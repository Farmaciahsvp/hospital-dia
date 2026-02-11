"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import {
  addErrorLog,
  clearErrorLogs,
  downloadErrorLogsTxt,
  getErrorLogs,
  getErrorLogUpdateEventName,
} from "@/lib/error-log";

function extractMessage(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return { message: reason.message || "Error", stack: reason.stack };
  }
  if (typeof reason === "string") return { message: reason };
  if (reason && typeof reason === "object") {
    try {
      return { message: JSON.stringify(reason) };
    } catch {
      return { message: "Error no serializable" };
    }
  }
  return { message: String(reason ?? "Error desconocido") };
}

export function ErrorLogPanel() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setCount(getErrorLogs().length);
    refresh();

    const onWindowError = (event: ErrorEvent) => {
      addErrorLog({
        source: "window.error",
        message: event.message || "Error de ejecución",
        stack: event.error instanceof Error ? event.error.stack : undefined,
        details: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
      refresh();
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const extracted = extractMessage(event.reason);
      addErrorLog({
        source: "window.unhandledrejection",
        message: extracted.message,
        stack: extracted.stack,
      });
      refresh();
    };

    const onUpdate = () => refresh();
    const updateEvent = getErrorLogUpdateEventName();

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener(updateEvent, onUpdate as EventListener);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener(updateEvent, onUpdate as EventListener);
    };
  }, []);

  const hasErrors = count > 0;
  const label = useMemo(() => `Errores: ${count}`, [count]);

  if (!hasErrors && !open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {!open ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 shadow-md hover:bg-amber-100"
          onClick={() => setOpen(true)}
          aria-label="Abrir panel de errores"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ) : (
        <div className="w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">{label}</div>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
          <div className="text-xs text-zinc-600">
            Descargue este log para soporte técnico si la app presenta fallos.
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100"
              onClick={() => downloadErrorLogsTxt()}
              disabled={!hasErrors}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
              onClick={() => {
                clearErrorLogs();
                setOpen(false);
              }}
              disabled={!hasErrors}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
