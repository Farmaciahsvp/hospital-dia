import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonFailure, jsonOk } from "@/lib/api-server";
import { fechasDentroDelRango } from "@/lib/rango-fechas.mjs";

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

/**
 * Rango cerrado `from`/`to` en formato `YYYY-MM-DD`, la misma convención que
 * `/api/medicamentos-rango` y `/api/estadistica`. Se devuelve como intervalo
 * semiabierto `[start, end)` para poder compararlo igual que el de mes.
 */
function parseRangeParams(fromRaw: string | null, toRaw: string | null) {
  if (!fromRaw && !toRaw) return { ok: true as const, range: null };
  if (!fromRaw || !toRaw) {
    return { ok: false as const, error: "Indique la fecha inicial y la final del rango" };
  }

  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(fromRaw.trim()) || !pattern.test(toRaw.trim())) {
    return { ok: false as const, error: "Rango de fechas inválido" };
  }

  const start = new Date(`${fromRaw.trim()}T00:00:00.000Z`);
  const to = new Date(`${toRaw.trim()}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false as const, error: "Rango de fechas inválido" };
  }
  if (to < start) {
    return { ok: false as const, error: "La fecha final no puede ser menor a la inicial" };
  }

  // `to` es inclusivo para quien consulta; la consulta usa el día siguiente.
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 1);
  return { ok: true as const, range: { start, end } };
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
  /** Las fechas de aplicación que caen dentro del rango consultado. */
  fechasEnRango: string[];
  itemIds: string[];
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const parsedRange = parseRangeParams(
      url.searchParams.get("from"),
      url.searchParams.get("to"),
    );
    if (!parsedRange.ok) return jsonError(requestId, parsedRange.error, { status: 400 });

    // `month` se conserva por compatibilidad; la agenda ya consulta por rango.
    const range = parsedRange.range ?? parseMonthParam(url.searchParams.get("month"));
    const takeRaw = url.searchParams.get("take");
    const take = takeRaw ? Math.min(Math.max(Number(takeRaw), 1), 5000) : null;
    const effectiveTake = take ?? (range ? null : 5);

    const desde = range ? range.start.toISOString().slice(0, 10) : null;
    // `range.end` es exclusivo; el rango que ve quien consulta termina el día
    // anterior, que es también el que se compara contra cada fecha.
    const hasta = range
      ? new Date(range.end.getTime() - 86400000).toISOString().slice(0, 10)
      : null;

    // El filtro es por fecha de aplicación: una receta se recibe una vez y
    // genera ciclos durante meses, así que filtrar por recepción dejaba fuera a
    // casi todos los pacientes que se atienden en el mes.
    //
    // Se resuelve en dos pasos a propósito. Primero qué pacientes tienen alguna
    // aplicación en el rango; después TODAS sus líneas, porque cada fila debe
    // conservar su lista completa de fechas: editarla reescribe esas fechas y
    // recortarlas al rango borraría las aplicaciones de los demás meses.
    const patientIdsEnRango = range
      ? Array.from(
          new Set(
            (
              await prisma.prepRequest.findMany({
                where: { fechaAplicacion: { gte: range.start, lt: range.end } },
                select: { patientId: true },
              })
            ).map((pr) => pr.patientId),
          ),
        )
      : [];

    if (range && !patientIdsEnRango.length) return jsonOk(requestId, { rows: [] });

    const items = await prisma.prepRequestItem.findMany({
      where: range
        ? { prepRequest: { is: { patientId: { in: patientIdsEnRango } } } }
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
      ...(range ? {} : { take: 250 }),
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
          fechasEnRango: [],
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
        const fechasAplicacion = Array.from(new Set(rest.fechasAplicacion)).sort();
        return {
          ...rest,
          fechasEnRango:
            desde && hasta ? fechasDentroDelRango(fechasAplicacion, desde, hasta) : fechasAplicacion,
          fechasAplicacion,
          itemIds: Array.from(new Set(rest.itemIds)),
        };
      })
      // La consulta trajo todas las líneas de esos pacientes para conservar sus
      // fechas completas; en la lista solo van las que el rango justifica.
      .filter((row) => !range || row.fechasEnRango.length > 0);

    const rows = effectiveTake ? sortedRows.slice(0, effectiveTake) : sortedRows;
    return jsonOk(requestId, { rows });
  } catch (e) {
    return jsonFailure(
      requestId,
      "GET /api/ultimos-registros",
      e,
      "No se pudieron cargar los registros. Intente de nuevo.",
    );
  }
}
