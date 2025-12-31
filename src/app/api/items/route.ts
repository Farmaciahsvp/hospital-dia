import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ItemStatus } from "@prisma/client";
import { getRequestId } from "@/lib/api-server";

const MAX_APPLY_DATES = 16;
const DUPLICATE_WINDOW_MS = 2000;

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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
        prepRequest: {
          include: {
            patient: true,
            prescriber: { select: { codigo: true } },
            pharmacist: { select: { codigo: true } },
          },
        },
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
        numeroReceta: i.prepRequest.numeroReceta ?? null,
        estado: i.estado,
        identificacion: i.prepRequest.patient.identificacion,
        nombre: i.prepRequest.patient.nombre,
        prescriberCodigo: i.prepRequest.prescriber?.codigo ?? null,
        pharmacistCodigo: i.prepRequest.pharmacist?.codigo ?? null,
        medicationId: i.medicationId,
        medicationCodigo: i.medication.codigoInstitucional ?? null,
        medicationNombre: i.medication.nombre,
        medicationViaAdministracion: i.medication.viaAdministracion ?? null,
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
    if (lower.includes("maxclientsinsessionmode") || lower.includes("max clients reached")) {
      return NextResponse.json(
        {
          requestId,
          error:
            "CONEXIONES MAXIMAS ALCANZADAS EN SUPABASE. EN VERCEL USA EL POOLER EN MODO TRANSACTION (PUERTO 6543) O AUMENTA EL POOL SIZE.",
          details: message,
        },
        { status: 503 },
      );
    }
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
  fechasAplicacion: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .max(MAX_APPLY_DATES)
    .optional(),
  fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numeroReceta: z.string().regex(/^\d{6}$/),
  prescriberId: z.string().uuid(),
  pharmacistId: z.string().uuid(),
  patient: z.object({
    identificacion: z.string().trim().min(1),
    nombre: z.string().trim().min(1),
  }),
  medication: z.object({
    id: z.string().uuid(),
    codigoInstitucional: z.string().trim().min(1).nullable().optional(),
    nombre: z.string().trim().min(1),
  }),
  dosisTexto: z.string().trim().min(1),
  unidadesRequeridas: z.number().positive(),
  frecuencia: z.string().trim().min(1).max(50),
  adquisicion: z.enum(["almacenable", "compra_local"]),
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
  if (uniqueRawDates.length > MAX_APPLY_DATES) {
    return NextResponse.json({ error: `Máximo ${MAX_APPLY_DATES} fechas` }, { status: 400 });
  }
  const fechas = uniqueRawDates
    .map((d) => parseDateParam(d))
    .filter((d): d is Date => !!d);
  if (fechas.length !== uniqueRawDates.length) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const fechaRecepcion = parseDateParam(body.fechaRecepcion);
  if (!fechaRecepcion) {
    return NextResponse.json({ error: "Fecha de recepción inválida" }, { status: 400 });
  }

  const patient = await prisma.patient.upsert({
    where: { identificacion: body.patient.identificacion.toUpperCase() },
    update: { nombre: body.patient.nombre.toUpperCase() },
    create: {
      identificacion: body.patient.identificacion.toUpperCase(),
      nombre: body.patient.nombre.toUpperCase(),
    },
  });

  const medicationId = body.medication.id;

  const normalizedDosis = body.dosisTexto.toUpperCase();
  const normalizedFrecuencia = body.frecuencia.toUpperCase();
  const normalizedAdquisicion = body.adquisicion;
  const normalizedObservaciones = body.observaciones ?? null;
  const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const ids = await prisma.$transaction(async (tx) => {
    const createdIds: string[] = [];
    for (const fecha of fechas) {
      const prepRequest = await tx.prepRequest.upsert({
        where: { fechaAplicacion_patientId: { fechaAplicacion: fecha, patientId: patient.id } },
        update: {
          updatedBy: body.createdBy ?? undefined,
          fechaRecepcion,
          numeroReceta: body.numeroReceta,
          prescriberId: body.prescriberId,
          pharmacistId: body.pharmacistId,
        },
        create: {
          fechaAplicacion: fecha,
          fechaRecepcion,
          numeroReceta: body.numeroReceta,
          patientId: patient.id,
          prescriberId: body.prescriberId,
          pharmacistId: body.pharmacistId,
          createdBy: body.createdBy ?? null,
          updatedBy: body.createdBy ?? null,
        },
      });

      const existing = await tx.prepRequestItem.findFirst({
        where: {
          prepRequestId: prepRequest.id,
          medicationId,
          dosisTexto: normalizedDosis,
          unidadesRequeridas: body.unidadesRequeridas,
          frecuencia: normalizedFrecuencia,
          adquisicion: normalizedAdquisicion,
          observaciones: normalizedObservaciones,
          createdAt: { gte: duplicateSince },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (existing) {
        createdIds.push(existing.id);
        continue;
      }

      const item = await tx.prepRequestItem.create({
        data: {
          prepRequestId: prepRequest.id,
          medicationId,
          dosisTexto: normalizedDosis,
          unidadesRequeridas: body.unidadesRequeridas,
          estado: "pendiente",
          frecuencia: normalizedFrecuencia,
          adquisicion: normalizedAdquisicion,
          observaciones: normalizedObservaciones,
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
