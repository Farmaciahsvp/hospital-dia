"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill, RefreshCw, Search } from "lucide-react";
import { fetchJson } from "@/lib/api-client";

type MedicationCard = { key: string; nombre: string; ids: string[]; count: number };
type PatientRow = {
  patientId: string;
  identificacion: string;
  nombre: string | null;
  fechasAplicacion: string[];
  lineas: number;
};

function formatDMY(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function MedicamentosPanel() {
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [meds, setMeds] = useState<MedicationCard[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [patientsPage, setPatientsPage] = useState(1);
  const patientsPageSize = 50;
  const [patientsTotal, setPatientsTotal] = useState(0);

  const loadMeds = useCallback(async () => {
    setLoadingMeds(true);
    setError(null);
    try {
      const data = await fetchJson<{ medications?: MedicationCard[] }>("/api/medicamentos-resumen", { cache: "no-store" });
      const list = data.medications ?? [];
      setMeds(list);
      if (!selectedKey && list.length) setSelectedKey(list[0].key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setMeds([]);
    } finally {
      setLoadingMeds(false);
    }
  }, [selectedKey]);

  const loadPatients = useCallback(async (medicationIds: string[], pageToLoad: number) => {
    setLoadingPatients(true);
    setError(null);
    try {
      const joined = medicationIds.join(",");
      const url = new URL(`/api/medications/${joined}/patients`, window.location.origin);
      url.searchParams.set("historico", "1");
      url.searchParams.set("take", String(patientsPageSize));
      url.searchParams.set("offset", String((pageToLoad - 1) * patientsPageSize));
      const data = await fetchJson<{ patients?: PatientRow[]; total?: number }>(url.toString(), { cache: "no-store" });
      setPatients(data.patients ?? []);
      setPatientsTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setPatients([]);
      setPatientsTotal(0);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    void loadMeds();
  }, [loadMeds]);

  useEffect(() => {
    setPatientsPage(1);
  }, [selectedKey]);

  const filteredMeds = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return meds;
    return meds.filter((m) => m.nombre.toUpperCase().includes(q));
  }, [meds, query]);

  const selectedName = useMemo(() => {
    return meds.find((m) => m.key === selectedKey)?.nombre ?? "MEDICAMENTO";
  }, [meds, selectedKey]);

  const selectedIds = useMemo(() => {
    return meds.find((m) => m.key === selectedKey)?.ids ?? [];
  }, [meds, selectedKey]);

  useEffect(() => {
    if (!selectedIds.length) return;
    void loadPatients(selectedIds, patientsPage);
  }, [selectedIds, patientsPage, loadPatients]);

  const patientsTotalPages = Math.max(1, Math.ceil(patientsTotal / patientsPageSize));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                  <Pill className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="text-sm font-semibold text-zinc-900">MEDICAMENTOS</div>
              </div>
              <Button
                variant="secondary"
                type="button"
                className="py-1.5"
                onClick={() => void loadMeds()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                ACTUALIZAR
              </Button>
            </div>

            <div className="mt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="BUSCAR MEDICAMENTO"
                />
              </div>
            </div>

            <div className="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1">
              {loadingMeds ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
                  CARGANDO...
                </div>
              ) : null}

              {filteredMeds.map((m) => {
                const active = m.key === selectedKey;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSelectedKey(m.key)}
                    className={[
                      "w-full rounded-2xl border p-3 text-left shadow-sm transition",
                      active
                        ? "border-blue-200 bg-blue-50"
                        : "border-zinc-200 bg-white hover:bg-blue-50/40",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-blue-950">{m.nombre}</div>
                      <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                        {m.count}
                      </div>
                    </div>
                  </button>
                );
              })}

              {!filteredMeds.length && !loadingMeds ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
                  SIN MEDICAMENTOS
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-500">PACIENTES CON</div>
                <div className="truncate text-sm font-semibold text-zinc-900">{selectedName}</div>
              </div>
              <Button
                variant="secondary"
                type="button"
                className="py-1.5"
                onClick={() => (selectedIds.length ? void loadPatients(selectedIds, patientsPage) : undefined)}
                disabled={!selectedIds.length}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                ACTUALIZAR
              </Button>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error.toUpperCase()}
              </div>
            ) : null}

            <div className="mt-3 text-sm text-zinc-600">
              {loadingPatients ? "CARGANDO..." : `${patientsTotal} PACIENTES`}
            </div>

            <div className="mt-3 overflow-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full text-center text-sm text-blue-950">
                <thead className="bg-white">
                  <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                    <th className="px-3 py-2 text-center">CÉDULA</th>
                    <th className="px-3 py-2 text-center">NOMBRE</th>
                    <th className="px-3 py-2 text-center">FECHAS DE APLICACIÓN</th>
                    <th className="px-3 py-2 text-center">LÍNEAS</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, idx) => (
                    <tr
                      key={p.patientId}
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                        {p.identificacion}
                      </td>
                      <td className="px-3 py-2 text-center">{p.nombre ?? ""}</td>
                      <td className="px-3 py-2 text-center">
                        {p.fechasAplicacion.map(formatDMY).join(", ")}
                      </td>
                      <td className="px-3 py-2 text-center">{p.lineas}</td>
                    </tr>
                  ))}
                  {!patients.length && !loadingPatients ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-zinc-500">
                        SIN PACIENTES
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col items-center justify-between gap-2 md:flex-row">
              <div className="text-xs text-zinc-500">
                PÁGINA {patientsPage} DE {patientsTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  className="py-1.5"
                  disabled={patientsPage <= 1 || loadingPatients}
                  onClick={() => setPatientsPage((p) => Math.max(1, p - 1))}
                >
                  ANTERIOR
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  className="py-1.5"
                  disabled={patientsPage >= patientsTotalPages || loadingPatients}
                  onClick={() => setPatientsPage((p) => Math.min(patientsTotalPages, p + 1))}
                >
                  SIGUIENTE
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
