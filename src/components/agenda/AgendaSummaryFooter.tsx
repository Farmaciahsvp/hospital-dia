"use client";

import type { ItemStatus } from "@/lib/status";

export function AgendaSummaryFooter(props: {
  counts: Record<ItemStatus, number>;
  lastUpdated: string | null;
  /** Hay filtro de estado activo. El listado que llega ya viene recortado por el
   *  servidor, así que estos totales son los de la vista y no los del día: con
   *  el filtro "Listo" puesto se leía "Pendientes: 0" habiendo once pendientes. */
  filtrado?: boolean;
}) {
  const { counts, lastUpdated, filtrado } = props;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-zinc-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-zinc-700 md:justify-start">
          {filtrado ? (
            <span className="font-semibold text-amber-800">Solo en la vista filtrada —</span>
          ) : null}
          <span>Pendientes: {counts.pendiente}</span>
          <span>Listos: {counts.listo}</span>
          <span>Entregados: {counts.entregado}</span>
          <span>Cancelados: {counts.cancelado}</span>
        </div>
        <div className="text-center text-sm text-zinc-500 md:text-right">
          Última actualización: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-500 print:hidden">
        Atajos: Enter (guardar), Ctrl+N (nuevo), Ctrl+P (imprimir), Esc (cancelar edición).
      </div>
    </>
  );
}
