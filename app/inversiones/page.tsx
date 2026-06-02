"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InvestmentForm } from "@/components/inversiones/investment-form";
import { getInvestments, deleteInvestment } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Investment, InvestmentWithPrice } from "@/types";

export default function InversionesPage() {
  const [investments, setInvestments] = useState<InvestmentWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const fetchPrices = useCallback(async (inv: Investment[]): Promise<InvestmentWithPrice[]> => {
    if (inv.length === 0) return [];
    const tickers = [...new Set(inv.map((i) => i.ticker))].join(",");
    try {
      const res = await fetch(`/api/inversiones?tickers=${tickers}`);
      const prices: Record<string, number | null> = await res.json();

      return inv.map((i) => {
        const currentPrice = prices[i.ticker.toUpperCase()] ?? null;
        const currentValue = currentPrice != null ? currentPrice * i.quantity : null;
        const cost = i.buy_price * i.quantity;
        const gainLoss = currentValue != null ? currentValue - cost : null;
        const gainLossPercent = gainLoss != null && cost > 0 ? (gainLoss / cost) * 100 : null;
        return { ...i, currentPrice, currentValue, gainLoss, gainLossPercent };
      });
    } catch {
      return inv.map((i) => ({ ...i, currentPrice: null, currentValue: null, gainLoss: null, gainLossPercent: null }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const inv = await getInvestments();
    const withPrices = await fetchPrices(inv);
    setInvestments(withPrices);
    setLoading(false);
  }, [fetchPrices]);

  const refresh = async () => {
    setRefreshing(true);
    const inv = await getInvestments();
    const withPrices = await fetchPrices(inv);
    setInvestments(withPrices);
    setRefreshing(false);
    toast({ title: "Precios actualizados" });
  };

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    await deleteInvestment(id);
    setInvestments((prev) => prev.filter((i) => i.id !== id));
    toast({ title: "Posición eliminada" });
  };

  const handleSaved = () => {
    setOpen(false);
    load();
    toast({ title: "Inversión guardada" });
  };

  // Totales del portafolio
  const totalCost = investments.reduce((s, i) => s + i.buy_price * i.quantity, 0);
  const totalValue = investments.reduce((s, i) => s + (i.currentValue ?? i.buy_price * i.quantity), 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const isPositive = totalGainLoss >= 0;

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portafolio</h1>
          <p className="text-muted-foreground text-sm">100% en USD</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle>Nueva posición</DialogTitle>
              </DialogHeader>
              <InvestmentForm onSaved={handleSaved} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Resumen del portafolio */}
      {investments.length > 0 && (
        <Card className={`mb-4 ${isPositive ? "border-emerald-500/30" : "border-destructive/30"}`}>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Valor actual</p>
                <p className="text-xl font-bold">{formatCurrency(totalValue, "USD")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Invertido</p>
                <p className="text-xl font-bold">{formatCurrency(totalCost, "USD")}</p>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ganancia / Pérdida</span>
              <div className="flex items-center gap-1.5">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span className={`text-sm font-bold ${isPositive ? "text-emerald-400" : "text-destructive"}`}>
                  {isPositive ? "+" : ""}{formatCurrency(totalGainLoss, "USD")}
                  {" "}
                  <span className="text-xs font-normal">
                    ({isPositive ? "+" : ""}{totalGainLossPercent.toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de posiciones */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : investments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay posiciones registradas</p>
          <p className="text-xs mt-1">Agregá tu primera inversión</p>
        </div>
      ) : (
        <div className="space-y-2">
          {investments.map((inv) => (
            <InvestmentCard key={inv.id} investment={inv} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvestmentCard({
  investment: inv,
  onDelete,
}: {
  investment: InvestmentWithPrice;
  onDelete: (id: string) => void;
}) {
  const cost = inv.buy_price * inv.quantity;
  const isPositive = (inv.gainLoss ?? 0) >= 0;
  const hasPrice = inv.currentPrice != null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-base">{inv.ticker}</span>
              {hasPrice && (
                <Badge variant={isPositive ? "success" : "destructive"} className="text-xs">
                  {isPositive ? "+" : ""}{inv.gainLossPercent?.toFixed(2)}%
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>Cantidad: <span className="text-foreground">{inv.quantity}</span></span>
              <span>Compra: <span className="text-foreground">{formatCurrency(inv.buy_price, "USD")}</span></span>
              {hasPrice && (
                <>
                  <span>Precio actual: <span className="text-foreground">{formatCurrency(inv.currentPrice!, "USD")}</span></span>
                  <span>
                    G/P: <span className={isPositive ? "text-emerald-400" : "text-destructive"}>
                      {isPositive ? "+" : ""}{formatCurrency(inv.gainLoss!, "USD")}
                    </span>
                  </span>
                </>
              )}
              {!hasPrice && (
                <span className="text-muted-foreground/60">Precio no disponible</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Comprado el {formatDate(inv.buy_date)}</span>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {hasPrice ? formatCurrency(inv.currentValue!, "USD") : formatCurrency(cost, "USD")}
                </p>
                {hasPrice && (
                  <p className="text-xs text-muted-foreground">costo: {formatCurrency(cost, "USD")}</p>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(inv.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
