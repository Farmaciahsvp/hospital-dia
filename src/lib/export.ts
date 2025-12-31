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

export type CalendarDayExportRow = {
  identificacion: string;
  nombre: string | null;
  numeroReceta: string | null;
  medicationCodigo: string | null;
  medicationNombre: string;
  viaAdministracion: string | null;
  dosis: string;
  unidades: number;
  prescriberCodigo: string | null;
};

export function exportCalendarDayPdf(
  rows: CalendarDayExportRow[],
  filename: string,
  title: string,
  dayLabel: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(11);
  doc.text(dayLabel, 14, 30);

  function drawFooter() {
    const marginX = 14;
    const gap = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const footerY = pageHeight - 14;
    const available = pageWidth - marginX * 2;
    const colWidth = (available - gap * 2) / 3;

    doc.setFontSize(10);

    const labels = ["DIGITADOR:", "ACOPIADO POR:", "FARMACÉUTICO:"] as const;
    for (let i = 0; i < labels.length; i++) {
      const x = marginX + i * (colWidth + gap);
      const label = labels[i];
      doc.text(label, x, footerY);

      const labelW = doc.getTextWidth(label);
      const lineStart = x + labelW + 2;
      const lineEnd = x + colWidth;
      if (lineEnd > lineStart + 8) {
        doc.setLineWidth(0.2);
        doc.line(lineStart, footerY + 1, lineEnd, footerY + 1);
      }
    }
  }

  autoTable(doc, {
    startY: 40,
    margin: { left: 14, right: 14, bottom: 22 },
    head: [
      [
        "CEDULA",
        "NOMBRE",
        "NUMERO RECETA",
        "CODIGO MEDICAMENTO",
        "MEDICAMENTO",
        "DOSIS",
        "VIA ADMINISTRACION",
        "UNIDADES",
        "COD. PRESCRIPTOR",
      ],
    ],
    body: rows.map((r) => [
      r.identificacion,
      r.nombre ?? "",
      r.numeroReceta ?? "",
      r.medicationCodigo ?? "",
      r.medicationNombre,
      r.dosis,
      r.viaAdministracion ?? "",
      String(r.unidades),
      r.prescriberCodigo ?? "",
    ]),
    styles: { fontSize: 9, cellPadding: 2, halign: "center", valign: "middle" },
    headStyles: { fillColor: [24, 24, 27], halign: "center" },
    didDrawPage: () => {
      drawFooter();
    },
  });

  const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 40;
  const signatureY = doc.internal.pageSize.getHeight() + 1000 + lastY;
  doc.setFontSize(10);
  doc.text(
    "DIGITADOR: ____________________    ACOPIADO POR: ____________________    FARMACÉUTICO: ____________________",
    14,
    signatureY,
  );

  doc.save(filename);
}
