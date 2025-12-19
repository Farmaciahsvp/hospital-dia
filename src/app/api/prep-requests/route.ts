import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = parseDateParam(url.searchParams.get("date"));
  const historico = url.searchParams.get("historico") === "1";

  const requests = await prisma.prepRequest.findMany({
    where: {
      ...(date ? { fechaAplicacion: date } : {}),
      ...(historico ? { finalizadoAt: { not: null } } : { finalizadoAt: null }),
    },
    include: {
      patient: true,
      items: { include: { medication: true } },
    },
    orderBy: [{ fechaAplicacion: "desc" }, { updatedAt: "desc" }],
    take: 300,
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      fechaAplicacion: r.fechaAplicacion.toISOString().slice(0, 10),
      patientId: r.patientId,
      identificacion: r.patient.identificacion,
      nombre: r.patient.nombre,
      finalizadoAt: r.finalizadoAt?.toISOString() ?? null,
      itemsCount: r.items.length,
    })),
  });
}

