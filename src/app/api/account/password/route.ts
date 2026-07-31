import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestIdentity } from "@/lib/auth/request-identity";
import { createClient } from "@/lib/supabase/server";

const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{14,}$/;

export async function POST(request: Request) {
  const identity = getRequestIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { error: "Sesión individual requerida" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!STRONG_PASSWORD.test(password)) {
    return NextResponse.json(
      {
        error:
          "Use al menos 14 caracteres, mayúscula, minúscula, número y símbolo.",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json(
      { error: "No fue posible actualizar la contraseña." },
      { status: 400 },
    );
  }

  await prisma.appUser.update({
    where: { authUserId: identity.authUserId },
    data: { mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
