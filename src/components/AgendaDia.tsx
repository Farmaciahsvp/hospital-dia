
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toISODateString } from "@/lib/date";
import { STATUS_LABEL, type ItemStatus } from "@/lib/status";
import { exportConsolidatedPdf, exportPdf, type ExportRow } from "@/lib/export";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast, type ToastState } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { NavPills } from "@/components/NavPills";
import {
  BookOpen,
  FileText,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Archive,
  CheckCircle2,
  Pencil,
  Trash2,
  Stethoscope,
  UserRound,
} from "lucide-react";

type PatientSuggestion = { id: string; identificacion: string; nombre: string | null };
type MedicationSuggestion = {
  id: string;
  codigoInstitucional: string | null;
  nombre: string;
  label: string;
};

type AgendaItem = {
  id: string;
  prepRequestId?: string;
  patientId?: string;
  fechaAplicacion: string;
  estado: ItemStatus;
  identificacion: string;
  nombre: string | null;
  medicamento: string;
  dosisTexto: string;
  unidadesRequeridas: number;
  frecuencia?: string | null;
  adquisicion?: "almacenable" | "compra_local";
  observaciones: string | null;
  canceladoMotivo?: string | null;
  updatedAt: string;
};

type UltimoRegistro = {
  id: string;
  patientId: string;
  fecha: string;
  cedula: string;
  nombre: string | null;
  medicationId: string;
  medicamento: string;
  dosisTexto: string;
  unidadesRequeridas: number;
  frecuencia: string | null;
  fechasAplicacion: string[];
  fechaRecepcion: string | null;
  numeroReceta: string | null;
  prescriberId: string | null;
  pharmacistId: string | null;
  adquisicion: "almacenable" | "compra_local";
  observaciones: string | null;
  itemIds: string[];
};

type PersonOption = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
};

const MAX_APPLY_DATES = 16;

  const quickSchema = z.object({
    fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    numeroReceta: z
      .string()
      .transform((v) => v.replace(/\D/g, "").slice(0, 6))
      .refine((v) => !v || /^\d{6}$/.test(v), { message: "Debe ser de 6 dígitos" })
      .optional(),
    prescriberId: z.string().uuid().optional(),
    pharmacistId: z.string().uuid().optional(),
    pharmacistTexto: z.string().optional(),
    prescriberTexto: z.string().optional(),
    claveAutorizacion: z.string().trim().max(100).optional(),
    identificacion: z.string().trim().min(1),
    nombre: z.string().trim().min(1).optional(),
    medicamentoId: z.string().uuid().optional(),
    medicamentoTexto: z.string().trim().min(1),
    dosisTexto: z.string().trim().min(1),
    unidadesRequeridas: z.preprocess((v) => Number(v), z.number().positive()),
    totalCiclos: z.preprocess((v) => Number(v), z.number().int().positive().max(MAX_APPLY_DATES)),
    frecuencia: z.string().trim().max(50).optional(),
    adquisicion: z.enum(["almacenable", "compra_local"]).default("almacenable"),
    observaciones: z.string().trim().max(300).optional(),
  });

type QuickForm = z.infer<typeof quickSchema>;

