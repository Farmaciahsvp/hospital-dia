"use client";

import { useId } from "react";

/**
 * Props que `Field` inyecta en el control. Se pasan por render-prop porque el
 * control puede ser `Input`, `Select` o un compuesto (input + botón), y cada
 * uno decide dónde aterrizan.
 */
export type FieldControlProps = {
  id: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * Envuelve etiqueta, control y error manteniendo los tres unidos por `id`.
 * Antes cada campo escribía su `<label>` suelto: se veía la etiqueta pero no
 * existía relación programática, así que un lector de pantalla anunciaba
 * "cuadro de edición" sin nombre y el clic en la etiqueta no enfocaba nada.
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-rose-600">
              {" *"}
            </span>
            {/* El asterisco es una convención visual; sin esto el lector de
                pantalla no distingue un campo obligatorio de uno opcional. */}
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : null}
      </label>
      {children({
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint ? (
        <div id={hintId} className="mt-1 text-xs text-zinc-500">
          {hint}
        </div>
      ) : null}
      {error ? (
        <div id={errorId} className="mt-1 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
