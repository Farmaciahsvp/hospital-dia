import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBasicCredentials,
  evaluateAccess,
  isAccessGateEnabled,
} from "../src/lib/access-gate.mjs";

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("la barrera siempre se activa en producción y Vercel", () => {
  assert.equal(
    isAccessGateEnabled({ nodeEnv: "production", vercel: undefined, mode: "off" }),
    true,
  );
  assert.equal(
    isAccessGateEnabled({ nodeEnv: "development", vercel: "1", mode: "off" }),
    true,
  );
});

test("desarrollo local puede activar o desactivar explícitamente la barrera", () => {
  assert.equal(
    isAccessGateEnabled({ nodeEnv: "development", vercel: undefined, mode: "on" }),
    true,
  );
  assert.equal(
    isAccessGateEnabled({ nodeEnv: "development", vercel: undefined, mode: "off" }),
    false,
  );
});

test("credenciales ausentes provocan cierre seguro", () => {
  assert.equal(
    evaluateAccess({
      enabled: true,
      expectedUsername: "",
      expectedPassword: "",
      authorization: null,
    }),
    "misconfigured",
  );
});

test("una solicitud anónima o con credenciales incorrectas se rechaza", () => {
  const expected = {
    enabled: true,
    expectedUsername: "hospital-dia",
    expectedPassword: "secreto-muy-largo",
  };

  assert.equal(evaluateAccess({ ...expected, authorization: null }), "unauthorized");
  assert.equal(
    evaluateAccess({
      ...expected,
      authorization: basic("hospital-dia", "incorrecto"),
    }),
    "unauthorized",
  );
});

test("credenciales correctas permiten acceso y admiten dos puntos en la contraseña", () => {
  const authorization = basic("hospital-dia", "secreto:con:separadores");
  assert.deepEqual(decodeBasicCredentials(authorization), {
    username: "hospital-dia",
    password: "secreto:con:separadores",
  });
  assert.equal(
    evaluateAccess({
      enabled: true,
      expectedUsername: "hospital-dia",
      expectedPassword: "secreto:con:separadores",
      authorization,
    }),
    "allow",
  );
});

test("encabezados Basic inválidos nunca permiten acceso", () => {
  assert.equal(decodeBasicCredentials("Bearer token"), null);
  assert.equal(decodeBasicCredentials("Basic !!!"), null);
  assert.equal(
    evaluateAccess({
      enabled: true,
      expectedUsername: "hospital-dia",
      expectedPassword: "secreto",
      authorization: "Basic !!!",
    }),
    "unauthorized",
  );
});
