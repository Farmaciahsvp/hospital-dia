// Lógica pura de la agenda, sin React ni zod, para poder probarla con `node --test`.
// Misma convención que `src/lib/access-gate.mjs` y `src/lib/auth/permissions.mjs`.
// `agenda-domain.ts` reexporta todo esto con los tipos del dominio.

export function personLabel(p) {
  return `${p.codigo} - ${p.nombres} ${p.apellidos}`.trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toMonthInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Primer y último día del mes de `date`, en el formato de `<input type="date">`.
 * Es el rango por defecto de "Pacientes registrados": antes el filtro era un
 * `<input type="month">` y no había forma de mirar una semana ni de cruzar meses.
 */
export function monthRangeOf(date) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

/**
 * Un rango sirve para consultar solo si ambas fechas están completas y la final
 * no es anterior a la inicial. Comparar las cadenas ISO basta: son ordenables.
 */
export function isValidDateRange(from, to) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  const desde = String(from ?? "");
  const hasta = String(to ?? "");
  if (!pattern.test(desde) || !pattern.test(hasta)) return false;
  return desde <= hasta;
}

/**
 * Deja solo dígitos y recorta a 6. Con `pad`, rellena con ceros a la izquierda
 * (lo que espera el campo al perder el foco). Cadena vacía se conserva vacía.
 */
export function normalizeNumeroReceta(raw, { pad = false } = {}) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 6);
  if (!pad) return digits;
  return digits ? digits.padStart(6, "0") : "";
}

export function toExportRows(items) {
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

export function buildStatusCounts(items) {
  const c = {
    pendiente: 0,
    en_preparacion: 0,
    listo: 0,
    entregado: 0,
    cancelado: 0,
  };
  for (const i of items) c[i.estado]++;
  return c;
}

export function buildConsolidatedByMedication(items) {
  const map = new Map();
  for (const i of items) {
    const current =
      map.get(i.medicamento) ?? { medicamento: i.medicamento, unidades: 0, lineas: 0 };
    current.unidades += i.unidadesRequeridas;
    current.lineas += 1;
    map.set(i.medicamento, current);
  }
  return Array.from(map.values()).sort((a, b) => a.medicamento.localeCompare(b.medicamento));
}

export function buildPatientsOfDay(items) {
  const map = new Map();
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

export function formatDMY(dateStr) {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

export function parseDateInputToISO(raw) {
  const value = raw.trim();
  if (!value) return null;

  const isValid = (y, m, d) => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (y < 1900 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1) return false;
    const daysInMonth = new Date(y, m, 0).getDate();
    return d <= daysInMonth;
  };

  const toIso = (y, m, d) =>
    `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    return isValid(y, m, d) ? toIso(y, m, d) : null;
  }

  const dmy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
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

/**
 * @param {string | null | undefined} raw
 * @returns {{ kind: "days" | "months", value: number } | null}
 */
export function parseFrequencyStep(raw) {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const norm = value
    .normalize("NFD")
    // Quita las marcas diacríticas separadas por NFD ("MENSÚAL" -> "MENSUAL").
    .replace(/\p{M}/gu, "")
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

export function isoToUtcDate(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addMonthsUtc(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}