function personLabel(p: PersonOption) {
  return `${p.codigo} - ${p.nombres} ${p.apellidos}`.trim();
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function toExportRows(items: AgendaItem[]): ExportRow[] {
  return items.map((i) => ({
    fechaAplicacion: i.fechaAplicacion,
    identificacion: i.identificacion,
    nombre: i.nombre,
    medicamento: i.medicamento,
    dosis: i.dosisTexto,
    unidades: i.unidadesRequeridas,
    estado: i.estado,
    observaciones: i.observaciones,
  }));
}

function formatDMY(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function parseDateInputToISO(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const isValid = (y: number, m: number, d: number) => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (y < 1900 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1) return false;
    const daysInMonth = new Date(y, m, 0).getDate();
    return d <= daysInMonth;
  };

  const toIso = (y: number, m: number, d: number) =>
    `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    return isValid(y, m, d) ? toIso(y, m, d) : null;
  }

  const dmy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    return isValid(y, m, d) ? toIso(y, m, d) : null;
  }

  const digits = value.match(/^(\d{8})$/);
  if (digits) {
    const s = digits[1];
    const first4 = Number(s.slice(0, 4));
    const last4 = Number(s.slice(4));
    if (first4 >= 1900 && first4 <= 2100) {
      const y = first4;
      const m = Number(s.slice(4, 6));
      const d = Number(s.slice(6, 8));
      return isValid(y, m, d) ? toIso(y, m, d) : null;
    }
    if (last4 >= 1900 && last4 <= 2100) {
      const d = Number(s.slice(0, 2));
      const m = Number(s.slice(2, 4));
      const y = last4;
      return isValid(y, m, d) ? toIso(y, m, d) : null;
    }
  }

  return null;
}

export function AgendaDia() {
  useRouter();
  const [fecha, setFecha] = useState(() => new Date());
  const fechaStr = useMemo(() => toISODateString(fecha), [fecha]);
  const [fechaInput, setFechaInput] = useState(() => toISODateString(new Date()));
  const [applyDates, setApplyDates] = useState<string[]>(() => [toISODateString(new Date())]);
  const [applyDateTexts, setApplyDateTexts] = useState<string[]>(() => [formatDMY(toISODateString(new Date()))]);

  useEffect(() => {
    setFechaInput(fechaStr);
  }, [fechaStr]);

  useEffect(() => {
    setApplyDates((prev) => (prev.length === 1 ? [fechaStr] : prev));
    setApplyDateTexts((prev) => (prev.length === 1 ? [formatDMY(fechaStr)] : prev));
  }, [fechaStr]);

  const [searchPatient, setSearchPatient] = useState("");
  const [searchMedication, setSearchMedication] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<ItemStatus>>(new Set());
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const debouncedPatient = useDebouncedValue(searchPatient, 250);
  const debouncedMedication = useDebouncedValue(searchMedication, 250);

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [patientSuggestions, setPatientSuggestions] = useState<PatientSuggestion[]>([]);
  const [medSuggestions, setMedSuggestions] = useState<MedicationSuggestion[]>([]);
  const [prescribers, setPrescribers] = useState<PersonOption[]>([]);
  const [pharmacists, setPharmacists] = useState<PersonOption[]>([]);

  const [ultimos, setUltimos] = useState<UltimoRegistro[]>([]);
  const [loadingUltimos, setLoadingUltimos] = useState(false);
  const [editUltimo, setEditUltimo] = useState<UltimoRegistro | null>(null);
  const [editDates, setEditDates] = useState<string[]>([]);
  const [editMedicationTexto, setEditMedicationTexto] = useState("");
  const [editMedicationId, setEditMedicationId] = useState<string | null>(null);

  const [menuId, setMenuId] = useState<string | null>(null);
  const [obsItem, setObsItem] = useState<AgendaItem | null>(null);
  const [cancelItem, setCancelItem] = useState<AgendaItem | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [editPatient, setEditPatient] = useState<{
    patientId: string;
    identificacion: string;
    nombre: string;
  } | null>(null);
  const [deletePatientReq, setDeletePatientReq] = useState<{
    prepRequestId: string;
    identificacion: string;
    nombre: string;
  } | null>(null);
  const [finalizePatientReq, setFinalizePatientReq] = useState<{
    prepRequestId: string;
    identificacion: string;
    nombre: string;
  } | null>(null);

  useEffect(() => {
    if (!editPatient?.patientId) return;
    const el = document.getElementById(`patient-row-${editPatient.patientId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editPatient?.patientId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = Array.from(statusFilter).join(",");
      const url = new URL("/api/items", window.location.origin);
      url.searchParams.set("date", fechaStr);
      if (debouncedPatient.trim()) url.searchParams.set("patient", debouncedPatient.trim());
      if (debouncedMedication.trim()) url.searchParams.set("med", debouncedMedication.trim());
      if (statusParam) url.searchParams.set("status", statusParam);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        let message = "No se pudo cargar la agenda";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = `${message}: ${data.error}`;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const data = (await res.json()) as { items: AgendaItem[]; serverTime: string };
      setItems(data.items);
      setLastUpdated(data.serverTime);
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }, [debouncedMedication, debouncedPatient, fechaStr, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const c: Record<ItemStatus, number> = {
      pendiente: 0,
      en_preparacion: 0,
      listo: 0,
      entregado: 0,
      cancelado: 0,
    };
    for (const i of items) c[i.estado]++;
    return c;
  }, [items]);

  const exportRows = useMemo(() => toExportRows(items), [items]);

  const consolidated = useMemo(() => {
    const map = new Map<string, { medicamento: string; unidades: number; lineas: number }>();
    for (const i of items) {
      const current =
        map.get(i.medicamento) ?? { medicamento: i.medicamento, unidades: 0, lineas: 0 };
      current.unidades += i.unidadesRequeridas;
      current.lineas += 1;
      map.set(i.medicamento, current);
    }
    return Array.from(map.values()).sort((a, b) => a.medicamento.localeCompare(b.medicamento));
  }, [items]);

  const patientsOfDay = useMemo(() => {
    const map = new Map<
      string,
      {
        patientId: string;
        prepRequestId: string;
        identificacion: string;
        nombre: string;
        itemsCount: number;
      }
    >();
    for (const it of items) {
      if (!it.patientId || !it.prepRequestId) continue;
      const key = it.patientId;
      const current =
        map.get(key) ??
        {
          patientId: it.patientId,
          prepRequestId: it.prepRequestId,
          identificacion: it.identificacion,
          nombre: it.nombre ?? "",
          itemsCount: 0,
        };
      current.itemsCount += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => a.identificacion.localeCompare(b.identificacion));
  }, [items]);

  const { register, handleSubmit, setValue, reset, formState, getValues } = useForm<QuickForm>({
    resolver: zodResolver(quickSchema),
    defaultValues: {
      fechaRecepcion: fechaStr,
      numeroReceta: "",
      prescriberId: undefined,
      pharmacistId: undefined,
      pharmacistTexto: "",
      prescriberTexto: "",
      claveAutorizacion: "",
      identificacion: "",
      nombre: "",
      medicamentoTexto: "",
      dosisTexto: "",
      unidadesRequeridas: 1,
      totalCiclos: 1,
      frecuencia: "",
      adquisicion: "almacenable",
      observaciones: "",
    },
  });

  const totalCiclosField = register("totalCiclos");

  const quickIdentRef = useRef<HTMLInputElement | null>(null);
  const quickRecetaRef = useRef<HTMLInputElement | null>(null);
  const quickFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    setValue("totalCiclos", applyDates.length, { shouldValidate: true, shouldDirty: false });
  }, [setValue, applyDates.length]);

  const focusNextQuickField = useCallback((current: HTMLElement, direction: 1 | -1) => {
    const form = quickFormRef.current;
    if (!form) return;

    const focusables = Array.from(
      form.querySelectorAll<HTMLElement>("input, select, textarea, button"),
    ).filter((el) => {
      if (el.tabIndex === -1) return false;
      if (el.getAttribute("disabled") !== null) return false;
      if (el.getAttribute("aria-disabled") === "true") return false;
      if (el instanceof HTMLInputElement && el.type === "hidden") return false;
      if (el instanceof HTMLButtonElement && el.type !== "submit") return false;
      if (el.offsetParent === null) return false;
      return true;
    });

    const idx = focusables.indexOf(current);
    if (idx === -1) return;
    const next = focusables[idx + direction];
    if (next) next.focus();
  }, []);

  const onQuickKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target instanceof HTMLButtonElement) return;
      if (target instanceof HTMLTextAreaElement) return;

      e.preventDefault();
      focusNextQuickField(target, e.shiftKey ? -1 : 1);
    },
    [focusNextQuickField],
  );

  const loadPatientSuggestions = useCallback(async (query: string) => {
    const url = new URL("/api/patients", window.location.origin);
    url.searchParams.set("query", query);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return;
    setPatientSuggestions((await res.json()) as PatientSuggestion[]);
  }, []);

  const loadMedSuggestions = useCallback(async (query: string) => {
    const url = new URL("/api/medications", window.location.origin);
    url.searchParams.set("query", query);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return;
    setMedSuggestions((await res.json()) as MedicationSuggestion[]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [prescRes, pharmRes] = await Promise.all([
          fetch("/api/prescribers", { cache: "no-store" }),
          fetch("/api/pharmacists", { cache: "no-store" }),
        ]);
        if (prescRes.ok) setPrescribers((await prescRes.json()) as PersonOption[]);
        if (pharmRes.ok) setPharmacists((await pharmRes.json()) as PersonOption[]);
      } catch {
        // ignore
      }
    })();
  }, []);

  const loadUltimos = useCallback(async () => {
    setLoadingUltimos(true);
    try {
      const res = await fetch("/api/ultimos-registros?take=5", { cache: "no-store" });
      const data = (await res.json()) as { rows?: UltimoRegistro[]; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo cargar");
      setUltimos(data.rows ?? []);
    } catch (e) {
      setUltimos([]);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoadingUltimos(false);
    }
  }, []);

  useEffect(() => {
    void loadUltimos();
  }, [loadUltimos]);

  const onQuickSubmit = handleSubmit(async (values) => {
    try {
      const fechasAplicacion = Array.from(new Set(applyDates.filter(Boolean))).slice(0, MAX_APPLY_DATES);
      if (!fechasAplicacion.length) throw new Error("Debe indicar al menos una fecha de aplicación");
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fechasAplicacion,
          fechaRecepcion: values.fechaRecepcion || null,
          numeroReceta: values.numeroReceta ? values.numeroReceta.replace(/\D/g, "").slice(0, 6) : null,
          prescriberId: values.prescriberId || null,
          pharmacistId: values.pharmacistId || null,
          patient: { identificacion: values.identificacion, nombre: values.nombre || null },
          medication: { id: values.medicamentoId, nombre: values.medicamentoTexto },
          dosisTexto: values.dosisTexto,
          unidadesRequeridas: values.unidadesRequeridas,
          frecuencia: values.frecuencia || null,
          adquisicion: values.adquisicion || "almacenable",
          observaciones:
            values.claveAutorizacion?.trim() || values.observaciones?.trim()
              ? [
                  values.claveAutorizacion?.trim() ? `Clave autorización: ${values.claveAutorizacion.trim()}` : null,
                  values.observaciones?.trim() ? values.observaciones.trim() : null,
                ]
                  .filter(Boolean)
                  .join(" | ")
              : null,
          createdBy: "farmacia",
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setToast({
        kind: "success",
        message:
          fechasAplicacion.length === 1
            ? "Guardado"
            : `Guardado (${fechasAplicacion.length} fechas)`,
      });
      reset({
        fechaRecepcion: values.fechaRecepcion,
        numeroReceta: "",
        prescriberId: undefined,
        prescriberTexto: "",
        claveAutorizacion: "",
        pharmacistId: undefined,
        pharmacistTexto: "",
        identificacion: "",
        nombre: "",
        medicamentoId: undefined,
        medicamentoTexto: "",
        dosisTexto: "",
        unidadesRequeridas: 1,
        totalCiclos: 1,
        frecuencia: "",
        adquisicion: "almacenable",
        observaciones: "",
      });
      setApplyDates([fechaStr]);
      setApplyDateTexts([formatDMY(fechaStr)]);
      setPatientSuggestions([]);
      setMedSuggestions([]);
      await refresh();
      await loadUltimos();
      quickIdentRef.current?.focus();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  });

  const toggleStatus = useCallback((s: ItemStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const savePatient = useCallback(async () => {
    if (!editPatient) return;
    try {
      const res = await fetch(`/api/patients/${editPatient.patientId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identificacion: editPatient.identificacion,
          nombre: editPatient.nombre || null,
        }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el paciente");
      setToast({ kind: "success", message: "Paciente actualizado" });
      setEditPatient(null);
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  }, [editPatient, refresh]);

  const deletePatientFromDay = useCallback(async () => {
    if (!deletePatientReq) return;
    try {
      const res = await fetch(`/api/prep-requests/${deletePatientReq.prepRequestId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No se pudo eliminar");
      setToast({ kind: "success", message: "Eliminado" });
      setDeletePatientReq(null);
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  }, [deletePatientReq, refresh]);

  const finalizePatient = useCallback(async () => {
    if (!finalizePatientReq) return;
    try {
      const res = await fetch(`/api/prep-requests/${finalizePatientReq.prepRequestId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finalizadoBy: "farmacia" }),
      });
      if (!res.ok) throw new Error("No se pudo finalizar");
      setToast({ kind: "success", message: "Paciente finalizado" });
      setFinalizePatientReq(null);
      await refresh();
    } catch (e) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    }
  }, [finalizePatientReq, refresh]);

  const updateItem = useCallback(
    async (
      id: string,
      patch: Partial<Pick<AgendaItem, "estado" | "dosisTexto" | "unidadesRequeridas" | "observaciones">> & {
        canceladoMotivo?: string | null;
      },
    ) => {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...patch,
          updatedBy: "farmacia",
          entregadoAt: patch.estado === "entregado" ? new Date().toISOString() : undefined,
          canceladoMotivo: patch.canceladoMotivo,
        }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      setToast({ kind: "success", message: "Actualizado" });
      await refresh();
    },
    [refresh],
  );

  const duplicateItem = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/items/${id}/duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ createdBy: "farmacia" }),
      });
      if (!res.ok) throw new Error("No se pudo duplicar");
      setToast({ kind: "success", message: "Duplicado" });
      await refresh();
    },
    [refresh],
  );

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ dosisTexto: string; unidadesRequeridas: number; observaciones: string } | null>(null);

  const startEdit = useCallback((item: AgendaItem) => {
    setEditId(item.id);
    setEditDraft({
      dosisTexto: item.dosisTexto,
      unidadesRequeridas: item.unidadesRequeridas,
      observaciones: item.observaciones ?? "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setEditDraft(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editId || !editDraft) return;
    await updateItem(editId, {
      dosisTexto: editDraft.dosisTexto,
      unidadesRequeridas: editDraft.unidadesRequeridas,
      observaciones: editDraft.observaciones || null,
    });
    cancelEdit();
  }, [cancelEdit, editDraft, editId, updateItem]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editId) cancelEdit();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        quickIdentRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancelEdit, editId]);

  useEffect(() => {
    const onClick = () => setMenuId(null);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const onClick = () => setStatusMenuOpen(false);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">Hospital de Heredia</div>
            <h1 className="text-lg font-semibold">Servicio de Farmacia</h1>
          </div>
          <div className="flex items-center gap-3">
            <NavPills
              items={[
                { href: "/catalogo", label: "Catálogo", icon: <BookOpen className="h-4 w-4" aria-hidden="true" /> },
                { href: "/farmaceuticos", label: "Farmacéuticos", icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
                { href: "/prescriptores", label: "Prescriptor", icon: <Stethoscope className="h-4 w-4" aria-hidden="true" /> },
                { href: "/historico", label: "Histórico", icon: <Archive className="h-4 w-4" aria-hidden="true" /> },
              ]}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="hidden print:block pb-3">
          <div className="text-lg font-semibold">Hospital de Heredia – Servicio de Farmacia</div>
          <div className="text-sm text-zinc-700">Agenda del día: {fechaStr}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
          <div className="hidden flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600">Fecha de aplicación</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={fechaInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setFechaInput(raw);
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
                    const next = new Date(`${raw}T00:00:00`);
                    if (Number.isNaN(next.getTime())) return;
                    setFecha(next);
                  }}
                  onBlur={() => {
                    setFechaInput(fechaStr);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600">Buscar paciente</label>
                <Input
                  className="mt-1"
                  placeholder="cédula / expediente / nombre"
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600">Buscar medicamento</label>
                <Input
                  className="mt-1"
                  placeholder="nombre / código"
                  value={searchMedication}
                  onChange={(e) => setSearchMedication(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600">Estados</label>
                <div className="mt-1">
                  <div className="relative inline-block">
                    <Button
                      variant="secondary"
                      type="button"
                      className="px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusMenuOpen((v) => !v);
                      }}
                      aria-expanded={statusMenuOpen}
                      aria-haspopup="menu"
                    >
                      ESTADOS
                    </Button>
                    {statusMenuOpen ? (
                      <div
                        className="absolute left-0 top-11 z-20 w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                      >
                        <div className="flex flex-wrap gap-2">
                          {([
                            "pendiente",
                            "en_preparacion",
                            "listo",
                            "entregado",
                            "cancelado",
                          ] as ItemStatus[]).map((s) => (
                            <Chip key={s} active={statusFilter.has(s)} onClick={() => toggleStatus(s)}>
                              {STATUS_LABEL[s]}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => quickIdentRef.current?.focus()}
                type="button"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nuevo
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportPdf(exportRows, `agenda-${fechaStr}.pdf`, `Agenda del día (${fechaStr})`)}
                type="button"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Exportar PDF
              </Button>
              <Button variant="secondary" onClick={() => window.print()} type="button">
                <Printer className="h-4 w-4" aria-hidden="true" />
                Imprimir
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportConsolidatedPdf(consolidated, `consolidado-${fechaStr}.pdf`, `Consolidado por medicamento (${fechaStr})`)}
                type="button"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Consolidado por medicamento
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-sm lg:sticky lg:top-20">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900">Captura rápida</div>
              <div className="text-xs text-zinc-500">Enter: siguiente campo (en Guardar: guarda)</div>
            </div>
            <form
              ref={quickFormRef}
              className="grid grid-cols-1 gap-3 md:grid-cols-7"
              onSubmit={onQuickSubmit}
              onKeyDownCapture={onQuickKeyDownCapture}
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Fecha de recepción</label>
                <Input className="mt-1" type="date" {...register("fechaRecepcion")} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Número de receta (6 dígitos)</label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  title="DEBE SER EXACTAMENTE DE 6 DIGITOS"
                  placeholder="000000"
                  {...register("numeroReceta")}
                  ref={(el) => {
                    register("numeroReceta").ref(el);
                    quickRecetaRef.current = el;
                  }}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\\D/g, "").slice(0, 6);
                    e.target.value = onlyDigits;
                    setValue("numeroReceta", onlyDigits, { shouldValidate: true });
                  }}
                  onBlur={(e) => {
                    const onlyDigits = e.target.value.replace(/\\D/g, "").slice(0, 6);
                    const normalized = onlyDigits ? onlyDigits.padStart(6, "0") : "";
                    e.target.value = normalized;
                    setValue("numeroReceta", normalized, { shouldValidate: true });
                  }}
                />
                {formState.errors.numeroReceta ? (
                  <div className="mt-1 text-xs text-rose-700">{formState.errors.numeroReceta.message}</div>
                ) : null}
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-600">Identificación</label>
                <Input
                  {...register("identificacion")}
                  ref={(el) => {
                    register("identificacion").ref(el);
                    quickIdentRef.current = el;
                  }}
                  list="patient-suggestions"
                  className="mt-1"
                  placeholder="Ej: 1-1234-5678"
                  onChange={(e) => {
                    setValue("identificacion", e.target.value);
                    void loadPatientSuggestions(e.target.value);
                  }}
                  onBlur={() => {
                    const val = (document.querySelector('input[name="identificacion"]') as HTMLInputElement | null)?.value;
                    const match = patientSuggestions.find((p) => p.identificacion === val);
                    if (match?.nombre) setValue("nombre", match.nombre ?? "");
                  }}
                />
                <datalist id="patient-suggestions">
                  {patientSuggestions.map((p) => (
                    <option key={p.id} value={p.identificacion}>
                      {p.nombre ?? ""}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Nombre del paciente</label>
                <Input
                  {...register("nombre")}
                  className="mt-1"
                  placeholder="Autorrelleno si existe"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Medicamento</label>
                <Input
                  {...register("medicamentoTexto")}
                  list="med-suggestions"
                  className="mt-1"
                  placeholder="nombre / código"
                  onChange={(e) => {
                    setValue("medicamentoTexto", e.target.value);
                    setValue("medicamentoId", undefined);
                    void loadMedSuggestions(e.target.value);
                  }}
                  onBlur={() => {
                    const val = (document.querySelector('input[name="medicamentoTexto"]') as HTMLInputElement | null)?.value;
                    const match = medSuggestions.find((m) => m.label === val || m.nombre === val);
                    if (match) {
                      setValue("medicamentoId", match.id);
                      setValue("medicamentoTexto", match.nombre);
                    }
                  }}
                />
                <datalist id="med-suggestions">
                  {medSuggestions.map((m) => (
                    <option key={m.id} value={m.label} />
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-600">Dosis</label>
                <Input
                  {...register("dosisTexto")}
                  className="mt-1"
                  placeholder="Ej: 500 mg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Frecuencia</label>
                <Input
                  {...register("frecuencia")}
                  className="mt-1"
                  placeholder="Ej: CADA 8H / SEMANAL"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-600">Unidades *</label>
                <Input
                  {...register("unidadesRequeridas")}
                  type="number"
                  min={1}
                  step={1}
                  required
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-600">Total de Ciclos *</label>
                <Input
                  {...totalCiclosField}
                  type="number"
                  min={1}
                  max={MAX_APPLY_DATES}
                  step={1}
                  className="mt-1"
                  onChange={(e) => {
                    totalCiclosField.onChange(e);
                    const raw = e.target.value;
                    const parsed = Number.parseInt(raw, 10);
                    if (!Number.isFinite(parsed)) return;

                    const nextCount = Math.max(1, Math.min(MAX_APPLY_DATES, parsed));
                    if (parsed !== nextCount) setValue("totalCiclos", nextCount, { shouldValidate: true });
                    const currentCount = applyDates.length;
                    if (nextCount === currentCount) return;

                    if (nextCount > currentCount) {
                      const toAdd = nextCount - currentCount;
                      setApplyDates((prev) => [...prev, ...Array.from({ length: toAdd }, () => fechaStr)]);
                      setApplyDateTexts((prev) => [
                        ...prev,
                        ...Array.from({ length: toAdd }, () => formatDMY(fechaStr)),
                      ]);
                      return;
                    }

                    setApplyDates((prev) => prev.slice(0, nextCount));
                    setApplyDateTexts((prev) => prev.slice(0, nextCount));
                  }}
                  onBlur={(e) => {
                    totalCiclosField.onBlur(e);
                    const v = getValues("totalCiclos");
                    const nextCount = Math.max(1, Math.min(MAX_APPLY_DATES, Number(v)));
                    if (Number.isFinite(nextCount)) setValue("totalCiclos", nextCount, { shouldValidate: true });
                  }}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-zinc-600">Prescriptor</label>
                <Input
                  className="mt-1"
                  list="prescriber-suggestions"
                  placeholder="ESCRIBA PARA BUSCAR"
                  {...register("prescriberTexto")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setValue("prescriberTexto", val);
                    const match = prescribers.find((p) => personLabel(p) === val);
                    setValue("prescriberId", match?.id);
                  }}
                  onBlur={() => {
                    const val =
                      (document.querySelector('input[name="prescriberTexto"]') as HTMLInputElement | null)?.value ??
                      "";
                    const match = prescribers.find((p) => personLabel(p) === val);
                    setValue("prescriberId", match?.id);
                  }}
                />
                <datalist id="prescriber-suggestions">
                  {prescribers.map((p) => (
                    <option key={p.id} value={personLabel(p)} />
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Clave de Autorización</label>
                <Input
                  {...register("claveAutorizacion")}
                  className="mt-1"
                  placeholder="Opcional"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Adquisición</label>
                <Select className="mt-1" {...register("adquisicion")}>
                  <option value="almacenable">ALMACENABLE</option>
                  <option value="compra_local">COMPRA LOCAL</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Observaciones</label>
                <Input {...register("observaciones")} className="mt-1" placeholder="Texto corto" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-zinc-600">
                  Fechas de aplicación (máx. 16)
                </label>
                <div className="mt-1 flex flex-col gap-2">
                  {applyDates.map((d, idx) => (
                    <div key={`${idx}-${d}`} className="flex items-center gap-2">
                      <Input
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                        value={applyDateTexts[idx] ?? (d ? formatDMY(d) : "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setApplyDateTexts((prev) => {
                            const next = [...prev];
                            next[idx] = raw;
                            return next;
                          });

                          if (!raw.trim()) {
                            setApplyDates((prev) => {
                              const next = [...prev];
                              next[idx] = "";
                              return next;
                            });
                            return;
                          }

                          const iso = parseDateInputToISO(raw);
                          if (!iso) return;
                          setApplyDates((prev) => {
                            const next = [...prev];
                            next[idx] = iso;
                            return next;
                          });
                        }}
                        onBlur={() => {
                          const raw = applyDateTexts[idx] ?? "";
                          if (!raw.trim()) return;
                          const iso = parseDateInputToISO(raw);
                          if (!iso) {
                            setApplyDateTexts((prev) => {
                              const next = [...prev];
                              next[idx] = d ? formatDMY(d) : "";
                              return next;
                            });
                            return;
                          }
                          setApplyDateTexts((prev) => {
                            const next = [...prev];
                            next[idx] = formatDMY(iso);
                            return next;
                          });
                        }}
                      />
                      <Button
                        variant="secondary"
                        type="button"
                        className="px-3 py-2"
                        onClick={() => {
                          setApplyDates((prev) => prev.filter((_, i) => i !== idx));
                          setApplyDateTexts((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        disabled={applyDates.length <= 1}
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="subtle"
                      type="button"
                      onClick={() => {
                        setApplyDates((prev) =>
                          prev.length >= MAX_APPLY_DATES ? prev : [...prev, fechaStr],
                        );
                        setApplyDateTexts((prev) =>
                          prev.length >= MAX_APPLY_DATES ? prev : [...prev, formatDMY(fechaStr)],
                        );
                      }}
                      disabled={applyDates.length >= MAX_APPLY_DATES}
                    >
                      + Agregar fecha
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        setApplyDates([fechaStr]);
                        setApplyDateTexts([formatDMY(fechaStr)]);
                      }}
                    >
                      Usar fecha seleccionada
                    </Button>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">Farmacéutico</label>
                <Input
                  className="mt-1"
                  list="pharmacist-suggestions"
                  placeholder="ESCRIBA PARA BUSCAR"
                  {...register("pharmacistTexto")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setValue("pharmacistTexto", val);
                    const match = pharmacists.find((p) => personLabel(p) === val);
                    setValue("pharmacistId", match?.id);
                  }}
                  onBlur={() => {
                    const val =
                      (document.querySelector('input[name="pharmacistTexto"]') as HTMLInputElement | null)?.value ??
                      "";
                    const match = pharmacists.find((p) => personLabel(p) === val);
                    setValue("pharmacistId", match?.id);
                  }}
                />
                <datalist id="pharmacist-suggestions">
                  {pharmacists.map((p) => (
                    <option key={p.id} value={personLabel(p)} />
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-7 flex items-end justify-end">
                <Button variant="primary" type="submit" disabled={formState.isSubmitting}>
                  Guardar
                </Button>
              </div>
            </form>
            {formState.errors.unidadesRequeridas ? (
              <div className="mt-2 text-sm text-rose-700">Unidades debe ser &gt; 0</div>
            ) : null}
            {formState.errors.totalCiclos ? (
              <div className="mt-2 text-sm text-rose-700">Total de Ciclos debe ser &gt; 0</div>
            ) : null}
          </div>
        </div>

        {editPatient ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm print:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-blue-950">EDITAR PACIENTE</div>
              <Button
                variant="secondary"
                type="button"
                className="py-1.5"
                onClick={() => setEditPatient(null)}
              >
                CANCELAR
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600">IDENTIFICACIÓN</label>
                <Input
                  className="mt-1"
                  value={editPatient.identificacion}
                  onChange={(e) =>
                    setEditPatient((p) => (p ? { ...p, identificacion: e.target.value } : p))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-600">NOMBRE</label>
                <Input
                  className="mt-1"
                  value={editPatient.nombre}
                  onChange={(e) => setEditPatient((p) => (p ? { ...p, nombre: e.target.value } : p))}
                />
              </div>
              <div className="md:col-span-3 flex items-end justify-end">
                <Button variant="primary" type="button" onClick={() => void savePatient()}>
                  GUARDAR CAMBIOS
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">ÚLTIMOS 5 PACIENTES REGISTRADOS</div>
              <div className="text-xs text-zinc-500">EDICIÓN COMPLETA (INCLUYE FECHAS DE APLICACIÓN)</div>
            </div>
            <Button
              variant="secondary"
              type="button"
              className="py-1.5"
              onClick={() => void loadUltimos()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              ACTUALIZAR
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-center text-sm text-blue-950">
              <thead className="bg-white">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                  <th className="px-3 py-2 text-center">FECHA</th>
                  <th className="px-3 py-2 text-center">CÉDULA</th>
                  <th className="px-3 py-2 text-center">NOMBRE DEL PACIENTE</th>
                  <th className="px-3 py-2 text-center">MEDICAMENTO</th>
                  <th className="px-3 py-2 text-center">DOSIS</th>
                  <th className="px-3 py-2 text-center">FRECUENCIA</th>
                  <th className="px-3 py-2 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-center">
                      {r.fecha ? formatDMY(r.fecha) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center font-medium">{r.cedula}</td>
                    <td className="px-3 py-2 text-center">{r.nombre ?? ""}</td>
                    <td className="px-3 py-2 text-center">{r.medicamento}</td>
                    <td className="px-3 py-2 text-center">{r.dosisTexto}</td>
                    <td className="px-3 py-2 text-center">{r.frecuencia ?? "-"}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <Button
                        variant="subtle"
                        type="button"
                        className="px-2 py-2"
                        aria-label="Editar registro"
                        onClick={() => {
                          setEditUltimo(r);
                          setEditDates(r.fechasAplicacion);
                          setEditMedicationTexto(r.medicamento);
                          setEditMedicationId(r.medicationId);
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!ultimos.length && !loadingUltimos ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-500">
                      SIN REGISTROS
                    </td>
                  </tr>
                ) : null}
                {loadingUltimos ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-500">
                      CARGANDO...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hidden mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:hidden relative">
          <div className="border-b border-zinc-200 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-900">Pacientes del día</div>
            <div className="text-xs text-zinc-500">
              Editar / eliminar / finalizar por paciente (se envía a Histórico)
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-white">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                  <th className="px-3 py-2 text-center">Identificación</th>
                  <th className="px-3 py-2 text-center">Nombre</th>
                  <th className="px-3 py-2 text-center">Líneas</th>
                  <th className="px-3 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {patientsOfDay.map((p, idx) => (
                  <tr
                    key={p.prepRequestId}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}
                  >
                    <td className="px-3 py-2 text-center font-medium whitespace-nowrap">
                      {p.identificacion}
                    </td>
                    <td className="px-3 py-2 text-center">{p.nombre}</td>
                    <td className="px-3 py-2 text-center">{p.itemsCount}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="subtle"
                          type="button"
                          className="px-2 py-2"
                          onClick={() =>
                            setEditPatient({
                              patientId: p.patientId,
                              identificacion: p.identificacion,
                              nombre: p.nombre,
                            })
                          }
                          aria-label="Editar paciente"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="danger"
                          type="button"
                          className="px-2 py-2"
                          onClick={() =>
                            setDeletePatientReq({
                              prepRequestId: p.prepRequestId,
                              identificacion: p.identificacion,
                              nombre: p.nombre,
                            })
                          }
                          aria-label="Eliminar paciente del día"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="primary"
                          type="button"
                          className="px-2 py-2"
                          onClick={() =>
                            setFinalizePatientReq({
                              prepRequestId: p.prepRequestId,
                              identificacion: p.identificacion,
                              nombre: p.nombre,
                            })
                          }
                          aria-label="Finalizar (enviar a histórico)"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!patientsOfDay.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-zinc-500">
                      Sin pacientes para esta fecha/filtros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hidden mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 print:hidden">
            <div className="text-sm text-zinc-600">{loading ? "Cargando…" : `${items.length} registros`}</div>
            <Button variant="secondary" onClick={() => refresh()} type="button" className="py-1.5">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar
            </Button>
          </div>

          <div className="max-h-[62vh] overflow-auto hidden md:block">
            <table className="min-w-full text-center text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2 text-center">Identificación</th>
                  <th className="px-3 py-2 text-center">Nombre</th>
                  <th className="px-3 py-2 text-center">Medicamento</th>
                  <th className="px-3 py-2 text-center">Dosis</th>
                  <th className="px-3 py-2 text-center">Unidades</th>
                  <th className="px-3 py-2 text-center">Obs.</th>
                  <th className="px-3 py-2 text-center print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr
                    key={i.id}
                    className={`border-b border-zinc-100 ${
                      editId === i.id
                        ? "bg-emerald-50"
                        : idx % 2 === 0
                          ? "bg-white"
                          : "bg-zinc-50"
                    } hover:bg-zinc-100/60`}
                    onDoubleClick={() => startEdit(i)}
                  >
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={i.estado} editable onChange={(v) => void updateItem(i.id, { estado: v })} />
                    </td>
                    <td className="px-3 py-2 text-center font-medium whitespace-nowrap">{i.identificacion}</td>
                    <td className="px-3 py-2 text-center">{i.nombre ?? ""}</td>
                    <td className="px-3 py-2 text-center">{i.medicamento}</td>
                    <td className="px-3 py-2 text-center">
                      {editId === i.id && editDraft ? (
                        <input
                          className="w-full rounded-md border border-zinc-200 px-2 py-1 text-sm"
                          value={editDraft.dosisTexto}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, dosisTexto: e.target.value } : d))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        i.dosisTexto
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {editId === i.id && editDraft ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="w-24 rounded-md border border-zinc-200 px-2 py-1 text-sm"
                          value={editDraft.unidadesRequeridas}
                          onChange={(e) =>
                            setEditDraft((d) => (d ? { ...d, unidadesRequeridas: Number(e.target.value) } : d))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        i.unidadesRequeridas
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {editId === i.id && editDraft ? (
                        <input
                          className="w-full rounded-md border border-zinc-200 px-2 py-1 text-sm"
                          value={editDraft.observaciones}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, observaciones: e.target.value } : d))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${
                            i.observaciones
                              ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                              : "border-transparent bg-transparent text-zinc-400"
                          }`}
                          onClick={() => setObsItem(i)}
                          disabled={!i.observaciones}
                        >
                          {i.observaciones ? "Ver" : "—"}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center print:hidden">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                          onClick={() => void updateItem(i.id, { estado: "listo" })}
                          type="button"
                        >
                          Listo
                        </button>
                        <button
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                          onClick={() => void updateItem(i.id, { estado: "entregado" })}
                          type="button"
                        >
                          Entregado
                        </button>
                        {editId === i.id ? (
                          <>
                            <button
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                              onClick={() => void saveEdit()}
                              type="button"
                            >
                              Guardar
                            </button>
                            <button
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                              onClick={() => cancelEdit()}
                              type="button"
                            >
                              Esc
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                              onClick={() => startEdit(i)}
                              type="button"
                            >
                              Editar
                            </button>
                            <div className="relative">
                              <button
                                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuId((prev) => (prev === i.id ? null : i.id));
                                }}
                                type="button"
                                aria-label="Más acciones"
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </button>
                              {menuId === i.id ? (
                                <div
                                  className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                                    type="button"
                                    onClick={() => void duplicateItem(i.id)}
                                  >
                                    Duplicar
                                  </button>
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null);
                                      setObsItem(i);
                                    }}
                                  >
                                    Observaciones…
                                  </button>
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null);
                                      setCancelItem(i);
                                      setCancelMotivo(i.canceladoMotivo ?? "");
                                    }}
                                  >
                                    Cancelar…
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-zinc-500">
                      Sin registros para esta fecha/filtros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            <div className="divide-y divide-zinc-200">
              {items.map((i) => (
                <div key={i.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{i.identificacion}</div>
                      <div className="text-sm text-zinc-600">{i.nombre ?? ""}</div>
                    </div>
                    <StatusBadge value={i.estado} editable onChange={(v) => void updateItem(i.id, { estado: v })} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="col-span-2">
                      <div className="text-xs font-medium text-zinc-500">Medicamento</div>
                      <div className="mt-0.5">{i.medicamento}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Dosis</div>
                      <div className="mt-0.5">{i.dosisTexto}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Unidades</div>
                      <div className="mt-0.5">{i.unidadesRequeridas}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                    <button
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
                      onClick={() => void updateItem(i.id, { estado: "listo" })}
                      type="button"
                    >
                      Listo
                    </button>
                    <button
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
                      onClick={() => void updateItem(i.id, { estado: "entregado" })}
                      type="button"
                    >
                      Entregado
                    </button>
                    <button
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
                      onClick={() => setObsItem(i)}
                      type="button"
                      disabled={!i.observaciones}
                    >
                      Obs
                    </button>
                    <button
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
                      onClick={() => void duplicateItem(i.id)}
                      type="button"
                    >
                      Duplicar
                    </button>
                    <button
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100"
                      onClick={() => {
                        setCancelItem(i);
                        setCancelMotivo(i.canceladoMotivo ?? "");
                      }}
                      type="button"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ))}
              {!items.length ? (
                <div className="px-4 py-10 text-center text-sm text-zinc-500">
                  Sin registros para esta fecha/filtros.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-700 md:justify-start">
              <span>Pendientes: {counts.pendiente}</span>
              <span>Listos: {counts.listo}</span>
              <span>Entregados: {counts.entregado}</span>
              <span>Cancelados: {counts.cancelado}</span>
            </div>
            <div className="text-center text-sm text-zinc-500 md:text-right">
              Última actualización: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500 print:hidden">
          Atajos: Enter (guardar), Ctrl+N (nuevo), Ctrl+P (imprimir), Esc (cancelar edición).
        </div>
      </div>

      <Modal
        open={!!editUltimo}
        title="EDITAR REGISTRO"
        onClose={() => {
          setEditUltimo(null);
          setEditDates([]);
          setEditMedicationTexto("");
          setEditMedicationId(null);
        }}
        footer={
          editUltimo ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditUltimo(null);
                  setEditDates([]);
                  setEditMedicationTexto("");
                  setEditMedicationId(null);
                }}
              >
                VOLVER
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={async () => {
                  if (!editUltimo) return;
                  try {
                    const fechasAplicacion = Array.from(new Set(editDates.filter(Boolean))).slice(0, MAX_APPLY_DATES);
                    if (!fechasAplicacion.length) throw new Error("Debe indicar al menos una fecha de aplicación");
                    const res = await fetch(`/api/ultimos-registros/${editUltimo.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        patientId: editUltimo.patientId,
                        identificacion: editUltimo.cedula,
                        nombre: editUltimo.nombre ?? null,
                        medication: {
                          id: editMedicationId,
                          nombre: editMedicationTexto,
                        },
                        dosisTexto: editUltimo.dosisTexto,
                        unidadesRequeridas: editUltimo.unidadesRequeridas,
                        frecuencia: editUltimo.frecuencia ?? null,
                        adquisicion: editUltimo.adquisicion,
                        observaciones: editUltimo.observaciones ?? null,
                        fechaRecepcion: editUltimo.fechaRecepcion ?? null,
                        numeroReceta: editUltimo.numeroReceta ?? null,
                        prescriberId: editUltimo.prescriberId ?? null,
                        pharmacistId: editUltimo.pharmacistId ?? null,
                        fechasAplicacion,
                        itemIds: editUltimo.itemIds,
                      }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error || "No se pudo guardar");
                    setToast({ kind: "success", message: "ACTUALIZADO" });
                    setEditUltimo(null);
                    setEditDates([]);
                    setEditMedicationTexto("");
                    setEditMedicationId(null);
                    await refresh();
                    await loadUltimos();
                  } catch (e) {
                    setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
                  }
                }}
              >
                GUARDAR
              </Button>
            </div>
          ) : null
        }
      >
        {editUltimo ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600">FECHA DE RECEPCIÓN</label>
              <Input
                className="mt-1"
                type="date"
                value={editUltimo.fechaRecepcion ?? ""}
                onChange={(e) =>
                  setEditUltimo((p) => (p ? { ...p, fechaRecepcion: e.target.value || null } : p))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">NÚMERO DE RECETA (6 DÍGITOS)</label>
              <Input
                className="mt-1"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                title="DEBE SER EXACTAMENTE DE 6 DIGITOS"
                value={editUltimo.numeroReceta ?? ""}
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/\\D/g, "").slice(0, 6);
                  e.target.value = onlyDigits;
                  setEditUltimo((p) => (p ? { ...p, numeroReceta: onlyDigits || null } : p));
                }}
                onBlur={(e) => {
                  const onlyDigits = e.target.value.replace(/\\D/g, "").slice(0, 6);
                  const normalized = onlyDigits ? onlyDigits.padStart(6, "0") : "";
                  setEditUltimo((p) => (p ? { ...p, numeroReceta: normalized || null } : p));
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">PRESCRIPTOR</label>
              <Select
                className="mt-1"
                value={editUltimo.prescriberId ?? ""}
                onChange={(e) =>
                  setEditUltimo((p) => (p ? { ...p, prescriberId: e.target.value || null } : p))
                }
              >
                <option value="">SELECCIONAR</option>
                {prescribers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">FARMACÉUTICO</label>
              <Select
                className="mt-1"
                value={editUltimo.pharmacistId ?? ""}
                onChange={(e) =>
                  setEditUltimo((p) => (p ? { ...p, pharmacistId: e.target.value || null } : p))
                }
              >
                <option value="">SELECCIONAR</option>
                {pharmacists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">CÉDULA</label>
              <Input
                className="mt-1"
                value={editUltimo.cedula}
                onChange={(e) => setEditUltimo((p) => (p ? { ...p, cedula: e.target.value } : p))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">NOMBRE DEL PACIENTE</label>
              <Input
                className="mt-1"
                value={editUltimo.nombre ?? ""}
                onChange={(e) => setEditUltimo((p) => (p ? { ...p, nombre: e.target.value } : p))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600">MEDICAMENTO</label>
              <Input
                className="mt-1"
                list="edit-med-suggestions"
                value={editMedicationTexto}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditMedicationTexto(val);
                  const match = medSuggestions.find((m) => m.label === val);
                  setEditMedicationId(match?.id ?? null);
                }}
                placeholder="NOMBRE / CÓDIGO"
              />
              <datalist id="edit-med-suggestions">
                {medSuggestions.map((m) => (
                  <option key={m.id} value={m.label} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">DOSIS</label>
              <Input
                className="mt-1"
                value={editUltimo.dosisTexto}
                onChange={(e) =>
                  setEditUltimo((p) => (p ? { ...p, dosisTexto: e.target.value } : p))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">FRECUENCIA</label>
              <Input
                className="mt-1"
                value={editUltimo.frecuencia ?? ""}
                onChange={(e) =>
                  setEditUltimo((p) => (p ? { ...p, frecuencia: e.target.value || null } : p))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">UNIDADES</label>
              <Input
                className="mt-1"
                inputMode="numeric"
                value={String(editUltimo.unidadesRequeridas)}
                onChange={(e) =>
                  setEditUltimo((p) =>
                    p ? { ...p, unidadesRequeridas: Math.max(1, Number(e.target.value || 1)) } : p,
                  )
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">ADQUISICIÓN</label>
              <Select
                className="mt-1"
                value={editUltimo.adquisicion}
                onChange={(e) =>
                  setEditUltimo((p) =>
                    p
                      ? { ...p, adquisicion: e.target.value as UltimoRegistro["adquisicion"] }
                      : p,
                  )
                }
              >
                <option value="almacenable">ALMACENABLE</option>
                <option value="compra_local">COMPRA LOCAL</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600">FECHAS DE APLICACIÓN (MÁX. 16)</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {editDates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900"
                  >
                    {formatDMY(d)}
                    <button
                      type="button"
                      className="text-blue-700 hover:text-blue-900"
                      onClick={() => setEditDates((prev) => prev.filter((x) => x !== d))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="date"
                  className="max-w-xs"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
                    setEditDates((prev) =>
                      prev.includes(raw) ? prev : [...prev, raw].slice(0, MAX_APPLY_DATES),
                    );
                  }}
                />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    const raw = fechaStr;
                    setEditDates((prev) =>
                      prev.includes(raw) ? prev : [...prev, raw].slice(0, MAX_APPLY_DATES),
                    );
                  }}
                >
                  USAR FECHA DE AGENDA
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!obsItem}
        title="Observaciones"
        onClose={() => setObsItem(null)}
        footer={
          obsItem ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setObsItem(null)}>
                Cerrar
              </Button>
            </div>
          ) : null
        }
      >
        <div className="whitespace-pre-wrap text-sm text-zinc-700">{obsItem?.observaciones ?? ""}</div>
      </Modal>

      <Modal
        open={!!cancelItem}
        title="Cancelar registro"
        onClose={() => {
          setCancelItem(null);
          setCancelMotivo("");
        }}
        footer={
          cancelItem ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setCancelItem(null);
                  setCancelMotivo("");
                }}
              >
                Volver
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!cancelItem) return;
                  void updateItem(cancelItem.id, {
                    estado: "cancelado",
                    canceladoMotivo: cancelMotivo || null,
                    observaciones: cancelMotivo || (cancelItem.observaciones ?? "") || "Cancelado",
                  });
                  setCancelItem(null);
                  setCancelMotivo("");
                }}
              >
                Confirmar cancelación
              </Button>
            </div>
          ) : null
        }
      >
        <label className="block text-xs font-medium text-zinc-600">Motivo (opcional)</label>
        <Input
          className="mt-1"
          value={cancelMotivo}
          onChange={(e) => setCancelMotivo(e.target.value)}
          placeholder="Ej: suspendido por indicación médica"
        />
        <div className="mt-2 text-xs text-zinc-500">Se marcará el estado como “Cancelado”.</div>
      </Modal>

      <Modal
        open={false}
        title="Editar paciente"
        onClose={() => setEditPatient(null)}
        footer={
          editPatient ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditPatient(null)}>
                Volver
              </Button>
              <Button variant="primary" type="button" onClick={() => void savePatient()}>
                Guardar
              </Button>
            </div>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600">Identificación</label>
            <Input
              className="mt-1"
              value={editPatient?.identificacion ?? ""}
              onChange={(e) =>
                setEditPatient((p) => (p ? { ...p, identificacion: e.target.value } : p))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">Nombre</label>
            <Input
              className="mt-1"
              value={editPatient?.nombre ?? ""}
              onChange={(e) =>
                setEditPatient((p) => (p ? { ...p, nombre: e.target.value } : p))
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deletePatientReq}
        title="Eliminar paciente del día"
        onClose={() => setDeletePatientReq(null)}
        footer={
          deletePatientReq ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setDeletePatientReq(null)}>
                Volver
              </Button>
              <Button variant="danger" type="button" onClick={() => void deletePatientFromDay()}>
                Eliminar
              </Button>
            </div>
          ) : null
        }
      >
        <div className="text-sm text-zinc-700">
          ¿Eliminar del día a{" "}
          <span className="font-semibold">
            {deletePatientReq?.identificacion} {deletePatientReq?.nombre}
          </span>
          ? Se borran todas sus líneas de este día.
        </div>
      </Modal>

      <Modal
        open={!!finalizePatientReq}
        title="Finalizar paciente"
        onClose={() => setFinalizePatientReq(null)}
        footer={
          finalizePatientReq ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setFinalizePatientReq(null)}>
                Volver
              </Button>
              <Button variant="primary" type="button" onClick={() => void finalizePatient()}>
                Finalizar
              </Button>
            </div>
          ) : null
        }
      >
        <div className="text-sm text-zinc-700">
          Al finalizar, este paciente se moverá a{" "}
          <span className="font-semibold">Histórico</span> para futuras consultas.
        </div>
      </Modal>
    </div>
  );
}




