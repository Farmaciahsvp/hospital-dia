import { NextResponse } from "next/server";
import { errorMessage, userFacingFailure } from "@/lib/api-errors.mjs";

export { errorMessage };

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonOk<T extends Record<string, unknown>>(requestId: string, body: T, init?: ResponseInit) {
  const res = NextResponse.json({ ...body, requestId }, init);
  res.headers.set("x-request-id", requestId);
  return res;
}

/**
 * Error con un mensaje redactado a propósito para el usuario.
 *
 * El cuerpo lleva solo `error` y `requestId`: el detalle técnico se queda en el
 * log del servidor. Los mensajes de Prisma incluyen rutas absolutas y
 * fragmentos del código fuente, y ningún consumidor del cliente los usa.
 */
export function jsonError(requestId: string, message: string, init?: ResponseInit) {
  const res = NextResponse.json(
    { error: message, requestId },
    { status: init?.status ?? 500, headers: init?.headers },
  );
  res.headers.set("x-request-id", requestId);
  return res;
}

export function logServerError(requestId: string, route: string, error: unknown) {
  console.error({ requestId, route, error });
}

/**
 * Punto único para los fallos no previstos de una ruta: registra el detalle
 * técnico en el servidor y devuelve al cliente un mensaje genérico con el
 * requestId, que es lo que necesita para reportar la incidencia.
 */
export function jsonFailure(
  requestId: string,
  route: string,
  error: unknown,
  fallbackMessage?: string,
) {
  const { message, status, hint } = userFacingFailure(error, fallbackMessage);
  logServerError(requestId, route, hint ? { hint, error } : error);

  return jsonError(requestId, message, { status });
}
