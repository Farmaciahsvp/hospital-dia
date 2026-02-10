import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestId } from "@/lib/api-server";

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");

    const from = parseDateParam(fromRaw);
    const to = parseDateParam(toRaw);

    if (!from || !to) {
      return NextResponse.json({ requestId, error: "Rango de fechas inválido" }, { status: 400 });
    }

    if (to < from) {
      return NextResponse.json({ requestId, error: "La fecha final no puede ser menor a la inicial" }, { status: 400 });
    }

    const diffDays = Math.floor((to.getTime() - from.getTime()) / 86400000);
    if (diffDays > 180) {
      return NextResponse.json({ requestId, error: "El rango máximo permitido es de 180 días" }, { status: 400 });
    }

    const toExclusive = addDays(to, 1);

    const grouped = await prisma.prepRequestItem.groupBy({
      by: ["medicationId"],
      where: {
        estado: { not: "cancelado" },
        prepRequest: {
          is: {
            fechaAplicacion: { gte: from, lt: toExclusive },
            finalizadoAt: null,
          },
        },
      },
      _count: { medicationId: true },
      _sum: { unidadesRequeridas: true },
      orderBy: { _sum: { unidadesRequeridas: "desc" } },
    });

    const medicationIds = grouped.map((g) => g.medicationId);
    const meds = medicationIds.length
      ? await prisma.medication.findMany({
          where: { id: { in: medicationIds } },
          select: { id: true, codigoInstitucional: true, nombre: true },
        })
      : [];
    const medById = new Map(meds.map((m) => [m.id, m]));

    const rows = grouped.map((g) => {
      const med = medById.get(g.medicationId);
      const nombre = med
        ? `${med.codigoInstitucional ? `${med.codigoInstitucional} - ` : ""}${med.nombre}`
        : g.medicationId;
      return {
        medicationId: g.medicationId,
        medicamento: nombre,
        lineas: g._count.medicationId,
        unidades: Number(g._sum.unidadesRequeridas ?? 0),
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.lineas += r.lineas;
        acc.unidades += r.unidades;
        return acc;
      },
      { lineas: 0, unidades: 0 },
    );

    return NextResponse.json({
      requestId,
      range: { from: fromRaw, to: toRaw },
      totals,
      rows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ requestId, error: message }, { status: 500 });
  }
}

