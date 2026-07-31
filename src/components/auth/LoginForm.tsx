"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      setPending(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <div>
        <label className="text-sm font-semibold text-zinc-800" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-zinc-800" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        {pending ? "INGRESANDO…" : "INGRESAR"}
      </button>
    </form>
  );
}
