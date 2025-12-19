import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim();

  const meds = await prisma.medication.findMany({
    where: query
      ? {
          OR: [
            { nombre: { contains: query, mode: "insensitive" } },
            { codigoInstitucional: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    meds.map((m) => ({
      id: m.id,
      codigoInstitucional: m.codigoInstitucional,
      nombre: m.nombre,
      concentracion: m.concentracion ?? null,
      viaAdministracion: m.viaAdministracion ?? null,
      label: `${m.codigoInstitucional ? `${m.codigoInstitucional} - ` : ""}${m.nombre}`,
    })),
  );
}

const upsertMedicationSchema = z.object({
  codigoInstitucional: z.string().trim().min(1).nullable().optional(),
  nombre: z.string().trim().min(1),
  concentracion: z.string().trim().min(1).nullable().optional(),
  viaAdministracion: z.string().trim().min(1).nullable().optional(),
  presentacion: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = upsertMedicationSchema.parse(await request.json());
  const codigoInstitucional = body.codigoInstitucional
    ? body.codigoInstitucional.toUpperCase()
    : body.codigoInstitucional;
  const nombre = body.nombre.toUpperCase();
  const concentracion = body.concentracion
    ? body.concentracion.toUpperCase()
    : body.concentracion;
  const viaAdministracion = body.viaAdministracion
    ? body.viaAdministracion.toUpperCase()
    : body.viaAdministracion;
  const presentacion = body.presentacion ? body.presentacion.toUpperCase() : body.presentacion;

  if (codigoInstitucional) {
    const med = await prisma.medication.upsert({
      where: { codigoInstitucional },
      update: {
        nombre,
        concentracion: concentracion ?? undefined,
        viaAdministracion: viaAdministracion ?? undefined,
        presentacion: presentacion ?? undefined,
      },
      create: {
        codigoInstitucional,
        nombre,
        concentracion: concentracion ?? null,
        viaAdministracion: viaAdministracion ?? null,
        presentacion: presentacion ?? null,
      },
    });
    return NextResponse.json({ id: med.id });
  }

  const med = await prisma.medication.create({
    data: {
      nombre,
      concentracion: concentracion ?? null,
      viaAdministracion: viaAdministracion ?? null,
      presentacion: presentacion ?? null,
    },
  });
  return NextResponse.json({ id: med.id });
}
