"use client";

import { useState } from "react";
import {
  Pencil, Check, X, Trash2, ChevronDown, ChevronUp,
  ArrowRightLeft, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, parseAmount } from "@/lib/utils";
import type { SavingsConfig, Expense, Income, FxTransaction, BillingPayment } from "@/types";

const today = new Date().toISOString().split("T")[0];

interface Props {
  config: SavingsConfig | null;
  expenses: Expense[];
  incomes: Income[];
  fxTransactions: FxTransaction[];
  billingPayments: BillingPayment[];
  onUpdateConfig: (ars: number, usd: number) => Promise<void>;
  onAddFx: (tx: Omit<FxTransaction, "id" | "created_at">) => Promise<void>;
  onDeleteFx: (id: string) => Promise<void>;
}

// Solo efectivo/débito/MP mueve la caja inmediatamente
const CASH_METHODS = ["efectivo", "debito", "mercado_pago"] as const;

export function SavingsOverview({
  config, expenses, incomes, fxTransactions, billingPayments,
  onUpdateConfig, onAddFx, onDeleteFx,
}: Props) {
  const [fxOpen, setFxOpen] = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isTCPaid = (e: Expense) =>
    billingPayments.some(
      p =>
        p.credit_card_id === e.credit_card_id &&
        p.billing_month  === e.billing_month  &&
        p.billing_year   === e.billing_year
    );

  // ── Cálculo de saldos ───────────────────────────────────────────────────────
  const initialARS = config?.initial_ars ?? 0;
  const initialUSD = config?.initial_usd ?? 0;

  const incomeARS = incomes.filter(i => i.currency === "ARS").reduce((s, i) => s + i.amount, 0);
  const incomeUSD = incomes.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0);

  // Gastos en cash (no crédito)
  const cashExpARS = expenses
    .filter(e => e.currency === "ARS" && (CASH_METHODS as readonly string[]).includes(e.payment_method))
    .reduce((s, e) => s + e.amount, 0);
  const cashExpUSD = expenses
    .filter(e => e.currency === "USD" && (CASH_METHODS as readonly string[]).includes(e.payment_method))
    .reduce((s, e) => s + e.amount, 0);

  // TC pagados → se descuentan del saldo
  const paidTC_ARS = expenses
    .filter(e => e.currency === "ARS" && e.payment_method === "credito" && isTCPaid(e))
    .reduce((s, e) => s + e.amount, 0);
  const paidTC_USD = expenses
    .filter(e => e.currency === "USD" && e.payment_method === "credito" && isTCPaid(e))
    .reduce((s, e) => s + e.amount, 0);

  // TC pendientes (no pagados) → solo para el aviso
  const pendingTC_ARS = expenses
    .filter(e => e.currency === "ARS" && e.payment_method === "credito" && !isTCPaid(e))
    .reduce((s, e) => s + e.amount, 0);
  const pendingTC_USD = expenses
    .filter(e => e.currency === "USD" && e.payment_method === "credito" && !isTCPaid(e))
    .reduce((s, e) => s + e.amount, 0);

  // FX
  const fxARS = fxTransactions.reduce((s, t) => s + t.ars_amount, 0);
  const fxUSD = fxTransactions.reduce((s, t) => s + t.usd_amount, 0);

  const balanceARS   = initialARS + incomeARS - cashExpARS - fxARS - paidTC_ARS;
  const balanceUSD   = initialUSD + incomeUSD - cashExpUSD + fxUSD - paidTC_USD;
  const projectedARS = balanceARS - pendingTC_ARS;
  const projectedUSD = balanceUSD - pendingTC_USD;

  return (
    <div className="space-y-4">
      {/* ── Saldo ARS ── */}
      <SaldoCard
        currency="ARS"
        balance={balanceARS}
        projected={projectedARS}
        pendingTC={pendingTC_ARS}
        config={config}
        onUpdateConfig={onUpdateConfig}
      />

      {/* ── Saldo USD ── */}
      <SaldoCard
        currency="USD"
        balance={balanceUSD}
        projected={projectedUSD}
        pendingTC={pendingTC_USD}
        config={config}
        onUpdateConfig={onUpdateConfig}
      />

      {/* ── Compra de dólares ── */}
      <Button
        className="w-full gap-2 bg-[#2d5016] hover:bg-[#3a6b1d] border-0"
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
  currency, balance, projected, pendingTC, config, onUpdateConfig,
}: {
  currency: "ARS" | "USD";
  balance: number;
  projected: number;
  pendingTC: number;
  config: SavingsConfig | null;
  onUpdateConfig: (ars: number, usd: number) => Promise<void>;
}) {
  const [editInitial, setEditInitial] = useState(false);
  const [initialInput, setInitialInput] = useState("");
  const [saving, setSaving] = useState(false);

  const isARS     = currency === "ARS";
  const label     = isARS ? "Pesos (ARS)" : "Dólares (USD)";
  const isPositive = balance >= 0;
  const hasPending = pendingTC > 0;

  const handleSaveInitial = async () => {
    if (!config) return;
    const val = parseAmount(initialInput);
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
            onClick={() => {
              const initial = isARS ? (config?.initial_ars ?? 0) : (config?.initial_usd ?? 0);
              setInitialInput(initial.toString());
              setEditInitial(e => !e);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Saldo principal */}
        <p className={`text-3xl font-bold ${isPositive ? "" : "text-destructive"}`}>
          {formatCurrency(balance, currency)}
        </p>

        {/* Edit saldo inicial inline */}
        {editInitial && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Saldo inicial</span>
            <Input
              type="text"
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
        )}

        {/* TC pendiente */}
        {hasPending && (
          <div className="flex items-center justify-between rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
            <span className="flex items-center gap-1.5 text-amber-400 text-xs">
              <AlertTriangle className="h-3 w-3" />
              TC pendiente de pago
            </span>
            <div className="text-right">
              <p className="text-amber-400 font-medium text-xs">− {formatCurrency(pendingTC, currency)}</p>
              <p className="text-[10px] text-muted-foreground">
                Proyectado:{" "}
                <span className={projected >= 0 ? "text-amber-400" : "text-destructive"}>
                  {formatCurrency(projected, currency)}
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
  const ars  = parseAmount(arsAmount);
  const rate = parseAmount(exchangeRate);
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
          type="text"
          placeholder="50000"
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
          type="text"
          placeholder="1150"
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
