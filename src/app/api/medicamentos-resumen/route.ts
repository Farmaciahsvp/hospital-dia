import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";

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
    current.count += m._count.items;
    grouped.set(key, current);
  }

    const medications = Array.from(grouped.values())
    .map((m) => ({
      ...m,
      ids: Array.from(new Set(m.ids)),
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
