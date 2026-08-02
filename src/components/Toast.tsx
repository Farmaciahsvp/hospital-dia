"use client";

import { useEffect, useRef, useState } from "react";

export type ToastState = {
  kind: "success" | "error";
  message: string;
  /** Acción de reparación ofrecida junto al aviso, p. ej. deshacer un cambio de
   *  estado aplicado por error. Solo tiene sentido mientras el aviso está. */
  action?: { label: string; onAction: () => void | Promise<void> };
} | null;

/** Los aciertos se van solos; los errores no (ver comentario en el efecto). */
const SUCCESS_MS = 4000;
/** Con acción de deshacer el aviso dura más: es la única ventana para reparar
 *  un cambio de estado aplicado por error, y cuatro segundos no bastan para
 *  leerlo, decidir y llegar al botón. */
const SUCCESS_CON_ACCION_MS = 9000;

export function Toast({
  toast,
  onClear,
}: {
  toast: ToastState;
  onClear: () => void;
}) {
  // Las llamadas pasan `onClear` como arrow inline, así que cambia de identidad
  // en cada render del padre. Tenerlo en las dependencias del efecto reiniciaba
  // la cuenta atrás con cada render, de modo que la duración real del aviso era
  // impredecible. La ref lo desacopla.
  const onClearRef = useRef(onClear);
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  const [paused, setPaused] = useState(false);
  // Se guarda el mensaje copiado, no un booleano: así "Copiado" se reinicia
  // solo al cambiar de aviso, sin necesidad de un efecto que toque el estado.
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const isError = toast?.kind === "error";
  const copied = Boolean(toast) && copiedMessage === toast?.message;

  useEffect(() => {
    // Un error lleva el identificador que soporte necesita para rastrear el
    // fallo en el log del servidor. Descartarlo solo lo hacía ilegible antes de
    // poder copiarlo, así que ahora espera a que el usuario lo cierre.
    if (!toast || isError || paused) return;
    const t = setTimeout(
      () => onClearRef.current(),
      toast.action ? SUCCESS_CON_ACCION_MS : SUCCESS_MS,
    );
    return () => clearTimeout(t);
  }, [toast, isError, paused]);

  const cuerpo = toast ? (
    <div
      className={[
        "pointer-events-auto flex max-w-md items-start gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg",
        isError ? "bg-rose-700 text-white" : "bg-blue-600 text-white",
      ].join(" ")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span className="min-w-0 flex-1 break-words">{toast.message}</span>

      {toast.action ? (
        <button
          type="button"
          className="shrink-0 rounded border border-white/60 px-2 py-0.5 text-xs font-semibold hover:bg-white/20 focus-visible:outline-white"
          onClick={() => {
            void toast.action?.onAction();
            onClearRef.current();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}

      {isError ? (
        <button
          type="button"
          className="shrink-0 rounded border border-white/40 px-1.5 py-0.5 text-xs font-semibold hover:bg-white/15 focus-visible:outline-white"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(toast.message);
              setCopiedMessage(toast.message);
            } catch {
              // Sin permiso de portapapeles: el texto sigue visible y seleccionable.
            }
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      ) : null}

      <button
        type="button"
        className="shrink-0 rounded px-1 text-lg leading-none hover:bg-white/15 focus-visible:outline-white"
        onClick={() => onClearRef.current()}
        aria-label="Cerrar aviso"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  ) : null;

  // Dos regiones vivas permanentes en el DOM: cambiar `aria-live` sobre un mismo
  // nodo no se anuncia de forma fiable. El mensaje entra en la que corresponde.
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 print:hidden">
      <div role="status" aria-live="polite" className="contents">
        {isError ? null : cuerpo}
      </div>
      <div role="alert" aria-live="assertive" className="contents">
        {isError ? cuerpo : null}
      </div>
    </div>
  );
}
