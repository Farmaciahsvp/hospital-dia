"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Los datos institucionales se guardan en mayúsculas —el servidor normaliza
 * paciente, dosis, frecuencia y medicamento al escribir—, así que la entrada
 * las muestra así y lo visto coincide con lo almacenado.
 *
 * `caja="normal"` es para los campos que el servidor NO normaliza (hoy solo
 * Observaciones): ahí forzarlas en pantalla hacía divergir ambos, y una nota
 * en prosa se lee mejor en caja normal.
 *
 * Va como prop y no como clase suelta porque `cn` concatena sin resolver
 * conflictos: `uppercase` y `normal-case` juntas se deciden por el orden de la
 * hoja de estilos, no por el de los argumentos.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  caja?: "mayusculas" | "normal";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, caja = "mayusculas", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400",
        caja === "mayusculas" ? "uppercase" : "normal-case",
        "focus-visible:outline-blue-600 focus-visible:ring-2 focus-visible:ring-blue-200",
        className,
      )}
      {...props}
    />
  );
});
