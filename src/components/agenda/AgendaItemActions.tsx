"use client";

import { MoreHorizontal } from "lucide-react";
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
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
        onClick={onMarkListo}
        type="button"
      >
        Listo
      </button>
      <button
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
        onClick={onMarkEntregado}
        type="button"
      >
        Entregado
      </button>
      {isEditing ? (
        <>
          <button
            className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
            onClick={onSaveEdit}
            type="button"
          >
            Guardar
          </button>
          <button
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
            onClick={onCancelEdit}
            type="button"
          >
            Esc
          </button>
        </>
      ) : (
        <>
          <button
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
            onClick={onStartEdit}
            type="button"
          >
            Editar
          </button>
          <div className="relative">
            <button
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
              onClick={(e) => {
                e.stopPropagation();
                onSetMenuOpen(!menuOpen);
              }}
              type="button"
              aria-label="Más acciones"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  type="button"
                  onClick={onDuplicate}
                >
                  Duplicar
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  type="button"
                  onClick={onOpenObs}
                >
                  Observaciones…
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                  type="button"
                  onClick={onOpenCancel}
                >
                  Cancelar…
                </button>
              </div>
            ) : null}
          </div>
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
