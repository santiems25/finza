"use client";

import { useState } from "react";
import {
  Pencil, Check, X, Plus, Trash2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, ArrowRightLeft, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SavingsConfig, Expense, Income, FxTransaction } from "@/types";

const today = new Date().toISOString().split("T")[0];

interface Props {
  config: SavingsConfig | null;
  expenses: Expense[];
  incomes: Income[];
  fxTransactions: FxTransaction[];
  onUpdateConfig: (ars: number, usd: number) => Promise<void>;
  onAddFx: (tx: Omit<FxTransaction, "id" | "created_at">) => Promise<void>;
  onDeleteFx: (id: string) => Promise<void>;
}

// Solo efectivo/débito/MP mueve la caja inmediatamente
const CASH_METHODS = ["efectivo", "debito", "mercado_pago"] as const;

export function SavingsOverview({
  config, expenses, incomes, fxTransactions,
  onUpdateConfig, onAddFx, onDeleteFx,
}: Props) {
  const [fxOpen, setFxOpen] = useState(false);

  // ── Cálculo de saldos ───────────────────────────────────────────────────────
  const initialARS = config?.initial_ars ?? 0;
  const initialUSD = config?.initial_usd ?? 0;

  const incomeARS = incomes.filter(i => i.currency === "ARS").reduce((s, i) => s + i.amount, 0);
  const incomeUSD = incomes.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0);

  // Solo gastos en cash (no crédito)
  const cashExpARS = expenses
    .filter(e => e.currency === "ARS" && (CASH_METHODS as readonly string[]).includes(e.payment_method))
    .reduce((s, e) => s + e.amount, 0);
  const cashExpUSD = expenses
    .filter(e => e.currency === "USD" && (CASH_METHODS as readonly string[]).includes(e.payment_method))
    .reduce((s, e) => s + e.amount, 0);

  // FX
  const fxARS = fxTransactions.reduce((s, t) => s + t.ars_amount, 0); // pesos gastados
  const fxUSD = fxTransactions.reduce((s, t) => s + t.usd_amount, 0); // dólares comprados

  // TC pendiente (crédito no pagado)
  const pendingTC_ARS = expenses
    .filter(e => e.currency === "ARS" && e.payment_method === "credito")
    .reduce((s, e) => s + e.amount, 0);
  const pendingTC_USD = expenses
    .filter(e => e.currency === "USD" && e.payment_method === "credito")
    .reduce((s, e) => s + e.amount, 0);

  const balanceARS = initialARS + incomeARS - cashExpARS - fxARS;
  const balanceUSD = initialUSD + incomeUSD - cashExpUSD + fxUSD;

  const projectedARS = balanceARS - pendingTC_ARS;
  const projectedUSD = balanceUSD - pendingTC_USD;

  return (
    <div className="space-y-4">
      {/* ── Saldo ARS ── */}
      <SaldoCard
        currency="ARS"
        balance={balanceARS}
        projected={projectedARS}
        initial={initialARS}
        incomes={incomeARS}
        cashExpenses={cashExpARS}
        fxOut={fxARS}
        pendingTC={pendingTC_ARS}
        config={config}
        onUpdateConfig={onUpdateConfig}
      />

      {/* ── Saldo USD ── */}
      <SaldoCard
        currency="USD"
        balance={balanceUSD}
        projected={projectedUSD}
        initial={initialUSD}
        incomes={incomeUSD}
        cashExpenses={cashExpUSD}
        fxIn={fxUSD}
        pendingTC={pendingTC_USD}
        config={config}
        onUpdateConfig={onUpdateConfig}
      />

      {/* ── Compra de dólares ── */}
      <Button
        className="w-full gap-2 bg-gradient-to-r from-blue-600 to-violet-600 border-0"
        onClick={() => setFxOpen(true)}
      >
        <ArrowRightLeft className="h-4 w-4" />
        Comprar dólares
      </Button>

      {/* ── Historial FX ── */}
      {fxTransactions.length > 0 && (
        <FxHistory transactions={fxTransactions} onDelete={onDeleteFx} />
      )}

      {/* ── Dialog compra FX ── */}
      <Dialog open={fxOpen} onOpenChange={setFxOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Comprar dólares</DialogTitle>
          </DialogHeader>
          <FxForm
            onSaved={async tx => { await onAddFx(tx); setFxOpen(false); }}
            onCancel={() => setFxOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SaldoCard ────────────────────────────────────────────────────────────────

function SaldoCard({
  currency, balance, projected, initial, incomes, cashExpenses,
  fxOut, fxIn, pendingTC, config, onUpdateConfig,
}: {
  currency: "ARS" | "USD";
  balance: number;
  projected: number;
  initial: number;
  incomes: number;
  cashExpenses: number;
  fxOut?: number;
  fxIn?: number;
  pendingTC: number;
  config: SavingsConfig | null;
  onUpdateConfig: (ars: number, usd: number) => Promise<void>;
}) {
  const [editInitial, setEditInitial] = useState(false);
  const [initialInput, setInitialInput] = useState(initial.toString());
  const [saving, setSaving] = useState(false);

  const isARS = currency === "ARS";
  const label = isARS ? "Pesos (ARS)" : "Dólares (USD)";
  const isPositive = balance >= 0;
  const hasPending = pendingTC > 0;

  const handleSaveInitial = async () => {
    if (!config) return;
    const val = parseFloat(initialInput);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    await onUpdateConfig(
      isARS ? val : config.initial_ars,
      isARS ? config.initial_usd : val
    );
    setSaving(false);
    setEditInitial(false);
  };

  return (
    <Card className={isPositive ? "border-emerald-500/20" : "border-destructive/20"}>
      <CardContent className="p-4 space-y-3">
        {/* Label + edit */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </p>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setEditInitial(e => !e); setInitialInput(initial.toString()); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Saldo principal */}
        <div>
          <p className={`text-3xl font-bold ${isPositive ? "" : "text-destructive"}`}>
            {formatCurrency(balance, currency)}
          </p>
          {hasPending && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Proyectado (sin TC pendiente):{" "}
              <span className={projected >= 0 ? "text-amber-400" : "text-destructive"}>
                {formatCurrency(projected, currency)}
              </span>
            </p>
          )}
        </div>

        <Separator />

        {/* Desglose */}
        <div className="space-y-1.5 text-xs">
          {/* Saldo inicial */}
          {editInitial ? (
            <div className="flex items-center gap-2 py-1">
              <span className="text-muted-foreground w-24 shrink-0">Saldo inicial</span>
              <Input
                type="number" min="0" step="0.01"
                value={initialInput}
                onChange={e => setInitialInput(e.target.value)}
                className="h-7 text-xs flex-1"
                inputMode="decimal"
                autoFocus
              />
              <button onClick={handleSaveInitial} disabled={saving} className="text-primary hover:text-primary/80">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditInitial(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <DesgloseLine label="Saldo inicial" value={initial} currency={currency} neutral />
          )}

          {incomes > 0 && (
            <DesgloseLine label="+ Ingresos" value={incomes} currency={currency} positive />
          )}
          {cashExpenses > 0 && (
            <DesgloseLine label="− Gastos (efectivo/débito/MP)" value={cashExpenses} currency={currency} negative />
          )}
          {fxOut != null && fxOut > 0 && (
            <DesgloseLine label="− Compra de dólares" value={fxOut} currency={currency} negative />
          )}
          {fxIn != null && fxIn > 0 && (
            <DesgloseLine label="+ Compra de dólares" value={fxIn} currency={currency} positive />
          )}

          {/* TC pendiente */}
          {hasPending && (
            <div className="flex items-center justify-between rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 mt-2">
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                TC pendiente de pago
              </span>
              <span className="text-amber-400 font-medium">
                − {formatCurrency(pendingTC, currency)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DesgloseLine({
  label, value, currency, positive, negative, neutral,
}: {
  label: string; value: number; currency: "ARS" | "USD";
  positive?: boolean; negative?: boolean; neutral?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={
        positive ? "text-emerald-400 font-medium" :
        negative ? "text-destructive font-medium" :
        "text-foreground"
      }>
        {formatCurrency(value, currency)}
      </span>
    </div>
  );
}

// ─── FxHistory ────────────────────────────────────────────────────────────────

function FxHistory({
  transactions, onDelete,
}: {
  transactions: FxTransaction[];
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <button className="w-full text-left" onClick={() => setExpanded(e => !e)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Compras de dólares
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {transactions.length}
              </Badge>
            </CardTitle>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-0 rounded-lg border overflow-hidden">
          {transactions.map((tx, i) => (
            <div key={tx.id}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0 text-xs space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatDate(tx.date)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      ${tx.exchange_rate.toLocaleString("es-AR")}/USD
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-destructive">
                      − {formatCurrency(tx.ars_amount, "ARS")}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-emerald-400">
                      + {formatCurrency(tx.usd_amount, "USD")}
                    </span>
                  </div>
                  {tx.notes && (
                    <p className="text-muted-foreground/70 truncate">{tx.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => onDelete(tx.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {i < transactions.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ─── FxForm ───────────────────────────────────────────────────────────────────

function FxForm({
  onSaved, onCancel,
}: {
  onSaved: (tx: Omit<FxTransaction, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving,       setSaving]       = useState(false);
  const [arsAmount,    setArsAmount]    = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [date,         setDate]         = useState(today);
  const [notes,        setNotes]        = useState("");

  // USD calculados automáticamente
  const ars = parseFloat(arsAmount)    || 0;
  const rate = parseFloat(exchangeRate) || 0;
  const usd  = rate > 0 ? ars / rate : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ars <= 0 || rate <= 0) return;
    setSaving(true);
    try {
      await onSaved({
        ars_amount:    ars,
        usd_amount:    parseFloat(usd.toFixed(4)),
        exchange_rate: rate,
        date,
        notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ARS a gastar */}
      <div>
        <Label className="text-xs mb-1.5 block">Pesos a gastar (ARS)</Label>
        <Input
          type="number" step="0.01" min="0.01"
          placeholder="50,000"
          value={arsAmount}
          onChange={e => setArsAmount(e.target.value)}
          inputMode="decimal"
          required
        />
      </div>

      {/* Cotización */}
      <div>
        <Label className="text-xs mb-1.5 block">Cotización ($ por USD)</Label>
        <Input
          type="number" step="0.01" min="0.01"
          placeholder="1.150"
          value={exchangeRate}
          onChange={e => setExchangeRate(e.target.value)}
          inputMode="decimal"
          required
        />
      </div>

      {/* Preview USD */}
      {usd > 0 && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Dólares a recibir</span>
          <span className="text-lg font-bold text-emerald-400">
            {formatCurrency(usd, "USD")}
          </span>
        </div>
      )}

      {/* Fecha */}
      <div>
        <Label className="text-xs mb-1.5 block">Fecha</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>

      {/* Notas */}
      <div>
        <Label className="text-xs mb-1.5 block">Notas <span className="text-muted-foreground">(opcional)</span></Label>
        <Input
          placeholder="Dólar blue, MEP, oficial..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving || usd <= 0}>
          {saving ? "Guardando..." : "Confirmar compra"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
