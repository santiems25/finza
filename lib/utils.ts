import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parsea un string numérico aceptando tanto punto como coma como decimal. */
export function parseAmount(v: string): number {
  return parseFloat(v.replace(",", ".")) || 0;
}

/**
 * Parsea una cantidad que puede ser un número o una fracción ("2/120").
 * Devuelve null si el valor no es válido.
 */
export function parseQuantity(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    if (isNaN(a) || isNaN(b) || b === 0) return null;
    return a / b;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function formatCurrency(amount: number, currency: "ARS" | "USD"): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Calcula a qué período de resumen corresponde un gasto de TC.
 *
 * Regla según el día de cierre:
 *   - closingDay < 15  → el cierre cae en el mes SIGUIENTE al mes del resumen.
 *     · expenseDay <  closingDay → resumen del mes ANTERIOR al del gasto
 *     · expenseDay >= closingDay → resumen del mes del gasto
 *
 *   - closingDay >= 15 → el cierre cae en el mismo mes del resumen.
 *     · expenseDay <  closingDay → resumen del mes del gasto
 *     · expenseDay >= closingDay → resumen del mes SIGUIENTE al del gasto
 *
 * Ejemplo A: cierre=2  (< 15, cae en mes siguiente)
 *   Gasto 1-julio  (day=1  < 2)  → resumen Junio  ✓
 *   Gasto 2-julio  (day=2  >= 2) → resumen Julio  ✓
 *   Gasto 15-junio (day=15 >= 2) → resumen Junio  ✓
 *
 * Ejemplo B: cierre=28 (>= 15, cae en el mismo mes)
 *   Gasto 27-junio (day=27 < 28)  → resumen Junio  ✓
 *   Gasto 28-junio (day=28 >= 28) → resumen Julio  ✓
 */
export function getBillingPeriod(
  expenseDate: string,
  closingDay: number
): { periodLabel: string; dueMonth: number; dueYear: number } {
  const date  = new Date(expenseDate + "T00:00:00");
  const day   = date.getDate();
  let   month = date.getMonth();   // 0-indexed
  let   year  = date.getFullYear();

  if (closingDay < 15) {
    // El cierre está en el mes siguiente. El día de cierre es INCLUSIVO:
    // gastos hasta el día de cierre (inclusive) van al resumen anterior.
    if (day <= closingDay) {
      month -= 1;
      if (month < 0) { month = 11; year -= 1; }
    }
  } else {
    // El cierre está en el mismo mes. El día de cierre es INCLUSIVO:
    // solo los gastos DESPUÉS del día de cierre van al resumen siguiente.
    if (day > closingDay) {
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }
  }

  return {
    periodLabel: `${MONTH_NAMES[month]} ${year}`,
    dueMonth:    month,
    dueYear:     year,
  };
}

/**
 * Dado el mes/año de billing y el due_day, devuelve la fecha real de vencimiento.
 *
 * Regla:
 *   - dueDay < 15  → el vencimiento cae en el mes SIGUIENTE al billing month
 *   - dueDay >= 15 → el vencimiento cae en el mismo mes que el billing month
 *
 * Ejemplo: billingMonth=5 (Junio), dueDay=12 (< 15) → vence en Julio
 *          billingMonth=5 (Junio), dueDay=20 (>=15) → vence en Junio
 */
export function getDueMonthYear(
  billingMonth: number,
  billingYear:  number,
  dueDay:       number
): { dueMonth: number; dueYear: number } {
  if (dueDay < 15) {
    const dueMonth = (billingMonth + 1) % 12;
    const dueYear  = billingMonth === 11 ? billingYear + 1 : billingYear;
    return { dueMonth, dueYear };
  }
  return { dueMonth: billingMonth, dueYear: billingYear };
}

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}
