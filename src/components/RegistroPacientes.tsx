"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/api-client";

type Row = {
  patientId: string;
  medicationId: string;
  fechaRecepcion: string | null;
  numeroReceta: string | null;
  cedula: string;
  nombre: string | null;
  medicamento: string;
  dosis: string;
  fechasAplicacion: string[];
  farmaceutico: string | null;
};

function formatDMY(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

const aplicacionesStorageKey = "hd_aplicaciones_cumplidas_v1";

export function RegistroPacientes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [aplicacionesCumplidas, setAplicacionesCumplidas] = useState<Set<string>>(() => new Set());

  const [toDelete, setToDelete] = useState<{
    patientId: string;
    cedula: string;
    nombre: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/registro-pacientes", window.location.origin);
      url.searchParams.set("historico", "1");
      url.searchParams.set("take", String(pageSize));
      url.searchParams.set("offset", String((page - 1) * pageSize));
      const q = query.trim();
      if (q) url.searchParams.set("q", q);

      const data = await fetchJson<{ rows: Row[]; total: number }>(url.toString(), { cache: "no-store" });
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = useMemo(() => rows, [rows]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(aplicacionesStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        setAplicacionesCumplidas(new Set(parsed));
      }
    } catch {
      // ignore
    }
  }, []);

  function getAplicacionKey(row: Row, fechaIso: string) {
    return [row.patientId, row.medicationId, row.dosis, row.numeroReceta ?? "", fechaIso].join("|");
  }

  function toggleAplicacionCumplida(row: Row, fechaIso: string) {
    const k = getAplicacionKey(row, fechaIso);
    setAplicacionesCumplidas((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      try {
        window.localStorage.setItem(aplicacionesStorageKey, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-xl">
            <label className="block text-xs font-medium text-zinc-600">BUSCAR</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="CÉDULA / NOMBRE / RECETA / MEDICAMENTO"
                />
              </div>
              <Button variant="secondary" type="button" onClick={() => void load()}>
                ACTUALIZAR
              </Button>
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            {loading ? "CARGANDO..." : `${total} REGISTROS`}
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.toUpperCase()}
          </div>
        ) : null}

        <div className="mt-4 overflow-auto rounded-2xl border border-zinc-200">
          <table className="min-w-full text-center text-sm text-blue-950">
            <thead className="bg-white">
              <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                <th className="px-3 py-2 text-center">FECHA DE RECEPCIÓN</th>
                <th className="px-3 py-2 text-center">NÚMERO DE RECETA</th>
                <th className="px-3 py-2 text-center">CÉDULA</th>
                <th className="px-3 py-2 text-center">NOMBRE</th>
                <th className="px-3 py-2 text-center">MEDICAMENTO</th>
                <th className="px-3 py-2 text-center">DOSIS</th>
                <th className="px-3 py-2 text-center">FECHAS DE APLICACIÓN</th>
                <th className="px-3 py-2 text-center">FARMACÉUTICO</th>
                <th className="px-3 py-2 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr
                  key={`${idx}-${r.patientId}-${r.medicamento}-${r.dosis}-${r.numeroReceta ?? ""}`}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    {r.fechaRecepcion ? formatDMY(r.fechaRecepcion) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">{r.numeroReceta ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center font-medium">{r.cedula}</td>
                  <td className="px-3 py-2 text-center">{r.nombre ?? ""}</td>
                  <td className="px-3 py-2 text-center">{r.medicamento}</td>
                  <td className="px-3 py-2 text-center">{r.dosis}</td>
                  <td className="px-3 py-2 text-center">
                    {r.fechasAplicacion.length ? (
                      <div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">
                        {r.fechasAplicacion.map((iso, i) => {
                          const key = getAplicacionKey(r, iso);
                          const cumplida = aplicacionesCumplidas.has(key);
                          return (
                            <span key={iso} className="whitespace-nowrap">
                              <button
                                type="button"
                                className={[
                                  "rounded px-1",
                                  "underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                                  cumplida ? "text-emerald-700" : "text-blue-950",
                                ].join(" ")}
                                aria-pressed={cumplida}
                                title={cumplida ? "APLICACIÓN CUMPLIDA (CLICK PARA DESMARCAR)" : "CLICK PARA MARCAR COMO CUMPLIDA"}
                                onClick={() => toggleAplicacionCumplida(r, iso)}
                              >
                                {formatDMY(iso)}
                              </button>
                              {i < r.fechasAplicacion.length - 1 ? <span className="text-zinc-400">, </span> : null}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">{r.farmaceutico ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="danger"
                        type="button"
                        className="px-2 py-2"
                        aria-label="Eliminar paciente"
                        onClick={() =>
                          setToDelete({
                            patientId: r.patientId,
                            cedula: r.cedula,
                            nombre: r.nombre ?? "",
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && !loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-zinc-500">
                    SIN REGISTROS
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-2 md:flex-row">
          <div className="text-xs text-zinc-500">
            PÁGINA {page} DE {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              type="button"
              className="py-1.5"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ANTERIOR
            </Button>
            <Button
              variant="secondary"
              type="button"
              className="py-1.5"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              SIGUIENTE
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={!!toDelete}
        title="ELIMINAR PACIENTE"
        onClose={() => setToDelete(null)}
        footer={
          toDelete ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setToDelete(null)}>
                VOLVER
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={async () => {
                  if (!toDelete) return;
                  setError(null);
                  try {
                    await fetchJson(`/api/registro-pacientes/${toDelete.patientId}`, {
                      method: "DELETE",
                    });
                    setToDelete(null);
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Error");
                  }
                }}
              >
                ELIMINAR (TODAS LAS FECHAS)
              </Button>
            </div>
          ) : null
        }
      >
        <div className="text-sm text-zinc-700">
          ¿ELIMINAR A{" "}
          <span className="font-semibold">
            {toDelete?.cedula} {toDelete?.nombre}
          </span>
          ? SE BORRAN TODAS SUS FECHAS DE APLICACIÓN Y REGISTROS.
        </div>
      </Modal>
    </div>
  );
}
