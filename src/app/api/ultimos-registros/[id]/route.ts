import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MAX_APPLY_DATES } from "@/lib/domain-rules";

const MED_CODE_RE = /^\d-\d{2}-\d{2}-\d{4}$/;

function parseDate(raw: string) {
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseMedicationInput(input: { id?: string | null; codigoInstitucional?: string | null; nombre: string }) {
  const rawId = input.id?.trim() || null;
  const rawCode = input.codigoInstitucional?.trim() || null;
  let rawName = input.nombre.trim();

  if (!rawId && !rawCode) {
    const parts = rawName.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && MED_CODE_RE.test(parts[0])) {
      rawName = parts.slice(1).join(" - ").trim();
      return { id: null, codigoInstitucional: parts[0].toUpperCase(), nombre: rawName.toUpperCase() };
    }
  }

  if (rawCode) {
    const prefix = `${rawCode} - `.toUpperCase();
    if (rawName.toUpperCase().startsWith(prefix)) rawName = rawName.slice(prefix.length).trim();
  }

  return {
    id: rawId,
    codigoInstitucional: rawCode ? rawCode.toUpperCase() : null,
    nombre: rawName.toUpperCase(),
  };
}

const schema = z.object({
  patientId: z.string().uuid(),
  identificacion: z.string().trim().min(1),
  nombre: z.string().trim().min(1).nullable().optional(),

  medication: z.object({
    id: z.string().uuid().nullable().optional(),
    codigoInstitucional: z.string().trim().min(1).nullable().optional(),
    nombre: z.string().trim().min(1),
  }),

  dosisTexto: z.string().trim().min(1),
  unidadesRequeridas: z.number().positive(),
  frecuencia: z.string().trim().max(50).nullable().optional(),
  adquisicion: z.enum(["almacenable", "compra_local"]).nullable().optional(),
  observaciones: z.string().trim().max(300).nullable().optional(),

  fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  numeroReceta: z.string().regex(/^\d{6}$/).nullable().optional(),
  prescriberId: z.string().uuid().nullable().optional(),
  pharmacistId: z.string().uuid().nullable().optional(),

  fechasAplicacion: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(MAX_APPLY_DATES),
  itemIds: z.array(z.string().uuid()).min(1),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  // `id` is not used as identifier; client sends the itemIds to update.
  await context.params;
  const body = schema.parse(await request.json());

  const fechas = Array.from(new Set(body.fechasAplicacion)).slice(0, MAX_APPLY_DATES);
  const parsedDates = fechas.map(parseDate);
  if (parsedDates.some((d) => !d)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const fechaRecepcion = body.fechaRecepcion ? parseDate(body.fechaRecepcion) : null;
  if (body.fechaRecepcion && !fechaRecepcion) {
    return NextResponse.json({ error: "Fecha de recepción inválida" }, { status: 400 });
  }

  const parsedMedication = parseMedicationInput({
    id: body.medication.id ?? null,
    codigoInstitucional: body.medication.codigoInstitucional ?? null,
    nombre: body.medication.nombre,
  });

  const medicationId = await (async () => {
    if (parsedMedication.id) return parsedMedication.id;
    if (parsedMedication.codigoInstitucional) {
      return (
        await prisma.medication.upsert({
          where: { codigoInstitucional: parsedMedication.codigoInstitucional },
          update: { nombre: parsedMedication.nombre },
          create: {
            codigoInstitucional: parsedMedication.codigoInstitucional,
            nombre: parsedMedication.nombre,
          },
          select: { id: true },
        })
      ).id;
    }

    const existing = await prisma.medication.findFirst({
      where: { nombre: parsedMedication.nombre, codigoInstitucional: null },
      select: { id: true },
    });
    if (existing?.id) return existing.id;
    return (
      await prisma.medication.create({
        data: { codigoInstitucional: null, nombre: parsedMedication.nombre },
        select: { id: true },
      })
    ).id;
  })();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.update({
        where: { id: body.patientId },
        data: {
          identificacion: body.identificacion.toUpperCase(),
          ...(body.nombre !== undefined ? { nombre: body.nombre ? body.nombre.toUpperCase() : null } : {}),
        },
        select: { id: true },
      });

      const existingItems = await tx.prepRequestItem.findMany({
        where: { id: { in: body.itemIds } },
        include: { prepRequest: true },
      });

      // Safety: only operate on items that belong to the expected patient.
      const filteredItems = existingItems.filter((i) => i.prepRequest.patientId === patient.id);

      const existingByDate = new Map<string, string[]>();
      const prepRequestIds = new Set<string>();
      for (const it of filteredItems) {
        const d = it.prepRequest.fechaAplicacion.toISOString().slice(0, 10);
        const arr = existingByDate.get(d) ?? [];
        arr.push(it.id);
        existingByDate.set(d, arr);
        prepRequestIds.add(it.prepRequestId);
      }

      // Update metadata on existing prep_requests
      await tx.prepRequest.updateMany({
        where: { id: { in: Array.from(prepRequestIds) } },
        data: {
          ...(fechaRecepcion !== null ? { fechaRecepcion } : {}),
          ...(body.numeroReceta !== undefined ? { numeroReceta: body.numeroReceta } : {}),
          ...(body.prescriberId !== undefined ? { prescriberId: body.prescriberId } : {}),
          ...(body.pharmacistId !== undefined ? { pharmacistId: body.pharmacistId } : {}),
        },
      });

      // Update existing items (keeps their estado)
      await tx.prepRequestItem.updateMany({
        where: { id: { in: filteredItems.map((i) => i.id) } },
        data: {
          medicationId,
          dosisTexto: body.dosisTexto.toUpperCase(),
          unidadesRequeridas: body.unidadesRequeridas,
          frecuencia: body.frecuencia ? body.frecuencia.toUpperCase() : null,
          adquisicion: body.adquisicion ?? "almacenable",
          observaciones: body.observaciones ?? null,
        },
      });

      // Delete removed dates
      const toDeleteIds: string[] = [];
      for (const [dateStr, ids] of existingByDate.entries()) {
        if (!fechas.includes(dateStr)) toDeleteIds.push(...ids);
      }
      if (toDeleteIds.length) {
        await tx.prepRequestItem.deleteMany({ where: { id: { in: toDeleteIds } } });
      }

      // Create new dates/items
      const createdIds: string[] = [];
      for (const dateStr of fechas) {
        if (existingByDate.has(dateStr)) continue;
        const dateObj = parseDate(dateStr)!;
        const pr = await tx.prepRequest.upsert({
          where: { fechaAplicacion_patientId: { fechaAplicacion: dateObj, patientId: patient.id } },
          update: {
            ...(fechaRecepcion !== null ? { fechaRecepcion } : {}),
            ...(body.numeroReceta !== undefined ? { numeroReceta: body.numeroReceta } : {}),
            ...(body.prescriberId !== undefined ? { prescriberId: body.prescriberId } : {}),
            ...(body.pharmacistId !== undefined ? { pharmacistId: body.pharmacistId } : {}),
          },
          create: {
            fechaAplicacion: dateObj,
            patientId: patient.id,
            fechaRecepcion,
            numeroReceta: body.numeroReceta ?? null,
            prescriberId: body.prescriberId ?? null,
            pharmacistId: body.pharmacistId ?? null,
          },
          select: { id: true },
        });

        const item = await tx.prepRequestItem.create({
          data: {
            prepRequestId: pr.id,
            medicationId,
            dosisTexto: body.dosisTexto.toUpperCase(),
            unidadesRequeridas: body.unidadesRequeridas,
            estado: "pendiente",
            frecuencia: body.frecuencia ? body.frecuencia.toUpperCase() : null,
            adquisicion: body.adquisicion ?? "almacenable",
            observaciones: body.observaciones ?? null,
          },
          select: { id: true },
        });
        createdIds.push(item.id);
      }

      return { updated: filteredItems.length, created: createdIds.length, deleted: toDeleteIds.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
