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

type MedicationRow = {
  id: string;
  codigoInstitucional: string | null;
  nombre: string;
  concentracion: string | null;
  viaAdministracion: string | null;
};

function formatMedicationCode(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 9); // 1+2+2+4
  const a = digits.slice(0, 1);
  const b = digits.slice(1, 3);
  const c = digits.slice(3, 5);
  const d = digits.slice(5, 9);
  return [a, b, c, d].filter(Boolean).join("-");
}

const schema = z.object({
  codigoInstitucional: z
    .string()
    .trim()
    .regex(/^\d-\d{2}-\d{2}-\d{4}$/, "Formato esperado: 0-00-00-0000"),
  nombre: z.string().trim().min(1),
  concentracion: z.string().trim().min(1),
  viaAdministracion: z.string().trim().min(1),
});

type FormValues = z.infer<typeof schema>;

export function CatalogoMedicamentos() {
  const [toast, setToast] = useState<ToastState>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<MedicationRow | null>(null);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/medications", window.location.origin);
      if (debouncedQuery) url.searchParams.set("query", debouncedQuery);
      const data = await fetchJson<Array<MedicationRow & { label?: string; presentacion?: string | null }>>(
        url.toString(),
        { cache: "no-store" },
      );
      setRows(
        data.map((d) => ({
          id: d.id,
          codigoInstitucional: d.codigoInstitucional,
          nombre: d.nombre,
          concentracion: d.concentracion ?? null,
          viaAdministracion: d.viaAdministracion ?? null,
        })),
      );
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(t);
  }, [refresh]);

  const { register, handleSubmit, reset, formState, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigoInstitucional: "",
      nombre: "",
      concentracion: "",
      viaAdministracion: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await fetchJson("/api/medications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          codigoInstitucional: values.codigoInstitucional,
          nombre: values.nombre,
          concentracion: values.concentracion,
          viaAdministracion: values.viaAdministracion,
        }),
      });
      setToast({ kind: "success", message: "Medicamento guardado" });
      reset();
      setEditingId(null);
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  });

  const startEdit = useCallback(
    (row: MedicationRow) => {
      setEditingId(row.id);
      setValue("codigoInstitucional", row.codigoInstitucional ?? "");
      setValue("nombre", row.nombre ?? "");
      setValue("concentracion", row.concentracion ?? "");
      setValue("viaAdministracion", row.viaAdministracion ?? "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setValue],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteRow) return;
    try {
      await fetchJson(`/api/medications/${deleteRow.id}`, { method: "DELETE" });
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
  }, [deleteRow, editingId, refresh, reset]);

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-500">Catálogo</div>
              <h2 className="text-lg font-semibold">Medicamentos</h2>
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
                {editingId ? "Editar medicamento" : "Registrar / actualizar"}
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
                <label className="block text-xs font-medium text-zinc-600">
                  Código del medicamento
                </label>
                <Input
                  className="mt-1"
                  placeholder="0-00-00-0000"
                  inputMode="numeric"
                  maxLength={12}
                  {...register("codigoInstitucional", {
                    onChange: (e) => {
                      const formatted = formatMedicationCode(e.target.value as string);
                      setValue("codigoInstitucional", formatted, { shouldDirty: true, shouldValidate: true });
                    },
                  })}
                />
                {formState.errors.codigoInstitucional ? (
                  <div className="mt-1 text-xs text-rose-700">
                    {formState.errors.codigoInstitucional.message}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-zinc-600">Nombre</label>
                <Input className="mt-1" {...register("nombre")} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-zinc-600">Concentración</label>
                <Input className="mt-1" placeholder="Ej: 500 mg/5 mL" {...register("concentracion")} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Vía de Administración</label>
                <Input className="mt-1" placeholder="IV / VO / SC" {...register("viaAdministracion")} />
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
              {loading ? "Cargando…" : `${rows.length} medicamentos`}
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
                  <th className="px-3 py-2 text-center">Código</th>
                  <th className="px-3 py-2 text-center">Nombre</th>
                  <th className="px-3 py-2 text-center">Concentración</th>
                  <th className="px-3 py-2 text-center">Vía</th>
                  <th className="px-3 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                  >
                    <td className="px-3 py-2 text-center font-medium whitespace-nowrap">
                      {r.codigoInstitucional ?? ""}
                    </td>
                    <td className="px-3 py-2 text-center">{r.nombre}</td>
                    <td className="px-3 py-2 text-center">{r.concentracion ?? ""}</td>
                    <td className="px-3 py-2 text-center">{r.viaAdministracion ?? ""}</td>
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
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-zinc-500">
                      Sin medicamentos.
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
        title="Eliminar medicamento"
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
          ¿Eliminar el medicamento <span className="font-semibold">{deleteRow?.nombre}</span>?
        </div>
      </Modal>
    </div>
  );
}
