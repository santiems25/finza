export type Currency = "ARS" | "USD";

export type IncomeSource = "sueldo" | "freelance" | "alquiler" | "dividendos" | "bono" | "otros";

export type AssetType = "accion" | "etf" | "cedear" | "bono" | "cripto" | "otro";

export type PaymentMethod = "efectivo" | "debito" | "mercado_pago" | "credito";

export type CardType = "visa" | "master";

// Categorías exactas del Excel del usuario
export type ExpenseCategory =
  | "oficina"
  | "juntada"
  | "comida_afuera"
  | "peluqueria"
  | "gym"
  | "ropa"
  | "viaje"
  | "bolucompra"
  | "salida"
  | "regalo"
  | "otros";

export interface Account {
  id: string;
  name: string;
  currency: Currency;
  account_type: "bank" | "wallet" | "cash";
  created_at: string;
}

export interface CreditCard {
  id: string;
  name: string;
  card_type: CardType;
  closing_day: number;
  due_day: number;
  account_id: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  description: string;
  category: string;         // libre: ExpenseCategory hardcodeada o slug de custom category
  date: string;             // YYYY-MM-DD
  payment_method: PaymentMethod;
  credit_card_id: string | null;
  account_id: string | null;
  billing_period: string | null; // "Enero 2025"
  billing_month: number | null;  // 0-indexed
  billing_year: number | null;
  // Cuotas
  total_installments: number;    // 1 = pago único
  installment_number: number;    // 1-based
  notes: string | null;
  created_at: string;
}

export interface ExpenseCustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface SavingsConfig {
  id: string;
  initial_ars: number;
  initial_usd: number;
  updated_at: string;
}

export interface FxTransaction {
  id: string;
  ars_amount: number;
  usd_amount: number;
  exchange_rate: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Dividend {
  id: string;
  ticker: string;
  amount: number;   // USD
  date: string;     // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

export interface Income {
  id: string;
  amount: number;
  currency: Currency;
  description: string;
  source: IncomeSource;
  date: string;        // YYYY-MM-DD
  account_id: string | null;
  created_at: string;
}

export interface Investment {
  id: string;
  ticker: string;
  asset_type: AssetType;
  quantity: number;
  buy_price: number;
  buy_date: string;
  is_sold: boolean;
  sell_price: number | null;
  sell_date: string | null;
  notes: string | null;
  created_at: string;
}

// Posición agrupada por ticker (suma de lotes activos)
export interface Position {
  ticker: string;
  asset_type: AssetType;
  totalQty: number;
  totalCost: number;
  avgBuyPrice: number;
  firstBuyDate: string;
  lots: Investment[];         // lotes individuales
  // computed con precio actual:
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
}

// Lote vendido con P&L realizado calculado
export interface SoldLot extends Investment {
  realizedPnL: number;
  realizedPnLPct: number;
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  accion: "Acción",
  etf:    "ETF",
  cedear: "CEDEAR",
  bono:   "Bono",
  cripto: "Cripto",
  otro:   "Otro",
};

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  accion: "bg-blue-500/15 text-blue-400",
  etf:    "bg-violet-500/15 text-violet-400",
  cedear: "bg-teal-500/15 text-teal-400",
  bono:   "bg-amber-500/15 text-amber-400",
  cripto: "bg-orange-500/15 text-orange-400",
  otro:   "bg-slate-500/15 text-slate-400",
};

// Override de días de cierre/vencimiento para un mes específico
export interface CreditCardMonthlyConfig {
  id: string;
  credit_card_id: string;
  month: number;       // 0-indexed (0=Enero)
  year: number;
  closing_day: number;
  due_day: number;
  created_at: string;
}

// Tabla para marcar un resumen de TC como pagado
export interface BillingPayment {
  id: string;
  credit_card_id: string;
  billing_month: number;
  billing_year: number;
  paid_at: string;
  created_at: string;
}

export interface BillingPeriodSummary {
  periodLabel: string;
  billingMonth: number;
  billingYear: number;
  cards: {
    card: CreditCard;
    totalARS: number;
    totalUSD: number;
    isPaid: boolean;
    expenses: Expense[];
  }[];
}

// ─── Labels y colores ──────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  oficina:       "Oficina",
  juntada:       "Juntada",
  comida_afuera: "Comida afuera",
  peluqueria:    "Peluquería",
  gym:           "Gym",
  ropa:          "Ropa",
  viaje:         "Viaje",
  bolucompra:    "Bolucompra",
  salida:        "Salida",
  regalo:        "Regalo",
  otros:         "Otros",
};

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  oficina:       "☕",
  juntada:       "🍻",
  comida_afuera: "🍽️",
  peluqueria:    "✂️",
  gym:           "🏋️",
  ropa:          "👕",
  viaje:         "✈️",
  bolucompra:    "🛍️",
  salida:        "🎉",
  regalo:        "🎁",
  otros:         "📦",
};

export const CATEGORY_COLORS: Record<ExpenseCategory, { bg: string; text: string; bar: string }> = {
  oficina:       { bg: "bg-sky-500/15",     text: "text-sky-400",     bar: "bg-sky-500"     },
  juntada:       { bg: "bg-amber-500/15",   text: "text-amber-400",   bar: "bg-amber-500"   },
  comida_afuera: { bg: "bg-orange-500/15",  text: "text-orange-400",  bar: "bg-orange-500"  },
  peluqueria:    { bg: "bg-pink-500/15",    text: "text-pink-400",    bar: "bg-pink-500"    },
  gym:           { bg: "bg-emerald-500/15", text: "text-emerald-400", bar: "bg-emerald-500" },
  ropa:          { bg: "bg-violet-500/15",  text: "text-violet-400",  bar: "bg-violet-500"  },
  viaje:         { bg: "bg-teal-500/15",    text: "text-teal-400",    bar: "bg-teal-500"    },
  bolucompra:    { bg: "bg-rose-500/15",    text: "text-rose-400",    bar: "bg-rose-500"    },
  salida:        { bg: "bg-fuchsia-500/15", text: "text-fuchsia-400", bar: "bg-fuchsia-500" },
  regalo:        { bg: "bg-yellow-500/15",  text: "text-yellow-400",  bar: "bg-yellow-500"  },
  otros:         { bg: "bg-slate-500/15",   text: "text-slate-400",   bar: "bg-slate-500"   },
};

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  sueldo:     "Sueldo",
  freelance:  "Freelance",
  alquiler:   "Alquiler",
  dividendos: "Dividendos",
  bono:       "Bono",
  otros:      "Otros",
};

export const INCOME_SOURCE_ICONS: Record<IncomeSource, string> = {
  sueldo:     "💼",
  freelance:  "💻",
  alquiler:   "🏠",
  dividendos: "📈",
  bono:       "🎯",
  otros:      "💰",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo:     "Efectivo",
  debito:       "Débito",
  mercado_pago: "Mercado Pago",
  credito:      "Crédito",
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  efectivo:     "💵",
  debito:       "💳",
  mercado_pago: "📱",
  credito:      "🏦",
};
