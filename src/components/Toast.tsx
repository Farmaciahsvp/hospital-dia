"use client";

import { useEffect } from "react";

export type ToastState = { kind: "success" | "error"; message: string } | null;

export function Toast({
  toast,
  onClear,
}: {
  toast: ToastState;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClear, 2500);
    return () => clearTimeout(t);
  }, [toast, onClear]);

  if (!toast) return null;
  const className =
    toast.kind === "success"
      ? "bg-blue-600 text-white"
      : "bg-rose-600 text-white";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`rounded-lg px-4 py-2 text-sm shadow-lg ${className}`}>
        {toast.message}
      </div>
    </div>
  );
}
