import type {
  Account, Expense, Income, CreditCard, BillingPayment, FxTransaction, AccountTransfer,
} from "@/types";

const CASH_METHODS = ["efectivo", "debito", "mercado_pago"];

export interface BalanceData {
  expenses: Expense[];
  incomes: Income[];
  cards: CreditCard[];
  billingPayments: BillingPayment[];
  fxTransactions: FxTransaction[];
  transfers: AccountTransfer[];
}

export function isTCPaid(e: Expense, billingPayments: BillingPayment[]): boolean {
  return billingPayments.some(
    p =>
      p.credit_card_id === e.credit_card_id &&
      p.billing_month  === e.billing_month  &&
      p.billing_year   === e.billing_year
  );
}

/**
 * Balance de una cuenta:
 *   inicial + ingresos − gastos cash − TC pagados (tarjeta vinculada)
 *   − compras FX (ARS) + compras FX (USD) ± transferencias
 */
export function accountBalance(account: Account, data: BalanceData): { ars: number; usd: number } {
  const { expenses, incomes, cards, billingPayments, fxTransactions, transfers } = data;

  const linkedCardIds = new Set(
    cards.filter(c => c.account_id === account.id).map(c => c.id)
  );

  const belongsToAccount = (e: Expense) => {
    if (CASH_METHODS.includes(e.payment_method)) return e.account_id === account.id;
    if (e.payment_method === "credito") {
      return !!e.credit_card_id && linkedCardIds.has(e.credit_card_id) && isTCPaid(e, billingPayments);
    }
    return false;
  };

  let ars = account.initial_ars;
  let usd = account.initial_usd;

  for (const i of incomes) {
    if (i.account_id !== account.id) continue;
    if (i.currency === "ARS") ars += i.amount; else usd += i.amount;
  }
  for (const e of expenses) {
    if (!belongsToAccount(e)) continue;
    if (e.currency === "ARS") ars -= e.amount; else usd -= e.amount;
  }
  for (const fx of fxTransactions) {
    if (fx.account_id !== account.id) continue;
    ars -= fx.ars_amount;
    usd += fx.usd_amount;
  }
  for (const t of transfers) {
    if (t.from_account_id === account.id) {
      if (t.currency === "ARS") ars -= t.amount; else usd -= t.amount;
    }
    if (t.to_account_id === account.id) {
      if (t.currency === "ARS") ars += t.amount; else usd += t.amount;
    }
  }

  return { ars, usd };
}

/**
 * Saldo TOTAL = suma de saldos iniciales de las cuentas + TODOS los flujos
 * (incluye movimientos sin cuenta asignada, para no perder datos legacy).
 * Las transferencias entre cuentas no afectan el total.
 */
export function totalBalance(accounts: Account[], data: BalanceData): { ars: number; usd: number } {
  const { expenses, incomes, billingPayments, fxTransactions } = data;

  let ars = accounts.reduce((s, a) => s + a.initial_ars, 0);
  let usd = accounts.reduce((s, a) => s + a.initial_usd, 0);

  for (const i of incomes) {
    if (i.currency === "ARS") ars += i.amount; else usd += i.amount;
  }
  for (const e of expenses) {
    const counts =
      CASH_METHODS.includes(e.payment_method) ||
      (e.payment_method === "credito" && isTCPaid(e, billingPayments));
    if (!counts) continue;
    if (e.currency === "ARS") ars -= e.amount; else usd -= e.amount;
  }
  for (const fx of fxTransactions) {
    ars -= fx.ars_amount;
    usd += fx.usd_amount;
  }

  return { ars, usd };
}

/** Total de TC pendiente de pago (para el aviso de proyección). */
export function pendingTC(expenses: Expense[], billingPayments: BillingPayment[]): { ars: number; usd: number } {
  let ars = 0, usd = 0;
  for (const e of expenses) {
    if (e.payment_method !== "credito" || isTCPaid(e, billingPayments)) continue;
    if (e.currency === "ARS") ars += e.amount; else usd += e.amount;
  }
  return { ars, usd };
}
