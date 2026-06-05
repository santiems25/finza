import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * Regla:
 *   - expenseDay <= closingDay  → resumen del mes de la fecha (billingMonth = month del gasto)
 *   - expenseDay >  closingDay  → resumen del mes siguiente
 *
 * El "billingMonth/Year" es el mes al que pertenece el resumen
 * (que se paga en due_day de ese mismo mes, según la conv. del Excel).
 */
export function getBillingPeriod(
  expenseDate: string,
  closingDay: number
): { periodLabel: string; dueMonth: number; dueYear: number } {
  const date  = new Date(expenseDate + "T00:00:00");
  const day   = date.getDate();
  let   month = date.getMonth();     // 0-indexed
  let   year  = date.getFullYear();

  if (day > closingDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  return {
    periodLabel: `${MONTH_NAMES[month]} ${year}`,
    dueMonth:    month,
    dueYear:     year,
  };
}

/**
 * Dado el mes/año de CIERRE del resumen (billing), devuelve el mes/año de VENCIMIENTO.
 * El vencimiento siempre cae en el mes siguiente al cierre.
 *
 * Ejemplo: billingMonth=5 (Junio), billingYear=2026
 *          → dueMonth=6 (Julio), dueYear=2026
 */
export function getDueMonthYear(
  billingMonth: number,
  billingYear:  number
): { dueMonth: number; dueYear: number } {
  const dueMonth = (billingMonth + 1) % 12;
  const dueYear  = billingMonth === 11 ? billingYear + 1 : billingYear;
  return { dueMonth, dueYear };
}

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}
