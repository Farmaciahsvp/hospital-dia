import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";

function parseIsoDate(raw: string | null) {
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const today = new Date();
    const defaultTo = toIsoDay(today);
    const defaultFrom = toIsoDay(addDays(new Date(`${defaultTo}T00:00:00.000Z`), -29));

    const fromStr = (url.searchParams.get("from") ?? defaultFrom).trim();
    const toStr = (url.searchParams.get("to") ?? defaultTo).trim();
    const from = parseIsoDate(fromStr);
    const to = parseIsoDate(toStr);

    if (!from || !to) return jsonError(requestId, "Rango de fechas inválido", { status: 400 });

    const maxDays = 180;
    const diffDays = Math.floor((to.getTime() - from.getTime()) / 86400000);
    if (diffDays < 0 || diffDays > maxDays) {
      return jsonError(requestId, `Rango inválido (máximo ${maxDays} días)`, { status: 400 });
    }

    const toExclusive = addDays(to, 1);

    const [
      recetas,
      uniquePatientsGroups,
      itemsAgg,
      statusGroups,
      adquisicionGroups,
      frecuenciaGroups,
      topMedGroups,
      dailyRecetas,
      dailyPatientsGroups,
      dailyLineas,
      cancelMotivos,
      cargaFarmacia,
      cargaPrescriptores,
      entregasStats,
      upcoming,
    ] = await Promise.all([
      prisma.prepRequest.count({
        where: {
          fechaRecepcion: { gte: from, lt: toExclusive },
        },
      }),
      prisma.prepRequest.groupBy({
        by: ["patientId"],
        where: { fechaRecepcion: { gte: from, lt: toExclusive } },
        _count: { _all: true },
      }),
      prisma.prepRequestItem.aggregate({
        where: {
          prepRequest: { is: { fechaRecepcion: { gte: from, lt: toExclusive } } },
        },
        _count: { _all: true },
        _sum: { unidadesRequeridas: true },
      }),
      prisma.prepRequestItem.groupBy({
        by: ["estado"],
        where: { prepRequest: { is: { fechaRecepcion: { gte: from, lt: toExclusive } } } },
        _count: { prepRequestId: true },
        orderBy: { _count: { prepRequestId: "desc" } },
      }),
      prisma.prepRequestItem.groupBy({
        by: ["adquisicion"],
        where: { prepRequest: { is: { fechaRecepcion: { gte: from, lt: toExclusive } } } },
        _count: { prepRequestId: true },
        orderBy: { _count: { prepRequestId: "desc" } },
      }),
      prisma.prepRequestItem.groupBy({
        by: ["frecuencia"],
        where: { prepRequest: { is: { fechaRecepcion: { gte: from, lt: toExclusive } } } },
        _count: { prepRequestId: true },
        orderBy: { _count: { prepRequestId: "desc" } },
        take: 12,
      }),
      prisma.prepRequestItem.groupBy({
        by: ["medicationId"],
        where: { prepRequest: { is: { fechaRecepcion: { gte: from, lt: toExclusive } } } },
        _count: { medicationId: true },
        _sum: { unidadesRequeridas: true },
        orderBy: { _count: { medicationId: "desc" } },
        take: 10,
      }),
      prisma.prepRequest.groupBy({
        by: ["fechaRecepcion"],
        where: { fechaRecepcion: { gte: from, lt: toExclusive } },
        _count: { id: true },
        orderBy: { fechaRecepcion: "asc" },
      }),
      prisma.prepRequest.groupBy({
        by: ["fechaRecepcion", "patientId"],
        where: { fechaRecepcion: { gte: from, lt: toExclusive } },
        _count: { id: true },
        orderBy: { fechaRecepcion: "asc" },
      }),
      prisma.prepRequestItem.groupBy({
        by: ["prepRequestId"],
        where: { prepRequest: { is: { fechaRecepcion: { gte: from, lt: toExclusive } } } },
        _count: { prepRequestId: true },
      }),
      prisma.$queryRaw<Array<{ motivo: string | null; count: bigint }>>(Prisma.sql`
        SELECT COALESCE(i."canceladoMotivo",'SIN MOTIVO') AS motivo, COUNT(*)::bigint AS count
        FROM "public"."prep_request_items" i
        JOIN "public"."prep_requests" pr ON pr."id"::text = i."prepRequestId"::text
        WHERE pr."fechaRecepcion" >= ${from} AND pr."fechaRecepcion" < ${toExclusive}
          AND i."estado" = 'cancelado'
        GROUP BY motivo
        ORDER BY count DESC
        LIMIT 10
      `),
      prisma.$queryRaw<Array<{ id: string | null; lineas: bigint }>>(Prisma.sql`
        SELECT pr."pharmacistId" AS id, COUNT(i."id")::bigint AS lineas
        FROM "public"."prep_request_items" i
        JOIN "public"."prep_requests" pr ON pr."id"::text = i."prepRequestId"::text
        WHERE pr."fechaRecepcion" >= ${from} AND pr."fechaRecepcion" < ${toExclusive}
        GROUP BY pr."pharmacistId"
        ORDER BY lineas DESC
        LIMIT 15
      `),
      prisma.$queryRaw<Array<{ id: string | null; lineas: bigint }>>(Prisma.sql`
        SELECT pr."prescriberId" AS id, COUNT(i."id")::bigint AS lineas
        FROM "public"."prep_request_items" i
        JOIN "public"."prep_requests" pr ON pr."id"::text = i."prepRequestId"::text
        WHERE pr."fechaRecepcion" >= ${from} AND pr."fechaRecepcion" < ${toExclusive}
        GROUP BY pr."prescriberId"
        ORDER BY lineas DESC
        LIMIT 15
      `),
      prisma.$queryRaw<
        Array<{ n: bigint; avg_hours: number | null; p50_hours: number | null; p90_hours: number | null; sla4h: number | null }>
      >(Prisma.sql`
        WITH base AS (
          SELECT EXTRACT(EPOCH FROM (i."entregadoAt" - i."createdAt")) / 3600.0 AS hours
          FROM "public"."prep_request_items" i
          JOIN "public"."prep_requests" pr ON pr."id"::text = i."prepRequestId"::text
          WHERE pr."fechaRecepcion" >= ${from} AND pr."fechaRecepcion" < ${toExclusive}
            AND i."entregadoAt" IS NOT NULL
        )
        SELECT
          COUNT(*)::bigint AS n,
          AVG(hours) AS avg_hours,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY hours) AS p50_hours,
          percentile_cont(0.9) WITHIN GROUP (ORDER BY hours) AS p90_hours,
          AVG(CASE WHEN hours <= 4 THEN 1 ELSE 0 END) AS sla4h
        FROM base
      `),
      prisma.$queryRaw<Array<{ fecha: Date; pacientes: bigint; lineas: bigint }>>(Prisma.sql`
        SELECT pr."fechaAplicacion"::date AS fecha,
               COUNT(DISTINCT pr."patientId")::bigint AS pacientes,
               COUNT(i."id")::bigint AS lineas
        FROM "public"."prep_requests" pr
        JOIN "public"."prep_request_items" i ON i."prepRequestId"::text = pr."id"::text
        WHERE pr."finalizadoAt" IS NULL
          AND pr."fechaAplicacion" >= ${parseIsoDate(defaultTo)!}
          AND pr."fechaAplicacion" < ${addDays(parseIsoDate(defaultTo)!, 31)}
        GROUP BY fecha
        ORDER BY fecha ASC
        LIMIT 31
      `),
    ]);

    const pacientes = uniquePatientsGroups.length;
    const lineas = itemsAgg._count._all;
    const unidades = toNumber(itemsAgg._sum.unidadesRequeridas ?? 0);

    const cancelados = statusGroups.find((s) => s.estado === "cancelado")?._count.prepRequestId ?? 0;
    const entregados = statusGroups.find((s) => s.estado === "entregado")?._count.prepRequestId ?? 0;

    const medicationIds = topMedGroups.map((g) => g.medicationId);
    const meds = medicationIds.length
      ? await prisma.medication.findMany({
          where: { id: { in: medicationIds } },
          select: { id: true, codigoInstitucional: true, nombre: true },
        })
      : [];
    const medById = new Map(
      meds.map((m) => [
        m.id,
        m.codigoInstitucional ? `${m.codigoInstitucional} - ${m.nombre}` : m.nombre,
      ]),
    );

    const topMedicamentos = topMedGroups.map((g) => ({
      medicationId: g.medicationId,
      medicamento: medById.get(g.medicationId) ?? g.medicationId,
      lineas: g._count.medicationId,
      unidades: toNumber(g._sum.unidadesRequeridas ?? 0),
    }));

    const pharmacists =
      cargaFarmacia.length && cargaFarmacia.some((r) => r.id)
        ? await prisma.pharmacist.findMany({
            where: { id: { in: cargaFarmacia.map((r) => r.id).filter((x): x is string => !!x) } },
            select: { id: true, codigo: true, nombres: true, apellidos: true },
          })
        : [];
    const pharmacistById = new Map(
      pharmacists.map((p) => [p.id, `${p.codigo} - ${p.nombres} ${p.apellidos}`.trim()]),
    );

    const prescribers =
      cargaPrescriptores.length && cargaPrescriptores.some((r) => r.id)
        ? await prisma.prescriber.findMany({
            where: { id: { in: cargaPrescriptores.map((r) => r.id).filter((x): x is string => !!x) } },
            select: { id: true, codigo: true, nombres: true, apellidos: true },
          })
        : [];
    const prescriberById = new Map(
      prescribers.map((p) => [p.id, `${p.codigo} - ${p.nombres} ${p.apellidos}`.trim()]),
    );

    const cargaPorFarmaceutico = cargaFarmacia.map((r) => ({
      pharmacistId: r.id,
      nombre: r.id ? pharmacistById.get(r.id) ?? r.id : "SIN ASIGNAR",
      lineas: toNumber(r.lineas),
    }));

    const cargaPorPrescriptor = cargaPrescriptores.map((r) => ({
      prescriberId: r.id,
      nombre: r.id ? prescriberById.get(r.id) ?? r.id : "SIN ASIGNAR",
      lineas: toNumber(r.lineas),
    }));

    const dailyPatientsByDay = new Map<string, Set<string>>();
    for (const g of dailyPatientsGroups) {
      const key = g.fechaRecepcion ? g.fechaRecepcion.toISOString().slice(0, 10) : "SIN FECHA";
      const set = dailyPatientsByDay.get(key) ?? new Set<string>();
      set.add(g.patientId);
      dailyPatientsByDay.set(key, set);
    }

    const lineasByRequestId = new Map<string, number>();
    for (const g of dailyLineas) {
      lineasByRequestId.set(g.prepRequestId, g._count.prepRequestId);
    }

    const recetasByDay = new Map<string, { recetas: number; lineas: number }>();
    for (const g of dailyRecetas) {
      const day = g.fechaRecepcion ? g.fechaRecepcion.toISOString().slice(0, 10) : "SIN FECHA";
      recetasByDay.set(day, { recetas: g._count.id, lineas: 0 });
    }

    // Approx: distribute line counts by joining prep_requests again (minimal)
    const reqsForDaily = await prisma.prepRequest.findMany({
      where: { fechaRecepcion: { gte: from, lt: toExclusive } },
      select: { id: true, fechaRecepcion: true },
      take: 20000,
    });
    for (const r of reqsForDaily) {
      const day = r.fechaRecepcion ? r.fechaRecepcion.toISOString().slice(0, 10) : "SIN FECHA";
      const bucket = recetasByDay.get(day);
      if (!bucket) continue;
      bucket.lineas += lineasByRequestId.get(r.id) ?? 0;
    }

    const days: Array<{ fecha: string; recetas: number; pacientes: number; lineas: number }> = [];
    for (const [fecha, bucket] of Array.from(recetasByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (fecha === "SIN FECHA") continue;
      days.push({
        fecha,
        recetas: bucket.recetas,
        pacientes: dailyPatientsByDay.get(fecha)?.size ?? 0,
        lineas: bucket.lineas,
      });
    }

    const entrega = entregasStats[0] ?? { n: BigInt(0), avg_hours: null, p50_hours: null, p90_hours: null, sla4h: null };

    return jsonOk(requestId, {
      range: { from: fromStr, to: toStr },
      totals: {
        recetas,
        pacientes,
        lineas,
        unidades,
        entregados,
        cancelados,
      },
      daily: days,
      status: statusGroups.map((s) => ({ estado: s.estado, count: s._count.prepRequestId })),
      adquisicion: adquisicionGroups.map((a) => ({ adquisicion: a.adquisicion, count: a._count.prepRequestId })),
      frecuencias: frecuenciaGroups.map((f) => ({ frecuencia: f.frecuencia ?? "SIN DEFINIR", count: f._count.prepRequestId })),
      topMedicamentos,
      cancelMotivos: cancelMotivos.map((m) => ({ motivo: m.motivo ?? "SIN MOTIVO", count: toNumber(m.count) })),
      cargaFarmaceuticos: cargaPorFarmaceutico,
      cargaPrescriptores: cargaPorPrescriptor,
      tiemposEntrega: {
        n: toNumber(entrega.n),
        avgHours: entrega.avg_hours,
        p50Hours: entrega.p50_hours,
        p90Hours: entrega.p90_hours,
        sla4hPct: entrega.sla4h !== null ? Math.round(entrega.sla4h * 1000) / 10 : null,
      },
      upcoming: upcoming.map((u) => ({
        fechaAplicacion: u.fecha.toISOString().slice(0, 10),
        pacientes: toNumber(u.pacientes),
        lineas: toNumber(u.lineas),
      })),
    });
  } catch (e) {
    console.error({ requestId, route: "GET /api/estadistica", error: e });
    const details = e instanceof Error ? e.message : "Error";
    return jsonError(requestId, "No se pudo calcular la estadística. Intenta de nuevo.", { status: 500, details });
  }
}
