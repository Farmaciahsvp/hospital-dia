"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setError(result?.error ?? "No fue posible actualizar la contraseña.");
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <div>
        <label className="text-sm font-semibold text-zinc-800" htmlFor="password">
          Nueva contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={14}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <label
          className="text-sm font-semibold text-zinc-800"
          htmlFor="confirmation"
        >
          Confirmar contraseña
        </label>
        <input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={14}
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-950 px-4 py-2.5 font-semibold text-white hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
