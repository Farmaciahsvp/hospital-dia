import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { STATUS_LABEL, type ItemStatus } from "@/lib/status";

export type ExportRow = {
  fechaAplicacion: string;
  identificacion: string;
  nombre: string | null;
  medicamento: string;
  dosis: string;
  unidades: number;
  estado: ItemStatus;
  observaciones: string | null;
};

export function exportPdf(rows: ExportRow[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [
      [
        "Fecha",
        "Identificación",
        "Nombre",
        "Medicamento",
        "Dosis",
        "Unidades",
        "Estado",
        "Obs.",
      ],
    ],
    body: rows.map((r) => [
      r.fechaAplicacion,
      r.identificacion,
      r.nombre ?? "",
      r.medicamento,
      r.dosis,
      String(r.unidades),
      STATUS_LABEL[r.estado],
      r.observaciones ?? "",
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [24, 24, 27] },
  });
  doc.save(filename);
}

export function exportConsolidatedPdf(
  rows: Array<{ medicamento: string; unidades: number; lineas: number }>,
  filename: string,
  title: string,
) {
  const doc = new jsPDF({ orientation: "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [["Medicamento", "Unidades", "Líneas"]],
    body: rows.map((r) => [r.medicamento, String(r.unidades), String(r.lineas)]),
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [24, 24, 27] },
  });
  doc.save(filename);
}
