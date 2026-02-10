import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const medicationId = url.searchParams.get("medicationId");
  const numeroReceta = url.searchParams.get("numeroReceta"); // Can be null/empty string
  const dosisTexto = url.searchParams.get("dosis");

  // Require explicit numeroReceta filter to avoid broad deletions by accident.
  if (numeroReceta === null) {
    return NextResponse.json(
      { error: "Debe enviar numeroReceta (usar cadena vacía para receta nula)." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete matching Items
      const deleteResult = await tx.prepRequestItem.deleteMany({
        where: {
          prepRequest: {
            patientId: id,
            // If numeroReceta is provided (even empty string implies looking for that), filter by it
            ...(numeroReceta !== null ? { numeroReceta: numeroReceta || null } : {}),
          },
          // Filter by medication and dosage if provided
          ...(medicationId ? { medicationId } : {}),
          ...(dosisTexto ? { dosisTexto } : {}),
        },
      });

      // 2. Find PrepRequests for this patient that have NO items left
      const emptyRequests = await tx.prepRequest.findMany({
        where: {
          patientId: id,
          items: { none: {} },
        },
        select: { id: true },
      });

      // 3. Delete those empty PrepRequests
      let deletedRequestsCount = 0;
      if (emptyRequests.length > 0) {
        const deleted = await tx.prepRequest.deleteMany({
          where: {
            id: { in: emptyRequests.map((r) => r.id) },
          },
        });
        deletedRequestsCount = deleted.count;
      }

      // Check if patient has any requests left
      const remainingRequests = await tx.prepRequest.count({
        where: { patientId: id },
      });

      // Optional: Delete patient if really no data left? 
      // The requirement says "verify ... only erase that line and not all registers".
      // Usually keeping the patient if they have history or empty profile is safer, 
      // but if the user wants "cleanup", we might delete the patient if count is 0.
      // For now, let's Stick to the "line" deletion which implies requests/items.

      return {
        deletedItems: deleteResult.count,
        deletedRequests: deletedRequestsCount,
        remainingRequests
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
