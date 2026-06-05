"use client";

import { useState } from "react";
import {
  CreditCard, ChevronDown, ChevronUp, CheckCircle2, Clock, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, getMonthName, getDueMonthYear } from "@/lib/utils";
import { markBillingAsPaid, unmarkBillingAsPaid } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type {
  CreditCard as CreditCardType, CreditCardMonthlyConfig, Expense, BillingPayment,
  ExpenseCategory,
} from "@/types";
import { CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS, PAYMENT_METHOD_LABELS } from "@/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BillingGroup {
  card: CreditCardType;
  billingMonth: number;
  billingYear: number;
  periodLabel: string;
  dueDay: number;
  expenses: Expense[];
  totalARS: number;
  totalUSD: number;
  isPaid: boolean;
}

interface Props {
  expenses: Expense[];
  cards: CreditCardType[];
  monthlyConfigs: CreditCardMonthlyConfig[];
  billingPayments: BillingPayment[];
  onPaymentToggled: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBillingGroups(
  expenses: Expense[],
  cards: CreditCardType[],
  monthlyConfigs: CreditCardMonthlyConfig[],
  payments: BillingPayment[]
): BillingGroup[] {
  const map = new Map<string, BillingGroup>();

  for (const e of expenses) {
    if (
      e.payment_method !== "credito" ||
      e.billing_month == null ||
      e.billing_year == null ||
      !e.billing_period ||
      !e.credit_card_id
    ) continue;

    const card = cards.find(c => c.id === e.credit_card_id);
    if (!card) continue;

    const key = `${e.credit_card_id}-${e.billing_year}-${e.billing_month}`;

    if (!map.has(key)) {
      const isPaid = payments.some(
        p =>
          p.credit_card_id === e.credit_card_id &&
          p.billing_month  === e.billing_month &&
          p.billing_year   === e.billing_year
      );
      // Buscar override mensual para el due_day de este período
      const override = monthlyConfigs.find(
        mc =>
          mc.credit_card_id === e.credit_card_id &&
          mc.month === e.billing_month &&
          mc.year  === e.billing_year
      );
      const dueDay = override?.due_day ?? card.due_day;

      map.set(key, {
        card,
        billingMonth: e.billing_month,
        billingYear:  e.billing_year,
        periodLabel:  e.billing_period,
        dueDay,
        expenses:     [],
        totalARS:     0,
        totalUSD:     0,
        isPaid,
      });
    }

    const group = map.get(key)!;
    group.expenses.push(e);
    if (e.currency === "ARS") group.totalARS += e.amount;
    if (e.currency === "USD") group.totalUSD += e.amount;
  }

  // Ordenar: primero pendientes del mes actual/futuro, luego histórico desc
  return Array.from(map.values()).sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    if (a.billingYear !== b.billingYear) return b.billingYear - a.billingYear;
    if (a.billingMonth !== b.billingMonth) return b.billingMonth - a.billingMonth;
    return a.card.name.localeCompare(b.card.name);
  });
}

/** Días hasta el vencimiento (negativo = ya venció). */
function daysUntilDue(billingMonth: number, billingYear: number, dueDay: number): number {
  const { dueMonth, dueYear } = getDueMonthYear(billingMonth, billingYear, dueDay);
  const now = new Date();
  const due = new Date(dueYear, dueMonth, dueDay);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function BillingSummaryTab({ expenses, cards, monthlyConfigs, billingPayments, onPaymentToggled }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const groups = buildBillingGroups(expenses, cards, monthlyConfigs, billingPayments);

  const pending = groups.filter(g => !g.isPaid);
  const paid    = groups.filter(g => g.isPaid);

  const handleToggle = async (group: BillingGroup) => {
    const key = `${group.card.id}-${group.billingYear}-${group.billingMonth}`;
    setLoading(key);
    try {
      if (group.isPaid) {
        await unmarkBillingAsPaid(group.card.id, group.billingMonth, group.billingYear);
        toast({ title: `${group.card.name} marcado como pendiente` });
      } else {
        await markBillingAsPaid(group.card.id, group.billingMonth, group.billingYear);
        toast({ title: `✅ Resumen ${group.card.name} — ${group.periodLabel} pagado` });
      }
      onPaymentToggled();
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Sin gastos con tarjeta de crédito</p>
        <p className="text-xs mt-1">Los gastos cargados como "Crédito" aparecerán acá agrupados por resumen</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Pendientes ── */}
      {pending.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pendientes ({pending.length})
          </p>
          {pending.map(group => (
            <BillingGroupCard
              key={`${group.card.id}-${group.billingYear}-${group.billingMonth}`}
              group={group}
              loading={loading}
              onToggle={handleToggle}
            />
          ))}
        </section>
      )}

      {/* ── Pagados ── */}
      {paid.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pagados ({paid.length})
          </p>
          {paid.map(group => (
            <BillingGroupCard
              key={`${group.card.id}-${group.billingYear}-${group.billingMonth}`}
              group={group}
              loading={loading}
              onToggle={handleToggle}
            />
          ))}
        </section>
      )}
    </div>
  );
}

