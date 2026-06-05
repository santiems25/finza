"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addIncome } from "@/lib/supabase";
import type { Currency, IncomeSource } from "@/types";
import { INCOME_SOURCE_LABELS, INCOME_SOURCE_ICONS } from "@/types";

interface Props {
  defaultDate: string; // YYYY-MM-DD del mes visible
  onSaved: () => void;
}

export function IncomeForm({ defaultDate, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount:      "",
    currency:    "ARS" as Currency,
    description: "Sueldo",
    source:      "sueldo" as IncomeSource,
    date:        defaultDate,
  });

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setSaving(true);
    try {
      await addIncome({
        amount:      parseFloat(form.amount),
        currency:    form.currency,
        description: form.description,
        source:      form.source,
        date:        form.date,
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

      {/* Fecha */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha de acreditación</Label>
        <Input
          type="date" value={form.date}
          onChange={e => set("date", e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Guardando..." : "Registrar ingreso"}
      </Button>
    </form>
  );
}
