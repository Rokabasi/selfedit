"use client";

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spinner, cx } from "@/components/ui/primitives";
import { CHALLENGE_TYPES, LIVENESS_CHALLENGES, LIVENESS_CHALLENGE_COUNT, type ChallengeType } from "@/lib/constants";
import { drawToCanvas, toJpeg } from "@/lib/client/image";
import { useCamera } from "@/lib/client/use-camera";
import type { LivenessResult } from "@/lib/schemas";
import { CheckIcon } from "./document-scanner";

/* --------------------------------------------------------------------------
 * Preuve de vie active :
 *  1. Le visage doit être centré, unique, à bonne distance et neutre → selfie.
 *  2. N défis tirés au hasard parmi 5 (tête gauche/droite, clignement,
 *     sourire, bouche ouverte). Chaque défi doit être tenu plusieurs images.
 *  3. Retour obligatoire à une position neutre entre deux défis, ce qui
 *     déjoue les photos imprimées et la plupart des vidéos rejouées.
 * Détection 100 % locale (MediaPipe Face Landmarker, WASM) : aucune image
 * n'est envoyée à un tiers.
 * ------------------------------------------------------------------------ */

const HOLD_POSITION = 12;
const HOLD_CHALLENGE = 4;
const HOLD_NEUTRAL = 4;
const STAGE_TIMEOUT_MS = 25_000;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function loadLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
      runningMode: "VIDEO" as const,
      numFaces: 2,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      return await FaceLandmarker.createFromOptions(fileset, options("CPU"));
    }
  })().catch((err) => {
    landmarkerPromise = null; // autoriser une nouvelle tentative
    throw err;
  });
  return landmarkerPromise;
}

function pickChallenges(): ChallengeType[] {
  const pool = [...CHALLENGE_TYPES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, LIVENESS_CHALLENGE_COUNT);
}

/* ------------------------------ Analyse visage ----------------------------- */

type FaceMetrics = {
  count: number;
  cx: number;
  cy: number;
  width: number;
  box: { minX: number; minY: number; maxX: number; maxY: number };
  /** 0 = nez vers la droite de l'image, 1 = vers la gauche de l'image ; ~0.5 de face. */
  yaw: number;
  blink: number;
  smile: number;
  jaw: number;
};

function measure(res: FaceLandmarkerResult): FaceMetrics | { count: number } {
  const count = res.faceLandmarks.length;
  if (count !== 1) return { count };
  const lm = res.faceLandmarks[0]!;
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const nose = lm[1]!;
  const cheekA = lm[234]!;
  const cheekB = lm[454]!;
  const yaw = (nose.x - cheekA.x) / (cheekB.x - cheekA.x || 1e-6);
  const scores: Record<string, number> = {};
  for (const c of res.faceBlendshapes[0]?.categories ?? []) scores[c.categoryName] = c.score;
  const avg = (a: string, b: string) => ((scores[a] ?? 0) + (scores[b] ?? 0)) / 2;
  return {
    count,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    box: { minX, minY, maxX, maxY },
    yaw,
    blink: avg("eyeBlinkLeft", "eyeBlinkRight"),
    smile: avg("mouthSmileLeft", "mouthSmileRight"),
    jaw: scores.jawOpen ?? 0,
  };
}

const isNeutral = (f: FaceMetrics) => f.yaw > 0.36 && f.yaw < 0.64 && f.jaw < 0.25 && f.smile < 0.45 && f.blink < 0.45;

function challengeMet(type: ChallengeType, f: FaceMetrics): boolean {
  switch (type) {
    // Image non miroir : quand la personne tourne la tête vers SA gauche, le nez part vers la droite de l'image.
    case "TURN_LEFT":
      return f.yaw > 0.7;
    case "TURN_RIGHT":
      return f.yaw < 0.3;
    case "SMILE":
      return f.smile > 0.55;
    case "OPEN_MOUTH":
      return f.jaw > 0.4;
    case "BLINK":
      return false; // géré par une machine à états dédiée (fermé → ouvert)
  }
}

/* -------------------------------- Composant -------------------------------- */

type Phase = "intro" | "loading" | "running" | "guided" | "success" | "failed";
type Ui = { instruction: string; hint: string | null; faceOk: boolean; index: number; progress: number };

const INITIAL_UI: Ui = { instruction: "Placez votre visage dans l'ovale", hint: null, faceOk: false, index: -1, progress: 0 };

