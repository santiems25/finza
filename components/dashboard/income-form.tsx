"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addIncome, addIncomes, getAccounts } from "@/lib/supabase";
import type { Currency, IncomeSource, Account } from "@/types";
import { INCOME_SOURCE_LABELS, INCOME_SOURCE_ICONS } from "@/types";

interface Props {
  defaultDate: string; // YYYY-MM-DD del mes visible
  onSaved: () => void;
}

const RECURRING_MONTHS = 12; // horizonte de generación para movimientos recurrentes

// Agrega N meses a una fecha YYYY-MM-DD
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

export function IncomeForm({ defaultDate, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [form, setForm] = useState({
    amount:      "",
    currency:    "ARS" as Currency,
    description: "Sueldo",
    source:      "sueldo" as IncomeSource,
    date:        defaultDate,
    account_id:  "",
  });

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
  }, []);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setSaving(true);
    try {
      const base = {
        amount:      parseFloat(form.amount),
        currency:    form.currency,
        description: form.description,
        source:      form.source,
        account_id:  form.account_id || null,
      };
      if (isRecurring) {
        const records = Array.from({ length: RECURRING_MONTHS }, (_, i) => ({
          ...base,
          date: addMonths(form.date, i),
          is_recurring: true,
        }));
        await addIncomes(records);
      } else {
        await addIncome({ ...base, date: form.date, is_recurring: false });
      }
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
            type="number" step="0.01" min="0.01"
            placeholder="0" inputMode="decimal"
            value={form.amount}
            onChange={e => set("amount", e.target.value)}
            required
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

      {/* Fuente */}
      <div>
        <Label className="text-xs mb-1.5 block">Tipo</Label>
        <Select value={form.source} onValueChange={v => set("source", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(INCOME_SOURCE_LABELS) as [IncomeSource, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {INCOME_SOURCE_ICONS[value]} {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Descripción */}
      <div>
        <Label className="text-xs mb-1.5 block">Descripción</Label>
        <Input
          placeholder="Sueldo junio, proyecto X..."
          value={form.description}
          onChange={e => set("description", e.target.value)}
          required
        />
      </div>

      {/* Cuenta */}
      {accounts.length > 0 && (
        <div>
          <Label className="text-xs mb-1.5 block">Cuenta <span className="text-muted-foreground">(opcional)</span></Label>
          <Select value={form.account_id || "none"} onValueChange={v => set("account_id", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Fecha */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha de acreditación</Label>
        <Input
          type="date" value={form.date}
          onChange={e => set("date", e.target.value)}
          required
        />
      </div>

      {/* Recurrente */}
      <label className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={e => setIsRecurring(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#2d5016]"
        />
        <span>
          <span className="text-xs font-medium block">Es un ingreso recurrente</span>
          <span className="text-[11px] text-muted-foreground">
            Se repite automáticamente todos los meses (sueldo, etc.) por los próximos {RECURRING_MONTHS} meses
          </span>
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Guardando..." : "Registrar ingreso"}
      </Button>
    </form>
  );
}
