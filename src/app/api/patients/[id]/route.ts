import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * No existía forma de eliminar una ficha de paciente, ni por interfaz ni por
 * API. Una cédula mal tecleada quedaba para siempre en el autocompletado de la
 * captura, compitiendo con la ficha correcta justo cuando el nombre se
 * autorrellena a partir de ella.
 *
 * El permiso lo aplica el proxy: todo DELETE exige `clinical.delete`, que solo
 * tiene el administrador. Aquí se cuida lo otro: no borrar nunca una ficha con
 * historial. Si tiene solicitudes, borrarla se llevaría por delante registros
 * clínicos; ese caso es una fusión de fichas, no un borrado.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { id: true, identificacion: true, _count: { select: { requests: true } } },
  });

  if (!patient) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (patient._count.requests > 0) {
    return NextResponse.json(
      {
        error:
          "La ficha tiene registros asociados y no puede eliminarse. Solo pueden eliminarse fichas sin historial.",
        solicitudes: patient._count.requests,
      },
      { status: 409 },
    );
  }

  await prisma.patient.delete({ where: { id } });

  return NextResponse.json({ id: patient.id, identificacion: patient.identificacion });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({
    id: patient.id,
    identificacion: patient.identificacion,
    nombre: patient.nombre,
  });
}

const schema = z.object({
  identificacion: z.string().trim().min(1).optional(),
  nombre: z.string().trim().min(1).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = schema.parse(await request.json());

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      ...(body.identificacion ? { identificacion: body.identificacion.toUpperCase() } : {}),
      ...(body.nombre !== undefined
        ? { nombre: body.nombre ? body.nombre.toUpperCase() : null }
        : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    identificacion: updated.identificacion,
    nombre: updated.nombre,
  });
}
