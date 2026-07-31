"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CreditCard, CheckCircle2,
  Clock, Wallet, Plus, Trash2, TrendingUp, TrendingDown, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getCreditCards, getExpenses, getIncomes, deleteIncome, deleteExpense,
  getBillingPayments, markBillingAsPaid, unmarkBillingAsPaid,
  getCustomCategories, getMonthlyConfigs, getAccounts,
} from "@/lib/supabase";
import { formatCurrency, formatDate, getMonthName, getCategoryMeta, getDueDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { IncomeForm } from "./income-form";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { FinzaLogo } from "@/components/layout/finza-logo";
import type {
  CreditCard as CreditCardType, CreditCardMonthlyConfig, Expense, Income, BillingPayment,
  ExpenseCustomCategory, Account,
} from "@/types";
import { INCOME_SOURCE_ICONS, INCOME_SOURCE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from "@/types";

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

// Paleta tierra/pastel validada (ver skill dataviz) — orden fijo, no cíclico
const DONUT_COLORS = ["#b5502e", "#c9a92e", "#2d7a3a", "#8a4a9e", "#a83d3d"];
const DONUT_OTHER_COLOR = "#9c9a92";
const MOVEMENTS_PAGE_SIZE = 8;

export function DashboardContent() {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"gasto" | "ingreso">("gasto");
  const [summaryCurrency, setSummaryCurrency] = useState<"ARS" | "USD">("ARS");
  const [billingCollapsedOpen, setBillingCollapsedOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [movementsExpanded, setMovementsExpanded] = useState(false);

  const [expenses,        setExpenses]        = useState<Expense[]>([]);
  const [incomes,         setIncomes]         = useState<Income[]>([]);
  const [cards,           setCards]           = useState<CreditCardType[]>([]);
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([]);
  const [customCategories, setCustomCategories] = useState<ExpenseCustomCategory[]>([]);
  const [monthlyConfigs,  setMonthlyConfigs]  = useState<CreditCardMonthlyConfig[]>([]);
  const [accounts,        setAccounts]        = useState<Account[]>([]);
  const [loading,         setLoading]         = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [e, i, c, bp, cats, mc, acc] = await Promise.all([
      getExpenses(), getIncomes(), getCreditCards(), getBillingPayments(),
      getCustomCategories(), getMonthlyConfigs(), getAccounts(),
    ]);
    setExpenses(e);
    setIncomes(i);
    setCards(c);
    setBillingPayments(bp);
    setCustomCategories(cats);
    setMonthlyConfigs(mc);
    setAccounts(acc);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setMovementsExpanded(false); }, [viewMonth, viewYear, categoryFilter]);

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

  // ── Gastos / ingresos del mes ────────────────────────────────────────────────
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date + "T00:00:00");
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });
  const monthIncomes = incomes.filter(i => {
    const d = new Date(i.date + "T00:00:00");
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  const totalExpARS = monthExpenses.filter(e => e.currency === "ARS").reduce((s, e) => s + e.amount, 0);
  const totalExpUSD = monthExpenses.filter(e => e.currency === "USD").reduce((s, e) => s + e.amount, 0);
  const hasUSD = totalExpUSD > 0 || monthIncomes.some(i => i.currency === "USD");

  const activeCurrency = hasUSD ? summaryCurrency : "ARS";
  const totalExp = activeCurrency === "ARS" ? totalExpARS : totalExpUSD;

  // ── Categorías (solo moneda activa, top 4 + Otras) ──────────────────────────
  const categoryTotals = getCategoryTotals(monthExpenses.filter(e => e.currency === activeCurrency));
  const donutData = topCategoriesWithOther(categoryTotals, customCategories, 5);

  // Monto protagonista: si hay filtro de categoría activo, mostrar solo esa categoría
  const filteredCategoryMeta = categoryFilter ? getCategoryMeta(categoryFilter, customCategories) : null;
  const heroTotal = categoryFilter
    ? monthExpenses.filter(e => e.currency === activeCurrency && e.category === categoryFilter).reduce((s, e) => s + e.amount, 0)
    : totalExp;

  // ── TC ──────────────────────────────────────────────────────────────────────
  const billingSummaries = buildBillingSummaries(expenses, cards, billingPayments);
  const relevantBillings = billingSummaries.filter(
    s => s.billingMonth === viewMonth && s.billingYear === viewYear
  );
  const allEntries = relevantBillings.flatMap(s => s.cards.map(entry => ({ entry, summary: s })));
  const pendingEntries = allEntries.filter(x => !x.entry.isPaid);
  const paidEntries    = allEntries.filter(x => x.entry.isPaid);

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

  const toggleCardExpanded = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Movimientos unificados (gastos + ingresos), orden cronológico desc ──────
  type Movement =
    | { kind: "expense"; id: string; date: string; data: Expense }
    | { kind: "income";  id: string; date: string; data: Income };

  const allMovements: Movement[] = [
    ...monthExpenses.map(e => ({ kind: "expense" as const, id: e.id, date: e.date, data: e })),
    ...monthIncomes.map(i => ({ kind: "income" as const, id: i.id, date: i.date, data: i })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const movements = categoryFilter === null
    ? allMovements
    : allMovements.filter(m => m.kind === "expense" && m.data.category === categoryFilter);
  const visibleMovements = movementsExpanded ? movements.length : MOVEMENTS_PAGE_SIZE;

  const handleDeleteIncome = async (id: string) => {
    await deleteIncome(id);
    toast({ title: "Ingreso eliminado" });
    load();
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
    toast({ title: "Gasto eliminado" });
    load();
  };

  // Fecha inicial para los forms (primer día del mes visible)
  const defaultDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;

  if (loading) return null;

  return (
    <div className="space-y-5">

      {/* ── Header: logo + botón agregar ── */}
      <div className="flex items-center justify-between">
        <FinzaLogo size="md" />
        <Button
          size="icon"
          className="h-11 w-11 rounded-full bg-[#2d5016] hover:bg-[#3a6b1d] border-0"
          onClick={() => setMovementOpen(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Selector de mes ── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold text-base tracking-tight">{getMonthName(viewMonth)} {viewYear}</p>
          {isCurrentMonth && (
            <span className="text-[10px] text-primary font-medium">Mes actual</span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Dashboard resumen ── */}
      <SummaryCard
        total={heroTotal}
        label={filteredCategoryMeta ? `Gastado en ${filteredCategoryMeta.label}` : "Gastado en el mes"}
        currency={activeCurrency}
        hasUSD={hasUSD}
        onCurrencyChange={setSummaryCurrency}
        donutData={donutData}
        categoryFilter={categoryFilter}
        onSelectCategory={cat => setCategoryFilter(prev => prev === cat ? null : cat)}
      />

      {/* ── Resúmenes TC ── */}
      {allEntries.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Resúmenes TC
          </p>

          {pendingEntries.length > 0 ? (
            <>
              {pendingEntries.map(({ entry, summary }) => {
                const key = `${entry.card.id}-${summary.billingYear}-${summary.billingMonth}`;
                return (
                  <BillingCard
                    key={key}
                    entry={entry}
                    summary={summary}
                    monthlyConfigs={monthlyConfigs}
                    customCategories={customCategories}
                    expanded={expandedCards.has(key)}
                    onToggleExpanded={() => toggleCardExpanded(key)}
                    onTogglePaid={() => handleTogglePaid(entry, summary)}
                  />
                );
              })}
              {paidEntries.map(({ entry, summary }) => {
                const key = `${entry.card.id}-${summary.billingYear}-${summary.billingMonth}`;
                return (
                  <BillingCard
                    key={key}
                    entry={entry}
                    summary={summary}
                    monthlyConfigs={monthlyConfigs}
                    customCategories={customCategories}
                    expanded={expandedCards.has(key)}
                    onToggleExpanded={() => toggleCardExpanded(key)}
                    onTogglePaid={() => handleTogglePaid(entry, summary)}
                  />
                );
              })}
            </>
          ) : (
            <Card className="border-emerald-500/20">
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between"
                onClick={() => setBillingCollapsedOpen(o => !o)}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Todos los resúmenes están pagados
                </span>
                {billingCollapsedOpen
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {billingCollapsedOpen && (
                <CardContent className="pt-0 space-y-2.5">
                  {allEntries.map(({ entry, summary }) => {
                    const key = `${entry.card.id}-${summary.billingYear}-${summary.billingMonth}`;
                    return (
                      <BillingCard
                        key={key}
                        entry={entry}
                        summary={summary}
                        monthlyConfigs={monthlyConfigs}
                        customCategories={customCategories}
                        expanded={expandedCards.has(key)}
                        onToggleExpanded={() => toggleCardExpanded(key)}
                        onTogglePaid={() => handleTogglePaid(entry, summary)}
                      />
                    );
                  })}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── Movimientos ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Movimientos
          </p>
          {customCategories.length > 0 && (
            <Select value={categoryFilter ?? "all"} onValueChange={v => setCategoryFilter(v === "all" ? null : v)}>
              <SelectTrigger className="h-7 w-auto gap-1.5 text-xs border-0 bg-muted px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Todas las categorías</SelectItem>
                {customCategories.map(cat => (
                  <SelectItem key={cat.id} value={`custom_${cat.id}`}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {movements.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {categoryFilter === null ? `Sin movimientos en ${getMonthName(viewMonth)}` : "Sin movimientos en esta categoría"}
            </p>
          </div>
        ) : (
          <Card className="rounded-2xl border-border/50 shadow-none">
            <CardContent className="p-0">
              {movements.slice(0, visibleMovements).map((m, i) => (
                <div key={`${m.kind}-${m.id}`}>
                  {m.kind === "expense"
                    ? <ExpenseRow expense={m.data} cards={cards} customCategories={customCategories} onDelete={handleDeleteExpense} />
                    : <IncomeRow income={m.data} onDelete={handleDeleteIncome} />}
                  {i < Math.min(movements.length, visibleMovements) - 1 && <Separator />}
                </div>
              ))}
              {movements.length > visibleMovements ? (
                <button
                  className="w-full text-xs text-center text-primary font-medium py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => setMovementsExpanded(true)}
                >
                  Ver {movements.length - visibleMovements} más
                </button>
              ) : movementsExpanded && movements.length > MOVEMENTS_PAGE_SIZE && (
                <button
                  className="w-full text-xs text-center text-muted-foreground font-medium py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => setMovementsExpanded(false)}
                >
                  Ver menos
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Dialog nuevo movimiento (gasto o ingreso) ── */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>

          <div className="flex rounded-lg bg-muted p-1 gap-1 mb-1">
            <button
              onClick={() => setMovementType("gasto")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                movementType === "gasto" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gasto
            </button>
            <button
              onClick={() => setMovementType("ingreso")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                movementType === "ingreso" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ingreso
            </button>
          </div>

          {movementType === "gasto" ? (
            <ExpenseForm
              cards={cards}
              monthlyConfigs={monthlyConfigs}
              accounts={accounts}
              customCategories={customCategories}
              onSaved={() => { setMovementOpen(false); load(); toast({ title: "✅ Gasto guardado" }); }}
            />
          ) : (
            <IncomeForm
              defaultDate={defaultDate}
              onSaved={() => { setMovementOpen(false); load(); toast({ title: "✅ Ingreso registrado" }); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  total, label, currency, hasUSD, onCurrencyChange, donutData, categoryFilter, onSelectCategory,
}: {
  total: number;
  label: string;
  currency: "ARS" | "USD";
  hasUSD: boolean;
  onCurrencyChange: (c: "ARS" | "USD") => void;
  donutData: { label: string; icon: string; value: number; percent: number; color: string; rawCategory: string | null }[];
  categoryFilter: string | null;
  onSelectCategory: (cat: string) => void;
}) {
  const hasData = donutData.length > 0;

  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </p>
          {hasUSD && (
            <div className="flex rounded-full bg-muted p-0.5 gap-0.5">
              {(["ARS", "USD"] as const).map(c => (
                <button
                  key={c}
                  onClick={() => onCurrencyChange(c)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    currency === c ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Monto grande protagonista */}
        <p className="text-[2.25rem] leading-tight font-bold tracking-tight mb-4" style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" }}>
          {formatCurrency(total, currency)}
        </p>

        {hasData ? (
          <ExpenseDonutChart data={donutData} categoryFilter={categoryFilter} onSelectCategory={onSelectCategory} />
        ) : (
          <p className="text-xs text-muted-foreground py-2">Sin gastos categorizados este mes</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ExpenseDonutChart ────────────────────────────────────────────────────────
// Mismo estilo/lógica que el donut de Portafolio (inversiones): track + slices
// con gap, hover que resalta el slice y muestra su detalle en el centro,
// leyenda con barra proporcional debajo. Clickear un slice/leyenda filtra
// el resto de Inicio (hero + movimientos) por esa categoría.

function ExpenseDonutChart({
  data, categoryFilter, onSelectCategory,
}: {
  data: { label: string; icon: string; value: number; percent: number; color: string; rawCategory: string | null }[];
  categoryFilter: string | null;
  onSelectCategory: (cat: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const SIZE    = 132;
  const STROKE  = 18;
  const R       = (SIZE - STROKE) / 2;
  const CIRCUMF = 2 * Math.PI * R;
  const GAP     = CIRCUMF * 0.012;

  let cumulativePct = 0;
  const selectedLabel = categoryFilter
    ? data.find(d => d.rawCategory === categoryFilter)?.label ?? null
    : null;
  const activeSlice = hovered
    ? data.find(d => d.label === hovered)
    : selectedLabel ? data.find(d => d.label === selectedLabel) : null;

  return (
    <div className="flex items-center gap-3">
      {/* Donut — ocupa más espacio que la leyenda */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={STROKE}
          />
          {data.map(slice => {
            const dash   = (slice.percent / 100) * CIRCUMF - GAP;
            const offset = -(cumulativePct / 100) * CIRCUMF;
            cumulativePct += slice.percent;
            const isHovered  = hovered === slice.label;
            const isSelected = selectedLabel === slice.label;
            const dimmed = selectedLabel !== null && !isSelected && !isHovered;
            return (
              <circle
                key={slice.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered || isSelected ? STROKE + 3 : STROKE}
                strokeOpacity={dimmed ? 0.35 : 1}
                strokeDasharray={`${Math.max(0, dash)} ${CIRCUMF}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                style={{ transition: "stroke-width 0.15s ease, stroke-opacity 0.15s ease" }}
                className={slice.rawCategory ? "cursor-pointer" : ""}
                onMouseEnter={() => setHovered(slice.label)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => slice.rawCategory && onSelectCategory(slice.rawCategory)}
                onTouchStart={() => setHovered(h => h === slice.label ? null : slice.label)}
              />
            );
          })}
        </svg>

        {/* Centro — solo al hacer hover/seleccionar, muestra la categoría activa */}
        {activeSlice && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-sm">{activeSlice.icon}</span>
            <span className="text-[10px] font-bold" style={{ color: activeSlice.color }}>
              {activeSlice.percent.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="w-36 shrink-0 space-y-1.5 ml-auto">
        {data.map(slice => {
          const isHovered  = hovered === slice.label;
          const isSelected = selectedLabel === slice.label;
          return (
            <button
              key={slice.label}
              disabled={!slice.rawCategory}
              className={`w-full flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 transition-colors text-left ${
                isSelected ? "bg-muted" : isHovered ? "bg-muted/60" : "hover:bg-muted/30"
              } ${!slice.rawCategory ? "cursor-default" : ""}`}
              onMouseEnter={() => setHovered(slice.label)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => slice.rawCategory && onSelectCategory(slice.rawCategory)}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-xs truncate">{slice.icon} {slice.label}</span>
              <span className="text-xs text-muted-foreground shrink-0">{slice.percent.toFixed(0)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ExpenseRow / IncomeRow ───────────────────────────────────────────────────

function ExpenseRow({
  expense, cards, customCategories, onDelete,
}: {
  expense: Expense;
  cards: CreditCardType[];
  customCategories: ExpenseCustomCategory[];
  onDelete: (id: string) => void;
}) {
  const card = cards.find(c => c.id === expense.credit_card_id);
  const { icon, label, bg, text } = getCategoryMeta(expense.category, customCategories);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-base ${bg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{expense.description}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className={`text-[10px] font-medium ${text}`}>{label}</span>
          <span className="text-[10px] text-muted-foreground">
            · {formatDate(expense.date)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {PAYMENT_METHOD_ICONS[expense.payment_method]} {PAYMENT_METHOD_LABELS[expense.payment_method]}
          </span>
          {expense.total_installments > 1 && (
            <span className="text-[10px] text-muted-foreground">
              · {expense.installment_number}/{expense.total_installments}
            </span>
          )}
          {card && <span className="text-[10px] text-muted-foreground">· {card.name}</span>}
        </div>
      </div>
      <span className={`text-sm font-semibold shrink-0 ${expense.currency === "USD" ? "text-emerald-500" : ""}`}>
        −{formatCurrency(expense.amount, expense.currency)}
      </span>
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
        onClick={() => onDelete(expense.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function IncomeRow({
  income, onDelete,
}: {
  income: Income;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-base bg-emerald-500/15">
        {INCOME_SOURCE_ICONS[income.source]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{income.description}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className="text-[10px] text-muted-foreground">{INCOME_SOURCE_LABELS[income.source]}</span>
          <span className="text-[10px] text-muted-foreground">· {formatDate(income.date)}</span>
        </div>
      </div>
      <span className="text-sm font-semibold shrink-0 text-emerald-500">
        +{formatCurrency(income.amount, income.currency)}
      </span>
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
        onClick={() => onDelete(income.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── BillingCard ──────────────────────────────────────────────────────────────

function BillingCard({
  entry, summary, monthlyConfigs, customCategories, expanded, onToggleExpanded, onTogglePaid,
}: {
  entry: CardBillingEntry;
  summary: PeriodSummary;
  monthlyConfigs: CreditCardMonthlyConfig[];
  customCategories: ExpenseCustomCategory[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onTogglePaid: () => void;
}) {
  const dueDate = getDueDate(summary.billingMonth, summary.billingYear, entry.card, monthlyConfigs);
  const days    = Math.round((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = !entry.isPaid && days < 0;
  const isDueSoon = !entry.isPaid && days >= 0 && days <= 5;

  return (
    <Card className={`rounded-2xl shadow-none ${
      entry.isPaid ? "opacity-60 border-border/40" : isOverdue ? "border-destructive/40" : isDueSoon ? "border-amber-500/40" : "border-primary/25"
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <CreditCard className={`h-4 w-4 ${entry.isPaid ? "text-muted-foreground" : "text-primary"}`} />
              <span className="text-sm font-semibold">{entry.card.name}</span>
              {entry.isPaid ? (
                <Badge variant="success" className="text-[10px] h-4 px-1.5 gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Pagado
                </Badge>
              ) : isOverdue ? (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                  Vencido hace {Math.abs(days)}d
                </Badge>
              ) : isDueSoon ? (
                <Badge variant="warning" className="text-[10px] h-4 px-1.5 gap-1">
                  <Clock className="h-2.5 w-2.5" /> Vence en {days}d
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  Vence {dueDate.getDate()} de {getMonthName(dueDate.getMonth())}
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              {entry.totalARS > 0 && <span className="text-lg font-bold">{formatCurrency(entry.totalARS, "ARS")}</span>}
              {entry.totalUSD > 0 && <span className="text-sm font-semibold text-emerald-500">{formatCurrency(entry.totalUSD, "USD")}</span>}
              <span className="text-xs text-muted-foreground">
                · {entry.expenses.length} compra{entry.expenses.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant={entry.isPaid ? "outline" : "default"}
            className={`shrink-0 h-8 text-xs ${!entry.isPaid ? "bg-[#2d5016] hover:bg-[#3a6b1d] border-0" : ""}`}
            onClick={onTogglePaid}
          >
            {entry.isPaid ? "Desmarcar" : "✓ Pagar"}
          </Button>
        </div>

        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Ocultar gastos" : "Ver gastos"}
        </button>

        {expanded && (
          <div className="mt-2 -mx-4 divide-y divide-border/40 border-t border-border/40">
            {entry.expenses.map(expense => {
              const meta = getCategoryMeta(expense.category, customCategories);
              return (
                <div key={expense.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{expense.description}</p>
                    <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                  </div>
                  <span className="text-xs font-semibold shrink-0">
                    {formatCurrency(expense.amount, expense.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
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

function topCategoriesWithOther(
  totals: { category: string; total: number; percent: number }[],
  customCategories: ExpenseCustomCategory[],
  max = 4
) {
  const top = totals.slice(0, max);
  const rest = totals.slice(max);
  const result = top.map((t, i) => {
    const meta = getCategoryMeta(t.category, customCategories);
    return { label: meta.label, icon: meta.icon, value: t.total, percent: t.percent, color: DONUT_COLORS[i], rawCategory: t.category as string | null };
  });
  if (rest.length > 0) {
    const restTotal = rest.reduce((s, t) => s + t.total, 0);
    const restPercent = rest.reduce((s, t) => s + t.percent, 0);
    result.push({ label: "Otras", icon: "•", value: restTotal, percent: restPercent, color: DONUT_OTHER_COLOR, rawCategory: null });
  }
  return result;
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
