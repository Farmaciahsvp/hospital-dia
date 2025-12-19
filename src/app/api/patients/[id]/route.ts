import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
