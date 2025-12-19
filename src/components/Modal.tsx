"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
        ? "max-w-4xl"
        : "max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className={`relative w-full ${sizeClass} overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
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
