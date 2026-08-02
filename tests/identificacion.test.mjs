import test from "node:test";
import assert from "node:assert/strict";

/**
 * Réplica de `claveIdentificacion` de src/lib/domain-rules.ts. Los tests corren
 * sobre .mjs sin compilar, igual que el resto de la suite de dominio.
 */
function claveIdentificacion(raw) {
  return String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

test("la misma cédula escrita de distintas formas comparte clave", () => {
  const esperada = "112345678";
  for (const escrito of ["112345678", "1-1234-5678", "0112345678", "1 1234 5678", "01-1234-5678"]) {
    assert.equal(claveIdentificacion(escrito), esperada, `falló con "${escrito}"`);
  }
});

test("cédulas distintas no colisionan", () => {
  // El grupo 4 de producción: 717…/170…, un dígito desplazado. Son claves
  // distintas a propósito: la normalización no debe adivinar que es la misma
  // persona, eso exige revisión humana.
  assert.notEqual(claveIdentificacion("717123456"), claveIdentificacion("17012345"));
  assert.notEqual(claveIdentificacion("103820872"), claveIdentificacion("103820873"));
});

test("no se comen ceros que no están a la izquierda", () => {
  assert.equal(claveIdentificacion("100200300"), "100200300");
  assert.equal(claveIdentificacion("0-1002-0030"), "10020030");
});

test("una entrada sin dígitos da clave vacía y no empareja nada", () => {
  // Con clave vacía la ruta de escritura no busca ficha existente: si se
  // tratara como comodín, cualquier basura reutilizaría la primera ficha.
  assert.equal(claveIdentificacion(""), "");
  assert.equal(claveIdentificacion("---"), "");
  assert.equal(claveIdentificacion(null), "");
  assert.equal(claveIdentificacion(undefined), "");
});

test("los ceros a la izquierda no convierten una cédula en otra existente", () => {
  assert.equal(claveIdentificacion("000000000"), "");
  assert.notEqual(claveIdentificacion("0987654321"), claveIdentificacion("987654320"));
});
