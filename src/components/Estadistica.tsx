"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RefreshCw } from "lucide-react";

type Stats = {
  range: { from: string; to: string };
  totals: {
    recetas: number;
    pacientes: number;
    lineas: number;
    unidades: number;
    entregados: number;
    cancelados: number;
  };
  daily: Array<{ fecha: string; recetas: number; pacientes: number; lineas: number }>;
  status: Array<{ estado: string; count: number }>;
  adquisicion: Array<{ adquisicion: string; count: number }>;
  frecuencias: Array<{ frecuencia: string; count: number }>;
  topMedicamentos: Array<{ medicationId: string; medicamento: string; lineas: number; unidades: number }>;
  cancelMotivos: Array<{ motivo: string; count: number }>;
  cargaFarmaceuticos: Array<{ pharmacistId: string | null; nombre: string; lineas: number }>;
  cargaPrescriptores: Array<{ prescriberId: string | null; nombre: string; lineas: number }>;
  tiemposEntrega: { n: number; avgHours: number | null; p50Hours: number | null; p90Hours: number | null; sla4hPct: number | null };
  upcoming: Array<{ fechaAplicacion: string; pacientes: number; lineas: number }>;
  requestId: string;
};

function formatDMY(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function nf(n: number) {
  return new Intl.NumberFormat("es-CR").format(n);
}

function round1(n: number | null) {
  if (n === null) return "-";
  return `${Math.round(n * 10) / 10}`;
}

export function Estadistica() {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const fromDefault = useMemo(() => {
    const d = new Date(`${todayStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 29);
    return d.toISOString().slice(0, 10);
  }, [todayStr]);

  const [from, setFrom] = useState(fromDefault);
  const [to, setTo] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Stats | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/estadistica", window.location.origin);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      const res = await fetchJson<Stats>(url.toString(), { cache: "no-store" });
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-end md:justify-center">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-600">DESDE (FECHA DE RECEPCIÓN)</label>
              <Input className="mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">HASTA</label>
              <Input className="mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex items-end justify-center gap-2">
              <Button variant="secondary" type="button" className="py-1.5" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                ACTUALIZAR
              </Button>
              {data?.requestId ? (
                <div className="text-xs text-zinc-500">REQUEST ID: {data.requestId}</div>
              ) : null}
            </div>
          </div>
          <div className="text-sm text-zinc-600">{loading ? "CARGANDO..." : ""}</div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.toUpperCase()}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { label: "RECETAS RECIBIDAS", value: nf(data.totals.recetas) },
                { label: "PACIENTES", value: nf(data.totals.pacientes) },
                { label: "LÍNEAS (ITEMS)", value: nf(data.totals.lineas) },
                { label: "UNIDADES (SUMA)", value: nf(data.totals.unidades) },
                { label: "ENTREGADOS", value: nf(data.totals.entregados) },
                { label: "CANCELADOS", value: nf(data.totals.cancelados) },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-center shadow-sm">
                  <div className="text-xs font-semibold text-blue-900">{c.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-blue-950">{c.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">VOLUMEN DIARIO (RECEPCIÓN)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">FECHA</th>
                          <th className="px-3 py-2 text-center">RECETAS</th>
                          <th className="px-3 py-2 text-center">PACIENTES</th>
                          <th className="px-3 py-2 text-center">LÍNEAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((d, idx) => (
                          <tr
                            key={d.fecha}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-center">{formatDMY(d.fecha)}</td>
                            <td className="px-3 py-2 text-center">{nf(d.recetas)}</td>
                            <td className="px-3 py-2 text-center">{nf(d.pacientes)}</td>
                            <td className="px-3 py-2 text-center">{nf(d.lineas)}</td>
                          </tr>
                        ))}
                        {!data.daily.length ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">ESTADOS</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">ESTADO</th>
                          <th className="px-3 py-2 text-center">CANTIDAD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.status.map((s, idx) => (
                          <tr
                            key={s.estado}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="px-3 py-2 text-center font-semibold">{s.estado.toUpperCase()}</td>
                            <td className="px-3 py-2 text-center">{nf(s.count)}</td>
                          </tr>
                        ))}
                        {!data.status.length ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">TIEMPOS DE ENTREGA (CREACIÓN → ENTREGA)</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-4 py-4 text-center text-sm text-blue-950">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-semibold text-blue-900">REGISTROS</div>
                      <div className="mt-1 text-lg font-semibold">{nf(data.tiemposEntrega.n)}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-semibold text-blue-900">SLA ≤ 4H</div>
                      <div className="mt-1 text-lg font-semibold">
                        {data.tiemposEntrega.sla4hPct === null ? "-" : `${data.tiemposEntrega.sla4hPct}%`}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-semibold text-blue-900">PROMEDIO (H)</div>
                      <div className="mt-1 text-lg font-semibold">{round1(data.tiemposEntrega.avgHours)}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-semibold text-blue-900">P50 / P90 (H)</div>
                      <div className="mt-1 text-lg font-semibold">
                        {round1(data.tiemposEntrega.p50Hours)} / {round1(data.tiemposEntrega.p90Hours)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">TOP MEDICAMENTOS</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">MEDICAMENTO</th>
                          <th className="px-3 py-2 text-center">LÍNEAS</th>
                          <th className="px-3 py-2 text-center">UNIDADES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topMedicamentos.map((m, idx) => (
                          <tr
                            key={m.medicationId}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="px-3 py-2 text-center">{m.medicamento}</td>
                            <td className="px-3 py-2 text-center">{nf(m.lineas)}</td>
                            <td className="px-3 py-2 text-center">{nf(m.unidades)}</td>
                          </tr>
                        ))}
                        {!data.topMedicamentos.length ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">ADQUISICIÓN / FRECUENCIA</div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4">
                    <div className="overflow-auto rounded-xl border border-zinc-200">
                      <table className="min-w-full text-center text-sm text-blue-950">
                        <thead className="bg-white">
                          <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                            <th className="px-3 py-2 text-center">ADQUISICIÓN</th>
                            <th className="px-3 py-2 text-center">CANTIDAD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.adquisicion.map((a, idx) => (
                            <tr
                              key={a.adquisicion}
                              className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                            >
                              <td className="px-3 py-2 text-center font-semibold">{a.adquisicion.toUpperCase()}</td>
                              <td className="px-3 py-2 text-center">{nf(a.count)}</td>
                            </tr>
                          ))}
                          {!data.adquisicion.length ? (
                            <tr>
                              <td colSpan={2} className="px-3 py-8 text-center text-sm text-zinc-500">
                                SIN DATOS
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-auto rounded-xl border border-zinc-200">
                      <table className="min-w-full text-center text-sm text-blue-950">
                        <thead className="bg-white">
                          <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                            <th className="px-3 py-2 text-center">FRECUENCIA</th>
                            <th className="px-3 py-2 text-center">CANTIDAD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.frecuencias.map((f, idx) => (
                            <tr
                              key={`${f.frecuencia}-${idx}`}
                              className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                            >
                              <td className="px-3 py-2 text-center">{f.frecuencia}</td>
                              <td className="px-3 py-2 text-center">{nf(f.count)}</td>
                            </tr>
                          ))}
                          {!data.frecuencias.length ? (
                            <tr>
                              <td colSpan={2} className="px-3 py-8 text-center text-sm text-zinc-500">
                                SIN DATOS
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">CARGA POR FARMACÉUTICO (LÍNEAS)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">FARMACÉUTICO</th>
                          <th className="px-3 py-2 text-center">LÍNEAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cargaFarmaceuticos.map((r, idx) => (
                          <tr
                            key={`${r.nombre}-${idx}`}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="px-3 py-2 text-center">{r.nombre}</td>
                            <td className="px-3 py-2 text-center">{nf(r.lineas)}</td>
                          </tr>
                        ))}
                        {!data.cargaFarmaceuticos.length ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">CARGA POR PRESCRIPTOR (LÍNEAS)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">PRESCRIPTOR</th>
                          <th className="px-3 py-2 text-center">LÍNEAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cargaPrescriptores.map((r, idx) => (
                          <tr
                            key={`${r.nombre}-${idx}`}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="px-3 py-2 text-center">{r.nombre}</td>
                            <td className="px-3 py-2 text-center">{nf(r.lineas)}</td>
                          </tr>
                        ))}
                        {!data.cargaPrescriptores.length ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-zinc-900">CANCELACIONES (MOTIVOS)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">MOTIVO</th>
                          <th className="px-3 py-2 text-center">CANTIDAD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cancelMotivos.map((m, idx) => (
                          <tr
                            key={`${m.motivo}-${idx}`}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="px-3 py-2 text-center">{m.motivo}</td>
                            <td className="px-3 py-2 text-center">{nf(m.count)}</td>
                          </tr>
                        ))}
                        {!data.cancelMotivos.length ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-200 px-4 py-3">
                    <div className="text-sm font-semibold text-zinc-900">PRÓXIMOS 31 DÍAS (FECHAS DE APLICACIÓN)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-center text-sm text-blue-950">
                      <thead className="bg-white">
                        <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                          <th className="px-3 py-2 text-center">FECHA</th>
                          <th className="px-3 py-2 text-center">PACIENTES</th>
                          <th className="px-3 py-2 text-center">LÍNEAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.upcoming.map((u, idx) => (
                          <tr
                            key={u.fechaAplicacion}
                            className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-center">{formatDMY(u.fechaAplicacion)}</td>
                            <td className="px-3 py-2 text-center">{nf(u.pacientes)}</td>
                            <td className="px-3 py-2 text-center">{nf(u.lineas)}</td>
                          </tr>
                        ))}
                        {!data.upcoming.length ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-8 text-center text-sm text-zinc-500">
                              SIN DATOS
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
