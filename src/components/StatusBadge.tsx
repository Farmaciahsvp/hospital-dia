"use client";

import { STATUS_LABEL, statusClassName, type ItemStatus } from "@/lib/status";

export function StatusBadge({
  value,
  onChange,
  editable,
  describedItem,
}: {
  value: ItemStatus;
  editable?: boolean;
  onChange?: (value: ItemStatus) => void;
  /** Paciente o registro al que pertenece el estado. Da nombre al control en un
   *  listado donde hay uno idéntico por fila. */
  describedItem?: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

  if (!editable || !onChange) {
    return <span className={`${base} ${statusClassName(value)}`}>{STATUS_LABEL[value]}</span>;
  }

  // El `<select>` ya muestra la opción seleccionada, así que el `<span>` que
  // llevaba al lado repetía la palabra: cada fila se leía "Pendiente Pendiente".
  // Ahora el select es el único texto y el rótulo accesible dice de quién es.
  // Se conserva la flecha nativa: es lo que anuncia que la píldora se puede
  // cambiar, y sin ella parecería una etiqueta de solo lectura.
  return (
    <select
      className={`${base} ${statusClassName(value)} cursor-pointer bg-transparent`}
      aria-label={describedItem ? `Estado de ${describedItem}` : "Estado del registro"}
      value={value}
      onChange={(e) => onChange(e.target.value as ItemStatus)}
    >
      <option value="pendiente">Pendiente</option>
      <option value="en_preparacion">En preparación</option>
      <option value="listo">Listo</option>
      <option value="entregado">Entregado</option>
      <option value="cancelado">Cancelado</option>
    </select>
  );
}

