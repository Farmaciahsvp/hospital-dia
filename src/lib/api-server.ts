import { NextResponse } from "next/server";

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonOk<T extends Record<string, unknown>>(requestId: string, body: T, init?: ResponseInit) {
  const res = NextResponse.json({ ...body, requestId }, init);
  res.headers.set("x-request-id", requestId);
  return res;
}

export function jsonError(requestId: string, message: string, init?: ResponseInit & { details?: unknown }) {
  const { details, ...rest } = init ?? {};
  const body: Record<string, unknown> = { error: message, requestId };
  if (details !== undefined) body.details = details;
  const res = NextResponse.json(body, { status: rest.status ?? 500, headers: rest.headers });
  res.headers.set("x-request-id", requestId);
  return res;
}

