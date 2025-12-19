import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const req = await prisma.prepRequest.findUnique({
    where: { id },
    include: {
      patient: true,
      items: { include: { medication: true }, orderBy: [{ updatedAt: "desc" }] },
    },
  });

  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: req.id,
    fechaAplicacion: req.fechaAplicacion.toISOString().slice(0, 10),
    identificacion: req.patient.identificacion,
    nombre: req.patient.nombre,
    finalizadoAt: req.finalizadoAt?.toISOString() ?? null,
    items: req.items.map((it) => ({
      id: it.id,
      estado: it.estado,
      medicamento: it.medication.codigoInstitucional
        ? `${it.medication.codigoInstitucional} - ${it.medication.nombre}`
        : it.medication.nombre,
      dosisTexto: it.dosisTexto,
      unidadesRequeridas: Number(it.unidadesRequeridas),
      observaciones: it.observaciones,
      entregadoAt: it.entregadoAt?.toISOString() ?? null,
      canceladoMotivo: it.canceladoMotivo,
    })),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await prisma.$transaction(async (tx) => {
    await tx.prepRequestItem.deleteMany({ where: { prepRequestId: id } });
    await tx.prepRequest.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
