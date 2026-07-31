"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, parseAmount } from "@/lib/utils";
import type { Account, FxTransaction } from "@/types";

const today = new Date().toISOString().split("T")[0];

interface Props {
  accounts: Account[];
  onAddFx: (tx: Omit<FxTransaction, "id" | "created_at">) => Promise<void>;
}

export function BuyDollarsButton({ accounts, onAddFx }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="w-full gap-2 bg-[#2d5016] hover:bg-[#3a6b1d] border-0"
        onClick={() => setOpen(true)}
      >
        <ArrowRightLeft className="h-4 w-4" />
        Comprar dólares
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Comprar dólares</DialogTitle>
          </DialogHeader>
          <FxForm
            accounts={accounts}
            onSaved={async tx => { await onAddFx(tx); setOpen(false); }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
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
