import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonFailure, jsonOk } from "@/lib/api-server";

const patchSchema = z.object({
  patientId: z.string().uuid(),
  medicationId: z.string().uuid(),
  dosisTexto: z.string().trim().min(1),
  fechaAplicacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  aplicado: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = patchSchema.parse(await request.json());

    const fechaAplicacion = new Date(`${body.fechaAplicacion}T00:00:00.000Z`);

    const items = await prisma.prepRequestItem.findMany({
      where: {
        medicationId: body.medicationId,
        dosisTexto: body.dosisTexto,
        prepRequest: {
          is: {
            patientId: body.patientId,
            fechaAplicacion,
          },
        },
      },
      select: { id: true, aplicadoAt: true },
    });

    if (!items.length) {
      return jsonError(requestId, "No se encontró el registro de aplicación", { status: 404 });
    }

    const allApplied = items.every((it) => !!it.aplicadoAt);
    const applied = body.aplicado ?? !allApplied;

    await prisma.prepRequestItem.updateMany({
      where: { id: { in: items.map((it) => it.id) } },
      data: { aplicadoAt: applied ? new Date() : null },
    });

    return jsonOk(requestId, { applied });
  } catch (e) {
    return jsonFailure(
      requestId,
      "PATCH /api/registro-pacientes/aplicacion",
      e,
      "No se pudo actualizar la aplicación. Intente de nuevo.",
    );
  }
}

