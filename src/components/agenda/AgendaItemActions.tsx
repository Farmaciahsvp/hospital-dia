"use client";

import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * El desplegable de fila era un `<div>` suelto: el disparador no declaraba
 * `aria-expanded`, las opciones no eran elementos de menú, el foco nunca
 * entraba y `Escape` no cerraba. Contiene "Cancelar…", que es destructiva.
 */
function RowMenu({
  open,
  onSetOpen,
  onDuplicate,
  onOpenObs,
  onOpenCancel,
}: {
  open: boolean;
  onSetOpen: (open: boolean) => void;
  onDuplicate: () => void;
  onOpenObs: () => void;
  onOpenCancel: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const cerrar = (devolverFoco = true) => {
    onSetOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const idx = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "Escape") {
      e.stopPropagation();
      cerrar();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      const siguiente = (idx + paso + items.length) % items.length;
      items[siguiente]?.focus();
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? items[0] : items[items.length - 1])?.focus();
      return;
    }
    if (e.key === "Tab") cerrar(false);
  };

  const itemClass = "block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 focus:bg-zinc-100";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs hover:bg-zinc-50"
        onClick={(e) => {
          e.stopPropagation();
          onSetOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            onSetOpen(true);
          }
        }}
        type="button"
        aria-label="Más acciones"
        title="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Más acciones"
          className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKeyDown}
        >
          <button role="menuitem" className={itemClass} type="button" onClick={onDuplicate}>
            Duplicar
          </button>
          <button role="menuitem" className={itemClass} type="button" onClick={onOpenObs}>
            Observaciones…
          </button>
          <button
            role="menuitem"
            className={`${itemClass} text-rose-700 hover:bg-rose-50 focus:bg-rose-100`}
            type="button"
            onClick={onOpenCancel}
          >
            Cancelar…
          </button>
        </div>
      ) : null}
    </div>
  );
}
type DesktopProps = {
  isEditing: boolean;
  menuOpen: boolean;
  onSetMenuOpen: (open: boolean) => void;
  onMarkListo: () => void;
  onMarkEntregado: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDuplicate: () => void;
  onOpenObs: () => void;
  onOpenCancel: () => void;
};

export function AgendaDesktopActions(props: DesktopProps) {
  const {
    isEditing,
    menuOpen,
    onSetMenuOpen,
    onMarkListo,
    onMarkEntregado,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDuplicate,
    onOpenObs,
    onOpenCancel,
  } = props;

  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs hover:bg-zinc-50"
        onClick={onMarkListo}
        type="button"
      >
        Listo
      </button>
      <button
        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs hover:bg-zinc-50"
        onClick={onMarkEntregado}
        type="button"
      >
        Entregado
      </button>
      {isEditing ? (
        <>
          <button
            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-500"
            onClick={onSaveEdit}
            type="button"
          >
            Guardar
          </button>
          <button
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs hover:bg-zinc-50"
            onClick={onCancelEdit}
            type="button"
            title="Atajo: Esc"
          >
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs hover:bg-zinc-50"
            onClick={onStartEdit}
            type="button"
          >
            Editar
          </button>
          <RowMenu
            open={menuOpen}
            onSetOpen={onSetMenuOpen}
            onDuplicate={onDuplicate}
            onOpenObs={onOpenObs}
            onOpenCancel={onOpenCancel}
          />
        </>
      )}
    </div>
  );
}

type MobileProps = {
  hasObservaciones: boolean;
  onMarkListo: () => void;
  onMarkEntregado: () => void;
  onOpenObs: () => void;
  onDuplicate: () => void;
  onOpenCancel: () => void;
};

export function AgendaMobileActions(props: MobileProps) {
  const { hasObservaciones, onMarkListo, onMarkEntregado, onOpenObs, onDuplicate, onOpenCancel } = props;

  return (
    <div className="mt-3 flex flex-wrap gap-2 print:hidden">
      <button
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
        onClick={onMarkListo}
        type="button"
      >
        Listo
      </button>
      <button
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
        onClick={onMarkEntregado}
        type="button"
      >
        Entregado
      </button>
      <button
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
        onClick={onOpenObs}
        type="button"
        disabled={!hasObservaciones}
      >
        Obs
      </button>
      <button
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
        onClick={onDuplicate}
        type="button"
      >
        Duplicar
      </button>
      <button
        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100"
        onClick={onOpenCancel}
        type="button"
      >
        Cancelar
      </button>
    </div>
  );
}
