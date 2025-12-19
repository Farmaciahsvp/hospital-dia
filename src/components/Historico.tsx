"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/Modal";
import { Search } from "lucide-react";
import { fetchJson } from "@/lib/api-client";

type HistoricoRequest = {
  id: string;
  fechaAplicacion: string;
  patientId: string;
  identificacion: string;
  nombre: string | null;
  finalizadoAt: string | null;
  itemsCount: number;
};

type HistoricoItem = {
  id: string;
  estado: string;
  medicamento: string;
  dosisTexto: string;
  unidadesRequeridas: number;
  observaciones: string | null;
  entregadoAt: string | null;
  canceladoMotivo: string | null;
};

export function Historico() {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState(todayStr);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<HistoricoRequest[]>([]);

  const [openReqId, setOpenReqId] = useState<string | null>(null);
  const [openReqItems, setOpenReqItems] = useState<HistoricoItem[] | null>(null);
  const [openReqLoading, setOpenReqLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/prep-requests", window.location.origin);
      url.searchParams.set("historico", "1");
      if (fecha) url.searchParams.set("date", fecha);
      const data = await fetchJson<{ requests: HistoricoRequest[] }>(url.toString(), { cache: "no-store" });
      setRequests(data.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(id: string) {
    setOpenReqId(id);
    setOpenReqItems(null);
    setOpenReqLoading(true);
    try {
      const data = await fetchJson<{ items: HistoricoItem[] }>(`/api/prep-requests/${id}`, { cache: "no-store" });
      setOpenReqItems(data.items ?? []);
    } catch {
      setOpenReqItems([]);
    } finally {
      setOpenReqLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const haystack = `${r.identificacion} ${r.nombre ?? ""}`.toUpperCase();
      return haystack.includes(q);
    });
  }, [requests, search]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-600">Fecha de aplicación</label>
              <Input className="mt-1" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600">Buscar paciente</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="CÉDULA / EXPEDIENTE / NOMBRE"
                  />
                </div>
                <Button variant="secondary" type="button" onClick={() => void load()} className="shrink-0">
                  Actualizar
                </Button>
              </div>
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            {loading ? "CARGANDO..." : `${filtered.length} REGISTROS`}
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.toUpperCase()}
          </div>
        ) : null}

        <div className="mt-4 overflow-auto rounded-2xl border border-zinc-200">
          <table className="min-w-full text-center text-sm">
            <thead className="bg-white">
              <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                <th className="px-3 py-2 text-center">FECHA</th>
                <th className="px-3 py-2 text-center">IDENTIFICACIÓN</th>
                <th className="px-3 py-2 text-center">NOMBRE</th>
                <th className="px-3 py-2 text-center">LÍNEAS</th>
                <th className="px-3 py-2 text-center">FINALIZADO</th>
                <th className="px-3 py-2 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                >
                  <td className="px-3 py-2 text-center whitespace-nowrap">{r.fechaAplicacion}</td>
                  <td className="px-3 py-2 text-center font-medium whitespace-nowrap">{r.identificacion}</td>
                  <td className="px-3 py-2 text-center">{r.nombre ?? ""}</td>
                  <td className="px-3 py-2 text-center">{r.itemsCount}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {r.finalizadoAt ? new Date(r.finalizadoAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center">
                      <Button variant="subtle" type="button" onClick={() => void openDetails(r.id)} className="px-3">
                        VER
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && !loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                    SIN REGISTROS
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!openReqId}
        title="DETALLE"
        onClose={() => {
          setOpenReqId(null);
          setOpenReqItems(null);
        }}
        footer={
          openReqId ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setOpenReqId(null);
                  setOpenReqItems(null);
                }}
              >
                CERRAR
              </Button>
            </div>
          ) : null
        }
      >
        {openReqLoading ? (
          <div className="text-sm text-zinc-600">CARGANDO...</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-200">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-white">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                  <th className="px-3 py-2 text-center">ESTADO</th>
                  <th className="px-3 py-2 text-center">MEDICAMENTO</th>
                  <th className="px-3 py-2 text-center">DOSIS</th>
                  <th className="px-3 py-2 text-center">UNIDADES</th>
                </tr>
              </thead>
              <tbody>
                {(openReqItems ?? []).map((it, idx) => (
                  <tr
                    key={it.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                  >
                    <td className="px-3 py-2 text-center">{it.estado}</td>
                    <td className="px-3 py-2 text-center">{it.medicamento}</td>
                    <td className="px-3 py-2 text-center">{it.dosisTexto}</td>
                    <td className="px-3 py-2 text-center">{it.unidadesRequeridas}</td>
                  </tr>
                ))}
                {openReqItems && !openReqItems.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                      SIN DETALLES
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
