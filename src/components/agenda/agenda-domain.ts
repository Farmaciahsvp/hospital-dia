"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { MAX_APPLY_DATES } from "@/lib/domain-rules";
import type { ExportRow } from "@/lib/export";
import type { ItemStatus } from "@/lib/status";
import * as domain from "./agenda-domain.mjs";

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
    .transform((v) => domain.normalizeNumeroReceta(v))
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

export const personLabel: (p: PersonOption) => string = domain.personLabel;

export const toMonthInputValue: (date: Date) => string = domain.toMonthInputValue;

export const normalizeNumeroReceta: (
  raw: unknown,
  options?: { pad?: boolean },
) => string = domain.normalizeNumeroReceta;

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
export const toExportRows: (items: AgendaItem[]) => ExportRow[] = domain.toExportRows;

export const buildStatusCounts: (items: AgendaItem[]) => Record<ItemStatus, number> =
  domain.buildStatusCounts;

export const buildConsolidatedByMedication: (
  items: AgendaItem[],
) => Array<{ medicamento: string; unidades: number; lineas: number }> =
  domain.buildConsolidatedByMedication;

export const buildPatientsOfDay: (items: AgendaItem[]) => Array<{
  patientId: string;
  prepRequestId: string;
  identificacion: string;
  nombre: string;
  itemsCount: number;
}> = domain.buildPatientsOfDay;

export const formatDMY: (dateStr: string) => string = domain.formatDMY;

export const parseDateInputToISO: (raw: string) => string | null = domain.parseDateInputToISO;

type FrequencyStep = { kind: "days"; value: number } | { kind: "months"; value: number };

export const parseFrequencyStep: (raw: string | null | undefined) => FrequencyStep | null =
  domain.parseFrequencyStep;

export const isoToUtcDate: (iso: string) => Date = domain.isoToUtcDate;

export const addMonthsUtc: (date: Date, months: number) => Date = domain.addMonthsUtc;
