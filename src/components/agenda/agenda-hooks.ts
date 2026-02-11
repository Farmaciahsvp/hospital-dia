"use client";

import { useEffect } from "react";

export function useAgendaGlobalShortcuts(params: {
  editId: string | null;
  onCancelEdit: () => void;
  onFocusNew: () => void;
  onPrint: () => void;
}) {
  const { editId, onCancelEdit, onFocusNew, onPrint } = params;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editId) onCancelEdit();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onFocusNew();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        onPrint();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editId, onCancelEdit, onFocusNew, onPrint]);
}

export function useWindowClickDismiss(onDismiss: () => void) {
  useEffect(() => {
    const onClick = () => onDismiss();
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [onDismiss]);
}
