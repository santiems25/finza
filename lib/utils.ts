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
 * Given an expense date and the card's closing day,
 * returns the billing period start date (YYYY-MM-DD).
 *
 * Logic:
 *  - If expenseDay <= closingDay  → billing month = current month
 *    (period starts on closingDay+1 of PREVIOUS month)
 *  - If expenseDay > closingDay   → billing month = next month
 *    (period starts on closingDay+1 of CURRENT month)
 */
export function getBillingPeriod(
  expenseDate: string,
  closingDay: number
): { periodLabel: string; dueMonth: number; dueYear: number } {
  const date = new Date(expenseDate + "T00:00:00");
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  let billingMonth: number;
  let billingYear: number;

  if (day <= closingDay) {
    // charge goes to current month's summary
    billingMonth = month;
    billingYear = year;
  } else {
    // charge goes to next month's summary
    billingMonth = month + 1;
    billingYear = year;
    if (billingMonth > 11) {
      billingMonth = 0;
      billingYear += 1;
    }
  }

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  return {
    periodLabel: `${monthNames[billingMonth]} ${billingYear}`,
    dueMonth: billingMonth,
    dueYear: billingYear,
  };
}

export function getMonthName(month: number): string {
  const names = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return names[month];
}
