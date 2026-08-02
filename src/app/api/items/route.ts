import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ItemStatus } from "@prisma/client";
import { claveIdentificacion, DUPLICATE_WINDOW_MS, MAX_APPLY_DATES } from "@/lib/domain-rules";
import { getRequestId, jsonFailure } from "@/lib/api-server";
import { getRequestIdentity } from "@/lib/auth/request-identity";

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
    const takeParam = Number(url.searchParams.get("take") ?? "500");
    const take = Number.isFinite(takeParam)
      ? Math.min(Math.max(Math.trunc(takeParam), 1), 5000)
      : 500;

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
      take,
    });

    return NextResponse.json({
      requestId,
      items: items.map((i) => ({
        id: i.id,
        prepRequestId: i.prepRequestId,
        patientId: i.prepRequest.patientId,
        fechaAplicacion: i.prepRequest.fechaAplicacion.toISOString().slice(0, 10),
        numeroReceta: i.prepRequest.numeroReceta ?? null,
        recursoAmparo: i.prepRequest.recursoAmparo,
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
    return jsonFailure(
      requestId,
      "GET /api/items",
      e,
      "No se pudo cargar la agenda. Intente de nuevo.",
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
  recursoAmparo: z.boolean().optional(),
  createdBy: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = createItemSchema.parse(await request.json());
  const actor = getRequestIdentity(request)?.auditLabel ?? body.createdBy ?? null;
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

  const identificacion = body.patient.identificacion.toUpperCase();
  const nombrePaciente = body.patient.nombre.toUpperCase();

  // El upsert buscaba por la cadena literal, así que "1-1234-5678", "112345678"
  // y "0112345678" creaban tres fichas del mismo paciente y le partían el
  // historial. Se busca por la clave normalizada y se reutiliza la ficha que ya
  // exista; solo se crea cuando de verdad no hay ninguna.
  const clave = claveIdentificacion(identificacion);
  // Con clave vacía no se busca nada: tratarla como comodín haría que una
  // entrada sin dígitos reutilizara una ficha ajena.
  //
  // Cuando ya hay varias fichas de la misma persona —las cinco divisiones que
  // arrastra la base—, se elige la que más solicitudes acumula, no la más
  // antigua: así lo nuevo se concentra en la ficha dominante, que es la que una
  // fusión conservaría, en vez de seguir engordando la otra mitad.
  const existente = clave
    ? (
        await prisma.$queryRaw<Array<{ id: string }>>`
          select p.id
          from patients p
          left join prep_requests r on r."patientId" = p.id
          where regexp_replace(regexp_replace(p.identificacion, '[^0-9]', '', 'g'), '^0+', '') = ${clave}
          group by p.id, p."createdAt"
          order by count(r.id) desc, p."createdAt" asc
          limit 1
        `
      )[0]
    : undefined;

  const patient = existente
    ? await prisma.patient.update({
        where: { id: existente.id },
        // La identificación no se reescribe: se respeta como quedó registrada.
        data: { nombre: nombrePaciente },
      })
    : await prisma.patient.create({
        data: { identificacion, nombre: nombrePaciente },
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
          updatedBy: actor ?? undefined,
          fechaRecepcion,
          numeroReceta: body.numeroReceta,
          prescriberId: body.prescriberId,
          pharmacistId: body.pharmacistId,
          recursoAmparo: body.recursoAmparo ?? false,
        },
        create: {
          fechaAplicacion: fecha,
          fechaRecepcion,
          numeroReceta: body.numeroReceta,
          patientId: patient.id,
          prescriberId: body.prescriberId,
          pharmacistId: body.pharmacistId,
          recursoAmparo: body.recursoAmparo ?? false,
          createdBy: actor,
          updatedBy: actor,
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
          createdBy: actor,
          updatedBy: actor,
        },
      });
      createdIds.push(item.id);
    }
    return createdIds;
  });

  return NextResponse.json({ ids });
}
