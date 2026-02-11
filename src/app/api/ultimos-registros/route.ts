import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";

function parseMonthParam(raw: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;

  const [yearStr, monthStr] = trimmed.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

type RecordRow = {
  id: string;
  patientId: string;
  fecha: string | null;
  fechaRecepcion: string | null;
  numeroReceta: string | null;
  prescriberId: string | null;
  pharmacistId: string | null;
  cedula: string;
  nombre: string | null;
  medicationId: string;
  medicamento: string;
  dosisTexto: string;
  unidadesRequeridas: number;
  frecuencia: string | null;
  adquisicion: "almacenable" | "compra_local";
  observaciones: string | null;
  fechasAplicacion: string[];
  itemIds: string[];
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const monthRange = parseMonthParam(url.searchParams.get("month"));
    const takeRaw = url.searchParams.get("take");
    const take = takeRaw ? Math.min(Math.max(Number(takeRaw), 1), 5000) : null;
    const effectiveTake = take ?? (monthRange ? null : 5);

    const items = await prisma.prepRequestItem.findMany({
      where: monthRange
        ? {
            prepRequest: {
              is: {
                OR: [
                  { fechaRecepcion: { gte: monthRange.start, lt: monthRange.end } },
                  { fechaRecepcion: null, createdAt: { gte: monthRange.start, lt: monthRange.end } },
                ],
              },
            },
          }
        : undefined,
      select: {
        id: true,
        medicationId: true,
        dosisTexto: true,
        unidadesRequeridas: true,
        frecuencia: true,
        adquisicion: true,
        observaciones: true,
        createdAt: true,
        medication: {
          select: {
            codigoInstitucional: true,
            nombre: true,
          },
        },
        prepRequest: {
          select: {
            patientId: true,
            fechaAplicacion: true,
            fechaRecepcion: true,
            numeroReceta: true,
            prescriberId: true,
            pharmacistId: true,
            patient: {
              select: {
                id: true,
                identificacion: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      ...(monthRange ? {} : { take: 250 }),
    });

    const grouped = new Map<string, RecordRow & { sortAt: string }>();

    for (const it of items) {
      const pr = it.prepRequest;
      const patient = pr.patient;

      const fechaRecepcion = pr.fechaRecepcion ? pr.fechaRecepcion.toISOString().slice(0, 10) : null;
      const numeroReceta = pr.numeroReceta ?? null;
      const prescriberId = pr.prescriberId ?? null;
      const pharmacistId = pr.pharmacistId ?? null;

      const medicamento = it.medication.codigoInstitucional
        ? `${it.medication.codigoInstitucional} - ${it.medication.nombre}`
        : it.medication.nombre;

      const fechaAplicacion = pr.fechaAplicacion.toISOString().slice(0, 10);
      const fecha = fechaRecepcion;

      const key = [
        patient.id,
        it.medicationId,
        it.dosisTexto,
        it.frecuencia ?? "",
        numeroReceta ?? "",
        fechaRecepcion ?? "",
        pharmacistId ?? "",
        prescriberId ?? "",
        it.adquisicion,
      ].join("|");

      const current =
        grouped.get(key) ??
        ({
          id: it.id,
          patientId: patient.id,
          fecha,
          fechaRecepcion,
          numeroReceta,
          prescriberId,
          pharmacistId,
          cedula: patient.identificacion,
          nombre: patient.nombre,
          medicationId: it.medicationId,
          medicamento,
          dosisTexto: it.dosisTexto,
          unidadesRequeridas: Number(it.unidadesRequeridas),
          frecuencia: it.frecuencia ?? null,
          adquisicion: it.adquisicion,
          observaciones: it.observaciones ?? null,
          fechasAplicacion: [],
          itemIds: [],
          sortAt: it.createdAt.toISOString(),
        } satisfies RecordRow & { sortAt: string });

      current.fechasAplicacion.push(fechaAplicacion);
      current.itemIds.push(it.id);
      if (it.createdAt.toISOString() > current.sortAt) current.sortAt = it.createdAt.toISOString();

      grouped.set(key, current);
    }

    const sortedRows = Array.from(grouped.values())
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
      .map((row) => {
        const { sortAt, ...rest } = row;
        void sortAt;
        return {
          ...rest,
          fechasAplicacion: Array.from(new Set(rest.fechasAplicacion)).sort(),
          itemIds: Array.from(new Set(rest.itemIds)),
        };
      });

    const rows = effectiveTake ? sortedRows.slice(0, effectiveTake) : sortedRows;
    return jsonOk(requestId, { rows });
  } catch (e) {
    console.error({ requestId, route: "GET /api/ultimos-registros", error: e });
    const message = e instanceof Error ? e.message : "Error";
    const lower = message.toLowerCase();
    if (lower.includes("maxclientsinsessionmode") || lower.includes("max clients reached")) {
      return jsonError(
        requestId,
        "CONEXIONES MAXIMAS ALCANZADAS EN SUPABASE. EN VERCEL USA EL POOLER EN MODO TRANSACTION (PUERTO 6543) O AUMENTA EL POOL SIZE.",
        { status: 503, details: message },
      );
    }
    return jsonError(requestId, message, { status: 500 });
  }
}
