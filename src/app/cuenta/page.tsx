import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default function AccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">
          Primer ingreso
        </p>
        <h1 className="mt-2 text-2xl font-bold text-blue-950">
          Establezca su contraseña
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          La contraseña temporal debe reemplazarse antes de acceder a los
          registros. Use al menos 14 caracteres, mayúscula, minúscula, número y
          símbolo.
        </p>
        <ChangePasswordForm />
        <form action="/auth/signout" method="post" className="mt-4">
          <button
            type="submit"
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            CERRAR SESIÓN
          </button>
        </form>
      </section>
    </main>
  );
}
