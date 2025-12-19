import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestId, jsonError } from "@/lib/api-server";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") ?? "").trim();

    const results = await prisma.prescriber.findMany({
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

    const res = NextResponse.json(
      results.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombres: r.nombres,
        apellidos: r.apellidos,
      })),
    );
    res.headers.set("x-request-id", requestId);
    return res;
  } catch (e) {
    console.error({ requestId, route: "GET /api/prescribers", error: e });
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

const schema = z.object({
  codigo: z.string().trim().min(1),
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = schema.parse(await request.json());
    const codigo = body.codigo.toUpperCase();
    const nombres = body.nombres.toUpperCase();
    const apellidos = body.apellidos.toUpperCase();
    const row = await prisma.prescriber.upsert({
      where: { codigo },
      update: { nombres, apellidos },
      create: { codigo, nombres, apellidos },
    });
    const res = NextResponse.json({ id: row.id });
    res.headers.set("x-request-id", requestId);
    return res;
  } catch (e) {
    console.error({ requestId, route: "POST /api/prescribers", error: e });
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
