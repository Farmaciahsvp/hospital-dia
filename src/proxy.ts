import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluateAccess, isAccessGateEnabled } from "@/lib/access-gate.mjs";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
} as const;

function applySecurityHeaders(response: NextResponse) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

function restrictedResponse(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const response = isApi
    ? NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 },
      )
    : new NextResponse("Acceso restringido", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });

  response.headers.set(
    "WWW-Authenticate",
    'Basic realm="Hospital Dia", charset="UTF-8"',
  );
  return applySecurityHeaders(response);
}

function misconfiguredResponse(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const response = isApi
    ? NextResponse.json(
        { error: "Servicio temporalmente no disponible" },
        { status: 503 },
      )
    : new NextResponse("Servicio temporalmente no disponible", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });

  return applySecurityHeaders(response);
}

export function proxy(request: NextRequest) {
  const enabled = isAccessGateEnabled({
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    mode: process.env.APP_ACCESS_GATE,
  });

  const decision = evaluateAccess({
    enabled,
    expectedUsername: process.env.APP_ACCESS_USER,
    expectedPassword: process.env.APP_ACCESS_PASSWORD,
    authorization: request.headers.get("authorization"),
  });

  if (decision === "misconfigured") return misconfiguredResponse(request);
  if (decision === "unauthorized") return restrictedResponse(request);

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
