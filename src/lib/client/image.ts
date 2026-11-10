import type { ScanMeta } from "@/lib/schemas";

/** Redimensionne une source (vidéo, image, canvas) sur un canvas, avec recadrage optionnel. */
export function drawToCanvas(
  source: CanvasImageSource,
  crop: { sx: number; sy: number; sw: number; sh: number },
  maxSide = 1600,
  mirror = false,
): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(crop.sw, crop.sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.sw * scale);
  canvas.height = Math.round(crop.sh * scale);
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export const toJpeg = (canvas: HTMLCanvasElement, quality = 0.85) => canvas.toDataURL("image/jpeg", quality);

export async function fileToCanvas(file: File, maxSide = 1600): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return drawToCanvas(bitmap, { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height }, maxSide);
  } finally {
    bitmap.close();
  }
}

/**
 * Analyse qualité légère, 100 % navigateur :
 *  - luminosité moyenne,
 *  - netteté = variance du Laplacien (flou ⇒ faible variance),
 *  - reflets = proportion de pixels saturés.
 */
export function analyzeQuality(canvas: HTMLCanvasElement, source: ScanMeta["source"]): ScanMeta {
  const w = 360;
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  let sum = 0;
  let saturated = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    gray[p] = v;
    sum += v;
    if (v > 248) saturated++;
  }
  const brightness = sum / gray.length;

  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - 1]! + gray[i + 1]! + gray[i - w]! + gray[i + w]! - 4 * gray[i]!;
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const mean = lapSum / n;
  const sharpness = lapSq / n - mean * mean;
  const glare = saturated / gray.length;

  return {
    source,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness),
    glare: Math.round(glare * 1000) / 1000,
    qualityOk: brightness > 55 && brightness < 225 && sharpness > 40 && glare < 0.08,
  };
}

export function qualityIssues(meta: ScanMeta): string[] {
  const issues: string[] = [];
  if (meta.brightness <= 55) issues.push("Image trop sombre");
  if (meta.brightness >= 225) issues.push("Image surexposée");
  if (meta.sharpness <= 40) issues.push("Image floue");
  if (meta.glare >= 0.08) issues.push("Reflets importants");
  return issues;
}
