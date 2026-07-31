import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/request-identity";

const schema = z.object({
  finalizadoBy: z.string().trim().min(1).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = schema.parse(await request.json().catch(() => ({})));
  const actor =
    getRequestIdentity(request)?.auditLabel ??
    body.finalizadoBy ??
    "farmacia";

  const updated = await prisma.prepRequest.update({
    where: { id },
    data: {
      finalizadoAt: new Date(),
      finalizadoBy: actor,
    },
  });

  return NextResponse.json({ id: updated.id, finalizadoAt: updated.finalizadoAt?.toISOString() });
}

