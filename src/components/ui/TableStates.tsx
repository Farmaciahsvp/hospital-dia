"use client";

/**
 * Estados de carga y de vacío para las tablas.
 *
 * Antes cada pantalla los resolvía a su manera: "CARGANDO..." como texto gris
 * pequeño alineado a la derecha, lejos del área que iba a cambiar, sin reservar
 * espacio —así que el contenido saltaba al llegar— y con el mensaje de vacío
 * escrito unas veces en versalitas ("SIN REGISTROS") y otras en frase ("Sin
 * pacientes para esta fecha/filtros."), a veces en la misma pantalla.
 */

/** Barra gris que ocupa el sitio de un dato mientras llega. */
function Hueco({ ancho }: { ancho: string }) {
  return (
    <span
      className="inline-block h-3 animate-pulse rounded bg-zinc-200 align-middle"
      style={{ width: ancho }}
    />
  );
}

// Anchos irregulares y estables por posición: un esqueleto con todas las barras
// iguales se lee como una tabla ya cargada y vacía.
const ANCHOS = ["70%", "45%", "85%", "55%", "65%", "40%", "75%", "50%"];

export function FilasCargando({
  columnas,
  filas = 4,
  etiqueta = "Cargando…",
}: {
  columnas: number;
  filas?: number;
  etiqueta?: string;
}) {
  return (
    <>
      {/* El esqueleto es decorativo; quien no ve la pantalla necesita que se lo
          digan una sola vez, no una barra por celda. */}
      <tr>
        <td colSpan={columnas} className="p-0">
          <span role="status" className="sr-only">
            {etiqueta}
          </span>
        </td>
      </tr>
      {Array.from({ length: filas }).map((_, f) => (
        <tr key={f} className="border-b border-zinc-100" aria-hidden="true">
          {Array.from({ length: columnas }).map((__, c) => (
            <td key={c} className="px-3 py-3 text-center">
              <Hueco ancho={ANCHOS[(f + c) % ANCHOS.length]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function FilaVacia({
  columnas,
  mensaje,
  detalle,
}: {
  columnas: number;
  mensaje: string;
  detalle?: string;
}) {
  return (
    <tr>
      <td colSpan={columnas} className="px-3 py-12 text-center">
        <p className="text-sm font-medium text-zinc-600">{mensaje}</p>
        {detalle ? <p className="mt-1 text-xs text-zinc-500">{detalle}</p> : null}
      </td>
    </tr>
  );
}

/** Indicador de carga para lo que no es una tabla. */
export function Cargando({ etiqueta = "Cargando…" }: { etiqueta?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-zinc-600">
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"
      />
      {etiqueta}
    </span>
  );
}
