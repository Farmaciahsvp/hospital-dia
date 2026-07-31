import { LoginForm } from "@/components/auth/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const unauthorized = params.error === "not_authorized";

  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/10">
        <p className="text-xs font-bold tracking-[0.18em] text-blue-700">
          SERVICIO DE FARMACIA
        </p>
        <h1 className="mt-2 text-2xl font-bold text-blue-950">
          Hospital de Heredia
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Ingrese con su cuenta individual autorizada.
        </p>
        {unauthorized ? (
          <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            La cuenta está inactiva o todavía no tiene un rol autorizado.
          </p>
        ) : null}
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
