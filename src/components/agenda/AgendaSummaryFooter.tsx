"use client";

import type { ItemStatus } from "@/lib/status";

export function AgendaSummaryFooter(props: {
  counts: Record<ItemStatus, number>;
  lastUpdated: string | null;
}) {
  const { counts, lastUpdated } = props;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-zinc-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-700 md:justify-start">
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
