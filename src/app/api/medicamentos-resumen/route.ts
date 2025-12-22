import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";
import { Prisma } from "@prisma/client";

function normalizeMedicationKey(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "300"), 1), 500);
    const q = (url.searchParams.get("q") ?? "").trim();

    const meds = await prisma.medication.findMany({
      where: q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { codigoInstitucional: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { _count: { select: { items: true } } },
      orderBy: [{ items: { _count: "desc" } }, { nombre: "asc" }],
      take: Math.min(2000, take * 4),
    });

    const grouped = new Map<
      string,
      { key: string; nombre: string; ids: string[]; count: number }
    >();

    for (const m of meds) {
      const nombre = m.codigoInstitucional
        ? `${m.codigoInstitucional} - ${m.nombre}`
        : m.nombre;
      const key = normalizeMedicationKey(nombre);
      const current = grouped.get(key) ?? { key, nombre, ids: [], count: 0 };
      current.ids.push(m.id);
      grouped.set(key, current);
    }

    const mappings = Array.from(grouped.values())
      .flatMap((g) => g.ids.map((id) => ({ id, key: g.key })))
      .filter((m, idx, all) => all.findIndex((x) => x.id === m.id && x.key === m.key) === idx);

    const counts =
      mappings.length === 0
        ? []
        : await prisma.$queryRaw<Array<{ key: string; count: number }>>(Prisma.sql`
            WITH mapping("medicationId", "key") AS (
              VALUES ${Prisma.join(
                mappings.map(
                  (m) => Prisma.sql`(${m.id}::text, ${m.key}::text)`,
                ),
              )}
            )
            SELECT
              mapping."key" AS "key",
              COALESCE(COUNT(DISTINCT pr."patientId"), 0)::int AS "count"
            FROM mapping
            LEFT JOIN "prep_request_items" pri
              ON pri."medicationId" = mapping."medicationId"
            LEFT JOIN "prep_requests" pr
              ON pr."id" = pri."prepRequestId"
            GROUP BY mapping."key"
          `);

    const countByKey = new Map(counts.map((c) => [c.key, c.count]));

    const medications = Array.from(grouped.values())
      .map((m) => ({
        ...m,
        ids: Array.from(new Set(m.ids)),
        count: countByKey.get(m.key) ?? 0,
      }))
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.nombre.localeCompare(b.nombre);
      })
      .slice(0, take);

    return jsonOk(requestId, { medications });
  } catch (e) {
    console.error({ requestId, route: "GET /api/medicamentos-resumen", error: e });
    const message = e instanceof Error ? e.message : "Error";
    return jsonError(requestId, message, { status: 500 });
  }
}
