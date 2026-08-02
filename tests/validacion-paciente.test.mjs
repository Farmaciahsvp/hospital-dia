import test from "node:test";
import assert from "node:assert/strict";

/**
 * Réplica de los validadores de src/lib/domain-rules.ts. La suite corre sobre
 * .mjs sin compilar, igual que el resto de pruebas de dominio.
 */
const MIN_DIGITOS = 8;
const MAX_DIGITOS = 12;
const CARACTERES = /^[0-9\s./-]+$/;
const CODIGO_MEDICAMENTO = /^\d-\d{2}-\d{2}-\d{4}$/;

function validarIdentificacion(raw) {
  const valor = String(raw ?? "").trim();
  if (!valor) return { ok: false, motivo: "Requerido" };
  if (CODIGO_MEDICAMENTO.test(valor)) {
    return { ok: false, motivo: "Parece un código de medicamento, no una identificación" };
  }
  if (!CARACTERES.test(valor)) {
    return { ok: false, motivo: "Solo se admiten números y los separadores - / . " };
  }
  const digitos = valor.replace(/\D/g, "").length;
  if (digitos < MIN_DIGITOS) return { ok: false, motivo: `Faltan dígitos (mínimo ${MIN_DIGITOS})` };
  if (digitos > MAX_DIGITOS) {
    return { ok: false, motivo: `Tiene ${digitos} dígitos (máximo ${MAX_DIGITOS}). ¿Se pegaron dos datos juntos?` };
  }
  return { ok: true };
}

function validarNombrePaciente(raw) {
  const valor = String(raw ?? "").trim();
  if (!valor) return { ok: false, motivo: "Requerido" };
  if (valor.length < 3) return { ok: false, motivo: "Demasiado corto" };
  if (/\d/.test(valor)) {
    return { ok: false, motivo: "No debe llevar números. ¿Se coló la identificación?" };
  }
  return { ok: true };
}

test("acepta los formatos de cédula que ya existen en producción", () => {
  for (const valido of [
    "112345678",      // 9 dígitos, el caso mayoritario
    "1-1234-5678",    // con guiones
    "0112345678",     // con cero inicial
    "71810110115",    // 11 dígitos
    "7/1810110115",   // con barra
    "17022375",       // 8 dígitos
    "1 1234 5678",    // con espacios
  ]) {
    assert.equal(validarIdentificacion(valido).ok, true, `rechazó "${valido}"`);
  }
});

test("rechaza el pegado doble que partió la ficha de un paciente", () => {
  // El valor real que había en producción: código de medicamento + cédula.
  const r = validarIdentificacion("1-10-41-4653 7 2690099149");
  assert.equal(r.ok, false);
  assert.match(r.motivo, /20 dígitos/);
});

test("rechaza un código institucional de medicamento suelto", () => {
  // Encaja en el rango de dígitos de una cédula, así que sin regla propia
  // pasaría la validación.
  const r = validarIdentificacion("1-10-41-4653");
  assert.equal(r.ok, false);
  assert.match(r.motivo, /código de medicamento/);
});

test("rechaza letras y caracteres que no son separadores de cédula", () => {
  assert.equal(validarIdentificacion("ABC123456").ok, false);
  assert.equal(validarIdentificacion("11234567X").ok, false);
  assert.equal(validarIdentificacion("112.345,678").ok, false);
});

test("rechaza cédulas demasiado cortas o vacías", () => {
  assert.equal(validarIdentificacion("1234567").ok, false);
  assert.equal(validarIdentificacion("").ok, false);
  assert.equal(validarIdentificacion("   ").ok, false);
  assert.equal(validarIdentificacion("---").ok, false);
});

test("acepta nombres reales, con acentos y eñe", () => {
  for (const valido of [
    "MARIA ROSALES GARCIA",
    "ROY ALEXANDER ROJAS ACUÑA",
    "JOSÉ LUIS SEVERINO GONZÁLEZ",
    "RICARDO A CHONG GARCIA",
  ]) {
    assert.equal(validarNombrePaciente(valido).ok, true, `rechazó "${valido}"`);
  }
});

test("rechaza un nombre con la cédula pegada detrás", () => {
  const r = validarNombrePaciente("ALICIA HERNANDEZ GONZALEZ 7 2690099149");
  assert.equal(r.ok, false);
  assert.match(r.motivo, /No debe llevar números/);
});

test("rechaza el cero tecleado en lugar de la O", () => {
  // "CHAC0N" estuvo catorce solicitudes en producción sin que nadie lo viera.
  assert.equal(validarNombrePaciente("DAMARIS MAYELA CHAC0N GUERRERO").ok, false);
});

test("rechaza nombres vacíos o de una letra", () => {
  assert.equal(validarNombrePaciente("").ok, false);
  assert.equal(validarNombrePaciente("A").ok, false);
  assert.equal(validarNombrePaciente(null).ok, false);
});
