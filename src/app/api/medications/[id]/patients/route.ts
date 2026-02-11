import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    const { id } = await context.params;
    const medicationIds = id.includes(",")
      ? id
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [id];
    const url = new URL(request.url);
    const date = parseDateParam(url.searchParams.get("date"));
    const includeHistorico = url.searchParams.get("historico") === "1";
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "50"), 1), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

    const items = await prisma.prepRequestItem.findMany({
      where: {
        medicationId: { in: medicationIds },
        prepRequest: {
          is: {
            ...(date ? { fechaAplicacion: date } : {}),
            ...(includeHistorico ? {} : { finalizadoAt: null }),
          },
        },
      },
      select: {
        prepRequest: {
          select: {
            patient: {
              select: {
                id: true,
                identificacion: true,
                nombre: true,
              },
            },
            fechaAplicacion: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5000,
    });

    const byPatient = new Map<
      string,
      {
        patientId: string;
        identificacion: string;
        nombre: string | null;
        fechasAplicacion: string[];
        lineas: number;
      }
    >();

    for (const it of items) {
      const patient = it.prepRequest.patient;
      const key = patient.id;
      const current = byPatient.get(key) ?? {
        patientId: patient.id,
        identificacion: patient.identificacion,
        nombre: patient.nombre,
        fechasAplicacion: [] as string[],
        lineas: 0,
      };

      current.fechasAplicacion.push(it.prepRequest.fechaAplicacion.toISOString().slice(0, 10));
      current.lineas += 1;
      byPatient.set(key, current);
    }

    const allPatients = Array.from(byPatient.values()).map((p) => ({
      ...p,
      fechasAplicacion: Array.from(new Set(p.fechasAplicacion)).sort(),
    }));

    allPatients.sort((a, b) => a.identificacion.localeCompare(b.identificacion));

    const total = allPatients.length;
    const patients = allPatients.slice(offset, offset + take);
    const hasMore = offset + take < total;

    return jsonOk(requestId, { patients, total, offset, take, hasMore });
  } catch (e) {
    console.error({ requestId, route: "GET /api/medications/[id]/patients", error: e });
    const message = e instanceof Error ? e.message : "Error";
    return jsonError(requestId, message, { status: 500 });
  }
}
