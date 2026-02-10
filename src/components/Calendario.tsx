"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarDays, ChevronLeft, ChevronRight, FileText, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { exportCalendarDayPdf, type CalendarDayExportRow } from "@/lib/export";

type DayPatient = {
  patientId?: string;
  identificacion: string;
  nombre: string | null;
  lines: {
    medicamento: string;
    dosis: string;
    unidades: number;
    estado: string;
  }[];
};

type AgendaItem = {
  id: string;
  patientId?: string;
  prepRequestId?: string;
  fechaAplicacion: string;
  numeroReceta?: string | null;
  estado: string;
  identificacion: string;
  nombre: string | null;
  prescriberCodigo?: string | null;
  pharmacistCodigo?: string | null;
  medicationCodigo?: string | null;
  medicationNombre?: string;
  medicationViaAdministracion?: string | null;
  medicamento: string;
  dosisTexto: string;
  unidadesRequeridas: number;
  recursoAmparo?: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDMY(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function statusLabel(status: string) {
  switch (status) {
    case "pendiente":
      return "PENDIENTE";
    case "en_preparacion":
      return "EN PREPARACION";
    case "listo":
      return "LISTO";
    case "entregado":
      return "ENTREGADO";
    case "cancelado":
      return "CANCELADO";
    default:
      return status.toUpperCase();
  }
}

function statusClass(status: string) {
  switch (status) {
    case "pendiente":
      return "bg-sky-50 text-sky-700";
    case "en_preparacion":
      return "bg-blue-50 text-blue-700";
    case "listo":
      return "bg-indigo-50 text-indigo-700";
    case "entregado":
      return "bg-slate-100 text-slate-700";
    case "cancelado":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export function Calendario() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => toISODate(new Date()));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<DayPatient[]>([]);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const loadRequestIdRef = useRef(0);

  const monthLabel = useMemo(() => {
    return month.toLocaleDateString("es-ES", { month: "long", year: "numeric" }).toUpperCase();
  }, [month]);

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const start = new Date(first);
    const dow = (start.getDay() + 6) % 7; // Monday=0
    start.setDate(start.getDate() - dow);

    const result: { date: Date; inMonth: boolean; iso: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISODate(d);
      result.push({ date: d, inMonth: d.getMonth() === month.getMonth(), iso });
    }
    return result;
  }, [month]);

  async function loadDay(iso: string) {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ items?: AgendaItem[] }>(`/api/items?date=${encodeURIComponent(iso)}&take=5000`, {
        cache: "no-store",
      });
      if (requestId !== loadRequestIdRef.current) return;
      const items = data.items ?? [];
      setItems(items);

      const map = new Map<string, DayPatient>();
      for (const it of items) {
        const key = it.patientId ?? it.identificacion;
        const current =
          map.get(key) ??
          ({
            patientId: it.patientId,
            identificacion: it.identificacion,
            nombre: it.nombre,
            lines: [],
          } satisfies DayPatient);
        current.lines.push({
          medicamento: it.medicamento,
          dosis: it.dosisTexto,
          unidades: it.unidadesRequeridas,
          estado: it.estado,
        });
        map.set(key, current);
      }

      const list = Array.from(map.values()).sort((a, b) => a.identificacion.localeCompare(b.identificacion));
      setPatients(list);
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return;
      setPatients([]);
      setItems([]);
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadDay(selected);
  }, [selected]);

  function handleExportPdf() {
    if (!items.length) return;
    const rows: CalendarDayExportRow[] = items
      .map((it) => ({
        identificacion: it.identificacion,
        nombre: it.recursoAmparo ? `${it.nombre ?? ""} **` : it.nombre,
        numeroReceta: it.numeroReceta ?? null,
        medicationCodigo: it.medicationCodigo ?? null,
        medicationNombre: it.medicationNombre ?? it.medicamento,
        viaAdministracion: it.medicationViaAdministracion ?? null,
        dosis: it.dosisTexto,
        unidades: it.unidadesRequeridas,
        prescriberCodigo: it.prescriberCodigo ?? null,
      }))
      .sort((a, b) => {
        const byId = a.identificacion.localeCompare(b.identificacion);
        if (byId) return byId;
        const byCode = (a.medicationCodigo ?? "").localeCompare(b.medicationCodigo ?? "");
        if (byCode) return byCode;
        const byName = a.medicationNombre.localeCompare(b.medicationNombre);
        if (byName) return byName;
        return a.dosis.localeCompare(b.dosis);
      });

    exportCalendarDayPdf(
      rows,
      `CALENDARIO_${selected}.pdf`,
      "HOSPITAL DE HEREDIA - SERVICIO DE FARMACIA",
      `PACIENTES DEL DIA ${formatDMY(selected)}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="text-sm font-semibold text-zinc-900">{monthLabel}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  className="px-2 py-2"
                  onClick={() => {
                    const selectedDate = parseIsoDate(selected) ?? new Date();
                    const nextSelected = new Date(
                      selectedDate.getFullYear(),
                      selectedDate.getMonth() - 1,
                      selectedDate.getDate(),
                    );
                    setMonth(startOfMonth(nextSelected));
                    setSelected(toISODate(nextSelected));
                  }}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  className="px-2 py-2"
                  onClick={() => {
                    const selectedDate = parseIsoDate(selected) ?? new Date();
                    const nextSelected = new Date(
                      selectedDate.getFullYear(),
                      selectedDate.getMonth() + 1,
                      selectedDate.getDate(),
                    );
                    setMonth(startOfMonth(nextSelected));
                    setSelected(toISODate(nextSelected));
                  }}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setMonth(startOfMonth(now));
                    setSelected(toISODate(now));
                  }}
                >
                  HOY
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-zinc-500">
              {["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {days.map((d) => {
                const isSelected = d.iso === selected;
                const isToday = isSameDay(d.date, today);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => {
                      setSelected(d.iso);
                      setMonth(startOfMonth(d.date));
                    }}
                    className={[
                      "h-12 rounded-xl border text-sm shadow-sm transition",
                      d.inMonth ? "bg-white" : "bg-zinc-50",
                      d.inMonth ? "border-zinc-200" : "border-zinc-100",
                      isSelected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "hover:bg-blue-50/40",
                      isToday && !isSelected ? "ring-2 ring-blue-50" : "",
                    ].join(" ")}
                    aria-label={d.iso}
                  >
                    <div className={d.inMonth ? "text-zinc-900" : "text-zinc-400"}>{d.date.getDate()}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 text-center">
                <div className="text-xs font-medium text-zinc-500">DÍA SELECCIONADO</div>
                <div className="text-sm font-semibold text-zinc-900">{formatDMY(selected)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  className="py-1.5"
                  onClick={handleExportPdf}
                  disabled={loading || !items.length}
                  title={items.length ? "EXPORTAR PDF" : "NO HAY DATOS PARA EXPORTAR"}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  EXPORTAR PDF
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  className="py-1.5"
                  onClick={() => void loadDay(selected)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  ACTUALIZAR
                </Button>
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error.toUpperCase()}
              </div>
            ) : null}

            <div className="mt-3 text-center text-sm text-zinc-600">
              {loading ? "CARGANDO..." : `${patients.length} PACIENTES`}
            </div>

            <div className="mt-3 max-h-[70vh] space-y-3 overflow-auto pr-1">
              {patients.map((p) => (
                <div
                  key={p.patientId ?? p.identificacion}
                  className="rounded-2xl border border-zinc-200 bg-white p-3 text-center"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 text-center">
                      <div className="text-sm font-semibold text-blue-950">{p.identificacion}</div>
                      <div className="text-xs text-zinc-600">{p.nombre ?? ""}</div>
                    </div>
                    <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      {p.lines.length} LÍNEAS
                    </div>
                  </div>
                  <div className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
                    {p.lines.map((l, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 bg-white px-2 py-2 text-xs text-blue-950">
                        <div className="col-span-6 text-center">{l.medicamento}</div>
                        <div className="col-span-3 text-center">{l.dosis}</div>
                        <div className="col-span-1 text-center">{l.unidades}</div>
                        <div className="col-span-2 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${statusClass(l.estado)}`}>
                            {statusLabel(l.estado)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!patients.length && !loading ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
                  SIN PACIENTES PROGRAMADOS PARA ESTE DÍA.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
