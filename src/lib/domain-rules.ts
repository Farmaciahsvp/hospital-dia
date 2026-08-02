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

/** Mínimo y máximo de dígitos de una identificación. Las 197 fichas que hay en
 *  producción caen dentro de este rango salvo una, que resultó ser un error de
 *  pegado con 20 dígitos. */
export const MIN_DIGITOS_IDENTIFICACION = 8;
export const MAX_DIGITOS_IDENTIFICACION = 12;

/** Solo dígitos y los separadores que la gente usa al teclear una cédula. */
const IDENTIFICACION_CARACTERES = /^[0-9\s./-]+$/;

/** Forma de los códigos institucionales de medicamento: `1-10-41-4653`. Se
 *  comprueba aparte porque encaja en el rango de dígitos de una cédula y, si no,
 *  pasaría la validación. */
const CODIGO_MEDICAMENTO = /^\d-\d{2}-\d{2}-\d{4}$/;

export type ResultadoValidacion = { ok: true } | { ok: false; motivo: string };

/**
 * Valida una identificación de paciente.
 *
 * El campo aceptaba cualquier cosa, y en producción acabó guardando
 * `1-10-41-4653 7 2690099149`: el código institucional de TRASTUZUMAB pegado
 * delante de la cédula. Esa ficha quedó duplicada con 16 solicitudes en cada
 * mitad. Las reglas se fijaron contra los datos reales: de 197 fichas, ninguna
 * tiene letras ni caracteres extraños ni baja de 8 dígitos, y solo esa pasa de
 * 12. Así que no bloquean nada legítimo de lo ya registrado.
 */
export function validarIdentificacion(raw: string): ResultadoValidacion {
  const valor = String(raw ?? "").trim();
  if (!valor) return { ok: false, motivo: "Requerido" };

  if (CODIGO_MEDICAMENTO.test(valor)) {
    return { ok: false, motivo: "Parece un código de medicamento, no una identificación" };
  }
  if (!IDENTIFICACION_CARACTERES.test(valor)) {
    return { ok: false, motivo: "Solo se admiten números y los separadores - / . " };
  }

  const digitos = valor.replace(/\D/g, "").length;
  if (digitos < MIN_DIGITOS_IDENTIFICACION) {
    return { ok: false, motivo: `Faltan dígitos (mínimo ${MIN_DIGITOS_IDENTIFICACION})` };
  }
  if (digitos > MAX_DIGITOS_IDENTIFICACION) {
    return {
      ok: false,
      motivo: `Tiene ${digitos} dígitos (máximo ${MAX_DIGITOS_IDENTIFICACION}). ¿Se pegaron dos datos juntos?`,
    };
  }

  return { ok: true };
}

/**
 * Valida el nombre de un paciente.
 *
 * Un nombre no lleva cifras. En producción los tres nombres que las tenían eran
 * errores: dos con la cédula pegada detrás y uno con "CHAC0N" escrito con un
 * cero en lugar de la O, que llevaba catorce solicitudes sin que nadie lo viera.
 */
export function validarNombrePaciente(raw: string): ResultadoValidacion {
  const valor = String(raw ?? "").trim();
  if (!valor) return { ok: false, motivo: "Requerido" };
  if (valor.length < 3) return { ok: false, motivo: "Demasiado corto" };
  if (/\d/.test(valor)) {
    return { ok: false, motivo: "No debe llevar números. ¿Se coló la identificación?" };
  }
  return { ok: true };
}
