import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CreditCard, CreditCardMonthlyConfig, ExpenseCustomCategory, ExpenseCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS } from "@/types";

/**
 * Resuelve label/icono/colores de una categoría, sea personalizada
 * ("custom_<uuid>") o un slug legacy de las categorías base.
 */
export function getCategoryMeta(
  category: string,
  customCategories: ExpenseCustomCategory[]
): { label: string; icon: string; bg: string; text: string; bar: string } {
  const custom = customCategories.find(c => `custom_${c.id}` === category);
  if (custom) {
    const [bg = "bg-slate-500/15", text = "text-slate-400"] = (custom.color ?? "").split(" ");
    return { label: custom.name, icon: custom.icon, bg, text, bar: "bg-slate-500" };
  }
  const colors = CATEGORY_COLORS[category as ExpenseCategory];
  return {
    label: CATEGORY_LABELS[category as ExpenseCategory] ?? category,
    icon:  CATEGORY_ICONS[category as ExpenseCategory]  ?? "📦",
    bg:    colors?.bg   ?? "bg-slate-500/15",
    text:  colors?.text ?? "text-slate-400",
    bar:   colors?.bar  ?? "bg-slate-500",
  };
}

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
 * Convención: el resumen se llama como el mes EN QUE CIERRA (no el mes en
 * que arrancan las compras). El día de cierre es exclusivo: un gasto hecho
 * justo el día del cierre ya entra al resumen siguiente.
 *
 *   expenseDay <  closingDay → resumen del mes del gasto
 *   expenseDay >= closingDay → resumen del mes SIGUIENTE al del gasto
 *
 * Ejemplo: tarjeta cierra el 2.
 *   Gasto 24-agosto (day=24 >= 2) → resumen SEPTIEMBRE (cierra el 2-sep) ✓
 *   Gasto 1-agosto  (day=1  < 2)  → resumen AGOSTO (cierra el 2-ago)     ✓
 */
export function getBillingPeriod(
  expenseDate: string,
  closingDay: number
): { periodLabel: string; dueMonth: number; dueYear: number } {
  const date  = new Date(expenseDate + "T00:00:00");
  const day   = date.getDate();
  let   month = date.getMonth();   // 0-indexed
  let   year  = date.getFullYear();

  if (day >= closingDay) {
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
 * Dado el mes/año del resumen y el due_day, devuelve el mes/año de vencimiento.
 *
 * El vencimiento siempre es posterior al cierre. Si el día de vencimiento
 * es anterior (numéricamente) al día de cierre, cronológicamente tiene que
 * caer en el mes siguiente al del resumen; si es igual o posterior, cae en
 * el mismo mes del resumen.
 *
 * Ejemplo: resumen Septiembre cierra el 2 → vence el 12 (12>=2, mismo mes:
 * Septiembre) o vence el 2 días después del cierre en el mes próximo si el
 * día de vencimiento numérico es menor al de cierre.
 */
export function getDueMonthYear(
  billingMonth: number,
  billingYear:  number,
  dueDay:       number,
  closingDay:   number
): { dueMonth: number; dueYear: number } {
  if (dueDay < closingDay) {
    const dueMonth = (billingMonth + 1) % 12;
    const dueYear  = billingMonth === 11 ? billingYear + 1 : billingYear;
    return { dueMonth, dueYear };
  }
  return { dueMonth: billingMonth, dueYear: billingYear };
}

/**
 * Fecha de CIERRE del resumen (statementMonth, statementYear) de una tarjeta.
 * El resumen se llama como el mes en que cierra, así que la fecha de cierre
 * cae siempre dentro de ese mismo mes/año — sin heurísticas.
 *
 * Prioridad: closing_date exacta del override mensual → closing_day (override
 * o habitual) dentro del mes del resumen.
 */
export function getClosingDate(
  statementMonth: number,
  statementYear:  number,
  card:           CreditCard,
  configs:        CreditCardMonthlyConfig[]
): Date {
  const ov = configs.find(
    c => c.credit_card_id === card.id && c.month === statementMonth && c.year === statementYear
  );
  if (ov?.closing_date) return new Date(ov.closing_date + "T00:00:00");

  const day = ov?.closing_day ?? card.closing_day;
  return new Date(statementYear, statementMonth, day);
}

/**
 * Fecha de VENCIMIENTO del resumen (statementMonth, statementYear).
 * Prioridad: due_date exacta del override → due_day, cayendo en el mismo
 * mes del resumen si due_day >= closing_day, o en el mes siguiente si no
 * (el vencimiento es siempre posterior al cierre).
 */
export function getDueDate(
  statementMonth: number,
  statementYear:  number,
  card:           CreditCard,
  configs:        CreditCardMonthlyConfig[]
): Date {
  const ov = configs.find(
    c => c.credit_card_id === card.id && c.month === statementMonth && c.year === statementYear
  );
  if (ov?.due_date) return new Date(ov.due_date + "T00:00:00");

  const dueDay     = ov?.due_day     ?? card.due_day;
  const closingDay = ov?.closing_day ?? card.closing_day;
  return dueDay >= closingDay
    ? new Date(statementYear, statementMonth, dueDay)
    : new Date(statementYear, statementMonth + 1, dueDay);
}

/**
 * Asigna un gasto al resumen correcto usando FECHAS reales de cierre.
 *
 * El resumen M abarca los gastos desde el día del cierre del resumen M-1
 * (inclusive) hasta el día ANTERIOR al cierre del resumen M.
 * El día del cierre ya pertenece al resumen siguiente.
 *
 * Ejemplo: resumen Junio cierra el 2-julio, resumen Mayo cerró el 2-junio.
 *   Gasto 1-julio → antes del 2-julio → resumen JUNIO ✓
 *   Gasto 2-julio → día del cierre  → resumen JULIO ✓
 */
export function getBillingPeriodForCard(
  expenseDate: string,
  card:        CreditCard,
  configs:     CreditCardMonthlyConfig[]
): { periodLabel: string; billingMonth: number; billingYear: number; closingDate: Date } {
  const d = new Date(expenseDate + "T00:00:00");

  // Buscar el resumen cuya ventana contiene la fecha del gasto
  // (desde 2 meses antes hasta 2 después del mes del gasto).
  for (let off = -2; off <= 2; off++) {
    const ref   = new Date(d.getFullYear(), d.getMonth() + off, 1);
    const month = ref.getMonth();
    const year  = ref.getFullYear();

    const close = getClosingDate(month, year, card, configs);

    const prevRef  = new Date(year, month - 1, 1);
    const prevClose = getClosingDate(prevRef.getMonth(), prevRef.getFullYear(), card, configs);

    if (d >= prevClose && d < close) {
      return {
        periodLabel:  `${MONTH_NAMES[month]} ${year}`,
        billingMonth: month,
        billingYear:  year,
        closingDate:  close,
      };
    }
  }

  // Fallback (no debería pasar): heurística clásica
  const bp = getBillingPeriod(expenseDate, card.closing_day);
  return {
    periodLabel:  bp.periodLabel,
    billingMonth: bp.dueMonth,
    billingYear:  bp.dueYear,
    closingDate:  getClosingDate(bp.dueMonth, bp.dueYear, card, configs),
  };
}

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}
