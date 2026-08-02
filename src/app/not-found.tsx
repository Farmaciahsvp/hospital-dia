import Link from "next/link";

/**
 * Sin esto salía el 404 por defecto de Next ("This page could not be found."),
 * en inglés dentro de una aplicación en español y sin salida.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-blue-700">ERROR 404</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Puede que el enlace esté mal escrito o que la página ya no exista.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
        >
          Volver a la agenda
        </Link>
      </div>
    </div>
  );
}
