"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spinner, cx } from "@/components/ui/primitives";
import { analyzeQuality, drawToCanvas, fileToCanvas, qualityIssues, toJpeg } from "@/lib/client/image";
import { useCamera } from "@/lib/client/use-camera";
import type { CapturedDocument, ScanMeta } from "@/lib/schemas";

type Props = {
  title: string;
  instructions: string;
  /** Ratio largeur/hauteur du cadre : 1.586 (format carte ID-1), 1.42 (passeport). */
  frameRatio: number;
  value: CapturedDocument | null;
  onChange: (doc: CapturedDocument | null) => void;
};

type Phase =
  | { kind: "camera" }
  | { kind: "scanning"; preview: string; dataUrl: string; meta: ScanMeta; stepIndex: number }
  | { kind: "review" };

const SCAN_STEPS = [
  "Détection des bords de la pièce",
  "Analyse de la netteté et de l'éclairage",
  "Lecture des zones de sécurité",
  "Authentification du document",
];

const STEP_MS = 650;

export function DocumentScanner({ title, instructions, frameRatio, value, onChange }: Props) {
  const [phase, setPhase] = useState<Phase>(value ? { kind: "review" } : { kind: "camera" });
  const cameraActive = phase.kind === "camera";
  const { videoRef, state: camera, restart } = useCamera("environment", cameraActive);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Valeur effacée depuis l'extérieur : retour à la caméra.
  useEffect(() => {
    if (phase.kind === "review" && !value) setPhase({ kind: "camera" });
  }, [phase.kind, value]);

  // Progression de l'animation d'authentification (tous les documents sont acceptés en démo).
  useEffect(() => {
    if (phase.kind !== "scanning") return;
    if (phase.stepIndex >= SCAN_STEPS.length) {
      onChangeRef.current({ dataUrl: phase.dataUrl, meta: phase.meta });
      setPhase({ kind: "review" });
      return;
    }
    const t = setTimeout(() => setPhase({ ...phase, stepIndex: phase.stepIndex + 1 }), STEP_MS);
    return () => clearTimeout(t);
  }, [phase]);

  function startScan(canvas: HTMLCanvasElement, source: ScanMeta["source"]) {
    const dataUrl = toJpeg(canvas, 0.88);
    setPhase({ kind: "scanning", preview: dataUrl, dataUrl, meta: analyzeQuality(canvas, source), stepIndex: 0 });
  }

  function captureFromCamera() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || !video.videoWidth) return;

    // Conversion du cadre affiché (object-cover) vers les coordonnées de la vidéo source.
    const vr = video.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const scale = Math.max(vr.width / video.videoWidth, vr.height / video.videoHeight);
    const offsetX = (vr.width - video.videoWidth * scale) / 2;
    const offsetY = (vr.height - video.videoHeight * scale) / 2;
    const margin = 0.04;
    const sx = (fr.left - vr.left - offsetX) / scale - (fr.width / scale) * margin;
    const sy = (fr.top - vr.top - offsetY) / scale - (fr.height / scale) * margin;
    const sw = (fr.width / scale) * (1 + 2 * margin);
    const sh = (fr.height / scale) * (1 + 2 * margin);
    const crop = {
      sx: Math.max(0, sx),
      sy: Math.max(0, sy),
      sw: Math.min(video.videoWidth - Math.max(0, sx), sw),
      sh: Math.min(video.videoHeight - Math.max(0, sy), sh),
    };
    startScan(drawToCanvas(video, crop, 1600), "camera");
  }

  async function onFile(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Veuillez choisir une image (JPG, PNG…).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("Image trop volumineuse (15 Mo maximum).");
      return;
    }
    try {
      startScan(await fileToCanvas(file, 1600), "upload");
    } catch {
      setUploadError("Impossible de lire cette image.");
    }
  }

  function retake() {
    onChange(null);
    setPhase({ kind: "camera" });
  }

  const hiddenFileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  /* ------------------------------- Rendu ---------------------------------- */

  if (phase.kind === "review" && value) {
    const issues = qualityIssues(value.meta);
    return (
      <section className="animate-fade-up space-y-4">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <div className="relative overflow-hidden rounded-card border border-line bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.dataUrl} alt={title} className="w-full rounded-xl object-contain" />
          <span className="animate-pop-in absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-extrabold text-white shadow">
            <CheckIcon className="h-3.5 w-3.5" /> Document authentifié
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <QualityChip ok={value.meta.sharpness > 40} label="Netteté" />
          <QualityChip ok={value.meta.brightness > 55 && value.meta.brightness < 225} label="Luminosité" />
          <QualityChip ok={value.meta.glare < 0.08} label="Reflets" />
        </div>
        {issues.length > 0 && (
          <Alert tone="warning" title="Qualité perfectible">
            {issues.join(" · ")}. Vous pouvez reprendre la photo pour accélérer la vérification.
          </Alert>
        )}
        <Button variant="secondary" size="md" onClick={retake}>
          Reprendre la photo
        </Button>
      </section>
    );
  }

  if (phase.kind === "scanning") {
    return (
      <section className="space-y-4" aria-live="polite">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <div className="relative overflow-hidden rounded-card bg-ink p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={phase.preview} alt="" className="w-full rounded-xl opacity-90" />
          <div className="animate-scan-line pointer-events-none absolute inset-x-2 h-1 rounded-full bg-airtel shadow-[0_0_24px_6px_rgb(228_0_0/0.7)]" />
        </div>
        <ol className="space-y-2">
          {SCAN_STEPS.map((label, i) => (
            <li key={label} className={cx("flex items-center gap-3 text-sm font-semibold", i > phase.stepIndex && "text-muted/60")}>
              {i < phase.stepIndex ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white"><CheckIcon className="h-3.5 w-3.5" /></span>
              ) : i === phase.stepIndex ? (
                <span className="flex h-6 w-6 items-center justify-center text-airtel"><Spinner className="h-5 w-5" /></span>
              ) : (
                <span className="h-6 w-6 rounded-full border-2 border-line" />
              )}
              {label}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-extrabold">{title}</h3>
        <p className="text-sm text-muted">{instructions}</p>
      </div>

      {camera.status === "error" ? (
        <div className="space-y-3">
          <Alert tone="error" title="Caméra indisponible">{camera.message}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button size="md" variant="secondary" onClick={() => void restart()}>Réessayer</Button>
            <Button size="md" onClick={() => fileRef.current?.click()}>Prendre / importer une photo</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative aspect-3/4 overflow-hidden rounded-card bg-ink sm:aspect-4/3">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center p-[7%]">
              <div
                ref={frameRef}
                className="relative w-full rounded-2xl border-2 border-white/80"
                style={{ aspectRatio: String(frameRatio), boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }}
              >
                {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"] as const).map((c) => (
                  <span key={c} className={cx("absolute -m-0.5 h-8 w-8 border-airtel", c)} />
                ))}
                {camera.status === "ready" && (
                  <div className="animate-scan-line pointer-events-none absolute inset-x-3 h-0.5 rounded-full bg-airtel/80 shadow-[0_0_16px_4px_rgb(228_0_0/0.5)]" />
                )}
              </div>
            </div>
            <p className="absolute inset-x-0 bottom-3 text-center text-sm font-bold text-white drop-shadow">
              {camera.status === "ready" ? "Alignez la pièce dans le cadre" : "Démarrage de la caméra…"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button block onClick={captureFromCamera} disabled={camera.status !== "ready"}>
              <ScanIcon className="h-5 w-5" /> Scanner la pièce
            </Button>
            <Button block variant="ghost" size="md" onClick={() => fileRef.current?.click()}>
              Importer une photo
            </Button>
          </div>
          <ul className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-muted">
            <li className="rounded-xl bg-white p-2">Pièce à plat</li>
            <li className="rounded-xl bg-white p-2">Bonne lumière, sans reflet</li>
            <li className="rounded-xl bg-white p-2">4 coins visibles</li>
          </ul>
        </>
      )}
      {uploadError && <Alert tone="error">{uploadError}</Alert>}
      {hiddenFileInput}
    </section>
  );
}

function QualityChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-3 py-1", ok ? "bg-success-50 text-success" : "bg-warning-50 text-warning")}>
      {ok ? <CheckIcon className="h-3 w-3" /> : "!"} {label}
    </span>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" />
    </svg>
  );
}
