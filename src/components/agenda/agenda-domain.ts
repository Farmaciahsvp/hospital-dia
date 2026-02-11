"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { MAX_APPLY_DATES } from "@/lib/domain-rules";
import type { ExportRow } from "@/lib/export";
import type { ItemStatus } from "@/lib/status";

export type PatientSuggestion = { id: string; identificacion: string; nombre: string | null };

export type MedicationSuggestion = {
  id: string;
  codigoInstitucional: string | null;
  nombre: string;
  label: string;
};

export type AgendaItem = {
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

export type UltimoRegistro = {
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

export type PersonOption = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
};

export const quickSchema = z.object({
  fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Requerido" }),
  numeroReceta: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(0, 6))
    .refine((v) => /^\d{6}$/.test(v), { message: "Debe ser de 6 dígitos" }),
  prescriberTexto: z.string().trim().min(1, "Requerido"),
  prescriberId: z.string().uuid({ message: "Seleccione un prescriptor de la lista" }),
  pharmacistTexto: z.string().trim().min(1, "Requerido"),
  pharmacistId: z.string().uuid({ message: "Seleccione un farmacéutico de la lista" }),
  claveAutorizacion: z.string().trim().max(100).optional(),
  identificacion: z.string().trim().min(1, "Requerido"),
  nombre: z.string().trim().min(1, "Requerido"),
  medicamentoId: z.string().uuid({ message: "Seleccione un medicamento de la lista" }),
  medicamentoTexto: z.string().trim().min(1),
  dosisTexto: z.string().trim().min(1),
  unidadesRequeridas: z.preprocess((v) => Number(v), z.number().positive()),
  totalCiclos: z.preprocess((v) => Number(v), z.number().int().positive().max(MAX_APPLY_DATES)),
  frecuencia: z.string().trim().min(1, "Requerido").max(50),
  adquisicion: z.enum(["almacenable", "compra_local"]),
  observaciones: z.string().trim().max(300).optional(),
  recursoAmparo: z.boolean().optional(),
});

export type QuickForm = z.infer<typeof quickSchema>;

export function personLabel(p: PersonOption) {
  return `${p.codigo} - ${p.nombres} ${p.apellidos}`.trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toMonthInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function toExportRows(items: AgendaItem[]): ExportRow[] {
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

export function buildStatusCounts(items: AgendaItem[]) {
  const c: Record<ItemStatus, number> = {
    pendiente: 0,
    en_preparacion: 0,
    listo: 0,
    entregado: 0,
    cancelado: 0,
  };
  for (const i of items) c[i.estado]++;
  return c;
}

export function buildConsolidatedByMedication(items: AgendaItem[]) {
  const map = new Map<string, { medicamento: string; unidades: number; lineas: number }>();
  for (const i of items) {
    const current =
      map.get(i.medicamento) ?? { medicamento: i.medicamento, unidades: 0, lineas: 0 };
    current.unidades += i.unidadesRequeridas;
    current.lineas += 1;
    map.set(i.medicamento, current);
  }
  return Array.from(map.values()).sort((a, b) => a.medicamento.localeCompare(b.medicamento));
}

export function buildPatientsOfDay(items: AgendaItem[]) {
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
}

export function formatDMY(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

export function parseDateInputToISO(raw: string): string | null {
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

type FrequencyStep = { kind: "days"; value: number } | { kind: "months"; value: number };

export function parseFrequencyStep(raw: string | null | undefined): FrequencyStep | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const norm = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const cadaMatch = norm.match(/\bCADA\s+(\d+)\s*(H|HRS|HORAS|DIA|DIAS|SEMANA|SEMANAS|MES|MESES)\b/);
  if (cadaMatch) {
    const n = Number.parseInt(cadaMatch[1] ?? "", 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = cadaMatch[2] ?? "";
    if (unit === "H" || unit === "HRS" || unit === "HORAS") return null;
    if (unit === "DIA" || unit === "DIAS") return { kind: "days", value: n };
    if (unit === "SEMANA" || unit === "SEMANAS") return { kind: "days", value: n * 7 };
    if (unit === "MES" || unit === "MESES") return { kind: "months", value: n };
  }

  if (/\bDIARIO\b|\bDIARIA\b/.test(norm)) return { kind: "days", value: 1 };
  if (/\bSEMANAL\b/.test(norm)) return { kind: "days", value: 7 };
  if (/\bQUINCENAL\b/.test(norm)) return { kind: "days", value: 15 };
  if (/\bMENSUAL\b/.test(norm)) return { kind: "months", value: 1 };
  if (/\bBIMENSUAL\b/.test(norm)) return { kind: "months", value: 2 };
  if (/\bTRIMESTRAL\b/.test(norm)) return { kind: "months", value: 3 };
  if (/\bANUAL\b/.test(norm)) return { kind: "months", value: 12 };

  return null;
}

export function isoToUtcDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addMonthsUtc(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}
