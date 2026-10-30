"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { addInvestment } from "@/lib/supabase";
import { formatCurrency, parseAmount, parseQuantity } from "@/lib/utils";
import { fetchMepRate } from "@/lib/mep";
import type { AssetType } from "@/types";
import { ASSET_TYPE_LABELS } from "@/types";

interface Props {
  availableArs: number;
  onSaved: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function InvestmentForm({ availableArs, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("");
  const [loadingMep, setLoadingMep] = useState(false);
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

  const resolvedQty = parseQuantity(form.quantity);
  const price       = parseAmount(form.buy_price);
  const cost        = (resolvedQty ?? 0) * price;
  // Si el usuario ingresó una fracción, mostramos el resultado
  const qtyPreview  = form.quantity.includes("/") && resolvedQty != null
    ? resolvedQty.toFixed(6).replace(/\.?0+$/, "")
    : null;

  const rate    = parseAmount(exchangeRate);
  const arsCost = rate > 0 ? cost * rate : 0;
  const notEnoughArs = rate > 0 && arsCost > availableArs;

  const loadMepRate = async () => {
    setLoadingMep(true);
    try {
      const mep = await fetchMepRate();
      if (mep) setExchangeRate(mep.toFixed(2));
    } finally {
      setLoadingMep(false);
    }
  };

  useEffect(() => { loadMepRate(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.quantity || !form.buy_price) return;
    if (resolvedQty == null || resolvedQty <= 0) return;
    if (rate <= 0) return;
    setSaving(true);
    try {
      await addInvestment({
        ticker:     form.ticker.toUpperCase().trim(),
        asset_type: form.asset_type,
        quantity:   resolvedQty,
        buy_price:  price,
        buy_date:   form.buy_date,
        is_sold:    false,
        sell_price: null,
        sell_date:  null,
        buy_rate:   rate,
        sell_rate:  null,
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
          <Label className="text-xs mb-1.5 block">Cantidad <span className="text-muted-foreground">(ej: 2/120)</span></Label>
          <Input
            type="text"
            placeholder="10 o 2/120"
            value={form.quantity}
            onChange={e => set("quantity", e.target.value)}
            required
          />
          {qtyPreview && (
            <p className="text-[10px] text-primary mt-1">= {qtyPreview} acciones</p>
          )}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Precio (USD)</Label>
          <Input
            type="text"
            placeholder="150,00"
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

      {/* Cotización MEP — toda compra se paga en pesos */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs">Cotización MEP ($ por USD)</Label>
          <button
            type="button"
            onClick={loadMepRate}
            disabled={loadingMep}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loadingMep ? "animate-spin" : ""}`} />
            {loadingMep ? "Buscando..." : "Actualizar"}
          </button>
        </div>
        <Input
          type="text"
          placeholder="1150"
          value={exchangeRate}
          onChange={e => setExchangeRate(e.target.value)}
          inputMode="decimal"
          required
        />
      </div>

      {/* Preview */}
      {cost > 0 && (
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Inversión total</span>
            <span className="text-sm font-semibold">{formatCurrency(cost, "USD")}</span>
          </div>
          {rate > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Se descuentan en pesos</span>
              <span className={`text-sm font-semibold ${notEnoughArs ? "text-destructive" : ""}`}>
                {formatCurrency(arsCost, "ARS")}
              </span>
            </div>
          )}
          {notEnoughArs && (
            <p className="text-[10px] text-destructive">
              Disponible: {formatCurrency(availableArs, "ARS")}
            </p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saving || rate <= 0}>
        {saving ? "Guardando..." : "Registrar compra"}
      </Button>
    </form>
  );
}
