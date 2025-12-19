import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ItemStatus } from "@prisma/client";
import { getRequestId } from "@/lib/api-server";

const MED_CODE_RE = /^\d-\d{2}-\d{2}-\d{4}$/;

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseMedicationInput(input: {
  codigoInstitucional?: string | null;
  nombre: string;
}) {
  const rawCode = input.codigoInstitucional?.trim() || null;
  let rawName = input.nombre.trim();

  if (!rawCode) {
    const parts = rawName.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && MED_CODE_RE.test(parts[0])) {
      rawName = parts.slice(1).join(" - ").trim();
      return { codigoInstitucional: parts[0].toUpperCase(), nombre: rawName.toUpperCase() };
    }
  }

  if (rawCode) {
    const prefix = `${rawCode} - `.toUpperCase();
    if (rawName.toUpperCase().startsWith(prefix)) {
      rawName = rawName.slice(prefix.length).trim();
    }
  }

  return {
    codigoInstitucional: rawCode ? rawCode.toUpperCase() : null,
    nombre: rawName.toUpperCase(),
  };
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const date = parseDateParam(url.searchParams.get("date"));
    const patientQuery = (url.searchParams.get("patient") ?? "").trim();
    const medicationQuery = (url.searchParams.get("med") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();

    const statusList = status
      ? status
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const items = await prisma.prepRequestItem.findMany({
      where: {
        ...(statusList.length ? { estado: { in: statusList as ItemStatus[] } } : {}),
        prepRequest: {
          is: {
            ...(date ? { fechaAplicacion: date } : {}),
            finalizadoAt: null,
            patient: patientQuery
              ? {
                  OR: [
                    { identificacion: { contains: patientQuery, mode: "insensitive" } },
                    { nombre: { contains: patientQuery, mode: "insensitive" } },
                  ],
                }
              : undefined,
          },
        },
        medication: medicationQuery
          ? {
              OR: [
                { nombre: { contains: medicationQuery, mode: "insensitive" } },
                {
                  codigoInstitucional: {
                    contains: medicationQuery,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : undefined,
      },
      include: {
        medication: true,
        prepRequest: { include: { patient: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });

    return NextResponse.json({
      requestId,
      items: items.map((i) => ({
        id: i.id,
        prepRequestId: i.prepRequestId,
        patientId: i.prepRequest.patientId,
        fechaAplicacion: i.prepRequest.fechaAplicacion.toISOString().slice(0, 10),
        estado: i.estado,
        identificacion: i.prepRequest.patient.identificacion,
        nombre: i.prepRequest.patient.nombre,
        medicationId: i.medicationId,
        medicamento: `${i.medication.codigoInstitucional ? `${i.medication.codigoInstitucional} - ` : ""}${i.medication.nombre}`,
        dosisTexto: i.dosisTexto,
        unidadesRequeridas: Number(i.unidadesRequeridas),
        frecuencia: i.frecuencia ?? null,
        adquisicion: i.adquisicion,
        observaciones: i.observaciones,
        entregadoAt: i.entregadoAt?.toISOString() ?? null,
        canceladoMotivo: i.canceladoMotivo ?? null,
        createdBy: i.createdBy ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedBy: i.updatedBy ?? null,
        updatedAt: i.updatedAt.toISOString(),
        idRegistro: i.id,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    console.error({ requestId, route: "GET /api/items", error: e });

    const message = e instanceof Error ? e.message : "Error";
    const lower = message.toLowerCase();
    if (lower.includes("column") && lower.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "La base de datos no está actualizada con el esquema esperado. Ejecuta las migraciones SQL en Supabase (`supabase-migration-003-items-frequency-acquisition.sql`, `supabase-migration-004-prep-requests-finalize.sql`, `supabase-migration-005-prep-requests-recipe-staff.sql`) y vuelve a intentar.",
          details: message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { requestId, error: message },
      { status: 500 },
    );
  }
}

const createItemSchema = z.object({
  fechaAplicacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechasAplicacion: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(12).optional(),
  fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  numeroReceta: z.string().regex(/^\d{6}$/).nullable().optional(),
  prescriberId: z.string().uuid().nullable().optional(),
  pharmacistId: z.string().uuid().nullable().optional(),
  patient: z.object({
    identificacion: z.string().trim().min(1),
    nombre: z.string().trim().min(1).nullable().optional(),
  }),
  medication: z.object({
    id: z.string().uuid().optional(),
    codigoInstitucional: z.string().trim().min(1).nullable().optional(),
    nombre: z.string().trim().min(1),
  }),
  dosisTexto: z.string().trim().min(1),
  unidadesRequeridas: z.number().positive(),
  frecuencia: z.string().trim().max(50).nullable().optional(),
  adquisicion: z.enum(["almacenable", "compra_local"]).nullable().optional(),
  observaciones: z.string().trim().max(300).nullable().optional(),
  createdBy: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = createItemSchema.parse(await request.json());
  const rawDates = body.fechasAplicacion?.length
    ? body.fechasAplicacion
    : body.fechaAplicacion
      ? [body.fechaAplicacion]
      : [];
  const uniqueRawDates = Array.from(new Set(rawDates));
  if (!uniqueRawDates.length) {
    return NextResponse.json(
      { error: "Debe indicar al menos una fecha de aplicación" },
      { status: 400 },
    );
  }
  if (uniqueRawDates.length > 12) {
    return NextResponse.json({ error: "Máximo 12 fechas" }, { status: 400 });
  }
  const fechas = uniqueRawDates
    .map((d) => parseDateParam(d))
    .filter((d): d is Date => !!d);
  if (fechas.length !== uniqueRawDates.length) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const fechaRecepcion = body.fechaRecepcion ? parseDateParam(body.fechaRecepcion) : null;
  if (body.fechaRecepcion && !fechaRecepcion) {
    return NextResponse.json({ error: "Fecha de recepción inválida" }, { status: 400 });
  }

  const patient = await prisma.patient.upsert({
    where: { identificacion: body.patient.identificacion.toUpperCase() },
    update: { nombre: body.patient.nombre ? body.patient.nombre.toUpperCase() : undefined },
    create: {
      identificacion: body.patient.identificacion.toUpperCase(),
      nombre: body.patient.nombre ? body.patient.nombre.toUpperCase() : null,
    },
  });

  const parsedMedication = parseMedicationInput(body.medication);
  let medicationId: string;
  if (body.medication.id) {
    medicationId = body.medication.id;
  } else if (parsedMedication.codigoInstitucional) {
    medicationId = (
      await prisma.medication.upsert({
        where: { codigoInstitucional: parsedMedication.codigoInstitucional },
        update: { nombre: parsedMedication.nombre },
        create: {
          codigoInstitucional: parsedMedication.codigoInstitucional,
          nombre: parsedMedication.nombre,
        },
      })
    ).id;
  } else {
    const existing = await prisma.medication.findFirst({
      where: { nombre: parsedMedication.nombre, codigoInstitucional: null },
      select: { id: true },
    });
    medicationId =
      existing?.id ??
      (
        await prisma.medication.create({
          data: { codigoInstitucional: null, nombre: parsedMedication.nombre },
          select: { id: true },
        })
      ).id;
  }

  const ids = await prisma.$transaction(async (tx) => {
    const createdIds: string[] = [];
    for (const fecha of fechas) {
      const prepRequest = await tx.prepRequest.upsert({
        where: { fechaAplicacion_patientId: { fechaAplicacion: fecha, patientId: patient.id } },
        update: {
          updatedBy: body.createdBy ?? undefined,
          ...(fechaRecepcion !== null ? { fechaRecepcion } : {}),
          ...(body.numeroReceta !== undefined ? { numeroReceta: body.numeroReceta } : {}),
          ...(body.prescriberId !== undefined ? { prescriberId: body.prescriberId } : {}),
          ...(body.pharmacistId !== undefined ? { pharmacistId: body.pharmacistId } : {}),
        },
        create: {
          fechaAplicacion: fecha,
          fechaRecepcion,
          numeroReceta: body.numeroReceta ?? null,
          patientId: patient.id,
          prescriberId: body.prescriberId ?? null,
          pharmacistId: body.pharmacistId ?? null,
          createdBy: body.createdBy ?? null,
          updatedBy: body.createdBy ?? null,
        },
      });

      const item = await tx.prepRequestItem.create({
        data: {
          prepRequestId: prepRequest.id,
          medicationId,
          dosisTexto: body.dosisTexto.toUpperCase(),
          unidadesRequeridas: body.unidadesRequeridas,
          estado: "pendiente",
          frecuencia: body.frecuencia ? body.frecuencia.toUpperCase() : null,
          adquisicion: body.adquisicion ?? "almacenable",
          observaciones: body.observaciones ?? null,
          createdBy: body.createdBy ?? null,
          updatedBy: body.createdBy ?? null,
        },
      });
      createdIds.push(item.id);
    }
    return createdIds;
  });

  return NextResponse.json({ ids });
}
