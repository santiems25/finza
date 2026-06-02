import { createClient } from "@supabase/supabase-js";
import type { CreditCard, Expense, Investment } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Credit Cards ────────────────────────────────────────────────────────────

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

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpenses(filters?: {
  from?: string;
  to?: string;
  category?: string;
  payment_method?: string;
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

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
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
  const { data, error } = await supabase.from("investments").insert(investment).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInvestment(id: string) {
  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) throw error;
}
