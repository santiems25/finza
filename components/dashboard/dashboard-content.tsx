"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, CreditCard, CheckCircle2,
  Clock, Wallet, TrendingDown, TrendingUp, RotateCcw,
  DollarSign, Plus, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getCreditCards, getExpenses, getIncomes, deleteIncome,
  getBillingPayments, markBillingAsPaid, unmarkBillingAsPaid,
} from "@/lib/supabase";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { IncomeForm } from "./income-form";
import type {
  CreditCard as CreditCardType, Expense, Income, BillingPayment, ExpenseCategory,
} from "@/types";
import {
  CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS,
  INCOME_SOURCE_ICONS, INCOME_SOURCE_LABELS,
} from "@/types";

interface CardBillingEntry {
  card: CreditCardType;
  totalARS: number;
  totalUSD: number;
  isPaid: boolean;
  expenses: Expense[];
}
interface PeriodSummary {
  periodLabel: string;
  billingMonth: number;
  billingYear: number;
  cards: CardBillingEntry[];
}

export function DashboardContent() {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);

  const [expenses,        setExpenses]        = useState<Expense[]>([]);
  const [incomes,         setIncomes]         = useState<Income[]>([]);
  const [cards,           setCards]           = useState<CreditCardType[]>([]);
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([]);
  const [loading,         setLoading]         = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [e, i, c, bp] = await Promise.all([
      getExpenses(), getIncomes(), getCreditCards(), getBillingPayments(),
    ]);
    setExpenses(e);
    setIncomes(i);
    setCards(c);
    setBillingPayments(bp);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Navegación mes ──────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  // ── Gastos del mes ──────────────────────────────────────────────────────────
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date + "T00:00:00");
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });
  const filtered = selectedCategory
    ? monthExpenses.filter(e => e.category === selectedCategory)
    : monthExpenses;

  const totalExpARS = monthExpenses.filter(e => e.currency === "ARS").reduce((s, e) => s + e.amount, 0);
  const totalExpUSD = monthExpenses.filter(e => e.currency === "USD").reduce((s, e) => s + e.amount, 0);

  // ── Ingresos del mes ────────────────────────────────────────────────────────
  const monthIncomes = incomes.filter(i => {
    const d = new Date(i.date + "T00:00:00");
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });
  const totalIncARS = monthIncomes.filter(i => i.currency === "ARS").reduce((s, i) => s + i.amount, 0);
  const totalIncUSD = monthIncomes.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0);

  // ── Balance ─────────────────────────────────────────────────────────────────
  const balanceARS = totalIncARS - totalExpARS;
  const balanceUSD = totalIncUSD - totalExpUSD;
  const hasUSD     = totalExpUSD > 0 || totalIncUSD > 0;

  // ── Categorías ──────────────────────────────────────────────────────────────
  const categoryTotalsARS = getCategoryTotals(filtered.filter(e => e.currency === "ARS"));
  const categoryTotalsUSD = getCategoryTotals(filtered.filter(e => e.currency === "USD"));

  // ── TC ──────────────────────────────────────────────────────────────────────
  const billingSummaries = buildBillingSummaries(expenses, cards, billingPayments);
  const relevantBillings = billingSummaries.filter(
    s => s.billingMonth === viewMonth && s.billingYear === viewYear
  );

  const handleTogglePaid = async (entry: CardBillingEntry, summary: PeriodSummary) => {
    try {
      if (entry.isPaid) {
        await unmarkBillingAsPaid(entry.card.id, summary.billingMonth, summary.billingYear);
        toast({ title: `${entry.card.name} marcado como pendiente` });
      } else {
        await markBillingAsPaid(entry.card.id, summary.billingMonth, summary.billingYear);
        toast({ title: `✅ Resumen ${entry.card.name} pagado` });
      }
      await load();
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  };

  const handleDeleteIncome = async (id: string) => {
    await deleteIncome(id);
    toast({ title: "Ingreso eliminado" });
    load();
  };

  // Fecha inicial para el form de ingreso (primer día del mes visible)
  const defaultIncomeDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;

  if (loading) return null;

  return (
    <div className="space-y-4">

      {/* ── Selector de mes ── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold text-base">{getMonthName(viewMonth)} {viewYear}</p>
          {isCurrentMonth && (
            <span className="text-[10px] text-primary font-medium">Mes actual</span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Balance del mes — ARS ── */}
      <BalanceCard
        currency="ARS"
        income={totalIncARS}
        expenses={totalExpARS}
        balance={balanceARS}
        onAddIncome={() => setIncomeOpen(true)}
      />

      {/* ── Balance del mes — USD (solo si hay movimiento) ── */}
      {hasUSD && (
        <BalanceCard
          currency="USD"
          income={totalIncUSD}
          expenses={totalExpUSD}
          balance={balanceUSD}
          onAddIncome={() => setIncomeOpen(true)}
        />
      )}

      {/* ── Ingresos del mes ── */}
      {monthIncomes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Ingresos</CardTitle>
              <Button
                variant="ghost" size="sm"
                className="h-6 text-xs gap-1 text-primary"
                onClick={() => setIncomeOpen(true)}
              >
                <Plus className="h-3 w-3" /> Agregar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {monthIncomes.map((inc, i) => (
              <div key={inc.id}>
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className="text-lg shrink-0">{INCOME_SOURCE_ICONS[inc.source]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inc.description}</p>
                    <p className="text-xs text-muted-foreground">{INCOME_SOURCE_LABELS[inc.source]}</p>
                  </div>
                  <span className={`text-sm font-semibold ${inc.currency === "USD" ? "text-emerald-400" : "text-green-400"}`}>
                    +{formatCurrency(inc.amount, inc.currency)}
                  </span>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDeleteIncome(inc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {i < monthIncomes.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Breakdown categorías ARS ── */}
      {categoryTotalsARS.length > 0 && (
        <CategoryBreakdown
          title="Gastos por categoría — ARS"
          totals={categoryTotalsARS}
          currency="ARS"
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />
      )}

      {/* ── Breakdown categorías USD ── */}
      {categoryTotalsUSD.length > 0 && (
        <CategoryBreakdown
          title="Gastos por categoría — USD"
          totals={categoryTotalsUSD}
          currency="USD"
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />
      )}

      {/* ── Resúmenes TC ── */}
      {relevantBillings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Resúmenes TC — {getMonthName(viewMonth)}
          </p>
          {relevantBillings.map(summary =>
            summary.cards.map(entry => (
              <BillingCard
                key={`${entry.card.id}-${summary.billingMonth}-${summary.billingYear}`}
                entry={entry}
                summary={summary}
                onTogglePaid={() => handleTogglePaid(entry, summary)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Últimos gastos ── */}
      {filtered.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {selectedCategory
                  ? `${CATEGORY_ICONS[selectedCategory as ExpenseCategory] ?? "📦"} ${CATEGORY_LABELS[selectedCategory as ExpenseCategory] ?? selectedCategory}`
                  : "Últimos gastos"}
              </CardTitle>
              {selectedCategory && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground"
                  onClick={() => setSelectedCategory(null)}
                >
                  <RotateCcw className="h-3 w-3" /> Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.slice(0, 8).map((expense, i) => {
              const card     = cards.find(c => c.id === expense.credit_card_id);
              const colors   = CATEGORY_COLORS[expense.category as ExpenseCategory];
              const catIcon  = CATEGORY_ICONS[expense.category as ExpenseCategory] ?? "📦";
              const catLabel = CATEGORY_LABELS[expense.category as ExpenseCategory] ?? expense.category;
              const catBg    = colors?.bg   ?? "bg-slate-500/15";
              const catText  = colors?.text ?? "text-slate-400";
              return (
                <div key={expense.id}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className="text-lg leading-none shrink-0">{catIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{expense.description}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catBg} ${catText}`}>
                          {catLabel}
                        </span>
                        {expense.total_installments > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            {expense.installment_number}/{expense.total_installments}
                          </span>
                        )}
                        {card && <span className="text-[10px] text-muted-foreground">{card.name}</span>}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${expense.currency === "USD" ? "text-emerald-400" : ""}`}>
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </div>
                  {i < Math.min(filtered.length, 8) - 1 && <Separator />}
                </div>
              );
            })}
            {filtered.length > 8 && (
              <p className="text-xs text-center text-muted-foreground py-3">
                +{filtered.length - 8} más en Gastos
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        !relevantBillings.length && monthIncomes.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Sin movimientos en {getMonthName(viewMonth)}</p>
          </div>
        )
      )}

      {/* ── Dialog ingreso ── */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Registrar ingreso</DialogTitle>
          </DialogHeader>
          <IncomeForm
            defaultDate={defaultIncomeDate}
            onSaved={() => { setIncomeOpen(false); load(); toast({ title: "✅ Ingreso registrado" }); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── BalanceCard ──────────────────────────────────────────────────────────────

function BalanceCard({
  currency, income, expenses, balance, onAddIncome,
}: {
  currency: "ARS" | "USD";
  income: number;
  expenses: number;
  balance: number;
  onAddIncome: () => void;
}) {
  const isPositive = balance >= 0;
  const hasIncome  = income > 0;

  return (
    <Card className={balance < 0 ? "border-destructive/30" : isPositive && hasIncome ? "border-emerald-500/20" : ""}>
      <CardContent className="p-4">
        {/* Label moneda */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {currency === "ARS" ? "Pesos (ARS)" : "Dólares (USD)"}
          </p>
          {currency === "ARS" && (
            <Button
              variant="ghost" size="sm"
              className="h-6 text-xs gap-1 text-primary -mr-1"
              onClick={onAddIncome}
            >
              <Plus className="h-3 w-3" /> Ingreso
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Ingreso */}
          <div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3" /> Ingreso
            </p>
            {hasIncome ? (
              <p className="text-base font-bold text-green-400">
                {formatCurrency(income, currency)}
              </p>
            ) : (
              <button
                onClick={onAddIncome}
                className="text-xs text-muted-foreground/60 hover:text-primary transition-colors text-left"
              >
                + Agregar
              </button>
            )}
          </div>

          {/* Gastos */}
          <div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
              <TrendingDown className="h-3 w-3" /> Gastos
            </p>
            <p className="text-base font-bold">{formatCurrency(expenses, currency)}</p>
          </div>

          {/* Saldo */}
          <div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
              <Wallet className="h-3 w-3" /> Saldo
            </p>
            {hasIncome ? (
              <p className={`text-base font-bold ${isPositive ? "text-green-400" : "text-destructive"}`}>
                {isPositive ? "+" : ""}{formatCurrency(balance, currency)}
              </p>
            ) : (
              <p className="text-base font-bold text-muted-foreground/40">—</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CategoryBreakdown ────────────────────────────────────────────────────────

function CategoryBreakdown({
  title, totals, currency, selectedCategory, onSelect,
}: {
  title: string;
  totals: { category: string; total: number; percent: number }[];
  currency: "ARS" | "USD";
  selectedCategory: string | null;
  onSelect: (cat: string | null) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2.5">
        {totals.map(({ category, total, percent }) => {
          const colors = CATEGORY_COLORS[category as ExpenseCategory];
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onSelect(active ? null : category)}
              className={`w-full text-left transition-opacity ${
                selectedCategory && !active ? "opacity-40" : "opacity-100"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{CATEGORY_ICONS[category as ExpenseCategory] ?? "📦"}</span>
                  <span className="text-xs font-medium">{CATEGORY_LABELS[category as ExpenseCategory] ?? category}</span>
                  {active && <Badge variant="outline" className="text-[10px] h-4 px-1">filtro</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{percent.toFixed(0)}%</span>
                  <span className={`text-xs font-semibold ${currency === "USD" ? "text-emerald-400" : ""}`}>
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${colors?.bar ?? "bg-slate-500"}`} style={{ width: `${percent}%` }} />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── BillingCard ──────────────────────────────────────────────────────────────

function BillingCard({
  entry, summary, onTogglePaid,
}: {
  entry: CardBillingEntry;
  summary: PeriodSummary;
  onTogglePaid: () => void;
}) {
  return (
    <Card className={entry.isPaid ? "opacity-60" : "border-primary/30"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <CreditCard className={`h-4 w-4 ${entry.isPaid ? "text-muted-foreground" : "text-primary"}`} />
              <span className="text-sm font-semibold">{entry.card.name}</span>
              {entry.isPaid ? (
                <Badge variant="success" className="text-[10px] h-4 px-1.5 gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Pagado
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px] h-4 px-1.5 gap-1">
                  <Clock className="h-2.5 w-2.5" /> Pendiente
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              {entry.totalARS > 0 && <span className="text-lg font-bold">{formatCurrency(entry.totalARS, "ARS")}</span>}
              {entry.totalUSD > 0 && <span className="text-sm font-semibold text-emerald-400">{formatCurrency(entry.totalUSD, "USD")}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vence el {entry.card.due_day} de {getMonthName(summary.billingMonth)} · {entry.expenses.length} compra{entry.expenses.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant={entry.isPaid ? "outline" : "default"}
            className="shrink-0 h-8 text-xs"
            onClick={onTogglePaid}
          >
            {entry.isPaid ? "Desmarcar" : "✓ Pagado"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryTotals(expenses: Expense[]) {
  const map   = new Map<string, number>();
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return Array.from(map.entries())
    .map(([category, t]) => ({ category, total: t, percent: total > 0 ? (t / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}

function buildBillingSummaries(
  expenses: Expense[], cards: CreditCardType[], payments: BillingPayment[]
): PeriodSummary[] {
  const map = new Map<string, PeriodSummary>();
  for (const e of expenses) {
    if (e.payment_method !== "credito" || e.billing_month == null || e.billing_year == null || !e.billing_period) continue;
    const key = `${e.billing_year}-${e.billing_month}`;
    if (!map.has(key)) map.set(key, { periodLabel: e.billing_period, billingMonth: e.billing_month, billingYear: e.billing_year, cards: [] });
    const summary = map.get(key)!;
    const card    = cards.find(c => c.id === e.credit_card_id);
    if (!card) continue;
    let entry = summary.cards.find(ce => ce.card.id === card.id);
    if (!entry) {
      const isPaid = payments.some(p => p.credit_card_id === card.id && p.billing_month === e.billing_month && p.billing_year === e.billing_year);
      entry = { card, totalARS: 0, totalUSD: 0, isPaid, expenses: [] };
      summary.cards.push(entry);
    }
    if (e.currency === "ARS") entry.totalARS += e.amount;
    if (e.currency === "USD") entry.totalUSD += e.amount;
    entry.expenses.push(e);
  }
  return Array.from(map.values()).sort((a, b) => a.billingYear !== b.billingYear ? a.billingYear - b.billingYear : a.billingMonth - b.billingMonth);
}
