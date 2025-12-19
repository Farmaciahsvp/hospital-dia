import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  estado: z
    .enum(["pendiente", "en_preparacion", "listo", "entregado", "cancelado"])
    .optional(),
  dosisTexto: z.string().trim().min(1).optional(),
  unidadesRequeridas: z.number().positive().optional(),
  observaciones: z.string().trim().max(300).nullable().optional(),
  updatedBy: z.string().trim().min(1).nullable().optional(),
  entregadoAt: z.string().datetime().nullable().optional(),
  canceladoMotivo: z.string().trim().max(200).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = patchSchema.parse(await request.json());

  const updated = await prisma.prepRequestItem.update({
    where: { id },
    data: {
      ...(body.estado ? { estado: body.estado } : {}),
      ...(body.dosisTexto ? { dosisTexto: body.dosisTexto } : {}),
      ...(typeof body.unidadesRequeridas === "number"
        ? { unidadesRequeridas: body.unidadesRequeridas }
        : {}),
      ...(body.observaciones !== undefined ? { observaciones: body.observaciones } : {}),
      ...(body.updatedBy !== undefined ? { updatedBy: body.updatedBy } : {}),
      ...(body.entregadoAt !== undefined
        ? { entregadoAt: body.entregadoAt ? new Date(body.entregadoAt) : null }
        : {}),
      ...(body.canceladoMotivo !== undefined ? { canceladoMotivo: body.canceladoMotivo } : {}),
    },
  });

  return NextResponse.json({ id: updated.id });
}

