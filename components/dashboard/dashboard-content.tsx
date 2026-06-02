"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreditCard, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCreditCards, getExpenses } from "@/lib/supabase";
import { formatCurrency, getMonthName } from "@/lib/utils";
import type { CreditCard as CreditCardType, Expense } from "@/types";

interface BillingSummary {
  periodLabel: string;
  billingMonth: number;
  billingYear: number;
  cards: {
    card: CreditCardType;
    totalARS: number;
    totalUSD: number;
    expenses: Expense[];
  }[];
}

export function DashboardContent() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getExpenses(), getCreditCards()])
      .then(([e, c]) => { setExpenses(e); setCards(c); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Gastos del mes actual (excluyendo crédito)
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlyARS = thisMonthExpenses
    .filter((e) => e.currency === "ARS" && e.payment_method !== "credito")
    .reduce((s, e) => s + e.amount, 0);

  const monthlyUSD = thisMonthExpenses
    .filter((e) => e.currency === "USD" && e.payment_method !== "credito")
    .reduce((s, e) => s + e.amount, 0);

  // Agrupar gastos de crédito por período de billing
  const creditExpenses = expenses.filter((e) => e.payment_method === "credito");
  const billingSummaries = buildBillingSummaries(creditExpenses, cards);

  // Últimos 5 gastos
  const recentExpenses = expenses.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Resumen del mes */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Gastos ARS</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(monthlyARS, "ARS")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {getMonthName(currentMonth)} {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Gastos USD</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(monthlyUSD, "USD")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {getMonthName(currentMonth)} {currentYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resúmenes de tarjetas de crédito */}
      {billingSummaries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Resúmenes de Tarjetas
          </h2>
          {billingSummaries.map((summary) => (
            <BillingPeriodCard key={`${summary.billingYear}-${summary.billingMonth}`} summary={summary} />
          ))}
        </div>
      )}

      {/* Últimos movimientos */}
      {recentExpenses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Últimos movimientos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentExpenses.map((expense, i) => (
              <div key={expense.id}>
                <ExpenseRow expense={expense} cards={cards} />
                {i < recentExpenses.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {expenses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay gastos registrados</p>
          <p className="text-xs mt-1">Agregá tu primer gasto en la sección Gastos</p>
        </div>
      )}
    </div>
  );
}

function BillingPeriodCard({ summary }: { summary: BillingSummary }) {
  const isNext = isNextOrCurrentMonth(summary.billingMonth, summary.billingYear);
  return (
    <Card className={isNext ? "border-primary/30" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Resumen {summary.periodLabel}
          </CardTitle>
          {isNext && <Badge variant="default" className="text-xs">Próximo</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.cards.map(({ card, totalARS, totalUSD }) => (
          <div key={card.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium capitalize text-muted-foreground">
                {card.name}
              </span>
              <span className="text-xs text-muted-foreground">
                Vence el {card.due_day}
              </span>
            </div>
            <div className="flex gap-3">
              {totalARS > 0 && (
                <span className="text-sm font-semibold">{formatCurrency(totalARS, "ARS")}</span>
              )}
              {totalUSD > 0 && (
                <span className="text-sm font-semibold text-emerald-400">
                  {formatCurrency(totalUSD, "USD")}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExpenseRow({ expense, cards }: { expense: Expense; cards: CreditCardType[] }) {
  const card = cards.find((c) => c.id === expense.credit_card_id);
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{expense.description}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(expense.date)}
          {card && ` · ${card.name}`}
          {expense.billing_period && ` · ${expense.billing_period}`}
        </p>
      </div>
      <span className={`text-sm font-semibold ml-3 ${expense.currency === "USD" ? "text-emerald-400" : ""}`}>
        {formatCurrency(expense.amount, expense.currency)}
      </span>
    </div>
  );
}

function formatDate(date: string) {
  return format(new Date(date + "T00:00:00"), "d MMM", { locale: es });
}

function buildBillingSummaries(creditExpenses: Expense[], cards: CreditCardType[]): BillingSummary[] {
  const map = new Map<string, BillingSummary>();

  for (const expense of creditExpenses) {
    if (!expense.billing_period || expense.billing_month == null || expense.billing_year == null) continue;
    const key = `${expense.billing_year}-${expense.billing_month}`;
    if (!map.has(key)) {
      map.set(key, {
        periodLabel: expense.billing_period,
        billingMonth: expense.billing_month,
        billingYear: expense.billing_year,
        cards: [],
      });
    }
    const summary = map.get(key)!;
    const card = cards.find((c) => c.id === expense.credit_card_id);
    if (!card) continue;

    let cardEntry = summary.cards.find((ce) => ce.card.id === card.id);
    if (!cardEntry) {
      cardEntry = { card, totalARS: 0, totalUSD: 0, expenses: [] };
      summary.cards.push(cardEntry);
    }
    if (expense.currency === "ARS") cardEntry.totalARS += expense.amount;
    if (expense.currency === "USD") cardEntry.totalUSD += expense.amount;
    cardEntry.expenses.push(expense);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.billingYear !== b.billingYear) return a.billingYear - b.billingYear;
    return a.billingMonth - b.billingMonth;
  });
}

function isNextOrCurrentMonth(month: number, year: number): boolean {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  return (year === currentYear && month >= currentMonth) ||
    (year === currentYear + 1 && month === 0 && currentMonth === 11);
}
