"use client";

export type ErrorLogEntry = {
  timestamp: string;
  source: string;
  message: string;
  stack?: string;
  details?: string;
};

const STORAGE_KEY = "hospital-dia:error-log:v1";
const MAX_ENTRIES = 500;
const UPDATE_EVENT = "app-error-log-updated";

function safeParse(raw: string | null): ErrorLogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ErrorLogEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as ErrorLogEntry).timestamp === "string" &&
        typeof (e as ErrorLogEntry).source === "string" &&
        typeof (e as ErrorLogEntry).message === "string",
    );
  } catch {
    return [];
  }
}

function toEntry(input: {
  source: string;
  message: string;
  stack?: string;
  details?: string;
}): ErrorLogEntry {
  return {
    timestamp: new Date().toISOString(),
    source: input.source,
    message: input.message,
    stack: input.stack,
    details: input.details,
  };
}

function emitUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function getErrorLogs(): ErrorLogEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function addErrorLog(input: {
  source: string;
  message: string;
  stack?: string;
  details?: string;
}) {
  if (typeof window === "undefined") return;
  const logs = getErrorLogs();
  logs.push(toEntry(input));
  const trimmed = logs.slice(-MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  emitUpdate();
}

export function clearErrorLogs() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitUpdate();
}

function formatEntry(entry: ErrorLogEntry, idx: number) {
  const lines = [
    `#${idx + 1}`,
    `Fecha: ${entry.timestamp}`,
    `Origen: ${entry.source}`,
    `Mensaje: ${entry.message}`,
  ];
  if (entry.details) lines.push(`Detalles: ${entry.details}`);
  if (entry.stack) lines.push(`Stack: ${entry.stack}`);
  return lines.join("\n");
}

export function buildErrorLogText(entries: ErrorLogEntry[]) {
  if (!entries.length) return "No hay errores registrados.";
  const header = [
    "Hospital de Heredia - Log de errores",
    `Generado: ${new Date().toISOString()}`,
    `Cantidad: ${entries.length}`,
    "",
  ].join("\n");
  const body = entries.map((e, i) => formatEntry(e, i)).join("\n\n---\n\n");
  return `${header}${body}\n`;
}

export function downloadErrorLogsTxt(filename?: string) {
  if (typeof window === "undefined") return;
  const entries = getErrorLogs();
  const text = buildErrorLogText(entries);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = filename ?? `errores-app-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getErrorLogUpdateEventName() {
  return UPDATE_EVENT;
}
