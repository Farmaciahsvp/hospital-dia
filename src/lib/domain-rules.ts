export const MAX_APPLY_DATES = 16;
export const DUPLICATE_WINDOW_MS = 2000;

/**
 * Clave de comparación de una cédula: solo dígitos y sin ceros a la izquierda.
 *
 * La ficha de paciente se resolvía con `where: { identificacion }` sobre el
 * texto tal cual se teclea, así que la misma cifra escrita con separadores o
 * con un cero de más creaba una ficha nueva. En producción eso dejó a cinco
 * pacientes con el historial partido entre dos fichas.
 *
 * Se usa solo para *buscar* la ficha existente; lo que se guarda y se muestra
 * sigue siendo lo que escribió la persona, para no reescribir por detrás un
 * dato de identificación.
 */
export function claveIdentificacion(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
}
