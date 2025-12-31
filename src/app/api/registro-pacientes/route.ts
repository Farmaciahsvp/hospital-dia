import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";

type Row = {
  patientId: string;
  medicationId: string;
  fechaRecepcion: string | null;
  numeroReceta: string | null;
  cedula: string;
  nombre: string | null;
  medicamento: string;
  dosis: string;
  fechasAplicacion: string[];
  fechasAplicacionCumplidas: string[];
  farmaceutico: string | null;
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const includeHistorico = url.searchParams.get("historico") === "1";
    const q = (url.searchParams.get("q") ?? "").trim();
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "50"), 1), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

    const items = await prisma.prepRequestItem.findMany({
      where: {
        ...(includeHistorico ? {} : { prepRequest: { is: { finalizadoAt: null } } }),
        ...(q
          ? {
              OR: [
                { dosisTexto: { contains: q, mode: "insensitive" } },
                { medication: { is: { nombre: { contains: q, mode: "insensitive" } } } },
                { medication: { is: { codigoInstitucional: { contains: q, mode: "insensitive" } } } },
                {
                  prepRequest: {
                    is: {
                      OR: [
                        { numeroReceta: { contains: q, mode: "insensitive" } },
                        {
                          patient: {
                            OR: [
                              { identificacion: { contains: q, mode: "insensitive" } },
                              { nombre: { contains: q, mode: "insensitive" } },
                            ],
                          },
                        },
                        {
                          pharmacist: {
                            is: {
                              OR: [
                                { codigo: { contains: q, mode: "insensitive" } },
                                { nombres: { contains: q, mode: "insensitive" } },
                                { apellidos: { contains: q, mode: "insensitive" } },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        medication: true,
        prepRequest: {
          include: {
            patient: true,
            pharmacist: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 20000,
    });

    const grouped = new Map<string, Row>();

    for (const it of items) {
      const pr = it.prepRequest;
      const patient = pr.patient;
      const fechaRecepcion = pr.fechaRecepcion ? pr.fechaRecepcion.toISOString().slice(0, 10) : null;
      const numeroReceta = pr.numeroReceta ?? null;

      const medicamento = it.medication.codigoInstitucional
        ? `${it.medication.codigoInstitucional} - ${it.medication.nombre}`
        : it.medication.nombre;

      const farmaceutico = pr.pharmacist
        ? `${pr.pharmacist.codigo} - ${pr.pharmacist.nombres} ${pr.pharmacist.apellidos}`.trim()
        : null;

      const key = [
        patient.id,
        it.medicationId,
        numeroReceta ?? "",
        fechaRecepcion ?? "",
        pr.pharmacistId ?? "",
        it.dosisTexto,
      ].join("|");

      const existing =
        grouped.get(key) ??
        ({
          patientId: patient.id,
          medicationId: it.medicationId,
          fechaRecepcion,
          numeroReceta,
          cedula: patient.identificacion,
          nombre: patient.nombre,
          medicamento,
          dosis: it.dosisTexto,
          fechasAplicacion: [],
          fechasAplicacionCumplidas: [],
          farmaceutico,
        } satisfies Row);

      const fechaAplicacionIso = pr.fechaAplicacion.toISOString().slice(0, 10);
      existing.fechasAplicacion.push(fechaAplicacionIso);
      if (it.aplicadoAt) existing.fechasAplicacionCumplidas.push(fechaAplicacionIso);
      grouped.set(key, existing);
    }

    const allRows = Array.from(grouped.values()).map((r) => ({
      ...r,
      fechasAplicacion: Array.from(new Set(r.fechasAplicacion)).sort(),
      fechasAplicacionCumplidas: Array.from(new Set(r.fechasAplicacionCumplidas)).sort(),
    }));

    allRows.sort((a, b) => {
      const ar = a.fechaRecepcion ?? "";
      const br = b.fechaRecepcion ?? "";
      if (ar !== br) return br.localeCompare(ar);
      const aa = a.fechasAplicacion.at(-1) ?? "";
      const bb = b.fechasAplicacion.at(-1) ?? "";
      if (aa !== bb) return bb.localeCompare(aa);
      return a.cedula.localeCompare(b.cedula);
    });

    const total = allRows.length;
    const rows = allRows.slice(offset, offset + take);
    const hasMore = offset + take < total;

    return jsonOk(requestId, { rows, total, offset, take, hasMore });
  } catch (e) {
    console.error({ requestId, route: "GET /api/registro-pacientes", error: e });
    const message = e instanceof Error ? e.message : "Error";
    return jsonError(requestId, message, { status: 500 });
  }
}
