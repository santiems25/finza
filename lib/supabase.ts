import { createBrowserClient } from "@supabase/ssr";
import type {
  CreditCard, CreditCardMonthlyConfig, Expense,
  Income, Investment, Dividend, BillingPayment,
  SavingsConfig, FxTransaction,
} from "@/types";

// Cliente browser — usa cookies para que el middleware pueda leer la sesión
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ─── Credit Cards ─────────────────────────────────────────────────────────────

export async function getCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .order("card_type");
  if (error) throw error;
  return data ?? [];
}

export async function upsertCreditCard(card: Partial<CreditCard> & { id?: string }) {
  const { data, error } = await supabase
    .from("credit_cards")
    .upsert(card)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Monthly Card Config ──────────────────────────────────────────────────────

export async function getMonthlyConfigs(): Promise<CreditCardMonthlyConfig[]> {
  const { data, error } = await supabase
    .from("credit_card_monthly_config")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertMonthlyConfig(
  config: Omit<CreditCardMonthlyConfig, "id" | "created_at">
): Promise<CreditCardMonthlyConfig> {
  const { data, error } = await supabase
    .from("credit_card_monthly_config")
    .upsert(config, { onConflict: "credit_card_id,month,year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMonthlyConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from("credit_card_monthly_config")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpenses(filters?: {
  from?: string; to?: string; category?: string; payment_method?: string;
}): Promise<Expense[]> {
  let query = supabase.from("expenses").select("*").order("date", { ascending: false });
  if (filters?.from) query = query.gte("date", filters.from);
  if (filters?.to) query = query.lte("date", filters.to);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.payment_method) query = query.eq("payment_method", filters.payment_method);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function addExpense(expense: Omit<Expense, "id" | "created_at">) {
  const { data, error } = await supabase.from("expenses").insert(expense).select().single();
  if (error) throw error;
  return data;
}

export async function addExpenses(expenses: Omit<Expense, "id" | "created_at">[]) {
  const { data, error } = await supabase.from("expenses").insert(expenses).select();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ─── Billing Payments ─────────────────────────────────────────────────────────

export async function getBillingPayments(): Promise<BillingPayment[]> {
  const { data, error } = await supabase.from("billing_payments").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function markBillingAsPaid(
  creditCardId: string, billingMonth: number, billingYear: number
): Promise<void> {
  const { error } = await supabase.from("billing_payments").upsert({
    credit_card_id: creditCardId, billing_month: billingMonth, billing_year: billingYear,
  });
  if (error) throw error;
}

export async function unmarkBillingAsPaid(
  creditCardId: string, billingMonth: number, billingYear: number
): Promise<void> {
  const { error } = await supabase
    .from("billing_payments")
    .delete()
    .eq("credit_card_id", creditCardId)
    .eq("billing_month", billingMonth)
    .eq("billing_year", billingYear);
  if (error) throw error;
}

// ─── Incomes ──────────────────────────────────────────────────────────────────

export async function getIncomes(): Promise<Income[]> {
  const { data, error } = await supabase
    .from("incomes")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addIncome(income: Omit<Income, "id" | "created_at">) {
  const { data, error } = await supabase.from("incomes").insert(income).select().single();
  if (error) throw error;
  return data;
}

export async function deleteIncome(id: string) {
  const { error } = await supabase.from("incomes").delete().eq("id", id);
  if (error) throw error;
}

// ─── Savings Config ───────────────────────────────────────────────────────────

export async function getSavingsConfig(): Promise<SavingsConfig | null> {
  const { data, error } = await supabase
    .from("savings_config")
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function updateSavingsConfig(
  id: string,
  values: { initial_ars: number; initial_usd: number }
): Promise<void> {
  const { error } = await supabase
    .from("savings_config")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ─── FX Transactions ──────────────────────────────────────────────────────────

export async function getFxTransactions(): Promise<FxTransaction[]> {
  const { data, error } = await supabase
    .from("fx_transactions")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addFxTransaction(
  tx: Omit<FxTransaction, "id" | "created_at">
): Promise<void> {
  const { error } = await supabase.from("fx_transactions").insert(tx);
  if (error) throw error;
}

export async function deleteFxTransaction(id: string): Promise<void> {
  const { error } = await supabase.from("fx_transactions").delete().eq("id", id);
  if (error) throw error;
}

// ─── Dividends ────────────────────────────────────────────────────────────────

export async function getDividends(): Promise<Dividend[]> {
  const { data, error } = await supabase
    .from("dividends")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addDividend(dividend: Omit<Dividend, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("dividends")
    .insert(dividend)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDividend(id: string) {
  const { error } = await supabase.from("dividends").delete().eq("id", id);
  if (error) throw error;
}

// ─── Investments ──────────────────────────────────────────────────────────────

export async function getInvestments(): Promise<Investment[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .order("buy_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addInvestment(investment: Omit<Investment, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("investments")
    .insert(investment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sellInvestment(
  id: string, sell_price: number, sell_date: string
): Promise<void> {
  const { error } = await supabase
    .from("investments")
    .update({ is_sold: true, sell_price, sell_date })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInvestment(id: string) {
  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) throw error;
}
