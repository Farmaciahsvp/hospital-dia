import assert from "node:assert/strict";
import test from "node:test";
import {
  esFechaISO,
  esRangoValido,
  fechasDentroDelRango,
} from "../src/lib/rango-fechas.mjs";

test("esFechaISO solo acepta una fecha completa", () => {
  assert.equal(esFechaISO("2026-08-01"), true);
  assert.equal(esFechaISO("2026-08"), false);
  assert.equal(esFechaISO(""), false);
  assert.equal(esFechaISO(null), false);
});

test("esRangoValido exige dos fechas completas y en orden", () => {
  assert.equal(esRangoValido("2026-08-01", "2026-08-31"), true);
  assert.equal(esRangoValido("2026-08-05", "2026-08-05"), true);
  assert.equal(esRangoValido("2026-08-31", "2026-08-01"), false);
  assert.equal(esRangoValido("2026-08", "2026-08-31"), false);
});

test("fechasDentroDelRango incluye los extremos", () => {
  const fechas = ["2026-07-31", "2026-08-01", "2026-08-15", "2026-08-31", "2026-09-01"];
  assert.deepEqual(fechasDentroDelRango(fechas, "2026-08-01", "2026-08-31"), [
    "2026-08-01",
    "2026-08-15",
    "2026-08-31",
  ]);
});

test("fechasDentroDelRango no recorta la lista original del registro", () => {
  const fechas = ["2026-07-15", "2026-08-15"];
  const enRango = fechasDentroDelRango(fechas, "2026-08-01", "2026-08-31");
  assert.deepEqual(enRango, ["2026-08-15"]);
  // La lista completa se conserva: editar el registro reescribe sus fechas y
  // perder las de otros meses borraría aplicaciones ya programadas.
  assert.deepEqual(fechas, ["2026-07-15", "2026-08-15"]);
});

test("un registro sin ninguna fecha en el rango queda fuera de la lista", () => {
  assert.deepEqual(fechasDentroDelRango(["2026-06-10"], "2026-08-01", "2026-08-31"), []);
});

test("un rango inválido no deja pasar ninguna fecha", () => {
  assert.deepEqual(fechasDentroDelRango(["2026-08-15"], "2026-08-31", "2026-08-01"), []);
  assert.deepEqual(fechasDentroDelRango(["2026-08-15"], "", "2026-08-31"), []);
});

test("tolera entradas que no son listas de fechas", () => {
  assert.deepEqual(fechasDentroDelRango(null, "2026-08-01", "2026-08-31"), []);
  assert.deepEqual(fechasDentroDelRango(["", "2026-08-15"], "2026-08-01", "2026-08-31"), [
    "2026-08-15",
  ]);
});
