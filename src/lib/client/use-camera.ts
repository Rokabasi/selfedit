"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "ready" }
  | { status: "error"; message: string };

function describeError(err: unknown): string {
  const name = (err as DOMException)?.name;
  if (!window.isSecureContext) return "La caméra nécessite une connexion sécurisée (HTTPS).";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Aucune caméra compatible n'a été trouvée sur cet appareil.";
    case "NotReadableError":
      return "La caméra est déjà utilisée par une autre application.";
    default:
      return "Impossible de démarrer la caméra.";
  }
}

/** Gère le cycle de vie d'un flux caméra attaché à un <video>. */
export function useCamera(facingMode: "user" | "environment", enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({ status: "idle" });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ status: "error", message: describeError(null) });
      return;
    }
    setState({ status: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: facingMode === "environment" ? 1920 : 1280 },
          height: { ideal: facingMode === "environment" ? 1080 : 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setState({ status: "ready" });
    } catch (err) {
      setState({ status: "error", message: describeError(err) });
    }
  }, [facingMode, stop]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return stop;
  }, [enabled, start, stop]);

  return { videoRef, state, restart: start, stop };
}
