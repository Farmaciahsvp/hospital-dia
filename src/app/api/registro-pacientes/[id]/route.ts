import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MAX_APPLY_DATES } from "@/lib/domain-rules";

const querySchema = z.object({
  medicationId: z.string().uuid(),
  numeroReceta: z.string(),
  dosis: z.string().trim().min(1),
});

const patchDatesSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  fechasAplicacion: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(MAX_APPLY_DATES),
});

function parseIsoDate(raw: string) {
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    medicationId: url.searchParams.get("medicationId"),
    numeroReceta: url.searchParams.get("numeroReceta"),
    dosis: url.searchParams.get("dosis"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Debe enviar medicationId, numeroReceta (usar cadena vacia para receta nula) y dosis." },
      { status: 400 },
    );
  }

  const { medicationId, numeroReceta, dosis: dosisTexto } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.prepRequestItem.deleteMany({
        where: {
          prepRequest: {
            patientId: id,
            numeroReceta: numeroReceta || null,
          },
          medicationId,
          dosisTexto,
        },
      });

      const emptyRequests = await tx.prepRequest.findMany({
        where: {
          patientId: id,
          items: { none: {} },
        },
        select: { id: true },
      });

      let deletedRequestsCount = 0;
      if (emptyRequests.length > 0) {
        const deleted = await tx.prepRequest.deleteMany({
          where: {
            id: { in: emptyRequests.map((r) => r.id) },
          },
        });
        deletedRequestsCount = deleted.count;
      }

      const remainingRequests = await tx.prepRequest.count({
        where: { patientId: id },
      });

      return {
        deletedItems: deleteResult.count,
        deletedRequests: deletedRequestsCount,
        remainingRequests,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = patchDatesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Debe enviar itemIds y fechasAplicacion válidas (máx. ${MAX_APPLY_DATES}).` },
      { status: 400 },
    );
  }

  const uniqueDates = Array.from(new Set(parsed.data.fechasAplicacion));
  const parsedDates = uniqueDates
    .map((raw) => ({ raw, date: parseIsoDate(raw) }))
    .filter((x): x is { raw: string; date: Date } => !!x.date);
  if (parsedDates.length !== uniqueDates.length) {
    return NextResponse.json({ error: "Hay fechas de aplicación inválidas." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const selected = await tx.prepRequestItem.findMany({
        where: { id: { in: parsed.data.itemIds } },
        select: {
          id: true,
          prepRequestId: true,
          medicationId: true,
          dosisTexto: true,
          unidadesRequeridas: true,
          estado: true,
          frecuencia: true,
          adquisicion: true,
          observaciones: true,
          createdBy: true,
          updatedBy: true,
          prepRequest: {
            select: {
              id: true,
              patientId: true,
              fechaAplicacion: true,
              fechaRecepcion: true,
              numeroReceta: true,
              prescriberId: true,
              pharmacistId: true,
              recursoAmparo: true,
              createdBy: true,
              updatedBy: true,
            },
          },
        },
      });

      const scoped = selected.filter((it) => it.prepRequest.patientId === id);
      if (!scoped.length) {
        throw new Error("No se encontraron registros para actualizar.");
      }

      const template = scoped[0];
      if (!template) throw new Error("No se encontró plantilla de actualización.");

      const existingByDate = new Map<string, typeof scoped>();
      for (const item of scoped) {
        const iso = item.prepRequest.fechaAplicacion.toISOString().slice(0, 10);
        const arr = existingByDate.get(iso) ?? [];
        arr.push(item);
        existingByDate.set(iso, arr);
      }

      const targetSet = new Set(uniqueDates);
      const toDeleteIds: string[] = [];
      for (const [iso, itemsOnDate] of existingByDate.entries()) {
        if (!targetSet.has(iso)) {
          toDeleteIds.push(...itemsOnDate.map((x) => x.id));
        }
      }
      if (toDeleteIds.length) {
        await tx.prepRequestItem.deleteMany({ where: { id: { in: toDeleteIds } } });
      }

      let createdItems = 0;
      for (const { raw, date } of parsedDates) {
        if (existingByDate.has(raw)) continue;

        const prepRequest = await tx.prepRequest.upsert({
          where: { fechaAplicacion_patientId: { fechaAplicacion: date, patientId: id } },
          update: {
            fechaRecepcion: template.prepRequest.fechaRecepcion,
            numeroReceta: template.prepRequest.numeroReceta,
            prescriberId: template.prepRequest.prescriberId,
            pharmacistId: template.prepRequest.pharmacistId,
            recursoAmparo: template.prepRequest.recursoAmparo,
            updatedBy: template.updatedBy ?? template.prepRequest.updatedBy ?? undefined,
          },
          create: {
            fechaAplicacion: date,
            patientId: id,
            fechaRecepcion: template.prepRequest.fechaRecepcion,
            numeroReceta: template.prepRequest.numeroReceta,
            prescriberId: template.prepRequest.prescriberId,
            pharmacistId: template.prepRequest.pharmacistId,
            recursoAmparo: template.prepRequest.recursoAmparo,
            createdBy: template.createdBy ?? template.prepRequest.createdBy ?? null,
            updatedBy: template.updatedBy ?? template.prepRequest.updatedBy ?? null,
          },
          select: { id: true },
        });

        await tx.prepRequestItem.create({
          data: {
            prepRequestId: prepRequest.id,
            medicationId: template.medicationId,
            dosisTexto: template.dosisTexto,
            unidadesRequeridas: template.unidadesRequeridas,
            estado: template.estado,
            frecuencia: template.frecuencia,
            adquisicion: template.adquisicion,
            observaciones: template.observaciones,
            createdBy: template.createdBy ?? null,
            updatedBy: template.updatedBy ?? null,
          },
        });
        createdItems += 1;
      }

      const affectedPrepRequestIds = Array.from(new Set(scoped.map((x) => x.prepRequestId)));
      if (affectedPrepRequestIds.length) {
        await tx.prepRequest.deleteMany({
          where: {
            id: { in: affectedPrepRequestIds },
            items: { none: {} },
          },
        });
      }

      return {
        updatedGroupItems: scoped.length,
        deletedItems: toDeleteIds.length,
        createdItems,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
