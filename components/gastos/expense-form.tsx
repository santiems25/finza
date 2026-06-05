"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { addExpenses } from "@/lib/supabase";
import { getBillingPeriod } from "@/lib/utils";
import type {
  CreditCard, CreditCardMonthlyConfig, Currency, ExpenseCategory, PaymentMethod
} from "@/types";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";

interface Props {
  cards: CreditCard[];
  monthlyConfigs: CreditCardMonthlyConfig[];
  onSaved: () => void;
}

const today = new Date().toISOString().split("T")[0];

// Agrega N meses a una fecha YYYY-MM-DD
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

/** Devuelve el closing_day correcto para una tarjeta en una fecha dada,
 *  buscando primero en los overrides mensuales y cayendo al default del card. */
function resolveClosingDay(
  card: CreditCard,
  dateStr: string,
  monthlyConfigs: CreditCardMonthlyConfig[]
): number {
  const d     = new Date(dateStr + "T00:00:00");
  const month = d.getMonth();   // 0-indexed
  const year  = d.getFullYear();
  const override = monthlyConfigs.find(
    mc => mc.credit_card_id === card.id && mc.month === month && mc.year === year
  );
  return override?.closing_day ?? card.closing_day;
}

export function ExpenseForm({ cards, monthlyConfigs, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "ARS" as Currency,
    description: "",
    category: "otros" as ExpenseCategory,
    date: today,
    payment_method: "efectivo" as PaymentMethod,
    credit_card_id: "",
    installments: "1",
    notes: "",
  });

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isCredit     = form.payment_method === "credito";
  const numCuotas    = Math.max(1, parseInt(form.installments) || 1);
  const selectedCard = cards.find(c => c.id === form.credit_card_id);

  // Closing day efectivo para la fecha del formulario (usa override mensual si existe)
  const effectiveClosingDay = selectedCard
    ? resolveClosingDay(selectedCard, form.date, monthlyConfigs)
    : null;

  // Preview del primer período
  const firstPeriod = isCredit && selectedCard && effectiveClosingDay != null
    ? getBillingPeriod(form.date, effectiveClosingDay)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    if (isCredit && !form.credit_card_id) return;
    setSaving(true);

    try {
      const totalAmount = parseFloat(form.amount);
      const perCuota    = parseFloat((totalAmount / numCuotas).toFixed(2));

      // Generar N registros (uno por cuota)
      const records = Array.from({ length: numCuotas }, (_, i) => {
        // Cada cuota cae en un billing period distinto (mes siguiente al anterior)
        const expenseDate = isCredit
          ? addMonths(form.date, i)    // la fecha "lógica" avanza 1 mes por cuota
          : form.date;

        let billing_period: string | null = null;
        let billing_month:  number | null = null;
        let billing_year:   number | null = null;

        if (isCredit && selectedCard) {
          const cd = resolveClosingDay(selectedCard, expenseDate, monthlyConfigs);
          const bp = getBillingPeriod(expenseDate, cd);
          billing_period = bp.periodLabel;
          billing_month  = bp.dueMonth;
          billing_year   = bp.dueYear;
        }

        return {
          amount:             perCuota,
          currency:           form.currency as Currency,
          description:        form.description,
          category:           form.category as ExpenseCategory,
          date:               isCredit ? form.date : expenseDate, // fecha real siempre la original
          payment_method:     form.payment_method as PaymentMethod,
          credit_card_id:     isCredit && form.credit_card_id ? form.credit_card_id : null,
          billing_period,
          billing_month,
          billing_year,
          total_installments: numCuotas,
          installment_number: i + 1,
          notes:              form.notes || null,
        };
      });

      await addExpenses(records);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Monto y moneda */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs mb-1.5 block">Monto total</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0"
            value={form.amount}
            onChange={e => set("amount", e.target.value)}
            required
            inputMode="decimal"
          />
        </div>
        <div className="w-24">
          <Label className="text-xs mb-1.5 block">Moneda</Label>
          <Select value={form.currency} onValueChange={v => set("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS $</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <Label className="text-xs mb-1.5 block">Descripción</Label>
        <Input
          placeholder="¿En qué gastaste?"
          value={form.description}
          onChange={e => set("description", e.target.value)}
          required
        />
      </div>

      {/* Categoría */}
      <div>
        <Label className="text-xs mb-1.5 block">Categoría</Label>
        <Select value={form.category} onValueChange={v => set("category", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <span>{CATEGORY_ICONS[value]}</span>
                    <span>{label}</span>
                  </span>
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Fecha */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha del gasto</Label>
        <Input
          type="date"
          value={form.date}
          onChange={e => set("date", e.target.value)}
          required
        />
      </div>

      {/* Método de pago */}
      <div>
        <Label className="text-xs mb-1.5 block">Medio de pago</Label>
        <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="efectivo">💵 Efectivo</SelectItem>
            <SelectItem value="debito">💳 Débito</SelectItem>
            <SelectItem value="mercado_pago">📱 Mercado Pago</SelectItem>
            <SelectItem value="credito">🏦 Crédito</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campos de crédito */}
      {isCredit && (
        <>
          <div>
            <Label className="text-xs mb-1.5 block">Tarjeta</Label>
            <Select
              value={form.credit_card_id}
              onValueChange={v => set("credit_card_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná una tarjeta" />
              </SelectTrigger>
              <SelectContent>
                {cards.map(card => {
                  const cd = resolveClosingDay(card, form.date, monthlyConfigs);
                  const isOverride = cd !== card.closing_day;
                  return (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} · Cierra el {cd}{isOverride ? " *" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Cuotas</Label>
            <Select value={form.installments} onValueChange={v => set("installments", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,6,9,12,18,24].map(n => (
                  <SelectItem key={n} value={n.toString()}>
                    {n === 1 ? "1 cuota (pago único)" : `${n} cuotas`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {firstPeriod && selectedCard && effectiveClosingDay != null && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 space-y-1">
              {effectiveClosingDay !== selectedCard.closing_day && (
                <p className="text-[10px] text-amber-400 mb-1">
                  ⚠ Usando día de cierre configurado para este mes ({effectiveClosingDay}), no el default ({selectedCard.closing_day})
                </p>
              )}
              {!form.amount ? null : numCuotas === 1 ? (
                <p className="text-xs">
                  → Resumen <strong className="text-primary">{firstPeriod.periodLabel}</strong>
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium text-primary">
                    {numCuotas} cuotas de {(parseFloat(form.amount || "0") / numCuotas).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Desde <strong className="text-foreground">{firstPeriod.periodLabel}</strong> por {numCuotas} meses
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Notas opcionales */}
      <div>
        <Label className="text-xs mb-1.5 block">Notas <span className="text-muted-foreground">(opcional)</span></Label>
        <Input
          placeholder="Contexto, referencia..."
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}
