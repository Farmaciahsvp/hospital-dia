"use client";

import { STATUS_LABEL, statusClassName, type ItemStatus } from "@/lib/status";

export function StatusBadge({
  value,
  onChange,
  editable,
}: {
  value: ItemStatus;
  editable?: boolean;
  onChange?: (value: ItemStatus) => void;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

  if (!editable || !onChange) {
    return <span className={`${base} ${statusClassName(value)}`}>{STATUS_LABEL[value]}</span>;
  }

  return (
    <label className={`${base} ${statusClassName(value)} cursor-pointer`}>
      <span>{STATUS_LABEL[value]}</span>
      <select
        className="bg-transparent text-xs outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as ItemStatus)}
      >
        <option value="pendiente">Pendiente</option>
        <option value="en_preparacion">En preparación</option>
        <option value="listo">Listo</option>
        <option value="entregado">Entregado</option>
        <option value="cancelado">Cancelado</option>
      </select>
    </label>
  );
}

