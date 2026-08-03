import Link from "next/link";
import { headers } from "next/headers";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

/**
 * La página servía para dos cosas distintas con un único texto: forzar el
 * cambio en el primer ingreso y cambiar la contraseña por voluntad propia. A
 * quien ya tenía contraseña le decía "Primer ingreso — Establezca su
 * contraseña", que no describe lo que está haciendo, y no ofrecía más salida
 * que cerrar sesión. El texto depende ahora de la cabecera que ya calcula el
 * proxy.
 */
export default async function AccountPage() {
  const requestHeaders = await headers();
  const primerIngreso = requestHeaders.get("x-app-must-change-password") === "true";

  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">
          {primerIngreso ? "Primer ingreso" : "Su cuenta"}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-blue-950">
          {primerIngreso ? "Establezca su contraseña" : "Cambiar contraseña"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          {primerIngreso
            ? "La contraseña temporal debe reemplazarse antes de acceder a los registros. "
            : "Elija una contraseña nueva para su cuenta. "}
          Use al menos 14 caracteres, mayúscula, minúscula, número y símbolo.
        </p>
        <ChangePasswordForm />

        {primerIngreso ? null : (
          <Link
            href="/"
            className="mt-4 block w-full rounded-xl border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Volver a la agenda
          </Link>
        )}

        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
