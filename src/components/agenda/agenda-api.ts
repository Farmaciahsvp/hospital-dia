"use client";

import type {
  MedicationSuggestion,
  PatientSuggestion,
  PersonOption,
  UltimoRegistro,
} from "@/components/agenda/agenda-domain";
import type {
  AgendaItemsResponse,
  CreateAgendaItemsRequest,
  FetchAgendaItemsParams,
  PatchAgendaItemRequest,
  PatchUltimoRegistroRequest,
  StaffOptionsResponse,
  UltimosRegistrosResponse,
} from "@/components/agenda/agenda-contracts";
import { addErrorLog } from "@/lib/error-log";

type ErrorPayload = { error?: string };

function logAgendaApiError(message: string, details?: string) {
  if (typeof window === "undefined") return;
  addErrorLog({ source: "agenda-api", message, details });
}

async function readErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await res.json()) as ErrorPayload;
    if (data?.error) return `${fallback}: ${data.error}`;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchAgendaItems(params: FetchAgendaItemsParams): Promise<AgendaItemsResponse> {
  const url = new URL("/api/items", window.location.origin);
  url.searchParams.set("date", params.date);
  if (params.patientQuery?.trim()) url.searchParams.set("patient", params.patientQuery.trim());
  if (params.medicationQuery?.trim()) url.searchParams.set("med", params.medicationQuery.trim());
  if (params.statuses?.length) url.searchParams.set("status", params.statuses.join(","));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const message = await readErrorMessage(res, "No se pudo cargar la agenda");
    logAgendaApiError(message);
    throw new Error(message);
  }
  return (await res.json()) as AgendaItemsResponse;
}

export async function fetchPatientSuggestions(query: string): Promise<PatientSuggestion[]> {
  const url = new URL("/api/patients", window.location.origin);
  url.searchParams.set("query", query);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as PatientSuggestion[];
}

export async function fetchMedicationSuggestions(query: string): Promise<MedicationSuggestion[]> {
  const url = new URL("/api/medications", window.location.origin);
  url.searchParams.set("query", query);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as MedicationSuggestion[];
}

export async function fetchStaffOptions(): Promise<StaffOptionsResponse> {
  const [prescRes, pharmRes] = await Promise.all([
    fetch("/api/prescribers", { cache: "no-store" }),
    fetch("/api/pharmacists", { cache: "no-store" }),
  ]);
  const prescribers = prescRes.ok ? ((await prescRes.json()) as PersonOption[]) : [];
  const pharmacists = pharmRes.ok ? ((await pharmRes.json()) as PersonOption[]) : [];
  return { prescribers, pharmacists };
}

export async function fetchUltimosRegistros(month?: string): Promise<UltimoRegistro[]> {
  const url = new URL("/api/ultimos-registros", window.location.origin);
  if (month) url.searchParams.set("month", month);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as UltimosRegistrosResponse;
  if (!res.ok) {
    const message = data.error || "No se pudo cargar";
    logAgendaApiError(message, month ? `month=${month}` : undefined);
    throw new Error(message);
  }
  return data.rows ?? [];
}

export async function createAgendaItems(payload: CreateAgendaItemsRequest): Promise<void> {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = "No se pudo guardar";
    logAgendaApiError(message);
    throw new Error(message);
  }
}

export async function patchPatient(
  patientId: string,
  payload: { identificacion: string; nombre: string | null },
): Promise<void> {
  const res = await fetch(`/api/patients/${patientId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = "No se pudo actualizar el paciente";
    logAgendaApiError(message, `patientId=${patientId}`);
    throw new Error(message);
  }
}

export async function deletePrepRequest(prepRequestId: string): Promise<void> {
  const res = await fetch(`/api/prep-requests/${prepRequestId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const message = "No se pudo eliminar";
    logAgendaApiError(message, `prepRequestId=${prepRequestId}`);
    throw new Error(message);
  }
}

export async function finalizePrepRequest(
  prepRequestId: string,
  payload: { finalizadoBy: string },
): Promise<void> {
  const res = await fetch(`/api/prep-requests/${prepRequestId}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = "No se pudo finalizar";
    logAgendaApiError(message, `prepRequestId=${prepRequestId}`);
    throw new Error(message);
  }
}

export async function patchAgendaItem(itemId: string, payload: PatchAgendaItemRequest): Promise<void> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = "No se pudo actualizar";
    logAgendaApiError(message, `itemId=${itemId}`);
    throw new Error(message);
  }
}

export async function duplicateAgendaItem(itemId: string, payload: { createdBy: string }): Promise<void> {
  const res = await fetch(`/api/items/${itemId}/duplicate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = "No se pudo duplicar";
    logAgendaApiError(message, `itemId=${itemId}`);
    throw new Error(message);
  }
}

export async function patchUltimoRegistro(
  ultimoId: string,
  payload: PatchUltimoRegistroRequest,
): Promise<void> {
  const res = await fetch(`/api/ultimos-registros/${ultimoId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    const message = data.error || "No se pudo guardar";
    logAgendaApiError(message, `ultimoId=${ultimoId}`);
    throw new Error(message);
  }
}
