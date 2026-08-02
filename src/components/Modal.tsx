"use client";

import { useEffect, useRef } from "react";

const FOCUSABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // `aria-modal` promete que el resto de la página queda fuera de alcance, pero
  // sin trampa de foco el tabulador salía del diálogo al contenido de detrás.
  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const primero = panel?.querySelector<HTMLElement>(FOCUSABLES);
    (primero ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
        (el) => el.offsetParent !== null,
      );
      if (!focusables.length) return;

      const primeroVisible = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement;

      if (e.shiftKey && (activo === primeroVisible || !panel.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primeroVisible.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Cerrar tiene que devolver el foco a donde estaba, no al principio de la
      // página: si no, el teclado pierde el sitio en una tabla de once filas.
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
        ? "max-w-4xl"
        : "max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      {/* El cierre colgaba de `onMouseDown` del contenedor entero: arrastrar
          desde dentro y soltar fuera cerraba el diálogo y se perdía lo escrito.
          Ahora solo cierra un clic completo sobre el fondo. */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${sizeClass} overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 hover:bg-blue-50 focus-visible:outline-blue-600"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer ? (
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
