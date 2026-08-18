
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toISODateString } from "@/lib/date";
import { MAX_APPLY_DATES } from "@/lib/domain-rules";
import { STATUS_LABEL, type ItemStatus } from "@/lib/status";
import { exportConsolidatedPdf, exportPdf } from "@/lib/export";
import {
  createAgendaItems,
  deletePrepRequest,
  duplicateAgendaItem,
  fetchAgendaItems,
  fetchMedicationSuggestions,
  fetchPatientSuggestions,
  fetchStaffOptions,
  fetchUltimosRegistros,
  finalizePrepRequest,
  patchAgendaItem,
  patchPatient,
  patchUltimoRegistro,
} from "@/components/agenda/agenda-api";
import { AgendaDesktopActions, AgendaMobileActions } from "@/components/agenda/AgendaItemActions";
import { AgendaSummaryFooter } from "@/components/agenda/AgendaSummaryFooter";
import {
  addMonthsUtc,
  AgendaItem,
  buildConsolidatedByMedication,
  buildPatientsOfDay,
  buildStatusCounts,
  formatDMY,
  isValidDateRange,
  monthRangeOf,
  normalizeNumeroReceta,
  isoToUtcDate,
  MedicationSuggestion,
  parseDateInputToISO,
  parseFrequencyStep,
  PersonOption,
  personLabel,
  PatientSuggestion,
  quickSchema,
  QuickForm,
  toExportRows,
  UltimoRegistro,
  useDebouncedValue,
} from "@/components/agenda/agenda-domain";
import { useAgendaGlobalShortcuts, useWindowClickDismiss } from "@/components/agenda/agenda-hooks";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast, type ToastState } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { NavPills } from "@/components/NavPills";
import {
  BookOpen,
  ChevronRight,
  FileText,
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

const STATUS_ORDER: ItemStatus[] = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
  "cancelado",
];

/** Rótulo visible de cada campo de Captura rápida. Es la misma cadena que ve el
 *  usuario en la etiqueta y la que se nombra al listar lo que falta, para que
 *  el aviso y el formulario hablen igual. */
const FIELD_LABELS: Record<keyof QuickForm, string> = {
  fechaRecepcion: "Fecha de recepción",
  numeroReceta: "Número de receta (6 dígitos)",
  identificacion: "Identificación",
  nombre: "Nombre del paciente",
  medicamentoTexto: "Medicamento",
  medicamentoId: "Medicamento",
  dosisTexto: "Dosis",
  frecuencia: "Frecuencia",
  unidadesRequeridas: "Unidades",
  totalCiclos: "Total de Ciclos",
  prescriberTexto: "Prescriptor",
  prescriberId: "Prescriptor",
  claveAutorizacion: "Clave de Autorización",
  adquisicion: "Adquisición",
  observaciones: "Observaciones",
  pharmacistTexto: "Farmacéutico",
  pharmacistId: "Farmacéutico",
  recursoAmparo: "Recurso de amparo",
};

/** Orden de lectura del formulario: fija en qué orden se nombran los campos que
 *  faltan y cuál recibe el foco. */
const QUICK_FIELD_ORDER: (keyof QuickForm)[] = [
  "fechaRecepcion",
  "numeroReceta",
  "identificacion",
  "nombre",
  "medicamentoTexto",
  "medicamentoId",
  "dosisTexto",
  "frecuencia",
  "unidadesRequeridas",
  "totalCiclos",
  "prescriberTexto",
  "prescriberId",
  "claveAutorizacion",
  "adquisicion",
  "observaciones",
  "pharmacistTexto",
  "pharmacistId",
];

/** Los campos de persona validan sobre el `*Id` oculto pero el usuario escribe
 *  en el `*Texto`: el foco debe ir al campo visible. */
