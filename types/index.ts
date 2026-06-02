export type Currency = "ARS" | "USD";

export type PaymentMethod = "efectivo" | "debito" | "mercado_pago" | "credito";

export type CardType = "visa" | "master";

export type ExpenseCategory =
  | "alimentacion"
  | "transporte"
  | "servicios"
  | "salud"
  | "entretenimiento"
  | "ropa"
  | "tecnologia"
  | "educacion"
  | "viajes"
  | "restaurantes"
  | "supermercado"
  | "otros";

export interface CreditCard {
  id: string;
  name: string;
  card_type: CardType;
  closing_day: number;  // día de cierre (1-28)
  due_day: number;      // día de vencimiento (1-28)
  created_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  description: string;
  category: ExpenseCategory;
  date: string;          // YYYY-MM-DD
  payment_method: PaymentMethod;
  credit_card_id: string | null;
  billing_period: string | null;  // e.g. "Enero 2025"
  billing_month: number | null;   // 0-indexed
  billing_year: number | null;
  created_at: string;
}

export interface Investment {
  id: string;
  ticker: string;
  quantity: number;
  buy_price: number;   // USD
  buy_date: string;    // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

// Runtime types (with computed fields)
export interface InvestmentWithPrice extends Investment {
  currentPrice: number | null;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
}

export interface BillingPeriodSummary {
  periodLabel: string;
  dueMonth: number;
  dueYear: number;
  cards: {
    cardName: string;
    cardType: CardType;
    totalARS: number;
    totalUSD: number;
    dueDate: string;  // "15 de Enero 2025"
  }[];
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  servicios: "Servicios",
  salud: "Salud",
  entretenimiento: "Entretenimiento",
  ropa: "Ropa",
  tecnologia: "Tecnología",
  educacion: "Educación",
  viajes: "Viajes",
  restaurantes: "Restaurantes",
  supermercado: "Supermercado",
  otros: "Otros",
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  alimentacion: "bg-orange-500/20 text-orange-400",
  transporte: "bg-blue-500/20 text-blue-400",
  servicios: "bg-purple-500/20 text-purple-400",
  salud: "bg-red-500/20 text-red-400",
  entretenimiento: "bg-pink-500/20 text-pink-400",
  ropa: "bg-yellow-500/20 text-yellow-400",
  tecnologia: "bg-cyan-500/20 text-cyan-400",
  educacion: "bg-indigo-500/20 text-indigo-400",
  viajes: "bg-teal-500/20 text-teal-400",
  restaurantes: "bg-amber-500/20 text-amber-400",
  supermercado: "bg-lime-500/20 text-lime-400",
  otros: "bg-gray-500/20 text-gray-400",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  mercado_pago: "Mercado Pago",
  credito: "Crédito",
};