export function LivenessCheck({ value, onChange }: { value: LivenessResult | null; onChange: (v: LivenessResult | null) => void }) {
  const [phase, setPhase] = useState<Phase>(value ? "success" : "intro");
  const [failure, setFailure] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeType[]>([]);
  const [ui, setUi] = useState<Ui>(INITIAL_UI);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { videoRef, state: camera, restart } = useCamera("user", phase === "loading" || phase === "running" || phase === "guided");

  async function begin(mode: "auto" | "guided" = "auto") {
    onChange(null);
    setFailure(null);
    setUi(INITIAL_UI);
    setChallenges(pickChallenges());
    if (mode === "guided") {
      setPhase("guided");
      return;
    }
    setPhase("loading");
    try {
      landmarkerRef.current = await loadLandmarker();
      setPhase("running");
    } catch (err) {
      console.warn("[liveness] modèle indisponible, bascule en mode guidé", err);
      setPhase("guided");
    }
  }

  /* --------------------------- Boucle de détection -------------------------- */
  useEffect(() => {
    if (phase !== "running" || camera.status !== "ready") return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    const m = {
      stage: "position" as "position" | "challenge" | "neutral",
      index: 0,
      hold: 0,
      blinkClosed: false,
      startedAt: Date.now(),
      stageStartedAt: Date.now(),
      completed: [] as LivenessResult["challenges"],
      selfie: "",
    };
    let raf = 0;
    let lastTs = -1;
    let stopped = false;

    const push = (next: Ui) =>
      setUi((prev) =>
        prev.instruction === next.instruction && prev.hint === next.hint && prev.faceOk === next.faceOk && prev.index === next.index && Math.abs(prev.progress - next.progress) < 0.01
          ? prev
          : next,
      );
    const fail = (message: string) => {
      stopped = true;
      setFailure(message);
      setPhase("failed");
    };
    const setStage = (stage: typeof m.stage) => {
      m.stage = stage;
      m.hold = 0;
      m.blinkClosed = false;
      m.stageStartedAt = Date.now();
    };
    const total = challenges.length;
    const progressOf = (extra: number) => (m.completed.length + extra) / total;

    const captureSelfie = (f: FaceMetrics) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const size = Math.min(Math.max(f.width * vw * 1.9, 240), vw, vh);
      const sx = Math.min(Math.max(f.cx * vw - size / 2, 0), vw - size);
      const sy = Math.min(Math.max(f.cy * vh - size / 2, 0), vh - size);
      m.selfie = toJpeg(drawToCanvas(video, { sx, sy, sw: size, sh: size }, 720), 0.9);
    };

    const tick = (res: FaceLandmarkerResult) => {
      if (Date.now() - m.stageStartedAt > STAGE_TIMEOUT_MS) {
        fail(m.stage === "position" ? "Visage non détecté correctement dans le temps imparti." : "Le défi n'a pas été réalisé à temps.");
        return;
      }
      const f = measure(res);
      const current = challenges[m.index]!;

      if (!("yaw" in f)) {
        m.hold = 0;
        push({ ...INITIAL_UI, instruction: f.count === 0 ? "Placez votre visage dans l'ovale" : "Une seule personne doit être visible", index: m.stage === "position" ? -1 : m.index, progress: progressOf(0) });
        return;
      }

      const offCenter = Math.abs(f.cx - 0.5) > 0.14 || Math.abs(f.cy - 0.5) > 0.18;

      if (m.stage === "position") {
        let hint: string | null = null;
        if (f.width < 0.2) hint = "Rapprochez-vous";
        else if (f.width > 0.72) hint = "Éloignez-vous un peu";
        else if (offCenter) hint = "Centrez votre visage";
        else if (!isNeutral(f)) hint = "Regardez droit vers l'écran, expression neutre";
        m.hold = hint ? 0 : m.hold + 1;
        push({ instruction: hint ? "Placez votre visage dans l'ovale" : "Ne bougez plus…", hint, faceOk: !hint, index: -1, progress: 0 });
        if (m.hold >= HOLD_POSITION) {
          captureSelfie(f);
          setStage("challenge");
        }
        return;
      }

      // Pendant les défis, tolérance plus large sur le cadrage.
      if (Math.abs(f.cx - 0.5) > 0.3 || f.width < 0.14) {
        m.hold = 0;
        push({ instruction: "Restez dans le cadre", hint: null, faceOk: false, index: m.index, progress: progressOf(0) });
        return;
      }

      if (m.stage === "neutral") {
        m.hold = isNeutral(f) ? m.hold + 1 : 0;
        push({ instruction: "Revenez face à l'écran", hint: null, faceOk: true, index: m.index, progress: progressOf(0) });
        if (m.hold >= HOLD_NEUTRAL) setStage("challenge");
        return;
      }

      // stage === "challenge"
      let done = false;
      if (current === "BLINK") {
        if (f.blink > 0.5) m.blinkClosed = true;
        else if (m.blinkClosed && f.blink < 0.25) done = true;
      } else {
        m.hold = challengeMet(current, f) ? m.hold + 1 : 0;
        done = m.hold >= HOLD_CHALLENGE;
      }
      push({
        instruction: LIVENESS_CHALLENGES[current].label,
        hint: null,
        faceOk: true,
        index: m.index,
        progress: progressOf(current === "BLINK" ? (m.blinkClosed ? 0.5 : 0) : (m.hold / HOLD_CHALLENGE) * 0.9),
      });
      if (!done) return;

      m.completed.push({ type: current, completedAt: Date.now() });
      if (m.completed.length >= total) {
        stopped = true;
        onChangeRef.current({
          method: "face-mesh",
          selfie: m.selfie,
          challenges: m.completed,
          startedAt: m.startedAt,
          completedAt: Date.now(),
        });
        setPhase("success");
        return;
      }
      m.index += 1;
      setStage("neutral");
    };

    const loop = () => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || !video.videoWidth) return;
      const ts = performance.now();
      if (ts <= lastTs) return;
      lastTs = ts;
      try {
        tick(landmarker.detectForVideo(video, ts));
      } catch (err) {
        console.error("[liveness] détection", err);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, camera.status, challenges, videoRef]);

  /* --------------------------------- Rendu ---------------------------------- */

  if (phase === "intro") {
    return (
      <div className="animate-fade-up space-y-5">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-airtel-50">
          <FaceIcon className="h-16 w-16 text-airtel" />
        </div>
        <div className="space-y-2 text-center">
          <h3 className="text-xl font-extrabold">Vérifions que c&apos;est bien vous</h3>
          <p className="text-muted">
            Nous allons prendre un selfie puis vous demander de réaliser {LIVENESS_CHALLENGE_COUNT} mouvements choisis au hasard
            pour confirmer que vous êtes une personne réelle.
          </p>
        </div>
        <ul className="grid gap-2 text-sm font-semibold sm:grid-cols-3">
          <li className="rounded-2xl bg-white p-3 text-center">💡 Endroit bien éclairé</li>
          <li className="rounded-2xl bg-white p-3 text-center">🧢 Sans lunettes ni chapeau</li>
          <li className="rounded-2xl bg-white p-3 text-center">📱 Téléphone à hauteur du visage</li>
        </ul>
        <Button block onClick={() => void begin()}>Démarrer la vérification</Button>
      </div>
    );
  }

  if (phase === "success" && value) {
    return (
      <div className="animate-fade-up space-y-4 text-center">
        <div className="relative mx-auto w-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.selfie} alt="Votre selfie" className="aspect-square w-40 rounded-full object-cover ring-4 ring-success" style={{ transform: "scaleX(-1)" }} />
          <span className="animate-pop-in absolute -right-1 -bottom-1 flex h-11 w-11 items-center justify-center rounded-full bg-success text-white ring-4 ring-white">
            <CheckIcon className="h-6 w-6" />
          </span>
        </div>
        <div>
          <h3 className="text-xl font-extrabold">Vérification réussie</h3>
          <p className="text-sm text-muted">
            {value.method === "face-mesh" ? "Présence humaine confirmée par détection faciale." : "Vérification guidée enregistrée, elle sera contrôlée par un agent."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {value.challenges.map((c) => (
            <span key={c.type} className="inline-flex items-center gap-1 rounded-full bg-success-50 px-3 py-1 text-xs font-bold text-success">
              <CheckIcon className="h-3 w-3" /> {LIVENESS_CHALLENGES[c.type].short}
            </span>
          ))}
        </div>
        <Button variant="secondary" size="md" onClick={() => void begin()}>Recommencer</Button>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="animate-fade-up space-y-4">
        <Alert tone="error" title="La vérification n'a pas abouti">{failure}</Alert>
        <p className="text-sm text-muted">Placez-vous face à une source de lumière, tenez le téléphone à hauteur du visage et suivez les consignes affichées.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button block onClick={() => void begin()}>Réessayer avec de nouveaux défis</Button>
          <Button block variant="ghost" size="md" onClick={() => void begin("guided")}>Mode guidé</Button>
        </div>
      </div>
    );
  }

  const cameraError = camera.status === "error" ? camera.message : null;

  return (
    <div className="space-y-4">
      {cameraError && (
        <div className="space-y-2">
          <Alert tone="error" title="Caméra indisponible">{cameraError}</Alert>
          <Button size="md" variant="secondary" onClick={() => void restart()}>Réessayer</Button>
        </div>
      )}

      <div className="relative mx-auto aspect-3/4 w-full max-w-sm overflow-hidden rounded-card bg-ink">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          <path fillRule="evenodd" fill="rgb(0 0 0 / 0.6)" d="M0 0h300v400H0z M150 50 a105 140 0 1 0 0.01 0z" />
          <ellipse cx="150" cy="190" rx="105" ry="140" fill="none" strokeWidth="5" stroke={ui.faceOk ? "#0a8f4e" : "rgb(255 255 255 / 0.7)"} className="transition-[stroke]" />
          <ellipse
            cx="150" cy="190" rx="105" ry="140" fill="none" stroke="#e40000" strokeWidth="7" strokeLinecap="round"
            pathLength={100} strokeDasharray={`${ui.progress * 100} 100`} transform="rotate(-90 150 190)" className="transition-[stroke-dasharray] duration-300"
          />
        </svg>
        {(phase === "loading" || camera.status !== "ready") && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 text-white">
            <Spinner className="h-8 w-8" />
            <p className="text-sm font-bold">{phase === "loading" ? "Chargement de la détection faciale…" : "Démarrage de la caméra…"}</p>
          </div>
        )}
        {phase === "running" && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg" aria-live="assertive">
            <p className="text-base font-extrabold text-ink">{ui.instruction}</p>
            {ui.hint && <p className="text-sm font-semibold text-airtel">{ui.hint}</p>}
          </div>
        )}
      </div>

      {phase === "running" && (
        <ol className="flex flex-wrap justify-center gap-2">
          {challenges.map((c, i) => {
            const state = i < ui.index || (i === ui.index && ui.progress >= (i + 1) / challenges.length) ? "done" : i === ui.index ? "current" : "todo";
            return (
              <li
                key={c}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
                  state === "done" && "bg-success-50 text-success",
                  state === "current" && "bg-airtel text-white",
                  state === "todo" && "bg-white text-muted",
                )}
              >
                {state === "done" ? <CheckIcon className="h-3 w-3" /> : <span aria-hidden>{LIVENESS_CHALLENGES[c].icon}</span>}
                {LIVENESS_CHALLENGES[c].short}
              </li>
            );
          })}
        </ol>
      )}

      {phase === "guided" && camera.status === "ready" && (
        <GuidedLiveness
          video={videoRef.current}
          challenges={challenges}
          onDone={(result) => {
            onChange(result);
            setPhase("success");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Mode guidé --------------------------------- */

/** Repli quand la détection faciale ne peut pas être chargée (appareil ancien, réseau…). */
function GuidedLiveness({ video, challenges, onDone }: { video: HTMLVideoElement | null; challenges: ChallengeType[]; onDone: (r: LivenessResult) => void }) {
  const [selfie, setSelfie] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const startedAt = useRef(Date.now());
  const completed = useRef<LivenessResult["challenges"]>([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!selfie) return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    const type = challenges[index]!;
    if (!completed.current.some((c) => c.type === type)) completed.current.push({ type, completedAt: Date.now() });
    if (index + 1 >= challenges.length) {
      onDoneRef.current({ method: "guided", selfie, challenges: completed.current, startedAt: startedAt.current, completedAt: Date.now() });
    } else {
      setIndex((i) => i + 1);
      setCountdown(3);
    }
  }, [selfie, countdown, index, challenges]);

  function takeSelfie() {
    if (!video?.videoWidth) return;
    const size = Math.min(video.videoWidth, video.videoHeight) * 0.85;
    const crop = { sx: (video.videoWidth - size) / 2, sy: (video.videoHeight - size) / 2, sw: size, sh: size };
    startedAt.current = Date.now();
    setSelfie(toJpeg(drawToCanvas(video, crop, 720), 0.9));
  }

  if (!selfie) {
    return (
      <div className="space-y-3">
        <Alert tone="warning" title="Mode guidé">
          La détection automatique n&apos;est pas disponible sur cet appareil. Votre vérification sera contrôlée par un agent.
        </Alert>
        <Button block onClick={takeSelfie}>Prendre mon selfie</Button>
      </div>
    );
  }
  const current = challenges[index]!;
  return (
    <div className="rounded-2xl bg-white p-4 text-center" aria-live="assertive">
      <p className="text-sm font-bold text-muted">Mouvement {index + 1} / {challenges.length}</p>
      <p className="text-lg font-extrabold">{LIVENESS_CHALLENGES[current].label}</p>
      <p className="text-3xl font-black text-airtel">{countdown}</p>
    </div>
  );
}

function FaceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
      <path d="M8 20V12a4 4 0 0 1 4-4h8M44 8h8a4 4 0 0 1 4 4v8M56 44v8a4 4 0 0 1-4 4h-8M20 56h-8a4 4 0 0 1-4-4v-8" />
      <circle cx="24" cy="27" r="2" fill="currentColor" />
      <circle cx="40" cy="27" r="2" fill="currentColor" />
      <path d="M32 27v8h-3M24 42c4.5 4 11.5 4 16 0" />
    </svg>
  );
}
