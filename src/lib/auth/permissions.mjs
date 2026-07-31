export const APP_ROLES = [
  "administrator",
  "pharmacist",
  "auditor",
];

export const ROLE_LABELS = {
  administrator: "Administrador",
  pharmacist: "Farmacéutico",
  auditor: "Consulta / Auditoría",
};

const ROLE_PERMISSIONS = {
  administrator: new Set([
    "clinical.read",
    "clinical.write",
    "clinical.delete",
    "catalog.manage",
    "users.manage",
  ]),
  pharmacist: new Set([
    "clinical.read",
    "clinical.write",
  ]),
  auditor: new Set([
    "clinical.read",
  ]),
};

export function isAppRole(value) {
  return typeof value === "string" && APP_ROLES.includes(value);
}

export function hasPermission(role, permission) {
  return isAppRole(role) && ROLE_PERMISSIONS[role].has(permission);
}

export function permissionForApiRequest(method, pathname) {
  const normalizedMethod = String(method).toUpperCase();

  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return "clinical.read";
  }

  if (normalizedMethod === "DELETE") {
    return "clinical.delete";
  }

  if (
    normalizedMethod === "POST" ||
    normalizedMethod === "PUT" ||
    normalizedMethod === "PATCH"
  ) {
    if (
      pathname.startsWith("/api/medications") ||
      pathname.startsWith("/api/pharmacists") ||
      pathname.startsWith("/api/prescribers")
    ) {
      return "catalog.manage";
    }

    return "clinical.write";
  }

  return "users.manage";
}
