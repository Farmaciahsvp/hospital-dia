import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/request-identity";
import { getRequestId, jsonError, jsonFailure, jsonOk } from "@/lib/api-server";
import { prisma } from "@/lib/prisma";

const archiveSchema = z.object({
  patientId: z.string().uuid(),
  numeroReceta: z.string().trim().min(1).nullable(),
  fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  archived: z.boolean(),
});

function parseIsoDate(raw: string | null) {
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    return undefined;
  }
  return date;
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  const parsed = archiveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(requestId, "Datos de receta inválidos", { status: 400 });
  }

  const fechaRecepcion = parseIsoDate(parsed.data.fechaRecepcion);
  if (fechaRecepcion === undefined) {
    return jsonError(requestId, "Fecha de recepción inválida", { status: 400 });
  }

  const identity = {
    patientId: parsed.data.patientId,
    numeroReceta: parsed.data.numeroReceta,
    fechaRecepcion,
  };

  try {
    const exists = await prisma.prepRequest.findFirst({
      where: identity,
      select: { id: true },
    });
    if (!exists) {
      return jsonError(requestId, "No se encontró la receta", { status: 404 });
    }

    const actor = getRequestIdentity(request)?.auditLabel ?? null;
    const result = await prisma.prepRequest.updateMany({
      where: {
        ...identity,
        archivedAt: parsed.data.archived ? null : { not: null },
      },
      data: {
        archivedAt: parsed.data.archived ? new Date() : null,
        archivedBy: parsed.data.archived ? actor : null,
        updatedBy: actor ?? undefined,
      },
    });

    return jsonOk(requestId, {
      archived: parsed.data.archived,
      updatedRequests: result.count,
    });
  } catch (error) {
    return jsonFailure(
      requestId,
      "PATCH /api/registro-pacientes/archivo",
      error,
      parsed.data.archived
        ? "No se pudo archivar la receta. Intente de nuevo."
        : "No se pudo restaurar la receta. Intente de nuevo.",
    );
  }
}
