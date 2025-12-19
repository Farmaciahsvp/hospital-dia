import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim();

  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { identificacion: { contains: query, mode: "insensitive" } },
            { nombre: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    patients.map((p) => ({
      id: p.id,
      identificacion: p.identificacion,
      nombre: p.nombre,
    })),
  );
}

const upsertPatientSchema = z.object({
  identificacion: z.string().trim().min(1),
  nombre: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = upsertPatientSchema.parse(await request.json());
  const identificacion = body.identificacion.toUpperCase();
  const nombre = body.nombre ? body.nombre.toUpperCase() : body.nombre;
  const patient = await prisma.patient.upsert({
    where: { identificacion },
    update: { nombre: nombre ?? undefined },
    create: { identificacion, nombre: nombre ?? null },
  });
  return NextResponse.json({
    id: patient.id,
    identificacion: patient.identificacion,
    nombre: patient.nombre,
  });
}
