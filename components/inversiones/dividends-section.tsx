"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { addDividend, deleteDividend } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Dividend } from "@/types";

interface Props {
  dividends: Dividend[];
  availableTickers: string[];   // tickers de posiciones activas para sugerir
  onChanged: () => void;
}

const today = new Date().toISOString().split("T")[0];

export function DividendsSection({ dividends, availableTickers, onChanged }: Props) {
  const [expanded,  setExpanded]  = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const { toast } = useToast();

  const totalDividends = dividends.reduce((s, d) => s + d.amount, 0);

  // Agrupar por ticker para el resumen
  const byTicker = dividends.reduce<Record<string, number>>((acc, d) => {
    acc[d.ticker] = (acc[d.ticker] ?? 0) + d.amount;
    return acc;
  }, {});

  const handleDelete = async (id: string) => {
    await deleteDividend(id);
    toast({ title: "Dividendo eliminado" });
    onChanged();
  };

  const handleSaved = () => {
    setShowForm(false);
    onChanged();
    toast({ title: "✅ Dividendo registrado" });
  };

  return (
    <Card>
      {/* Header clickeable */}
      <button className="w-full text-left" onClick={() => setExpanded(e => !e)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Dividendos recibidos
              </CardTitle>
              {dividends.length > 0 && (
                <Badge variant="success" className="text-[10px] h-4 px-1.5">
                  {dividends.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {totalDividends > 0 && (
                <span className="text-sm font-bold text-emerald-400">
                  {formatCurrency(totalDividends, "USD")}
                </span>
              )}
              {expanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Resumen por ticker */}
          {Object.keys(byTicker).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(byTicker)
                .sort(([, a], [, b]) => b - a)
                .map(([ticker, total]) => (
                  <div key={ticker} className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold">{ticker}</span>
                    <span className="text-xs font-medium text-emerald-400">
                      {formatCurrency(total, "USD")}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Formulario de nuevo dividendo */}
          {showForm ? (
            <DividendForm
              availableTickers={availableTickers}
              onSaved={handleSaved}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed"
              onClick={e => { e.stopPropagation(); setShowForm(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar dividendo
            </Button>
          )}

          {/* Lista de dividendos */}
          {dividends.length > 0 && (
            <>
              <Separator />
              <div className="space-y-0 rounded-lg border overflow-hidden">
                {dividends.map((d, i) => (
                  <div key={d.id}>
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold">{d.ticker}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(d.date)}</span>
                        </div>
                        {d.notes && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{d.notes}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-emerald-400 shrink-0">
                        +{formatCurrency(d.amount, "USD")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleDelete(d.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {i < dividends.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </>
          )}

          {dividends.length === 0 && !showForm && (
            <p className="text-xs text-center text-muted-foreground py-2">
              No hay dividendos registrados
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── DividendForm ─────────────────────────────────────────────────────────────

function DividendForm({
  availableTickers,
  onSaved,
  onCancel,
}: {
  availableTickers: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ticker: availableTickers[0] ?? "",
    amount: "",
    date:   today,
    notes:  "",
  });

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.amount) return;
    setSaving(true);
    try {
      await addDividend({
        ticker: form.ticker.toUpperCase().trim(),
        amount: parseFloat(form.amount),
        date:   form.date,
        notes:  form.notes || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-dashed border-border/60 p-3 space-y-3"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-muted-foreground">Nuevo dividendo</p>

      <div className="grid grid-cols-2 gap-2">
        {/* Ticker */}
        <div>
          <Label className="text-[10px] mb-1 block text-muted-foreground">Ticker</Label>
          {availableTickers.length > 0 ? (
            <select
              value={form.ticker}
              onChange={e => set("ticker", e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            >
              {availableTickers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__other__">Otro...</option>
            </select>
          ) : (
            <Input
              placeholder="AAPL"
              value={form.ticker}
              onChange={e => set("ticker", e.target.value.toUpperCase())}
              className="h-8 text-sm uppercase font-mono"
              required
            />
          )}
          {/* Si eligió "Otro..." mostrar input libre */}
          {form.ticker === "__other__" && (
            <Input
              placeholder="Ticker..."
              className="h-8 text-sm uppercase font-mono mt-1"
              onChange={e => set("ticker", e.target.value.toUpperCase())}
              autoFocus
            />
          )}
        </div>

        {/* Monto */}
        <div>
          <Label className="text-[10px] mb-1 block text-muted-foreground">Monto (USD)</Label>
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            placeholder="12.50"
            value={form.amount}
            onChange={e => set("amount", e.target.value)}
            inputMode="decimal"
            className="h-8 text-sm"
            required
          />
        </div>
      </div>

      {/* Fecha */}
      <div>
        <Label className="text-[10px] mb-1 block text-muted-foreground">Fecha de cobro</Label>
        <Input
          type="date"
          value={form.date}
          onChange={e => set("date", e.target.value)}
          className="h-8 text-sm"
          required
        />
      </div>

      {/* Notas */}
      <div>
        <Label className="text-[10px] mb-1 block text-muted-foreground">Notas (opcional)</Label>
        <Input
          placeholder="Q1 dividend, dividend reinvestment..."
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={saving}>
          {saving ? "..." : "Registrar"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
