"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoriesManager } from "@/components/gastos/categories-manager";
import { addExpenses, upsertCustomCategory, deleteCustomCategory } from "@/lib/supabase";
import { getBillingPeriodForCard, getMonthName, parseAmount } from "@/lib/utils";
import type {
  CreditCard, CreditCardMonthlyConfig, Currency, PaymentMethod, Account,
  ExpenseCustomCategory,
} from "@/types";

interface Props {
  cards: CreditCard[];
  monthlyConfigs: CreditCardMonthlyConfig[];
  accounts: Account[];
  customCategories: ExpenseCustomCategory[];
  onCategoriesChanged: () => void;
  onSaved: () => void;
}

const today = new Date().toISOString().split("T")[0];
const RECURRING_MONTHS = 12; // horizonte de generación para movimientos recurrentes

// Agrega N meses a una fecha YYYY-MM-DD
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}


export function ExpenseForm({ cards, monthlyConfigs, accounts, customCategories, onCategoriesChanged, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "ARS" as Currency,
    description: "",
    category: customCategories[0] ? `custom_${customCategories[0].id}` : "",
    date: today,
    payment_method: "efectivo" as PaymentMethod,
    credit_card_id: "",
    account_id: "",
    installments: "1",
    notes: "",
  });
  const [isRecurring, setIsRecurring] = useState(false);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isCredit     = form.payment_method === "credito";
  const isCash       = ["efectivo", "debito", "mercado_pago"].includes(form.payment_method);
  const numCuotas    = Math.max(1, parseInt(form.installments) || 1);
  const selectedCard = cards.find(c => c.id === form.credit_card_id);
  const totalAmount  = parseAmount(form.amount);
  const perCuota     = numCuotas > 1 ? totalAmount / numCuotas : totalAmount;

  // Cuenta automática según medio de pago:
  //   Mercado Pago → cuenta tipo "wallet" · Efectivo → cuenta tipo "cash"
  //   Débito → el usuario elige · Crédito → cuenta vinculada a la tarjeta
  const autoAccount =
    form.payment_method === "mercado_pago" ? accounts.find(a => a.account_type === "wallet")
    : form.payment_method === "efectivo"   ? accounts.find(a => a.account_type === "cash")
    : undefined;
  const needsAccountSelect = isCash && !autoAccount && accounts.length > 0;

  // Preview del primer período (usa fechas exactas de cierre si están configuradas)
  const firstPeriod = isCredit && selectedCard
    ? getBillingPeriodForCard(form.date, selectedCard, monthlyConfigs)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description || !form.category) return;
    if (isCredit && !form.credit_card_id) return;
    setSaving(true);

    try {
      const total    = parseAmount(form.amount);
      const count    = isRecurring ? RECURRING_MONTHS : numCuotas;
      const perCuota = isRecurring ? total : parseFloat((total / numCuotas).toFixed(2));

      // Generar N registros (uno por cuota, o uno por mes si es recurrente).
      // Cada uno avanza 1 mes: así el trigger de Supabase calcula el billing
      // period correcto para cada uno.
      const records = Array.from({ length: count }, (_, i) => {
        const expenseDate = addMonths(form.date, i);

        let billing_period: string | null = null;
        let billing_month:  number | null = null;
        let billing_year:   number | null = null;

        if (isCredit && selectedCard) {
          const bp = getBillingPeriodForCard(expenseDate, selectedCard, monthlyConfigs);
          billing_period = bp.periodLabel;
          billing_month  = bp.billingMonth;
          billing_year   = bp.billingYear;
        }

        // Cuenta resuelta: crédito → cuenta de la tarjeta;
        // MP/efectivo → cuenta automática por tipo; débito → elegida
        const cardAccountId = isCredit && selectedCard ? selectedCard.account_id : null;
        const resolvedAccountId =
          cardAccountId ??
          autoAccount?.id ??
          (isCash && form.account_id ? form.account_id : null);

        return {
          amount:             perCuota,
          currency:           form.currency as Currency,
          description:        form.description,
          category:           form.category,
          date:               expenseDate,
          payment_method:     form.payment_method as PaymentMethod,
          credit_card_id:     isCredit && form.credit_card_id ? form.credit_card_id : null,
          account_id:         resolvedAccountId,
          billing_period,
          billing_month,
          billing_year,
          total_installments: isRecurring ? 1 : numCuotas,
          installment_number: isRecurring ? 1 : i + 1,
          is_recurring:       isRecurring,
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
            type="text"
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
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs">Categoría</Label>
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3 w-3" /> Gestionar
          </button>
        </div>
        {customCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2.5">
            No tenés categorías. Creá una en la solapa <strong>Categorías</strong>.
          </p>
        ) : (
          <Select value={form.category} onValueChange={v => set("category", v)}>
            <SelectTrigger><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
            <SelectContent>
              {customCategories.map(cat => (
                <SelectItem key={cat.id} value={`custom_${cat.id}`}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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

      {/* Cuenta: automática para MP/efectivo, selector para débito */}
      {isCash && autoAccount && (
        <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
          Se descuenta de <strong className="text-foreground">{autoAccount.name}</strong>
        </p>
      )}
      {needsAccountSelect && (
        <div>
          <Label className="text-xs mb-1.5 block">Cuenta</Label>
          <Select value={form.account_id || "none"} onValueChange={v => set("account_id", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Elegí una cuenta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
                  const bp = getBillingPeriodForCard(form.date, card, monthlyConfigs);
                  return (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} · Cierra el {bp.closingDate.getDate()} de {getMonthName(bp.closingDate.getMonth())}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Cuotas</Label>
            <Select value={form.installments} onValueChange={v => set("installments", v)} disabled={isRecurring}>
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
          {firstPeriod && selectedCard && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 space-y-1">
              <p className="text-[10px] text-muted-foreground mb-1">
                Cierra el {firstPeriod.closingDate.getDate()} de {getMonthName(firstPeriod.closingDate.getMonth())}
              </p>
              {!form.amount ? null : numCuotas === 1 ? (
                <p className="text-xs">
                  → Resumen <strong className="text-primary">{firstPeriod.periodLabel}</strong>
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium text-primary">
                    {numCuotas} cuotas de {perCuota.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}
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

      {/* Recurrente */}
      <label className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={e => {
            const checked = e.target.checked;
            setIsRecurring(checked);
            if (checked) set("installments", "1");
          }}
          className="mt-0.5 h-4 w-4 accent-[#2d5016]"
        />
        <span>
          <span className="text-xs font-medium block">Es un gasto recurrente</span>
          <span className="text-[11px] text-muted-foreground">
            Se repite automáticamente todos los meses (alquiler, suscripciones, etc.) por los próximos {RECURRING_MONTHS} meses
          </span>
        </span>
      </label>

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

      {/* Dialog gestión de categorías */}
      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="max-w-sm mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categorías</DialogTitle>
          </DialogHeader>
          <CategoriesManager
            categories={customCategories}
            onUpsert={async (cat) => { await upsertCustomCategory(cat); onCategoriesChanged(); }}
            onDelete={async (id) => { await deleteCustomCategory(id); onCategoriesChanged(); }}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
}
