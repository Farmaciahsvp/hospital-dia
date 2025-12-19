import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError, jsonOk } from "@/lib/api-server";

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
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 5), 1), 20);

    const items = await prisma.prepRequestItem.findMany({
      include: {
        medication: true,
        prepRequest: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 250,
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

    const rows = Array.from(grouped.values())
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
      .slice(0, take)
      .map(({ sortAt: _sortAt, ...rest }) => ({
        ...rest,
        fechasAplicacion: Array.from(new Set(rest.fechasAplicacion)).sort(),
        itemIds: Array.from(new Set(rest.itemIds)),
      }));

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
