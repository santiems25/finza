"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExpense } from "@/lib/supabase";
import { getBillingPeriod } from "@/lib/utils";
import type { CreditCard, Currency, ExpenseCategory, PaymentMethod } from "@/types";
import { CATEGORY_LABELS } from "@/types";

interface Props {
  cards: CreditCard[];
  onSaved: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function ExpenseForm({ cards, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "ARS" as Currency,
    description: "",
    category: "otros" as ExpenseCategory,
    date: today,
    payment_method: "efectivo" as PaymentMethod,
    credit_card_id: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isCredit = form.payment_method === "credito";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setSaving(true);
    try {
      const selectedCard = cards.find((c) => c.id === form.credit_card_id);
      let billing_period: string | null = null;
      let billing_month: number | null = null;
      let billing_year: number | null = null;

      if (isCredit && selectedCard) {
        const bp = getBillingPeriod(form.date, selectedCard.closing_day);
        billing_period = bp.periodLabel;
        billing_month = bp.dueMonth;
        billing_year = bp.dueYear;
      }

      await addExpense({
        amount: parseFloat(form.amount),
        currency: form.currency,
        description: form.description,
        category: form.category,
        date: form.date,
        payment_method: form.payment_method,
        credit_card_id: isCredit && form.credit_card_id ? form.credit_card_id : null,
        billing_period,
        billing_month,
        billing_year,
      });
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
          <Label className="text-xs mb-1.5 block">Monto</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            required
            inputMode="decimal"
          />
        </div>
        <div className="w-24">
          <Label className="text-xs mb-1.5 block">Moneda</Label>
          <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
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
          onChange={(e) => set("description", e.target.value)}
          required
        />
      </div>

      {/* Categoría */}
      <div>
        <Label className="text-xs mb-1.5 block">Categoría</Label>
        <Select value={form.category} onValueChange={(v) => set("category", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fecha */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha</Label>
        <Input
          type="date"
          value={form.date}
          onChange={(e) => set("date", e.target.value)}
          required
        />
      </div>

      {/* Método de pago */}
      <div>
        <Label className="text-xs mb-1.5 block">Método de pago</Label>
        <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="debito">Débito</SelectItem>
            <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
            <SelectItem value="credito">Crédito</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tarjeta de crédito (solo si método = crédito) */}
      {isCredit && (
        <div>
          <Label className="text-xs mb-1.5 block">Tarjeta</Label>
          <Select
            value={form.credit_card_id}
            onValueChange={(v) => set("credit_card_id", v)}
            required={isCredit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná una tarjeta" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {card.name} · Cierra el {card.closing_day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Preview del período de billing */}
          {form.credit_card_id && form.date && (() => {
            const card = cards.find((c) => c.id === form.credit_card_id);
            if (!card) return null;
            const bp = getBillingPeriod(form.date, card.closing_day);
            return (
              <p className="text-xs text-primary mt-1.5">
                → Resumen de <strong>{bp.periodLabel}</strong>
              </p>
            );
          })()}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}
