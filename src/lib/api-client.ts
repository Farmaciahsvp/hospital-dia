export type ApiErrorPayload = {
  error?: string;
  details?: string;
  requestId?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

function shouldRetry(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    retries?: number;
    timeoutMs?: number;
    retryBaseDelayMs?: number;
  },
): Promise<T> {
  const retries = options?.retries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 15000;
  const retryBaseDelayMs = options?.retryBaseDelayMs ?? 350;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const body = (isJson ? await res.json().catch(() => ({})) : {}) as ApiErrorPayload & Record<string, unknown>;

      if (!res.ok) {
        const requestId = (body?.requestId as string | undefined) ?? res.headers.get("x-request-id") ?? undefined;
        const message = (body?.error as string | undefined) ?? `HTTP ${res.status}`;

        if (attempt < retries && shouldRetry(res.status)) {
          const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
          const jitter = Math.floor(Math.random() * 200);
          const backoff = retryAfterMs ?? retryBaseDelayMs * 2 ** attempt + jitter;
          await sleep(backoff);
          continue;
        }

        throw new Error(requestId ? `${message} (ID: ${requestId})` : message);
      }

      return body as unknown as T;
    } catch (e) {
      lastError = e;
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      const isNetwork = e instanceof TypeError;

      if (attempt < retries && (isAbort || isNetwork)) {
        const jitter = Math.floor(Math.random() * 200);
        const backoff = retryBaseDelayMs * 2 ** attempt + jitter;
        await sleep(backoff);
        continue;
      }

      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Error inesperado");
}