const FOCUS_TARGET: Partial<Record<keyof QuickForm, keyof QuickForm>> = {
  prescriberId: "prescriberTexto",
  pharmacistId: "pharmacistTexto",
  medicamentoId: "medicamentoTexto",
};

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
  // El filtro era un solo mes; ahora es un rango libre que arranca en el mes en
  // curso, para poder mirar una semana o cruzar el corte de mes sin perder nada.
  const [ultimosRango, setUltimosRango] = useState(() => monthRangeOf(new Date()));
  // La tarjeta arranca plegada: es la más larga de la agenda y empujaba el resto
  // de la vista fuera de pantalla.
  const [ultimosAbierto, setUltimosAbierto] = useState(false);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAgendaItems({
        date: fechaStr,
        patientQuery: debouncedPatient,
        medicationQuery: debouncedMedication,
        statuses: Array.from(statusFilter),
      });
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
    return buildStatusCounts(items);
  }, [items]);

  const exportRows = useMemo(() => toExportRows(items), [items]);

  const consolidated = useMemo(() => {
    return buildConsolidatedByMedication(items);
  }, [items]);

  const patientsOfDay = useMemo(() => {
    return buildPatientsOfDay(items);
  }, [items]);

  // Con el menú cerrado no había forma de saber que la agenda estaba filtrada:
  // el listado mostraba un subconjunto con el mismo aspecto que el día completo.
  const activeStatuses = useMemo(
    () => STATUS_ORDER.filter((s) => statusFilter.has(s)),
    [statusFilter],
  );
  const activeStatusLabels = useMemo(
    () => activeStatuses.map((s) => STATUS_LABEL[s]),
    [activeStatuses],
  );

  const { register, handleSubmit, setValue, setFocus, reset, formState, getValues, control } = useForm<QuickForm>({
    resolver: zodResolver(quickSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      fechaRecepcion: fechaStr,
      numeroReceta: "",
      prescriberId: "",
      pharmacistId: "",
      pharmacistTexto: "",
      prescriberTexto: "",
      claveAutorizacion: "",
      identificacion: "",
      nombre: "",
      medicamentoId: "",
      medicamentoTexto: "",
      dosisTexto: "",
      unidadesRequeridas: 1,
      totalCiclos: 1,
      frecuencia: "",
      adquisicion: "almacenable",
      observaciones: "",
      recursoAmparo: false,
    },
  });

  const totalCiclosField = register("totalCiclos");

  /** Rótulos de los campos obligatorios que faltaron en el último envío. */
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const fechaRecepcionActual = useWatch({ control, name: "fechaRecepcion" });
  /** Fechas de aplicación anteriores a la de recepción, en formato dd/mm/aaaa. */
  const fechasAnterioresARecepcion = useMemo(() => {
    if (!fechaRecepcionActual) return [];
    return applyDates
      .filter((d) => d && d < fechaRecepcionActual)
      .map((d) => formatDMY(d));
  }, [applyDates, fechaRecepcionActual]);

  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const quickIdentRef = useRef<HTMLInputElement | null>(null);
  const quickRecetaRef = useRef<HTMLInputElement | null>(null);
  const quickFormRef = useRef<HTMLFormElement | null>(null);
  const quickSubmitInFlightRef = useRef(false);

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
    setPatientSuggestions(await fetchPatientSuggestions(query));
  }, []);

  const loadMedSuggestions = useCallback(async (query: string) => {
    setMedSuggestions(await fetchMedicationSuggestions(query));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const staff = await fetchStaffOptions();
        setPrescribers(staff.prescribers);
        setPharmacists(staff.pharmacists);
      } catch {
        // ignore
      }
    })();
  }, []);

  const rangoUltimosValido = isValidDateRange(ultimosRango.from, ultimosRango.to);

  const loadUltimos = useCallback(async () => {
    // Mientras el rango esté a medio escribir o invertido no se consulta: el
    // aviso de la tarjeta dice qué corregir.
    if (!isValidDateRange(ultimosRango.from, ultimosRango.to)) return;
    setLoadingUltimos(true);
    try {
      setUltimos(await fetchUltimosRegistros(ultimosRango));
    } catch (e) {
      setUltimos([]);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoadingUltimos(false);
    }
  }, [ultimosRango]);

  useEffect(() => {
    void loadUltimos();
  }, [loadUltimos]);

  // Un envío inválido tiene que decir qué falta y llevar allí el foco: antes el
  // botón quedaba deshabilitado y no había forma de saber qué campo lo bloqueaba.
  const onQuickInvalid = useCallback(
    (errors: FieldErrors<QuickForm>) => {
      const names = QUICK_FIELD_ORDER.filter((name) => errors[name]);
      const labels = names
        .map((name) => FIELD_LABELS[FOCUS_TARGET[name] ?? name])
        .filter((label, idx, all) => all.indexOf(label) === idx);
      setMissingFields(labels);

      const first = names[0];
      if (first) setFocus(FOCUS_TARGET[first] ?? first, { shouldSelect: true });
    },
    [setFocus],
  );

  const onQuickSubmit = handleSubmit(async (values) => {
    setMissingFields([]);
    if (quickSubmitInFlightRef.current) return;
    quickSubmitInFlightRef.current = true;
    try {
      const fechasAplicacion = Array.from(new Set(applyDates.filter(Boolean))).slice(0, MAX_APPLY_DATES);
      if (!fechasAplicacion.length) throw new Error("Debe indicar al menos una fecha de aplicación");
      await createAgendaItems({
        fechasAplicacion,
        fechaRecepcion: values.fechaRecepcion,
        numeroReceta: normalizeNumeroReceta(values.numeroReceta),
        prescriberId: values.prescriberId,
        pharmacistId: values.pharmacistId,
        patient: { identificacion: values.identificacion, nombre: values.nombre },
        medication: { id: values.medicamentoId, nombre: values.medicamentoTexto },
        dosisTexto: values.dosisTexto,
        unidadesRequeridas: values.unidadesRequeridas,
        frecuencia: values.frecuencia,
        adquisicion: values.adquisicion,
        observaciones:
          values.claveAutorizacion?.trim() || values.observaciones?.trim()
            ? [
              values.claveAutorizacion?.trim() ? `Clave autorización: ${values.claveAutorizacion.trim()}` : null,
              values.observaciones?.trim() ? values.observaciones.trim() : null,
            ]
              .filter(Boolean)
              .join(" | ")
            : null,
        recursoAmparo: values.recursoAmparo,
        createdBy: "farmacia",
      });
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
        prescriberId: "",
        prescriberTexto: "",
        claveAutorizacion: "",
        pharmacistId: "",
        pharmacistTexto: "",
        identificacion: "",
        nombre: "",
        medicamentoId: "",
        medicamentoTexto: "",
        dosisTexto: "",
        unidadesRequeridas: 1,
        totalCiclos: 1,
        frecuencia: "",
        adquisicion: "almacenable",
        observaciones: "",
        recursoAmparo: false,
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
    } finally {
      quickSubmitInFlightRef.current = false;
    }
  }, onQuickInvalid);

  const suggestApplyDates = useCallback(() => {
    const step = parseFrequencyStep(getValues("frecuencia"));
    if (!step) {
      setToast({
        kind: "error",
        message: 'No pude interpretar "Frecuencia". Ej: "CADA 21 DIAS", "SEMANAL", "MENSUAL".',
      });
      return;
    }

    const requested = Number(getValues("totalCiclos") ?? applyDates.length);
    const count = Math.max(1, Math.min(MAX_APPLY_DATES, Number.isFinite(requested) ? requested : applyDates.length));
    const startIso = applyDates[0] || fechaStr;
    const start = isoToUtcDate(startIso);
    if (Number.isNaN(start.getTime())) {
      setToast({ kind: "error", message: "Fecha inicial inválida" });
      return;
    }

    if (applyDates.length > 1) {
      const ok = window.confirm("Esto reemplazará las fechas actuales. ¿Desea continuar?");
      if (!ok) return;
    }

    const dates: string[] = [];
    let current = start;
    for (let i = 0; i < count; i++) {
      dates.push(current.toISOString().slice(0, 10));
      current =
        step.kind === "days"
          ? new Date(current.getTime() + step.value * 24 * 60 * 60 * 1000)
          : addMonthsUtc(current, step.value);
    }

    setApplyDates(dates);
    setApplyDateTexts(dates.map((d) => formatDMY(d)));
    setValue("totalCiclos", dates.length, { shouldValidate: true });
  }, [applyDates, fechaStr, getValues, setValue]);

  const toggleStatus = useCallback((s: ItemStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const clearStatusFilter = useCallback(() => {
    setStatusFilter(new Set());
    setStatusMenuOpen(false);
    statusTriggerRef.current?.focus();
  }, []);

  // El popover se cerraba solo con un clic fuera: `Escape` lo dejaba abierto
  // aunque el foco estuviera de vuelta en el disparador.
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setStatusMenuOpen(false);
      statusTriggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [statusMenuOpen]);

  const savePatient = useCallback(async () => {
    if (!editPatient) return;
    try {
      await patchPatient(editPatient.patientId, {
        identificacion: editPatient.identificacion,
        nombre: editPatient.nombre || null,
      });
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
      await deletePrepRequest(deletePatientReq.prepRequestId);
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
      await finalizePrepRequest(finalizePatientReq.prepRequestId, { finalizadoBy: "farmacia" });
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
      await patchAgendaItem(id, {
        ...patch,
        updatedBy: "farmacia",
        entregadoAt: patch.estado === "entregado" ? new Date().toISOString() : undefined,
        canceladoMotivo: patch.canceladoMotivo,
      });
      setToast({ kind: "success", message: "Actualizado" });
      await refresh();
    },
    [refresh],
  );

  // "Listo" y "Entregado" se aplicaban al instante, sin confirmación ni vuelta
  // atrás, desde botones contiguos de una fila entre once. Marcar "Entregado" al
  // paciente equivocado no tenía reparación; ahora el aviso ofrece deshacer.
  const changeStatus = useCallback(
    async (item: AgendaItem, next: ItemStatus) => {
      const previo = item.estado;
      const quien = item.nombre ?? item.identificacion;
      await patchAgendaItem(item.id, {
        estado: next,
        updatedBy: "farmacia",
        entregadoAt: next === "entregado" ? new Date().toISOString() : undefined,
      });
      setToast({
        kind: "success",
        message: `${quien}: ${STATUS_LABEL[next]}`,
        action:
          previo === next
            ? undefined
            : {
              label: "Deshacer",
              onAction: async () => {
                await patchAgendaItem(item.id, {
                  estado: previo,
                  updatedBy: "farmacia",
                  // Volver atrás desde "entregado" tiene que borrar la marca de
                  // entrega, o el registro queda diciendo que se entregó.
                  entregadoAt: previo === "entregado" ? undefined : null,
                });
                setToast({ kind: "success", message: `${quien}: ${STATUS_LABEL[previo]}` });
                await refresh();
              },
            },
      });
      await refresh();
    },
    [refresh],
  );

  const duplicateItem = useCallback(
    async (id: string) => {
      await duplicateAgendaItem(id, { createdBy: "farmacia" });
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

  useAgendaGlobalShortcuts({
    editId,
    onCancelEdit: cancelEdit,
    onFocusNew: () => quickIdentRef.current?.focus(),
    onPrint: () => window.print(),
  });

  useWindowClickDismiss(() => setMenuId(null));
  useWindowClickDismiss(() => setStatusMenuOpen(false));

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white print:hidden">
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Field label="Fecha de aplicación">
                {(f) => (
                  <Input
                    {...f}
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
                )}
              </Field>
              <Field label="Buscar paciente">
                {(f) => (
                  <Input
                    {...f}
                    className="mt-1"
                    placeholder="cédula / expediente / nombre"
                    value={searchPatient}
                    onChange={(e) => setSearchPatient(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Buscar medicamento">
                {(f) => (
                  <Input
                    {...f}
                    className="mt-1"
                    placeholder="nombre / código"
                    value={searchMedication}
                    onChange={(e) => setSearchMedication(e.target.value)}
                  />
                )}
              </Field>
              <div>
                <label className="block text-xs font-medium text-zinc-600" id="filtro-estados-rotulo">
                  Estados
                </label>
                <div className="mt-1">
                  <div className="relative inline-block">
                    <Button
                      ref={statusTriggerRef}
                      variant={statusFilter.size ? "primary" : "secondary"}
                      type="button"
                      className="px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusMenuOpen((v) => !v);
                      }}
                      aria-expanded={statusMenuOpen}
                      aria-haspopup="true"
                      aria-label={
                        statusFilter.size
                          ? `Estados: filtrando por ${activeStatusLabels.join(", ")}`
                          : "Estados: sin filtro, mostrando todos"
                      }
                    >
                      {statusFilter.size ? `ESTADOS (${statusFilter.size})` : "ESTADOS"}
                    </Button>
                    {statusMenuOpen ? (
                      <div
                        // Se abría hacia abajo tapando "Número de receta" e
                        // "Identificación", los dos primeros campos de captura.
                        // `right-0 bottom-full` lo saca de encima del formulario.
                        className="absolute bottom-full right-0 z-30 mb-2 w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key !== "Escape") return;
                          e.stopPropagation();
                          setStatusMenuOpen(false);
                          statusTriggerRef.current?.focus();
                        }}
                        role="group"
                        aria-labelledby="filtro-estados-rotulo"
                      >
                        <div className="flex flex-wrap gap-2">
                          {STATUS_ORDER.map((s) => (
                            <Chip
                              key={s}
                              active={statusFilter.has(s)}
                              aria-pressed={statusFilter.has(s)}
                              onClick={() => toggleStatus(s)}
                            >
                              {STATUS_LABEL[s]}
                            </Chip>
                          ))}
                        </div>
                        {statusFilter.size ? (
                          <button
                            type="button"
                            className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                            onClick={clearStatusFilter}
                          >
                            Quitar filtro y ver todos
                          </button>
                        ) : null}
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
              <h2 className="text-sm font-semibold text-zinc-900">Captura rápida</h2>
              <div className="text-xs text-zinc-500">Enter: siguiente campo (en Guardar: guarda)</div>
            </div>
            <form
              ref={quickFormRef}
              className="grid grid-cols-1 gap-3 md:grid-cols-7"
              onSubmit={onQuickSubmit}
              onKeyDownCapture={onQuickKeyDownCapture}
              // `required` se mantiene en cada campo porque es lo que anuncia la
              // obligatoriedad a un lector de pantalla, pero la burbuja nativa
              // corta el envío antes de React y se comía el resumen de lo que
              // falta. `noValidate` desactiva solo esa interfaz del navegador.
              noValidate
            >
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.fechaRecepcion}
                required
                error={formState.errors.fechaRecepcion?.message}
              >
                {(f) => <Input className="mt-1" type="date" {...f} {...register("fechaRecepcion")} />}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.numeroReceta}
                required
                error={formState.errors.numeroReceta?.message}
              >
                {(f) => (
                  <Input
                    className="mt-1"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    title="Debe ser exactamente de 6 dígitos"
                    placeholder="000000"
                    {...f}
                    {...register("numeroReceta")}
                    ref={(el) => {
                      register("numeroReceta").ref(el);
                      quickRecetaRef.current = el;
                    }}
                    onChange={(e) => {
                      const onlyDigits = normalizeNumeroReceta(e.target.value);
                      e.target.value = onlyDigits;
                      setValue("numeroReceta", onlyDigits, { shouldValidate: true });
                    }}
                    onBlur={(e) => {
                      const normalized = normalizeNumeroReceta(e.target.value, { pad: true });
                      e.target.value = normalized;
                      setValue("numeroReceta", normalized, { shouldValidate: true });
                    }}
                  />
                )}
              </Field>
              <Field
                className="md:col-span-1"
                label={FIELD_LABELS.identificacion}
                required
                error={formState.errors.identificacion?.message}
              >
                {(f) => (
                  <>
                    <Input
                      {...f}
                      {...register("identificacion")}
                      ref={(el) => {
                        register("identificacion").ref(el);
                        quickIdentRef.current = el;
                      }}
                      list="patient-suggestions"
                      className="mt-1"
                      placeholder="Ej: 1-1234-5678"
                      onChange={(e) => {
                        setValue("identificacion", e.target.value, { shouldValidate: true });
                        void loadPatientSuggestions(e.target.value);
                      }}
                      onBlur={() => {
                        const val = (document.querySelector('input[name="identificacion"]') as HTMLInputElement | null)?.value;
                        const match = patientSuggestions.find((p) => p.identificacion === val);
                        if (match?.nombre) setValue("nombre", match.nombre ?? "", { shouldValidate: true });
                      }}
                    />
                    <datalist id="patient-suggestions">
                      {patientSuggestions.map((p) => (
                        <option key={p.id} value={p.identificacion}>
                          {p.nombre ?? ""}
                        </option>
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.nombre}
                required
                error={formState.errors.nombre?.message}
              >
                {(f) => (
                  <Input
                    {...f}
                    {...register("nombre")}
                    className="mt-1"
                    placeholder="Autorrelleno si existe"
                  />
                )}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.medicamentoTexto}
                required
                error={
                  formState.errors.medicamentoId?.message ?? formState.errors.medicamentoTexto?.message
                }
              >
                {(f) => (
                <Input
                  {...f}
                  {...register("medicamentoTexto")}
                  list="med-suggestions"
                  className="mt-1"
                  placeholder="nombre / código"
                  onChange={(e) => {
                    const raw = e.target.value;
                    setValue("medicamentoTexto", raw, { shouldValidate: true });

                    const match = medSuggestions.find((m) => m.label === raw || m.nombre === raw);
                    if (match) {
                      setValue("medicamentoId", match.id, { shouldValidate: true });
                      setValue("medicamentoTexto", match.nombre, { shouldValidate: true });
                      return;
                    }

                    setValue("medicamentoId", "", { shouldValidate: true });
                    void loadMedSuggestions(raw);
                  }}
                  onBlur={() => {
                    const val = getValues("medicamentoTexto");
                    const match = medSuggestions.find((m) => m.label === val || m.nombre === val);
                    if (match) {
                      setValue("medicamentoId", match.id, { shouldValidate: true });
                      setValue("medicamentoTexto", match.nombre, { shouldValidate: true });
                    } else {
                      setValue("medicamentoId", "", { shouldValidate: true });
                    }
                  }}
                />
                )}
              </Field>
              <datalist id="med-suggestions">
                {medSuggestions.map((m) => (
                  <option key={m.id} value={m.label} />
                ))}
              </datalist>
              <Field
                className="md:col-span-1"
                label={FIELD_LABELS.dosisTexto}
                required
                error={formState.errors.dosisTexto?.message}
              >
                {(f) => (
                  <Input {...f} {...register("dosisTexto")} className="mt-1" placeholder="Ej: 500 mg" />
                )}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.frecuencia}
                required
                error={formState.errors.frecuencia?.message}
              >
                {(f) => (
                  <Input
                    {...f}
                    {...register("frecuencia")}
                    className="mt-1"
                    placeholder="Ej: CADA 8H / SEMANAL"
                  />
                )}
              </Field>
              <Field
                className="md:col-span-1"
                label={FIELD_LABELS.unidadesRequeridas}
                required
                error={formState.errors.unidadesRequeridas?.message}
              >
                {(f) => (
                  <Input
                    {...f}
                    {...register("unidadesRequeridas")}
                    type="number"
                    min={1}
                    step={1}
                    className="mt-1"
                  />
                )}
              </Field>
              <Field
                className="md:col-span-1"
                label={FIELD_LABELS.totalCiclos}
                required
                error={formState.errors.totalCiclos?.message}
              >
                {(f) => (
                <Input
                  {...f}
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
                )}
              </Field>
              <Field
                className="md:col-span-3"
                label={FIELD_LABELS.prescriberTexto}
                required
                error={
                  formState.errors.prescriberId?.message ?? formState.errors.prescriberTexto?.message
                }
              >
                {(f) => (
                  <>
                    <Input
                      className="mt-1"
                      list="prescriber-suggestions"
                      placeholder="Escriba para buscar"
                      {...f}
                      {...register("prescriberTexto")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setValue("prescriberTexto", val, { shouldValidate: true });
                        const match = prescribers.find((p) => personLabel(p) === val);
                        setValue("prescriberId", match?.id ?? "", { shouldValidate: true });
                      }}
                      onBlur={() => {
                        const val =
                          (document.querySelector('input[name="prescriberTexto"]') as HTMLInputElement | null)?.value ??
                          "";
                        const match = prescribers.find((p) => personLabel(p) === val);
                        setValue("prescriberId", match?.id ?? "", { shouldValidate: true });
                      }}
                    />
                    <datalist id="prescriber-suggestions">
                      {prescribers.map((p) => (
                        <option key={p.id} value={personLabel(p)} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.claveAutorizacion}
                error={formState.errors.claveAutorizacion?.message}
              >
                {(f) => (
                  <div className="flex items-center gap-2">
                    <Input
                      {...f}
                      {...register("claveAutorizacion")}
                      className="mt-1 flex-1"
                      placeholder="Opcional"
                    />
                    <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                      <input
                        type="checkbox"
                        id="ra-check"
                        {...register("recursoAmparo")}
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="ra-check" className="cursor-pointer text-xs font-bold text-blue-800">
                        RA
                        <span className="sr-only"> (recurso de amparo)</span>
                      </label>
                    </div>
                  </div>
                )}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.adquisicion}
                required
                error={formState.errors.adquisicion?.message}
              >
                {(f) => (
                  <Select className="mt-1" {...f} {...register("adquisicion")}>
                    <option value="almacenable">ALMACENABLE</option>
                    <option value="compra_local">COMPRA LOCAL</option>
                  </Select>
                )}
              </Field>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.observaciones}
                error={formState.errors.observaciones?.message}
              >
                {(f) => (
                  // Único campo que el servidor no pasa a mayúsculas al guardar
                  // (`body.observaciones ?? null` en /api/items): forzarlas solo
                  // en pantalla hacía que lo mostrado no fuese lo almacenado.
                  <Input
                    {...f}
                    {...register("observaciones")}
                    caja="normal"
                    className="mt-1"
                    placeholder="Texto corto"
                  />
                )}
              </Field>
              {/* Varias entradas bajo un mismo rótulo: `fieldset`/`legend` es lo
                  que agrupa; cada fila lleva su propio nombre accesible. */}
              <fieldset className="md:col-span-3">
                <legend className="block text-xs font-medium text-zinc-600">
                  Fechas de aplicación (máx. 16)
                </legend>
                {/* Al cambiar la fecha de la agenda se sincronizan las fechas de
                    aplicación pero no la de recepción, así que era fácil acabar
                    registrando una aplicación anterior a la receta sin enterarse.
                    Se avisa en vez de bloquear: puede haber casos legítimos de
                    carga retroactiva. */}
                {fechasAnterioresARecepcion.length ? (
                  <p
                    role="status"
                    className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                  >
                    {fechasAnterioresARecepcion.length === 1
                      ? `La fecha ${fechasAnterioresARecepcion[0]} es anterior a la de recepción.`
                      : `${fechasAnterioresARecepcion.length} fechas son anteriores a la de recepción: ${fechasAnterioresARecepcion.join(", ")}.`}{" "}
                    Revise que sea correcto.
                  </p>
                ) : null}
                <div className="mt-1 flex flex-col gap-2">
                  {applyDates.map((d, idx) => (
                    <div key={`${idx}-${d}`} className="flex items-center gap-2">
                      <Input
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                        aria-label={`Fecha de aplicación ${idx + 1} de ${applyDates.length}`}
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
                        <span className="sr-only">{` fecha de aplicación ${idx + 1}`}</span>
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
                    <Button variant="secondary" type="button" onClick={suggestApplyDates}>
                      Sugerir según frecuencia
                    </Button>
                  </div>
                </div>
              </fieldset>
              <Field
                className="md:col-span-2"
                label={FIELD_LABELS.pharmacistTexto}
                required
                error={
                  formState.errors.pharmacistId?.message ?? formState.errors.pharmacistTexto?.message
                }
              >
                {(f) => (
                  <>
                    <Input
                      className="mt-1"
                      list="pharmacist-suggestions"
                      placeholder="Escriba para buscar"
                      {...f}
                      {...register("pharmacistTexto")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setValue("pharmacistTexto", val, { shouldValidate: true });
                        const match = pharmacists.find((p) => personLabel(p) === val);
                        setValue("pharmacistId", match?.id ?? "", { shouldValidate: true });
                      }}
                      onBlur={() => {
                        const val =
                          (document.querySelector('input[name="pharmacistTexto"]') as HTMLInputElement | null)?.value ??
                          "";
                        const match = pharmacists.find((p) => personLabel(p) === val);
                        setValue("pharmacistId", match?.id ?? "", { shouldValidate: true });
                      }}
                    />
                    <datalist id="pharmacist-suggestions">
                      {pharmacists.map((p) => (
                        <option key={p.id} value={personLabel(p)} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <div className="md:col-span-7 flex flex-col items-stretch gap-2 md:flex-row md:items-end md:justify-between">
                {/* Antes el botón quedaba deshabilitado hasta que el formulario
                    fuese válido: con doce campos obligatorios el usuario veía un
                    botón apagado y ningún motivo. Ahora se puede enviar siempre,
                    y el envío inválido nombra lo que falta y lleva el foco allí. */}
                <div aria-live="polite" className="min-w-0">
                  {missingFields.length ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
                    >
                      <span className="font-semibold">
                        {missingFields.length === 1
                          ? "Falta un campo obligatorio: "
                          : `Faltan ${missingFields.length} campos obligatorios: `}
                      </span>
                      {missingFields.join(", ")}.
                    </div>
                  ) : null}
                </div>
                <Button variant="primary" type="submit" disabled={formState.isSubmitting}>
                  {formState.isSubmitting ? "Guardando…" : "Guardar"}
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

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:hidden">
          {/* La cabecera es el propio control de plegado: un botón con
              `aria-expanded` sobre el panel, para que el estado se anuncie y se
              alcance con el teclado igual que con el ratón. */}
          <h2
            className={`text-sm font-semibold text-zinc-900 ${
              ultimosAbierto ? "border-b border-zinc-200" : ""
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
              aria-expanded={ultimosAbierto}
              aria-controls="ultimos-registros-panel"
              onClick={() => setUltimosAbierto((open) => !open)}
            >
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                  ultimosAbierto ? "rotate-90" : ""
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                Pacientes registrados
                <span className="block text-xs font-normal text-zinc-500">
                  Edición completa (incluye fechas de aplicación)
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {loadingUltimos ? "…" : `${ultimos.length} ${ultimos.length === 1 ? "registro" : "registros"}`}
              </span>
            </button>
          </h2>
          <div id="ultimos-registros-panel" hidden={!ultimosAbierto}>
            <div className="flex flex-wrap items-end justify-end gap-2 border-b border-zinc-200 px-4 py-3">
              <Field label="Desde" className="w-44">
                {(f) => (
                  <Input
                    {...f}
                    className="mt-1 py-1.5"
                    type="date"
                    value={ultimosRango.from}
                    onChange={(e) =>
                      setUltimosRango((r) => ({ ...r, from: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Hasta" className="w-44">
                {(f) => (
                  <Input
                    {...f}
                    className="mt-1 py-1.5"
                    type="date"
                    value={ultimosRango.to}
                    onChange={(e) => setUltimosRango((r) => ({ ...r, to: e.target.value }))}
                  />
                )}
              </Field>
              <Button
                variant="secondary"
                type="button"
                className="py-1.5"
                disabled={!rangoUltimosValido}
                onClick={() => void loadUltimos()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                ACTUALIZAR
              </Button>
            </div>
            {!rangoUltimosValido ? (
              <div
                role="alert"
                className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800"
              >
                Indique ambas fechas; la final no puede ser anterior a la inicial.
              </div>
            ) : null}
            <div className="overflow-auto">
              <table className="min-w-full text-center text-sm text-blue-950">
                {/* El título vivía fuera de la tabla, así que la tabla en sí no
                    tenía nombre al navegarla con lector de pantalla. */}
                <caption className="sr-only">
                  Pacientes registrados en el rango de fechas seleccionado, con edición completa
                </caption>
                <thead className="bg-white">
                  <tr className="border-b border-zinc-200 text-xs font-semibold text-blue-900">
                    <th scope="col" className="px-3 py-2 text-center">FECHA</th>
                    <th scope="col" className="px-3 py-2 text-center">CÉDULA</th>
                    <th scope="col" className="px-3 py-2 text-center">NOMBRE DEL PACIENTE</th>
                    <th scope="col" className="px-3 py-2 text-center">MEDICAMENTO</th>
                    <th scope="col" className="px-3 py-2 text-center">DOSIS</th>
                    <th scope="col" className="px-3 py-2 text-center">FRECUENCIA</th>
                    <th scope="col" className="px-3 py-2 text-center">ACCIONES</th>
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
                        Sin registros en el rango seleccionado.
                      </td>
                    </tr>
                  ) : null}
                  {loadingUltimos ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:hidden">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Pacientes del día</h2>
            <div className="text-xs text-zinc-500">
              Editar / eliminar / finalizar por paciente (se envía a Histórico)
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-center text-sm">
              <caption className="sr-only">Pacientes con registros en la fecha seleccionada</caption>
              <thead className="bg-white">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                  <th scope="col" className="px-3 py-2 text-center">Identificación</th>
                  <th scope="col" className="px-3 py-2 text-center">Nombre</th>
                  <th scope="col" className="px-3 py-2 text-center">Líneas</th>
                  <th scope="col" className="px-3 py-2 text-center">Acciones</th>
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
                          title="Editar paciente"
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
                          title="Eliminar paciente del día"
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
                          title="Finalizar (enviar a histórico)"
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

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 print:hidden">
            <h2 className="text-sm font-semibold text-zinc-900">Agenda del día</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-600">
                {loading ? "Cargando…" : `${items.length} registros`}
              </span>
              <Button variant="secondary" onClick={() => refresh()} type="button" className="py-1.5">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Actualizar
              </Button>
            </div>
          </div>

          {/* La vista filtrada era indistinguible del día completo. */}
          {activeStatuses.length ? (
            <div
              className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 print:hidden"
              role="status"
            >
              <span className="text-xs font-semibold text-amber-900">
                Vista filtrada · no se muestran todos los registros del día
              </span>
              {activeStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-label={`Quitar el filtro ${STATUS_LABEL[s]}`}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  {STATUS_LABEL[s]}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <Button
                variant="secondary"
                type="button"
                className="px-2 py-1 text-xs"
                onClick={() => setStatusFilter(new Set())}
              >
                Ver todos
              </Button>
            </div>
          ) : null}

          {/* Tenía `max-h-[62vh] overflow-auto`: la tabla se desplazaba dentro
              de una página que también se desplaza, se veían 6 de 11 filas y
              aparecían filas cortadas por la mitad. Ahora crece y el encabezado
              se queda pegado justo bajo la cabecera de página. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-center text-sm">
              <caption className="sr-only">Agenda del día seleccionado</caption>
              <thead className="sticky top-[var(--altura-cabecera)] z-10 bg-white shadow-[0_1px_0_0_rgb(228_228_231)]">
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                  <th scope="col" className="px-3 py-2 text-center">Estado</th>
                  <th scope="col" className="px-3 py-2 text-center">Identificación</th>
                  <th scope="col" className="px-3 py-2 text-center">Nombre</th>
                  <th scope="col" className="px-3 py-2 text-center">Medicamento</th>
                  <th scope="col" className="px-3 py-2 text-center">Dosis</th>
                  <th scope="col" className="px-3 py-2 text-center">Unidades</th>
                  <th scope="col" className="px-3 py-2 text-center">Obs.</th>
                  <th scope="col" className="px-3 py-2 text-center print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr
                    key={i.id}
                    className={`border-b border-zinc-100 ${editId === i.id
                      ? "bg-emerald-50"
                      : idx % 2 === 0
                        ? "bg-white"
                        : "bg-zinc-50"
                      } hover:bg-zinc-100/60`}
                    onDoubleClick={() => startEdit(i)}
                  >
                    <td className="px-3 py-2 text-center">
                      <StatusBadge
                      value={i.estado}
                      editable
                      describedItem={i.nombre ?? i.identificacion}
                      onChange={(v) => void changeStatus(i, v)}
                    />
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
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${i.observaciones
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
                      <AgendaDesktopActions
                        isEditing={editId === i.id}
                        menuOpen={menuId === i.id}
                        onSetMenuOpen={(open) => setMenuId(open ? i.id : null)}
                        onMarkListo={() => void changeStatus(i, "listo")}
                        onMarkEntregado={() => void changeStatus(i, "entregado")}
                        onStartEdit={() => startEdit(i)}
                        onSaveEdit={() => void saveEdit()}
                        onCancelEdit={cancelEdit}
                        onDuplicate={() => void duplicateItem(i.id)}
                        onOpenObs={() => {
                          setMenuId(null);
                          setObsItem(i);
                        }}
                        onOpenCancel={() => {
                          setMenuId(null);
                          setCancelItem(i);
                          setCancelMotivo(i.canceladoMotivo ?? "");
                        }}
                      />
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
                    <StatusBadge
                      value={i.estado}
                      editable
                      describedItem={i.nombre ?? i.identificacion}
                      onChange={(v) => void changeStatus(i, v)}
                    />
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
                  <AgendaMobileActions
                    hasObservaciones={!!i.observaciones}
                    onMarkListo={() => void changeStatus(i, "listo")}
                    onMarkEntregado={() => void changeStatus(i, "entregado")}
                    onOpenObs={() => setObsItem(i)}
                    onDuplicate={() => void duplicateItem(i.id)}
                    onOpenCancel={() => {
                      setCancelItem(i);
                      setCancelMotivo(i.canceladoMotivo ?? "");
                    }}
                  />
                </div>
              ))}
              {!items.length ? (
                <div className="px-4 py-10 text-center text-sm text-zinc-500">
                  Sin registros para esta fecha/filtros.
                </div>
              ) : null}
            </div>
          </div>

          <AgendaSummaryFooter
            counts={counts}
            lastUpdated={lastUpdated}
            filtrado={statusFilter.size > 0}
          />
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
                    await patchUltimoRegistro(editUltimo.id, {
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
                    });
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
                  const onlyDigits = normalizeNumeroReceta(e.target.value);
                  e.target.value = onlyDigits;
                  setEditUltimo((p) => (p ? { ...p, numeroReceta: onlyDigits || null } : p));
                }}
                onBlur={(e) => {
                  const normalized = normalizeNumeroReceta(e.target.value, { pad: true });
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
        open={!!editPatient}
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
