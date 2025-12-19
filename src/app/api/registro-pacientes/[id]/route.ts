import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedItems = await tx.prepRequestItem.deleteMany({
        where: { prepRequest: { is: { patientId: id } } },
      });
      const deletedPrepRequests = await tx.prepRequest.deleteMany({
        where: { patientId: id },
      });
      await tx.patient.delete({ where: { id } });
      return { deletedItems: deletedItems.count, deletedPrepRequests: deletedPrepRequests.count };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

