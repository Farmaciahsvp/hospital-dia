// Decide qué se le cuenta al usuario cuando una ruta falla.
// Sin dependencias de Next para poder probarlo con `node --test`.

export const GENERIC_FAILURE =
  "Ocurrió un error inesperado. Intente de nuevo; si persiste, reporte el identificador a soporte.";

/** Texto del error para clasificarlo en el servidor. No enviarlo al cliente. */
export function errorMessage(error) {
  return error instanceof Error ? error.message : "Error";
}

/**
 * Traduce fallos de infraestructura conocidos a un mensaje accionable para
 * quien está usando la aplicación, sin nombrar proveedor, puertos ni archivos
 * de migración: esa pista es para el operador y va al log del servidor.
 *
 * @returns {{ message: string, status: number, hint: string } | null}
 */
export function classifyFailure(error) {
  const lower = errorMessage(error).toLowerCase();

  if (lower.includes("maxclientsinsessionmode") || lower.includes("max clients reached")) {
    return {
      message: "El sistema está temporalmente saturado. Espere unos segundos e intente de nuevo.",
      status: 503,
      hint: "Conexiones máximas alcanzadas en Supabase. Usa el pooler en modo transaction (puerto 6543) o aumenta el pool size.",
    };
  }

  if (lower.includes("column") && lower.includes("does not exist")) {
    return {
      message: "La base de datos no tiene el esquema esperado. Avise al administrador del sistema.",
      status: 500,
      hint: "Faltan migraciones SQL por aplicar en Supabase (supabase-migration-003/004/005).",
    };
  }

  return null;
}

/**
 * Respuesta que verá el usuario. Nunca incluye el texto del error original.
 *
 * @returns {{ message: string, status: number, hint: string | null }}
 */
export function userFacingFailure(error, fallbackMessage = GENERIC_FAILURE) {
  const known = classifyFailure(error);
  if (known) return { message: known.message, status: known.status, hint: known.hint };
  return { message: fallbackMessage, status: 500, hint: null };
}
