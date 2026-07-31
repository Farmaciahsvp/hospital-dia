import type { AppRole } from "@prisma/client";

export type RequestIdentity = {
  authUserId: string;
  email: string;
  displayName: string;
  role: AppRole;
  auditLabel: string;
};

export function getRequestIdentity(request: Request): RequestIdentity | null {
  const authUserId = request.headers.get("x-app-user-id");
  const email = request.headers.get("x-app-user-email");
  const displayName = request.headers.get("x-app-user-name");
  const role = request.headers.get("x-app-user-role") as AppRole | null;

  if (!authUserId || !email || !displayName || !role) return null;
  if (!["administrator", "pharmacist", "auditor"].includes(role)) return null;

  return {
    authUserId,
    email,
    displayName,
    role,
    auditLabel: `${displayName} <${email}>`,
  };
}
