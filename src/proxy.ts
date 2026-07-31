import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluateAccess, isAccessGateEnabled } from "@/lib/access-gate.mjs";
import {
  hasPermission,
  isAppRole,
  permissionForApiRequest,
} from "@/lib/auth/permissions.mjs";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type AuthMode = "basic" | "hybrid" | "individual";

type AppProfile = {
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
};

const PUBLIC_INDIVIDUAL_PATHS = new Set([
  "/login",
  "/auth/callback",
]);

const VERIFIED_IDENTITY_HEADERS = [
  "x-app-user-id",
  "x-app-user-email",
  "x-app-user-name",
  "x-app-user-role",
  "x-app-must-change-password",
  "x-app-auth-mode",
];

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  Vary: "Authorization, Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
} as const;

function resolveAuthMode(): AuthMode | null {
  const value = process.env.APP_AUTH_MODE ?? "basic";
  return value === "basic" || value === "hybrid" || value === "individual"
    ? value
    : null;
}

function applySecurityHeaders(response: NextResponse) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

function basicRestrictedResponse(request: NextRequest) {
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

function unavailableResponse(request: NextRequest) {
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

function individualRequiredResponse(
  request: NextRequest,
  authResponse?: NextResponse,
) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: "Sesión individual requerida" },
      { status: 401 },
    );
    if (authResponse) copyCookies(authResponse, response);
    return applySecurityHeaders(response);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const response = NextResponse.redirect(loginUrl);
  if (authResponse) copyCookies(authResponse, response);
  return applySecurityHeaders(response);
}

function forbiddenResponse(
  request: NextRequest,
  authResponse: NextResponse,
  reason = "Cuenta sin autorización activa",
) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.json({ error: reason }, { status: 403 });
    copyCookies(authResponse, response);
    return applySecurityHeaders(response);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "error=not_authorized";
  const response = NextResponse.redirect(loginUrl);
  copyCookies(authResponse, response);
  return applySecurityHeaders(response);
}

function cleanRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  for (const name of VERIFIED_IDENTITY_HEADERS) {
    headers.delete(name);
  }
  return headers;
}

async function authenticateIndividual(
  request: NextRequest,
  requestHeaders: Headers,
) {
  const { url, key } = getSupabasePublicConfig();
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const subject = claimsData?.claims?.sub;

  if (claimsError || typeof subject !== "string" || !subject) {
    return { response, profile: null };
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("authUserId,email,displayName,role,active,mustChangePassword")
    .eq("authUserId", subject)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo validar el perfil autorizado: ${error.message}`);
  }

  return {
    response,
    profile: data as AppProfile | null,
  };
}

export async function proxy(request: NextRequest) {
  const mode = resolveAuthMode();
  if (!mode) return unavailableResponse(request);

  const requestHeaders = cleanRequestHeaders(request);

  if (request.nextUrl.pathname === "/robots.txt") {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  if (mode === "basic" || mode === "hybrid") {
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

    if (decision === "misconfigured") return unavailableResponse(request);
    if (decision === "unauthorized") return basicRestrictedResponse(request);

    if (mode === "basic") {
      requestHeaders.set("x-app-auth-mode", "basic");
      return applySecurityHeaders(
        NextResponse.next({ request: { headers: requestHeaders } }),
      );
    }
  }

  if (PUBLIC_INDIVIDUAL_PATHS.has(request.nextUrl.pathname)) {
    requestHeaders.set("x-app-auth-mode", mode);
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  try {
    const { response: authResponse, profile } =
      await authenticateIndividual(request, requestHeaders);

    if (!profile) return individualRequiredResponse(request, authResponse);
    if (!profile.active || !isAppRole(profile.role)) {
      return forbiddenResponse(request, authResponse);
    }

    const passwordChangeAllowed =
      request.nextUrl.pathname === "/cuenta" ||
      request.nextUrl.pathname === "/api/account/password" ||
      request.nextUrl.pathname === "/auth/signout";
    if (profile.mustChangePassword && !passwordChangeAllowed) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return forbiddenResponse(
          request,
          authResponse,
          "Debe cambiar la contraseña temporal antes de continuar",
        );
      }

      const accountUrl = request.nextUrl.clone();
      accountUrl.pathname = "/cuenta";
      accountUrl.search = "";
      const response = NextResponse.redirect(accountUrl);
      copyCookies(authResponse, response);
      return applySecurityHeaders(response);
    }

    if (request.nextUrl.pathname.startsWith("/api/")) {
      const permission = permissionForApiRequest(
        request.method,
        request.nextUrl.pathname,
      );
      if (!hasPermission(profile.role, permission)) {
        return forbiddenResponse(
          request,
          authResponse,
          "El rol asignado no permite esta operación",
        );
      }
    }

    requestHeaders.set("x-app-auth-mode", mode);
    requestHeaders.set("x-app-user-id", profile.authUserId);
    requestHeaders.set("x-app-user-email", profile.email);
    requestHeaders.set("x-app-user-name", profile.displayName);
    requestHeaders.set("x-app-user-role", profile.role);
    requestHeaders.set(
      "x-app-must-change-password",
      String(profile.mustChangePassword),
    );

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    copyCookies(authResponse, response);
    return applySecurityHeaders(response);
  } catch (error) {
    console.error("Individual authentication failed", error);
    return unavailableResponse(request);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
