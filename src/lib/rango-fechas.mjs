// Lógica pura del rango de fechas que comparten la tarjeta "Pacientes
// registrados" y su endpoint. Va en `.mjs` sin React ni Prisma para poder
// probarla con `node --test`, igual que `access-gate.mjs`.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaISO(valor) {
  return ISO_DATE.test(String(valor ?? ""));
}

/**
 * Un rango sirve para consultar solo si ambas fechas están completas y la final
 * no es anterior a la inicial. Comparar las cadenas ISO basta: son ordenables.
 */
export function esRangoValido(desde, hasta) {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return false;
  return String(desde) <= String(hasta);
}

/**
 * Las fechas de aplicación del registro que caen dentro del rango consultado.
 * El registro conserva siempre su lista completa —editarlo reescribe todas sus
 * fechas y perder las de fuera del rango borraría aplicaciones—; esto es solo
 * lo que explica por qué la fila aparece en la lista.
 */
export function fechasDentroDelRango(fechas, desde, hasta) {
  if (!Array.isArray(fechas)) return [];
  if (!esRangoValido(desde, hasta)) return [];
  return fechas.filter((f) => esFechaISO(f) && f >= desde && f <= hasta);
}
