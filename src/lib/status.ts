export type ItemStatus =
  | "pendiente"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export function statusClassName(status: ItemStatus) {
  switch (status) {
    case "pendiente":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "en_preparacion":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "listo":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "entregado":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "cancelado":
      return "bg-rose-50 text-rose-700 ring-rose-200";
  }
}
