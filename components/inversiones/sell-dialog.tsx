"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { sellFifo, estimateFifoCost } from "@/lib/sell-fifo";
import { formatCurrency, parseQuantity } from "@/lib/utils";
import type { Position } from "@/types";

interface Props {
  position: Position;
  currentPrice: number | null;
  onSold: () => void;
  onCancel: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function SellDialog({ position, currentPrice, onSold, onCancel }: Props) {
  const [quantityStr, setQuantityStr] = useState(position.totalQty.toString());
  const [sellPrice,   setSellPrice]   = useState(currentPrice ? currentPrice.toFixed(2) : "");
  const [sellDate,    setSellDate]    = useState(today);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const quantity = parseQuantity(quantityStr);
  const validQty = quantity != null && quantity > 0 && quantity <= position.totalQty + 1e-6;

  const cost       = validQty ? estimateFifoCost(position.lots, quantity!) : 0;
  const sprice     = parseFloat(sellPrice) || 0;
  const proceeds   = validQty ? sprice * quantity! : 0;
  const pnl        = proceeds - cost;
  const pnlPct     = cost > 0 ? (pnl / cost) * 100 : 0;
  const isPositive = pnl >= 0;

  const handleSell = async () => {
    setError(null);
    if (!validQty) { setError(`Ingresá una cantidad entre 0 y ${position.totalQty}`); return; }
    if (!sellPrice || !sellDate) return;
    setSaving(true);
    try {
      await sellFifo(position.lots, quantity!, parseFloat(sellPrice), sellDate);
      onSold();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumen de la posición */}
      <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ticker</span>
          <span className="font-semibold">{position.ticker}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nominales disponibles</span>
          <span>{position.totalQty}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Precio de compra promedio</span>
          <span>{formatCurrency(position.avgBuyPrice, "USD")}</span>
        </div>
      </div>

      {/* Cantidad a vender */}
      <div>
        <Label className="text-xs mb-1.5 block">Cantidad a vender</Label>
        <Input
          type="text"
          placeholder={position.totalQty.toString()}
          value={quantityStr}
          onChange={e => setQuantityStr(e.target.value)}
          autoFocus
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Se vende primero de la compra más antigua (FIFO). Máximo: {position.totalQty}
        </p>
      </div>

      {/* Precio de venta */}
      <div>
        <Label className="text-xs mb-1.5 block">Precio de venta (USD por nominal)</Label>
        <Input
          type="number"
          step="0.0001"
          min="0.0001"
          placeholder="0.00"
          value={sellPrice}
          onChange={e => setSellPrice(e.target.value)}
          inputMode="decimal"
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

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Preview P&L */}
      {sprice > 0 && validQty && (
        <div className={`rounded-lg border px-4 py-3 space-y-1.5 ${
          isPositive ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"
        }`}>
          <div className="flex items-center gap-2">
            {isPositive
              ? <TrendingUp className="h-4 w-4 text-emerald-500" />
              : <TrendingDown className="h-4 w-4 text-destructive" />}
            <span className="text-sm font-semibold">P&L realizado</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-bold ${isPositive ? "text-emerald-500" : "text-destructive"}`}>
              {isPositive ? "+" : ""}{formatCurrency(pnl, "USD")}
            </span>
            <span className={`text-sm font-medium ${isPositive ? "text-emerald-500" : "text-destructive"}`}>
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
          disabled={!sellPrice || !sellDate || !validQty || saving}
        >
          {saving ? "Vendiendo..." : "Confirmar venta"}
        </Button>
      </DialogFooter>
    </div>
  );
}
