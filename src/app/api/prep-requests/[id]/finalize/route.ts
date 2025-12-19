import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  finalizadoBy: z.string().trim().min(1).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = schema.parse(await request.json().catch(() => ({})));

  const updated = await prisma.prepRequest.update({
    where: { id },
    data: {
      finalizadoAt: new Date(),
      finalizadoBy: body.finalizadoBy ?? "farmacia",
    },
  });

  return NextResponse.json({ id: updated.id, finalizadoAt: updated.finalizadoAt?.toISOString() });
}

