import { IMAGE_KINDS, type ImageKind } from "@/lib/constants";
import { isValidMsisdn } from "@/lib/phone";
import { apiError } from "@/lib/server/http";
import { readImage } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ msisdn: string; kind: string }> }) {
  const { msisdn, kind } = await params;
  if (!isValidMsisdn(msisdn) || !IMAGE_KINDS.includes(kind as ImageKind)) {
    return apiError(400, "INVALID_REQUEST", "Requête invalide");
  }
  const image = await readImage(msisdn, kind as ImageKind).catch(() => null);
  if (!image) return apiError(404, "NOT_FOUND", "Image introuvable");

  return new Response(new Uint8Array(image.buffer), {
    headers: { "Content-Type": image.contentType, "Cache-Control": "private, no-store" },
  });
}
