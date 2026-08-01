import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERIC_FAILURE,
  classifyFailure,
  errorMessage,
  userFacingFailure,
} from "../src/lib/api-errors.mjs";

// Traza real capturada con la app en marcha: incluye la ruta absoluta del
// servidor, la invocación de Prisma y tres líneas del código fuente. Antes de
// sanear, esto se mostraba tal cual en el toast del usuario.
const TRAZA_PRISMA = new Error(
  'Invalid `prisma.prepRequestItem.findMany()` invocation in\n' +
    'C:\\Users\\david\\Documents\\Hospital Día\\.next\\dev\\server\\chunks\\[root-of-the-server]__1piojdc._.js:178:174\n' +
    '  177 const statusList = status ? status.split(",") : [];\n' +
    '→ 178 const items = await prisma.prepRequestItem.findMany(\n' +
    'Authentication failed against database server, the provided database ' +
    'credentials for `(not available)` are not valid.',
);

function assertNoFiltra(mensaje) {
  const prohibido = [
    "prisma",
    "C:\\",
    ".next",
    "invocation",
    "credentials",
    "findMany",
    "root-of-the-server",
  ];
  for (const fragmento of prohibido) {
    assert.ok(
      !mensaje.toLowerCase().includes(fragmento.toLowerCase()),
      `el mensaje al usuario no debe contener "${fragmento}": ${mensaje}`,
    );
  }
}

test("el mensaje al usuario nunca incluye la traza de Prisma ni rutas del servidor", () => {
  const { message } = userFacingFailure(TRAZA_PRISMA);
  assertNoFiltra(message);
  assert.equal(message, GENERIC_FAILURE);
});

test("el mensaje personalizado de la ruta se respeta y tampoco filtra nada", () => {
  const { message, status } = userFacingFailure(
    TRAZA_PRISMA,
    "No se pudo cargar la agenda. Intente de nuevo.",
  );
  assert.equal(message, "No se pudo cargar la agenda. Intente de nuevo.");
  assert.equal(status, 500);
  assertNoFiltra(message);
});

test("un error desconocido no reconocido cae al mensaje genérico", () => {
  assert.equal(classifyFailure(new Error("boom")), null);
  assert.equal(userFacingFailure(new Error("boom")).message, GENERIC_FAILURE);
});

test("errorMessage tolera valores que no son Error", () => {
  assert.equal(errorMessage(new Error("x")), "x");
  assert.equal(errorMessage("texto suelto"), "Error");
  assert.equal(errorMessage(null), "Error");
  assert.equal(errorMessage(undefined), "Error");
  assert.equal(errorMessage({ code: 500 }), "Error");
});

test("saturación de conexiones responde 503 sin nombrar proveedor ni puerto", () => {
  const error = new Error("Error querying the database: MaxClientsInSessionMode");
  const { message, status, hint } = userFacingFailure(error);

  assert.equal(status, 503);
  assert.match(message, /saturado/i);
  assert.ok(!message.toLowerCase().includes("supabase"), "no debe nombrar al proveedor");
  assert.ok(!message.includes("6543"), "no debe revelar el puerto del pooler");
  // La pista operativa existe, pero es para el log del servidor.
  assert.match(hint, /supabase/i);
});

test("también reconoce la variante 'max clients reached'", () => {
  assert.equal(userFacingFailure(new Error("max clients reached")).status, 503);
});

test("esquema desactualizado avisa al administrador sin listar migraciones", () => {
  const error = new Error('The column `frecuencia` does not exist in the current database.');
  const { message, status, hint } = userFacingFailure(error);

  assert.equal(status, 500);
  assert.match(message, /administrador/i);
  assert.ok(
    !message.includes("supabase-migration"),
    "no debe listar los archivos de migración al usuario",
  );
  assert.match(hint, /supabase-migration/);
});

test("la clasificación es indiferente a mayúsculas y minúsculas", () => {
  assert.equal(userFacingFailure(new Error("MAX CLIENTS REACHED")).status, 503);
  assert.equal(
    userFacingFailure(new Error("COLUMN foo DOES NOT EXIST")).status,
    500,
  );
});

test("un error que solo dice 'column' sin 'does not exist' no se clasifica", () => {
  assert.equal(classifyFailure(new Error("column mismatch")), null);
});
