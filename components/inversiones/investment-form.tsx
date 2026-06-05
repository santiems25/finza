"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { addInvestment } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { AssetType } from "@/types";
import { ASSET_TYPE_LABELS } from "@/types";

interface Props {
  onSaved: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function InvestmentForm({ onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ticker:     "",
    asset_type: "accion" as AssetType,
    quantity:   "",
    buy_price:  "",
    buy_date:   today,
    notes:      "",
  });

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const cost = parseFloat(form.quantity || "0") * parseFloat(form.buy_price || "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.quantity || !form.buy_price) return;
    setSaving(true);
    try {
      await addInvestment({
        ticker:     form.ticker.toUpperCase().trim(),
        asset_type: form.asset_type,
        quantity:   parseFloat(form.quantity),
        buy_price:  parseFloat(form.buy_price),
        buy_date:   form.buy_date,
        is_sold:    false,
        sell_price: null,
        sell_date:  null,
        notes:      form.notes || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Ticker + tipo */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs mb-1.5 block">Ticker</Label>
          <Input
            placeholder="AMD, SPY, AAPL..."
            value={form.ticker}
            onChange={e => set("ticker", e.target.value.toUpperCase())}
            className="uppercase font-mono"
            required
          />
        </div>
        <div className="w-28">
          <Label className="text-xs mb-1.5 block">Tipo</Label>
          <Select value={form.asset_type} onValueChange={v => set("asset_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cantidad + precio */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1.5 block">Cantidad</Label>
          <Input
            type="number" step="0.0001" min="0.0001"
            placeholder="10"
            value={form.quantity}
            onChange={e => set("quantity", e.target.value)}
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Precio (USD)</Label>
          <Input
            type="number" step="0.0001" min="0.0001"
            placeholder="150.00"
            value={form.buy_price}
            onChange={e => set("buy_price", e.target.value)}
            inputMode="decimal"
            required
          />
        </div>
      </div>

      {/* Fecha */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha de compra</Label>
        <Input
          type="date" value={form.buy_date}
          onChange={e => set("buy_date", e.target.value)}
          required
        />
      </div>

      {/* Notas */}
      <div>
        <Label className="text-xs mb-1.5 block">Notas <span className="text-muted-foreground">(opcional)</span></Label>
        <Input
          placeholder="Contexto de la compra..."
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
        />
      </div>

      {/* Preview */}
      {cost > 0 && (
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Inversión total</span>
          <span className="text-sm font-semibold">{formatCurrency(cost, "USD")}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Guardando..." : "Registrar compra"}
      </Button>
    </form>
  );
}
