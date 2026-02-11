import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  createdBy: z.string().trim().min(1).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = schema.parse(await request.json().catch(() => ({})));

  const item = await prisma.prepRequestItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const duplicated = await prisma.prepRequestItem.create({
    data: {
      prepRequestId: item.prepRequestId,
      medicationId: item.medicationId,
      dosisTexto: item.dosisTexto,
      unidadesRequeridas: item.unidadesRequeridas,
      estado: "pendiente",
      frecuencia: item.frecuencia,
      adquisicion: item.adquisicion,
      observaciones: item.observaciones,
      createdBy: body.createdBy ?? null,
      updatedBy: body.createdBy ?? null,
    },
  });

  return NextResponse.json({ id: duplicated.id });
}
