import { NextResponse } from "next/server";

export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

export function apiError(status: number, code: string, message: string, fields?: Record<string, string>) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message, fields } }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
}
