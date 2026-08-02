import assert from "node:assert/strict";
import test from "node:test";
import {
  hasPermission,
  isAppRole,
  permissionForApiRequest,
} from "../src/lib/auth/permissions.mjs";

test("solo reconoce los tres roles institucionales", () => {
  assert.equal(isAppRole("administrator"), true);
  assert.equal(isAppRole("pharmacist"), true);
  assert.equal(isAppRole("auditor"), true);
  assert.equal(isAppRole("admin"), false);
  assert.equal(isAppRole(undefined), false);
});

test("el auditor es estrictamente de solo lectura", () => {
  assert.equal(hasPermission("auditor", "account.password.change"), true);
  assert.equal(hasPermission("auditor", "clinical.read"), true);
  assert.equal(hasPermission("auditor", "clinical.write"), false);
  assert.equal(hasPermission("auditor", "clinical.delete"), false);
});

test("el farmacéutico opera registros pero no administra catálogos ni elimina", () => {
  assert.equal(hasPermission("pharmacist", "clinical.read"), true);
  assert.equal(hasPermission("pharmacist", "clinical.write"), true);
  assert.equal(hasPermission("pharmacist", "catalog.manage"), false);
  assert.equal(hasPermission("pharmacist", "clinical.delete"), false);
});

test("el administrador conserva todas las capacidades", () => {
  for (const permission of [
    "clinical.read",
    "clinical.write",
    "clinical.delete",
    "catalog.manage",
    "users.manage",
  ]) {
    assert.equal(hasPermission("administrator", permission), true);
  }
});

test("las APIs se clasifican con cierre seguro", () => {
  assert.equal(
    permissionForApiRequest("POST", "/api/account/password"),
    "account.password.change",
  );
  assert.equal(permissionForApiRequest("GET", "/api/items"), "clinical.read");
  assert.equal(permissionForApiRequest("POST", "/api/items"), "clinical.write");
  assert.equal(
    permissionForApiRequest("PATCH", "/api/medications/1"),
    "catalog.manage",
  );
  assert.equal(
    permissionForApiRequest("POST", "/api/pharmacists"),
    "catalog.manage",
  );
  assert.equal(
    permissionForApiRequest("DELETE", "/api/prep-requests/1"),
    "clinical.delete",
  );
  assert.equal(
    permissionForApiRequest("TRACE", "/api/items"),
    "users.manage",
  );
});

test("eliminar una ficha de paciente queda reservado al administrador", () => {
  // El endpoint es nuevo y borra datos de paciente: conviene fijar por prueba
  // que cae bajo `clinical.delete` y no bajo el `clinical.write` que tiene el
  // farmacéutico, para que un cambio en el enrutado no lo abra por descuido.
  assert.equal(
    permissionForApiRequest("DELETE", "/api/patients/abc"),
    "clinical.delete",
  );
  assert.equal(hasPermission("administrator", "clinical.delete"), true);
  assert.equal(hasPermission("pharmacist", "clinical.delete"), false);
  assert.equal(hasPermission("auditor", "clinical.delete"), false);
});
