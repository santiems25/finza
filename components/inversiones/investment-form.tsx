"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addInvestment } from "@/lib/supabase";

interface Props {
  onSaved: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function InvestmentForm({ onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ticker: "",
    quantity: "",
    buy_price: "",
    buy_date: today,
    notes: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.quantity || !form.buy_price) return;
    setSaving(true);
    try {
      await addInvestment({
        ticker: form.ticker.toUpperCase().trim(),
        quantity: parseFloat(form.quantity),
        buy_price: parseFloat(form.buy_price),
        buy_date: form.buy_date,
        notes: form.notes || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs mb-1.5 block">Ticker</Label>
        <Input
          placeholder="AAPL, GGAL, MELI..."
          value={form.ticker}
          onChange={(e) => set("ticker", e.target.value.toUpperCase())}
          required
          className="uppercase"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Usá el ticker de Yahoo Finance. Para ADRs argentinos: GGAL, MELI, etc.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1.5 block">Cantidad</Label>
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            placeholder="10"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            required
            inputMode="decimal"
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Precio de compra (USD)</Label>
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            placeholder="150.00"
            value={form.buy_price}
            onChange={(e) => set("buy_price", e.target.value)}
            required
            inputMode="decimal"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Fecha de compra</Label>
        <Input
          type="date"
          value={form.buy_date}
          onChange={(e) => set("buy_date", e.target.value)}
          required
        />
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Notas (opcional)</Label>
        <Input
          placeholder="Contexto de la compra..."
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      {/* Preview de la compra */}
      {form.quantity && form.buy_price && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Costo total: </span>
          <span className="font-semibold">
            USD {(parseFloat(form.quantity || "0") * parseFloat(form.buy_price || "0")).toFixed(2)}
          </span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Guardando..." : "Guardar posición"}
      </Button>
    </form>
  );
}
