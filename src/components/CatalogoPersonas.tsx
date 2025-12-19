"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast, type ToastState } from "@/components/Toast";
import { RefreshCw } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Pencil, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/api-client";

type Row = { id: string; codigo: string; nombres: string; apellidos: string };

const schema = z.object({
  codigo: z.string().trim().min(1),
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
});

type FormValues = z.infer<typeof schema>;

export function CatalogoPersonas({
  title,
  apiPath,
  codigoLabel = "Código",
}: {
  title: string;
  apiPath: "/api/pharmacists" | "/api/prescribers";
  codigoLabel?: string;
}) {
  const [toast, setToast] = useState<ToastState>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(apiPath, window.location.origin);
      if (debouncedQuery) url.searchParams.set("query", debouncedQuery);
      const data = await fetchJson<Row[]>(url.toString(), { cache: "no-store" });
      setRows(data);
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }, [apiPath, debouncedQuery]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(t);
  }, [refresh]);

  const { register, handleSubmit, reset, formState, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: "", nombres: "", apellidos: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await fetchJson(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      setToast({ kind: "success", message: "Guardado" });
      reset();
      setEditingId(null);
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  });

  const startEdit = useCallback(
    (row: Row) => {
      setEditingId(row.id);
      setValue("codigo", row.codigo);
      setValue("nombres", row.nombres);
      setValue("apellidos", row.apellidos);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setValue],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteRow) return;
    try {
      const base =
        apiPath === "/api/pharmacists"
          ? "/api/pharmacists"
          : apiPath === "/api/prescribers"
            ? "/api/prescribers"
            : apiPath;
      await fetchJson(`${base}/${deleteRow.id}`, { method: "DELETE" });
      setToast({ kind: "success", message: "Eliminado" });
      setDeleteRow(null);
      if (editingId === deleteRow.id) {
        reset();
        setEditingId(null);
      }
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  }, [apiPath, deleteRow, editingId, refresh, reset]);

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <Toast toast={toast} onClear={() => setToast(null)} />
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-500">Catálogo</div>
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
            <div className="w-full max-w-sm">
              <label className="block text-xs font-medium text-zinc-600">Buscar</label>
              <Input
                className="mt-1"
                placeholder="código o nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900">
                {editingId ? "Editar" : "Registrar / actualizar"}
              </div>
              {editingId ? (
                <Button
                  variant="secondary"
                  type="button"
                  className="py-1.5"
                  onClick={() => {
                    reset();
                    setEditingId(null);
                  }}
                >
                  Cancelar edición
                </Button>
              ) : null}
            </div>
            <form className="grid grid-cols-1 gap-3 md:grid-cols-10" onSubmit={onSubmit}>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">{codigoLabel}</label>
                <Input className="mt-1" {...register("codigo")} />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-zinc-600">Nombre</label>
                <Input className="mt-1" {...register("nombres")} />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-zinc-600">Apellidos</label>
                <Input className="mt-1" {...register("apellidos")} />
              </div>
              <div className="md:col-span-10 flex justify-end">
                <Button variant="primary" type="submit" disabled={formState.isSubmitting}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
            <div className="text-sm text-zinc-600">
              {loading ? "Cargando…" : `${rows.length} registros`}
            </div>
            <Button variant="secondary" onClick={() => refresh()} type="button" className="py-1.5">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-white">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                  <th className="px-3 py-2 text-center">{codigoLabel}</th>
                  <th className="px-3 py-2 text-center">Nombre</th>
                  <th className="px-3 py-2 text-center">Apellidos</th>
                  <th className="px-3 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                  >
                    <td className="px-3 py-2 text-center font-medium whitespace-nowrap">{r.codigo}</td>
                    <td className="px-3 py-2 text-center">{r.nombres}</td>
                    <td className="px-3 py-2 text-center">{r.apellidos}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="subtle"
                          type="button"
                          className="px-2 py-2"
                          onClick={() => startEdit(r)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="danger"
                          type="button"
                          className="px-2 py-2"
                          onClick={() => setDeleteRow(r)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-zinc-500">
                      Sin registros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={!!deleteRow}
        title="Eliminar"
        onClose={() => setDeleteRow(null)}
        footer={
          deleteRow ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setDeleteRow(null)}>
                Volver
              </Button>
              <Button variant="danger" type="button" onClick={() => void confirmDelete()}>
                Eliminar
              </Button>
            </div>
          ) : null
        }
      >
        <div className="text-sm text-zinc-700">
          ¿Eliminar el registro <span className="font-semibold">{deleteRow?.codigo}</span>?
        </div>
      </Modal>
    </div>
  );
}
