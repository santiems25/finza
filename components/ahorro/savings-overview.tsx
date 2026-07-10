"use client";

import { useState } from "react";
import {
  Trash2, ChevronDown, ChevronUp,
  ArrowRightLeft, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, parseAmount } from "@/lib/utils";
import { totalBalance, pendingTC, type BalanceData } from "@/lib/balances";
import type { Account, FxTransaction } from "@/types";

const today = new Date().toISOString().split("T")[0];

interface Props {
  accounts: Account[];
  data: BalanceData;
  onAddFx: (tx: Omit<FxTransaction, "id" | "created_at">) => Promise<void>;
  onDeleteFx: (id: string) => Promise<void>;
}

export function SavingsOverview({ accounts, data, onAddFx, onDeleteFx }: Props) {
  const [fxOpen, setFxOpen] = useState(false);

  const balance = totalBalance(accounts, data);
  const pending = pendingTC(data.expenses, data.billingPayments);

  return (
    <div className="space-y-4">
      {/* ── Saldo ARS ── */}
      <SaldoCard
        currency="ARS"
        balance={balance.ars}
        pendingTC={pending.ars}
      />

      {/* ── Saldo USD ── */}
      <SaldoCard
        currency="USD"
        balance={balance.usd}
        pendingTC={pending.usd}
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
      {data.fxTransactions.length > 0 && (
        <FxHistory transactions={data.fxTransactions} accounts={accounts} onDelete={onDeleteFx} />
      )}

      {/* ── Dialog compra FX ── */}
      <Dialog open={fxOpen} onOpenChange={setFxOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Comprar dólares</DialogTitle>
          </DialogHeader>
          <FxForm
            accounts={accounts}
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
  currency, balance, pendingTC,
}: {
  currency: "ARS" | "USD";
  balance: number;
  pendingTC: number;
}) {
  const label      = currency === "ARS" ? "Pesos (ARS)" : "Dólares (USD)";
  const isPositive = balance >= 0;
  const hasPending = pendingTC > 0;
  const projected  = balance - pendingTC;

  return (
    <Card className={isPositive ? "border-emerald-500/20" : "border-destructive/20"}>
      <CardContent className="p-4 space-y-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {label} · total entre cuentas
        </p>

        {/* Saldo principal */}
        <p className={`text-3xl font-bold ${isPositive ? "" : "text-destructive"}`}>
          {formatCurrency(balance, currency)}
        </p>

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
  transactions, accounts, onDelete,
}: {
  transactions: FxTransaction[];
  accounts: Account[];
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
          {transactions.map((tx, i) => {
            const account = accounts.find(a => a.id === tx.account_id);
            return (
              <div key={tx.id}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0 text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatDate(tx.date)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        ${tx.exchange_rate.toLocaleString("es-AR")}/USD
                      </span>
                      {account && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{account.name}</span>
                        </>
                      )}
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
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

// ─── FxForm ───────────────────────────────────────────────────────────────────

function FxForm({
  accounts, onSaved, onCancel,
}: {
  accounts: Account[];
  onSaved: (tx: Omit<FxTransaction, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving,       setSaving]       = useState(false);
  const [arsAmount,    setArsAmount]    = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [date,         setDate]         = useState(today);
  const [notes,        setNotes]        = useState("");
  const [accountId,    setAccountId]    = useState(accounts[0]?.id ?? "");

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
        account_id: accountId || null,
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

      {/* Cuenta */}
      {accounts.length > 0 && (
        <div>
          <Label className="text-xs mb-1.5 block">Cuenta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Elegí una cuenta" /></SelectTrigger>
            <SelectContent>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
