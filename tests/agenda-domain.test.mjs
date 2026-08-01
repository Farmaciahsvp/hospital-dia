import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonthsUtc,
  buildConsolidatedByMedication,
  buildPatientsOfDay,
  buildStatusCounts,
  formatDMY,
  isoToUtcDate,
  normalizeNumeroReceta,
  parseDateInputToISO,
  parseFrequencyStep,
  personLabel,
  toExportRows,
  toMonthInputValue,
} from "../src/components/agenda/agenda-domain.mjs";

function item(overrides = {}) {
  return {
    id: "i1",
    fechaAplicacion: "2026-08-01",
    estado: "pendiente",
    identificacion: "1-1111-1111",
    nombre: "ANA",
    medicamento: "PACLITAXEL",
    dosisTexto: "100 MG",
    unidadesRequeridas: 1,
    observaciones: null,
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

// --- normalizeNumeroReceta -------------------------------------------------
// Regresión: la versión anterior usaba /\\D/ (doblemente escapada) y no
// limpiaba nada, de modo que "AB12" terminaba guardándose como "00AB12".

test("normalizeNumeroReceta descarta todo lo que no sea dígito", () => {
  assert.equal(normalizeNumeroReceta("AB12"), "12");
  assert.equal(normalizeNumeroReceta("12-34/56"), "123456");
  assert.equal(normalizeNumeroReceta("  007  "), "007");
});

test("normalizeNumeroReceta recorta a seis dígitos", () => {
  assert.equal(normalizeNumeroReceta("1234567890"), "123456");
});

test("normalizeNumeroReceta con pad rellena con ceros a la izquierda", () => {
  assert.equal(normalizeNumeroReceta("12", { pad: true }), "000012");
  assert.equal(normalizeNumeroReceta("AB12", { pad: true }), "000012");
  assert.equal(normalizeNumeroReceta("123456", { pad: true }), "123456");
});

test("normalizeNumeroReceta deja vacío lo que no tiene dígitos", () => {
  assert.equal(normalizeNumeroReceta(""), "");
  assert.equal(normalizeNumeroReceta("SIN NUMERO"), "");
  assert.equal(normalizeNumeroReceta("SIN NUMERO", { pad: true }), "");
  assert.equal(normalizeNumeroReceta(null), "");
  assert.equal(normalizeNumeroReceta(undefined), "");
});

// --- parseFrequencyStep ----------------------------------------------------

test("parseFrequencyStep interpreta la forma 'CADA N <unidad>'", () => {
  assert.deepEqual(parseFrequencyStep("CADA 21 DIAS"), { kind: "days", value: 21 });
  assert.deepEqual(parseFrequencyStep("CADA 1 DIA"), { kind: "days", value: 1 });
  assert.deepEqual(parseFrequencyStep("CADA 2 SEMANAS"), { kind: "days", value: 14 });
  assert.deepEqual(parseFrequencyStep("CADA 3 MESES"), { kind: "months", value: 3 });
});

test("parseFrequencyStep interpreta los adverbios de periodicidad", () => {
  assert.deepEqual(parseFrequencyStep("DIARIO"), { kind: "days", value: 1 });
  assert.deepEqual(parseFrequencyStep("SEMANAL"), { kind: "days", value: 7 });
  assert.deepEqual(parseFrequencyStep("QUINCENAL"), { kind: "days", value: 15 });
  assert.deepEqual(parseFrequencyStep("MENSUAL"), { kind: "months", value: 1 });
  assert.deepEqual(parseFrequencyStep("BIMENSUAL"), { kind: "months", value: 2 });
  assert.deepEqual(parseFrequencyStep("TRIMESTRAL"), { kind: "months", value: 3 });
  assert.deepEqual(parseFrequencyStep("ANUAL"), { kind: "months", value: 12 });
});

test("parseFrequencyStep ignora mayúsculas, tildes y espacios sobrantes", () => {
  assert.deepEqual(parseFrequencyStep("  cada   21   dias  "), { kind: "days", value: 21 });
  assert.deepEqual(parseFrequencyStep("Mensual"), { kind: "months", value: 1 });
  assert.deepEqual(parseFrequencyStep("cada 2 días"), { kind: "days", value: 2 });
});

test("parseFrequencyStep rechaza las pautas horarias: no generan fechas", () => {
  // "CADA 8H" es una pauta intradía; programar fechas a partir de ella no
  // tiene sentido, así que debe devolver null y no un paso de 8 días.
  assert.equal(parseFrequencyStep("CADA 8H"), null);
  assert.equal(parseFrequencyStep("CADA 12 HORAS"), null);
  assert.equal(parseFrequencyStep("CADA 6 HRS"), null);
});

test("parseFrequencyStep devuelve null ante entradas vacías o no reconocidas", () => {
  assert.equal(parseFrequencyStep(""), null);
  assert.equal(parseFrequencyStep("   "), null);
  assert.equal(parseFrequencyStep(null), null);
  assert.equal(parseFrequencyStep(undefined), null);
  assert.equal(parseFrequencyStep("SEGUN INDICACION MEDICA"), null);
  assert.equal(parseFrequencyStep("CADA 0 DIAS"), null);
});

// --- parseDateInputToISO ---------------------------------------------------

test("parseDateInputToISO acepta el formato dd/mm/aaaa que usa la agenda", () => {
  assert.equal(parseDateInputToISO("01/08/2026"), "2026-08-01");
  assert.equal(parseDateInputToISO("1/8/2026"), "2026-08-01");
  assert.equal(parseDateInputToISO("01-08-2026"), "2026-08-01");
  assert.equal(parseDateInputToISO("01.08.2026"), "2026-08-01");
});

test("parseDateInputToISO acepta ISO y ocho dígitos seguidos", () => {
  assert.equal(parseDateInputToISO("2026-08-01"), "2026-08-01");
  assert.equal(parseDateInputToISO("20260801"), "2026-08-01");
  assert.equal(parseDateInputToISO("01082026"), "2026-08-01");
});

test("parseDateInputToISO rechaza fechas de calendario imposibles", () => {
  assert.equal(parseDateInputToISO("31/02/2026"), null);
  assert.equal(parseDateInputToISO("29/02/2025"), null, "2025 no es bisiesto");
  assert.equal(parseDateInputToISO("00/08/2026"), null);
  assert.equal(parseDateInputToISO("01/13/2026"), null);
});

test("parseDateInputToISO acepta el 29 de febrero en año bisiesto", () => {
  assert.equal(parseDateInputToISO("29/02/2024"), "2024-02-29");
});

test("parseDateInputToISO acota el año al rango 1900-2100", () => {
  assert.equal(parseDateInputToISO("01/08/1899"), null);
  assert.equal(parseDateInputToISO("01/08/2101"), null);
});

test("parseDateInputToISO devuelve null con entrada vacía o basura", () => {
  assert.equal(parseDateInputToISO(""), null);
  assert.equal(parseDateInputToISO("   "), null);
  assert.equal(parseDateInputToISO("mañana"), null);
  assert.equal(parseDateInputToISO("1/8/26"), null, "año de 2 dígitos es ambiguo");
});

// --- aritmética de fechas UTC ---------------------------------------------

test("isoToUtcDate ancla la fecha a medianoche UTC, sin desfase por zona", () => {
  const d = isoToUtcDate("2026-08-01");
  assert.equal(d.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(d.getUTCDate(), 1);
});

test("addMonthsUtc avanza meses conservando el día", () => {
  const base = isoToUtcDate("2026-01-15");
  assert.equal(addMonthsUtc(base, 1).toISOString().slice(0, 10), "2026-02-15");
  assert.equal(addMonthsUtc(base, 12).toISOString().slice(0, 10), "2027-01-15");
});

test("addMonthsUtc desborda al mes siguiente cuando el día no existe", () => {
  // 31 de enero + 1 mes no es un día válido de febrero: Date normaliza a marzo.
  // Se fija el comportamiento actual para que un cambio futuro sea deliberado.
  const base = isoToUtcDate("2026-01-31");
  assert.equal(addMonthsUtc(base, 1).toISOString().slice(0, 10), "2026-03-03");
});

test("addMonthsUtc retrocede con valores negativos", () => {
  const base = isoToUtcDate("2026-03-15");
  assert.equal(addMonthsUtc(base, -3).toISOString().slice(0, 10), "2025-12-15");
});

test("la programación por frecuencia encadena isoToUtcDate y addMonthsUtc", () => {
  // Reproduce el cálculo de "Sugerir según frecuencia" para 4 ciclos mensuales.
  const step = parseFrequencyStep("MENSUAL");
  let current = isoToUtcDate("2026-08-01");
  const fechas = [];
  for (let i = 0; i < 4; i++) {
    fechas.push(current.toISOString().slice(0, 10));
    current = addMonthsUtc(current, step.value);
  }
  assert.deepEqual(fechas, ["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"]);
});

test("la programación por días suma intervalos exactos de 24 h", () => {
  const step = parseFrequencyStep("CADA 21 DIAS");
  let current = isoToUtcDate("2026-08-01");
  const fechas = [];
  for (let i = 0; i < 3; i++) {
    fechas.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + step.value * 24 * 60 * 60 * 1000);
  }
  assert.deepEqual(fechas, ["2026-08-01", "2026-08-22", "2026-09-12"]);
});

// --- formato y etiquetas ---------------------------------------------------

test("formatDMY convierte ISO a dd/mm/aaaa con relleno", () => {
  assert.equal(formatDMY("2026-08-01"), "01/08/2026");
  assert.equal(formatDMY("2026-8-1"), "01/08/2026");
});

test("formatDMY devuelve la entrada intacta si no es una fecha ISO", () => {
  assert.equal(formatDMY(""), "");
  assert.equal(formatDMY("2026-08"), "2026-08");
});

test("toMonthInputValue produce el valor de un <input type=month>", () => {
  assert.equal(toMonthInputValue(new Date(2026, 0, 15)), "2026-01");
  assert.equal(toMonthInputValue(new Date(2026, 11, 1)), "2026-12");
});

test("personLabel une código, nombres y apellidos", () => {
  assert.equal(
    personLabel({ codigo: "F12", nombres: "ANA", apellidos: "SOTO" }),
    "F12 - ANA SOTO",
  );
});

// --- agregaciones que alimentan la agenda y los PDF ------------------------

test("buildStatusCounts cuenta los cinco estados y deja el resto en cero", () => {
  const counts = buildStatusCounts([
    item({ estado: "pendiente" }),
    item({ estado: "pendiente" }),
    item({ estado: "entregado" }),
    item({ estado: "cancelado" }),
  ]);
  assert.deepEqual(counts, {
    pendiente: 2,
    en_preparacion: 0,
    listo: 0,
    entregado: 1,
    cancelado: 1,
  });
});

test("buildStatusCounts sobre una lista vacía devuelve todo en cero", () => {
  assert.deepEqual(buildStatusCounts([]), {
    pendiente: 0,
    en_preparacion: 0,
    listo: 0,
    entregado: 0,
    cancelado: 0,
  });
});

test("buildConsolidatedByMedication suma unidades y líneas por medicamento", () => {
  const filas = buildConsolidatedByMedication([
    item({ medicamento: "PACLITAXEL", unidadesRequeridas: 2 }),
    item({ medicamento: "PACLITAXEL", unidadesRequeridas: 3 }),
    item({ medicamento: "CARBOPLATINO", unidadesRequeridas: 1 }),
  ]);
  assert.deepEqual(filas, [
    { medicamento: "CARBOPLATINO", unidades: 1, lineas: 1 },
    { medicamento: "PACLITAXEL", unidades: 5, lineas: 2 },
  ]);
});

test("buildConsolidatedByMedication ordena alfabéticamente el consolidado", () => {
  const filas = buildConsolidatedByMedication([
    item({ medicamento: "ZOLEDRONICO" }),
    item({ medicamento: "ATEZOLIZUMAB" }),
    item({ medicamento: "METOTREXATO" }),
  ]);
  assert.deepEqual(
    filas.map((f) => f.medicamento),
    ["ATEZOLIZUMAB", "METOTREXATO", "ZOLEDRONICO"],
  );
});

test("buildPatientsOfDay agrupa por paciente y cuenta sus líneas", () => {
  const filas = buildPatientsOfDay([
    item({ id: "a", patientId: "p1", prepRequestId: "r1", identificacion: "2-2222-2222" }),
    item({ id: "b", patientId: "p1", prepRequestId: "r1", identificacion: "2-2222-2222" }),
    item({ id: "c", patientId: "p2", prepRequestId: "r2", identificacion: "1-1111-1111" }),
  ]);
  assert.equal(filas.length, 2);
  assert.deepEqual(
    filas.map((f) => [f.identificacion, f.itemsCount]),
    [
      ["1-1111-1111", 1],
      ["2-2222-2222", 2],
    ],
    "ordenado por identificación",
  );
});

test("buildPatientsOfDay descarta líneas sin paciente o sin solicitud", () => {
  const filas = buildPatientsOfDay([
    item({ id: "a", patientId: undefined, prepRequestId: "r1" }),
    item({ id: "b", patientId: "p1", prepRequestId: undefined }),
    item({ id: "c", patientId: "p2", prepRequestId: "r2" }),
  ]);
  assert.deepEqual(
    filas.map((f) => f.patientId),
    ["p2"],
  );
});

test("buildPatientsOfDay normaliza el nombre ausente a cadena vacía", () => {
  const [fila] = buildPatientsOfDay([
    item({ patientId: "p1", prepRequestId: "r1", nombre: null }),
  ]);
  assert.equal(fila.nombre, "");
});

test("toExportRows proyecta las columnas del PDF renombrando dosis y unidades", () => {
  assert.deepEqual(
    toExportRows([
      item({ dosisTexto: "100 MG", unidadesRequeridas: 2, observaciones: "AYUNAS" }),
    ]),
    [
      {
        fechaAplicacion: "2026-08-01",
        identificacion: "1-1111-1111",
        nombre: "ANA",
        medicamento: "PACLITAXEL",
        dosis: "100 MG",
        unidades: 2,
        estado: "pendiente",
        observaciones: "AYUNAS",
      },
    ],
  );
});

test("toExportRows sobre una lista vacía devuelve una lista vacía", () => {
  assert.deepEqual(toExportRows([]), []);
});
