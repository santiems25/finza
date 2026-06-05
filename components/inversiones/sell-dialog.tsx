"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { sellInvestment } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { Investment } from "@/types";

interface Props {
  lot: Investment;
  currentPrice: number | null;
  onSold: () => void;
  onCancel: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function SellDialog({ lot, currentPrice, onSold, onCancel }: Props) {
  const [sellPrice, setSellPrice] = useState(
    currentPrice ? currentPrice.toFixed(2) : ""
  );
  const [sellDate, setSellDate] = useState(today);
  const [saving, setSaving]     = useState(false);

  const cost        = lot.buy_price * lot.quantity;
  const sprice      = parseFloat(sellPrice) || 0;
  const proceeds    = sprice * lot.quantity;
  const pnl         = proceeds - cost;
  const pnlPct      = cost > 0 ? (pnl / cost) * 100 : 0;
  const isPositive  = pnl >= 0;

  const handleSell = async () => {
    if (!sellPrice || !sellDate) return;
    setSaving(true);
    try {
      await sellInvestment(lot.id, parseFloat(sellPrice), sellDate);
      onSold();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumen del lote */}
      <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ticker</span>
          <span className="font-semibold">{lot.ticker}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cantidad</span>
          <span>{lot.quantity} acciones</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Precio de compra</span>
          <span>{formatCurrency(lot.buy_price, "USD")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Costo total</span>
          <span className="font-medium">{formatCurrency(cost, "USD")}</span>
        </div>
      </div>

      {/* Precio de venta */}
      <div>
        <Label className="text-xs mb-1.5 block">Precio de venta (USD por acción)</Label>
        <Input
          type="number"
          step="0.0001"
          min="0.0001"
          placeholder="0.00"
          value={sellPrice}
          onChange={e => setSellPrice(e.target.value)}
          inputMode="decimal"
          autoFocus
        />
      </div>

      {/* Fecha de venta */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha de venta</Label>
        <Input
          type="date"
          value={sellDate}
          onChange={e => setSellDate(e.target.value)}
        />
      </div>

      {/* Preview P&L */}
      {sprice > 0 && (
        <div className={`rounded-lg border px-4 py-3 space-y-1.5 ${
          isPositive ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"
        }`}>
          <div className="flex items-center gap-2">
            {isPositive
              ? <TrendingUp className="h-4 w-4 text-emerald-400" />
              : <TrendingDown className="h-4 w-4 text-destructive" />}
            <span className="text-sm font-semibold">P&L realizado</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-destructive"}`}>
              {isPositive ? "+" : ""}{formatCurrency(pnl, "USD")}
            </span>
            <span className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-destructive"}`}>
              {isPositive ? "+" : ""}{pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Ingreso: {formatCurrency(proceeds, "USD")}</span>
            <span>Costo: {formatCurrency(cost, "USD")}</span>
          </div>
        </div>
      )}

      <DialogFooter className="gap-2 flex-row">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          onClick={handleSell}
          disabled={!sellPrice || !sellDate || saving}
        >
          {saving ? "Vendiendo..." : "Confirmar venta"}
        </Button>
      </DialogFooter>
    </div>
  );
}
