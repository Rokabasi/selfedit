import { NextResponse, type NextRequest } from "next/server";

/** Protection Basic Auth du back-office et de ses API. */
export function middleware(req: NextRequest) {
  const user = process.env.BACKOFFICE_USER ?? "admin";
  const pass = process.env.BACKOFFICE_PASSWORD ?? "airtel2026";
  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep > 0 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
        return NextResponse.next();
      }
    } catch {
      /* en-tête mal formé */
    }
  }

  return new NextResponse("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Airtel KYC Back-office", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/backoffice/:path*"] };