// ─── BillingGroupCard ─────────────────────────────────────────────────────────

function BillingGroupCard({
  group, loading, onToggle,
}: {
  group: BillingGroup;
  loading: string | null;
  onToggle: (g: BillingGroup) => void;
}) {
  const [expanded, setExpanded] = useState(!group.isPaid);
  const key = `${group.card.id}-${group.billingYear}-${group.billingMonth}`;
  const isLoading = loading === key;

  const days   = daysUntilDue(group.billingMonth, group.billingYear, group.dueDay);
  const isOverdue = !group.isPaid && days < 0;
  const isDueSoon = !group.isPaid && days >= 0 && days <= 5;

  return (
    <Card className={
      group.isPaid
        ? "opacity-60 border-border/40"
        : isOverdue
          ? "border-destructive/40"
          : isDueSoon
            ? "border-amber-500/40"
            : "border-primary/25"
    }>
      <CardContent className="p-0">
        {/* Header del grupo */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Tarjeta + período */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
                  <CreditCard className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm font-semibold">{group.card.name}</span>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm font-medium">{group.periodLabel}</span>
                {group.isPaid ? (
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
                    Vence el {group.dueDay} de {getMonthName(getDueMonthYear(group.billingMonth, group.billingYear, group.dueDay).dueMonth)}
                  </Badge>
                )}
              </div>

              {/* Totales */}
              <div className="flex items-baseline gap-3">
                {group.totalARS > 0 && (
                  <span className="text-xl font-bold">
                    {formatCurrency(group.totalARS, "ARS")}
                  </span>
                )}
                {group.totalUSD > 0 && (
                  <span className="text-base font-semibold text-emerald-400">
                    {formatCurrency(group.totalUSD, "USD")}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {group.expenses.length} compra{group.expenses.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Botón pagar */}
            <Button
              size="sm"
              variant={group.isPaid ? "outline" : "default"}
              className={`shrink-0 h-8 text-xs ${
                !group.isPaid
                  ? "bg-gradient-to-r from-blue-600 to-violet-600 border-0"
                  : ""
              }`}
              onClick={() => onToggle(group)}
              disabled={isLoading}
            >
              {isLoading
                ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                : group.isPaid
                  ? "Desmarcar"
                  : "✓ Pagar"}
            </Button>
          </div>

          {/* Toggle expandir */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Ocultar gastos" : "Ver gastos"}
          </button>
        </div>

        {/* Lista de gastos del período */}
        {expanded && (
          <>
            <Separator />
            <div className="divide-y divide-border/40">
              {group.expenses.map(expense => {
                const colors = CATEGORY_COLORS[expense.category as ExpenseCategory];
                return (
                  <div key={expense.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base shrink-0">{CATEGORY_ICONS[expense.category as ExpenseCategory]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{expense.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${colors.bg} ${colors.text}`}>
                          {CATEGORY_LABELS[expense.category as ExpenseCategory]}
                        </span>
                        {expense.total_installments > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            Cuota {expense.installment_number}/{expense.total_installments}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{formatDate(expense.date)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${expense.currency === "USD" ? "text-emerald-400" : ""}`}>
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
