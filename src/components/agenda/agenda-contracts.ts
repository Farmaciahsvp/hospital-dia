import type { ItemStatus } from "@/lib/status";
import type { AgendaItem, PatientSuggestion, MedicationSuggestion, PersonOption, UltimoRegistro } from "@/components/agenda/agenda-domain";

export type AgendaItemsResponse = {
  items: AgendaItem[];
  serverTime: string;
};

export type UltimosRegistrosResponse = {
  rows?: UltimoRegistro[];
  error?: string;
};

export type CreateAgendaItemsRequest = {
  fechasAplicacion: string[];
  fechaRecepcion: string;
  numeroReceta: string;
  prescriberId: string;
  pharmacistId: string;
  patient: { identificacion: string; nombre: string };
  medication: { id: string; nombre: string };
  dosisTexto: string;
  unidadesRequeridas: number;
  frecuencia: string;
  adquisicion: "almacenable" | "compra_local";
  observaciones?: string | null;
  recursoAmparo?: boolean;
  createdBy?: string;
};

export type PatchAgendaItemRequest = Partial<
  Pick<AgendaItem, "estado" | "dosisTexto" | "unidadesRequeridas" | "observaciones">
> & {
  canceladoMotivo?: string | null;
  updatedBy?: string;
  entregadoAt?: string;
};

export type PatchUltimoRegistroRequest = {
  patientId: string;
  identificacion: string;
  nombre: string | null;
  medication: { id: string | null; nombre: string };
  dosisTexto: string;
  unidadesRequeridas: number;
  frecuencia: string | null;
  adquisicion: "almacenable" | "compra_local";
  observaciones: string | null;
  fechaRecepcion: string | null;
  numeroReceta: string | null;
  prescriberId: string | null;
  pharmacistId: string | null;
  fechasAplicacion: string[];
  itemIds: string[];
};

export type FetchAgendaItemsParams = {
  date: string;
  patientQuery?: string;
  medicationQuery?: string;
  statuses?: ItemStatus[];
};

export type StaffOptionsResponse = {
  prescribers: PersonOption[];
  pharmacists: PersonOption[];
};

export type SuggestionResponses = {
  patients: PatientSuggestion[];
  medications: MedicationSuggestion[];
};
