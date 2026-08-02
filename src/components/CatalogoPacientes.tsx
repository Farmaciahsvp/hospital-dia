"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/Modal";
import { Toast, type ToastState } from "@/components/Toast";

type Ficha = {
  id: string;
  identificacion: string;
  nombre: string | null;
  solicitudes: number;
};

/**
 * Las fichas de paciente no se veían en ninguna pantalla: solo asomaban en el
 * autocompletado de la captura. Una cédula mal tecleada creaba una ficha que
 * nadie podía encontrar ni retirar, y que seguía compitiendo con la correcta
 * justo cuando el nombre se autorrellena a partir de ella.
 *
 * Solo se pueden eliminar fichas sin historial. Con solicitudes asociadas, el
 * borrado se llevaría registros clínicos por delante: ese caso es una fusión de
 * fichas, que todavía no existe.
 */
export function CatalogoPacientes() {
  const [toast, setToast] = useState<ToastState>(null);
  const [query, setQuery] = useState("");
  const [soloSinRegistros, setSoloSinRegistros] = useState(true);
  const [rows, setRows] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(false);
  const [porEliminar, setPorEliminar] = useState<Ficha | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/patients", window.location.origin);
      url.searchParams.set("conRecuento", "true");
      if (query.trim()) url.searchParams.set("query", query.trim());
      if (soloSinRegistros) url.searchParams.set("soloSinRegistros", "true");
      setRows(await fetchJson<Ficha[]>(url.toString(), { cache: "no-store" }));
    } catch (e) {
      setRows([]);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }, [query, soloSinRegistros]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const eliminar = useCallback(async () => {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await fetchJson(`/api/patients/${porEliminar.id}`, { method: "DELETE" });
      setToast({ kind: "success", message: `Ficha eliminada: ${porEliminar.identificacion}` });
      setPorEliminar(null);
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "No se pudo eliminar" });
    } finally {
      setEliminando(false);
    }
  }, [porEliminar, refresh]);

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-zinc-500">Catálogo</div>
          <h2 className="text-base font-semibold text-zinc-900">Fichas de paciente</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Solo pueden eliminarse fichas sin registros. Las que tienen historial requieren
            fusionarlas, no borrarlas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar">
            {(f) => (
              <Input
                {...f}
                className="mt-1 w-64"
                placeholder="Cédula o nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              checked={soloSinRegistros}
              onChange={(e) => setSoloSinRegistros(e.target.checked)}
            />
            Solo sin registros
          </label>
          <Button variant="secondary" type="button" className="mb-1" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Fichas de paciente registradas</caption>
          <thead className="bg-white">
            <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
              <th scope="col" className="px-4 py-2 text-left">Identificación</th>
              <th scope="col" className="px-4 py-2 text-left">Nombre</th>
              <th scope="col" className="px-4 py-2 text-center">Registros</th>
              <th scope="col" className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-b border-zinc-100">
                <td className="px-4 py-2 font-medium">{f.identificacion}</td>
                <td className="px-4 py-2">{f.nombre ?? "—"}</td>
                <td className="px-4 py-2 text-center">{f.solicitudes}</td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant="danger"
                    type="button"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={f.solicitudes > 0}
                    title={
                      f.solicitudes > 0
                        ? "Tiene registros asociados: hay que fusionar la ficha, no eliminarla"
                        : undefined
                    }
                    onClick={() => setPorEliminar(f)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Eliminar
                    <span className="sr-only">{` ficha ${f.identificacion}`}</span>
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">
                  {loading
                    ? "Cargando…"
                    : soloSinRegistros
                      ? "No hay fichas sin registros."
                      : "Sin resultados."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!porEliminar}
        title="Eliminar ficha de paciente"
        onClose={() => setPorEliminar(null)}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setPorEliminar(null)}>
              Volver
            </Button>
            <Button variant="danger" type="button" disabled={eliminando} onClick={() => void eliminar()}>
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-zinc-700">
          ¿Eliminar la ficha de{" "}
          <strong>
            {porEliminar?.identificacion} {porEliminar?.nombre ?? ""}
          </strong>
          ? No tiene registros asociados. Dejará de aparecer en el autocompletado de la captura.
        </p>
      </Modal>

      <Toast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
