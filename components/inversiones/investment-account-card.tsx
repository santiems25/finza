"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, parseAmount } from "@/lib/utils";
import { fetchMepRate } from "@/lib/mep";
import type { Account, AccountTransfer, Currency } from "@/types";

interface Props {
  sourceAccounts: Account[];
  investmentAccountId: string;
  cashArs: number;
  cashUsd: number;
  onAddTransfer: (t: Omit<AccountTransfer, "id" | "created_at">) => Promise<void>;
}

export function InvestmentAccountCard({
  sourceAccounts, investmentAccountId, cashArs, cashUsd, onAddTransfer,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mepRate, setMepRate] = useState<number | null>(null);
  const [loadingMep, setLoadingMep] = useState(false);

  const loadMep = async () => {
    setLoadingMep(true);
    try {
      setMepRate(await fetchMepRate());
    } finally {
      setLoadingMep(false);
    }
  };

  useEffect(() => { loadMep(); }, []);

  // Todo el "valor en moneda" expresado en dólares (los pesos se dolarizan
  // al MEP), para poder compararlo de una con el resto del portafolio.
  const cashArsInUsd = mepRate ? cashArs / mepRate : null;
  const totalUsd = cashUsd + (cashArsInUsd ?? 0);

  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Valor en moneda
          </p>
          {sourceAccounts.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)}>
              <ArrowDownToLine className="h-3.5 w-3.5" /> Transferir fondos
            </Button>
          )}
        </div>
        <p className="text-xl font-bold">{formatCurrency(totalUsd, "USD")}</p>
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
          <span>{formatCurrency(cashUsd, "USD")} propios</span>
          {cashArs !== 0 && (
            <>
              <span>+</span>
              <span>
                {formatCurrency(cashArs, "ARS")}
                {mepRate ? ` (dolarizado al MEP $${mepRate.toFixed(0)})` : " (sin cotización MEP)"}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={loadMep}
            disabled={loadingMep}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${loadingMep ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Plata disponible en tu cuenta de Inversiones sin invertir todavía
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Transferir a Inversiones</DialogTitle>
          </DialogHeader>
          <TransferInForm
            sourceAccounts={sourceAccounts}
            investmentAccountId={investmentAccountId}
            onSave={async (t) => { await onAddTransfer(t); setOpen(false); }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const today = new Date().toISOString().split("T")[0];

function TransferInForm({
  sourceAccounts, investmentAccountId, onSave, onCancel,
}: {
  sourceAccounts: Account[];
  investmentAccountId: string;
  onSave: (t: Omit<AccountTransfer, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}) {
  const [fromId,   setFromId]   = useState(sourceAccounts[0]?.id ?? "");
  const [amount,   setAmount]   = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = parseAmount(amount);
    if (amt <= 0) { setError("Ingresá un monto válido"); return; }
    if (!fromId) { setError("Elegí una cuenta de origen"); return; }
    setSaving(true);
    try {
      await onSave({
        from_account_id: fromId,
        to_account_id:   investmentAccountId,
        amount: amt,
        currency,
        date: today,
        notes: null,
      });
    } catch {
      setError("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs mb-1.5 block">Desde</Label>
        <Select value={fromId} onValueChange={setFromId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {sourceAccounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs mb-1.5 block">Monto</Label>
          <Input
            type="text" inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="w-24">
          <Label className="text-xs mb-1.5 block">Moneda</Label>
          <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS $</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1 gap-1.5" disabled={saving}>
          <ArrowDownToLine className="h-4 w-4" />
          {saving ? "Guardando..." : "Transferir"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
