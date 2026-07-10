"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Wallet, Banknote, ArrowRightLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, parseAmount } from "@/lib/utils";
import { accountBalance, type BalanceData } from "@/lib/balances";
import type { Account, AccountTransfer, Currency } from "@/types";

const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  bank:   <Building2 className="h-3.5 w-3.5" />,
  wallet: <Wallet    className="h-3.5 w-3.5" />,
  cash:   <Banknote  className="h-3.5 w-3.5" />,
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank:   "Banco",
  wallet: "Billetera",
  cash:   "Efectivo",
};

interface Props {
  accounts: Account[];
  data: BalanceData;
  onUpsert: (a: Partial<Account>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddTransfer: (t: Omit<AccountTransfer, "id" | "created_at">) => Promise<void>;
  onDeleteTransfer: (id: string) => Promise<void>;
}

export function AccountsManager({ accounts, data, onUpsert, onDelete, onAddTransfer, onDeleteTransfer }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (a: Account) => { setEditing(a); setOpen(true); };

  const handleSave = async (data: Partial<Account>) => {
    await onUpsert(editing ? { ...editing, ...data } : data);
    setOpen(false);
  };

  const handleDelete = async (a: Account) => {
    if (!confirm(`¿Eliminar cuenta "${a.name}"?`)) return;
    await onDelete(a.id);
  };

  const balanceOf = (account: Account) => accountBalance(account, data);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cuentas
        </p>
        <div className="flex gap-1.5">
          {accounts.length >= 2 && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Nueva cuenta
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No hay cuentas. Creá una para rastrear el saldo por banco.
        </p>
      ) : (
        accounts.map(account => {
          const bal = balanceOf(account);
          return (
            <Card key={account.id} className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {ACCOUNT_TYPE_ICONS[account.account_type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{account.name}</p>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {ACCOUNT_TYPE_LABELS[account.account_type]}
                    </Badge>
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    {(bal.ars !== 0 || account.initial_ars !== 0) && (
                      <p className={`text-xs font-medium ${bal.ars >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(bal.ars, "ARS")}
                      </p>
                    )}
                    {(bal.usd !== 0 || account.initial_usd !== 0) && (
                      <p className={`text-xs font-medium ${bal.usd >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(bal.usd, "USD")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(account)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(account)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Historial de transferencias */}
      {data.transfers.length > 0 && (
        <TransferHistory transfers={data.transfers} accounts={accounts} onDelete={onDeleteTransfer} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          </DialogHeader>
          <AccountForm
            initial={editing ?? undefined}
            onSave={handleSave}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog transferencia */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Transferir entre cuentas</DialogTitle>
          </DialogHeader>
          <TransferForm
            accounts={accounts}
            onSave={async (t) => { await onAddTransfer(t); setTransferOpen(false); }}
            onCancel={() => setTransferOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TransferForm ─────────────────────────────────────────────────────────────

const todayStr = new Date().toISOString().split("T")[0];

function TransferForm({
  accounts, onSave, onCancel,
}: {
  accounts: Account[];
  onSave: (t: Omit<AccountTransfer, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}) {
  const [fromId,   setFromId]   = useState(accounts[0]?.id ?? "");
  const [toId,     setToId]     = useState(accounts[1]?.id ?? "");
  const [amount,   setAmount]   = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [date,     setDate]     = useState(todayStr);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = parseAmount(amount);
    if (amt <= 0) { setError("Ingresá un monto válido"); return; }
    if (fromId === toId) { setError("Elegí dos cuentas distintas"); return; }
    setSaving(true);
    try {
      await onSave({
        from_account_id: fromId,
        to_account_id:   toId,
        amount: amt,
        currency,
        date,
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
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Hacia</Label>
        <Select value={toId} onValueChange={setToId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.id !== fromId).map(a => (
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

      <div>
        <Label className="text-xs mb-1.5 block">Fecha</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1 gap-1.5" disabled={saving}>
          <ArrowRightLeft className="h-4 w-4" />
          {saving ? "Guardando..." : "Transferir"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ─── TransferHistory ──────────────────────────────────────────────────────────

function TransferHistory({
  transfers, accounts, onDelete,
}: {
  transfers: AccountTransfer[];
  accounts: Account[];
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const nameOf = (id: string) => accounts.find(a => a.id === id)?.name ?? "?";

  return (
    <Card className="border-border/50">
      <button
        className="w-full text-left px-3 py-2.5 flex items-center justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-xs font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
          Transferencias
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{transfers.length}</Badge>
        </span>
        <span className="text-[10px] text-muted-foreground">{expanded ? "Ocultar" : "Ver"}</span>
      </button>

      {expanded && (
        <CardContent className="pt-0 px-3 pb-3 space-y-2">
          {transfers.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {nameOf(t.from_account_id)} → {nameOf(t.to_account_id)}
                </p>
                <p className="text-[10px] text-muted-foreground">{formatDate(t.date)}</p>
              </div>
              <span className="font-semibold shrink-0">
                {formatCurrency(t.amount, t.currency)}
              </span>
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onDelete(t.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function AccountForm({
  initial, onSave, onCancel,
}: {
  initial?: Account;
  onSave: (data: Partial<Account>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,        setName]        = useState(initial?.name ?? "");
  const [accountType, setAccountType] = useState(initial?.account_type ?? "bank");
  const [initialARS,  setInitialARS]  = useState(initial?.initial_ars?.toString() ?? "0");
  const [initialUSD,  setInitialUSD]  = useState(initial?.initial_usd?.toString() ?? "0");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Ingresá un nombre"); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        account_type: accountType,
        currency: "ARS",
        initial_ars: parseAmount(initialARS),
        initial_usd: parseAmount(initialUSD),
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
        <Label className="text-xs mb-1.5 block">Nombre</Label>
        <Input
          placeholder="BBVA, Mercado Pago, Efectivo..."
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus required
        />
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Tipo</Label>
        <Select value={accountType} onValueChange={v => setAccountType(v as "bank" | "wallet" | "cash")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">🏦 Banco</SelectItem>
            <SelectItem value="wallet">👛 Billetera digital</SelectItem>
            <SelectItem value="cash">💵 Efectivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1.5 block">Saldo inicial ARS</Label>
          <Input
            type="text" inputMode="decimal"
            value={initialARS} onChange={e => setInitialARS(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Saldo inicial USD</Label>
          <Input
            type="text" inputMode="decimal"
            value={initialUSD} onChange={e => setInitialUSD(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando..." : (initial ? "Guardar cambios" : "Crear cuenta")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
