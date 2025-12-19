import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim();

  const results = await prisma.pharmacist.findMany({
    where: query
      ? {
          OR: [
            { codigo: { contains: query, mode: "insensitive" } },
            { nombres: { contains: query, mode: "insensitive" } },
            { apellidos: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    results.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombres: r.nombres,
      apellidos: r.apellidos,
    })),
  );
}

const schema = z.object({
  codigo: z.string().trim().min(1),
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const codigo = body.codigo.toUpperCase();
  const nombres = body.nombres.toUpperCase();
  const apellidos = body.apellidos.toUpperCase();
  const row = await prisma.pharmacist.upsert({
    where: { codigo },
    update: { nombres, apellidos },
    create: { codigo, nombres, apellidos },
  });
  return NextResponse.json({ id: row.id });
}
