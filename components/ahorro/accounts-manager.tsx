"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Wallet, Banknote, ArrowRightLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, parseAmount } from "@/lib/utils";
import { accountBalance, totalBalance, type BalanceData } from "@/lib/balances";
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
}

export function AccountsManager({ accounts, data, onUpsert, onDelete, onAddTransfer }: Props) {
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

  const [currency, setCurrency] = useState<Currency>("ARS");

  const total = totalBalance(accounts, data);
  const hasUSD = accounts.some(a => a.initial_usd !== 0) || data.expenses.some(e => e.currency === "USD") || data.incomes.some(i => i.currency === "USD");

  // Solo cuentas con algún importe asociado a la moneda seleccionada
  const accountsWithBalances = accounts.map(a => ({ account: a, bal: accountBalance(a, data) }));
  const visibleAccounts = accountsWithBalances.filter(({ account, bal }) =>
    currency === "ARS"
      ? (bal.ars !== 0 || account.initial_ars !== 0)
      : (bal.usd !== 0 || account.initial_usd !== 0)
  );

  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="p-5 space-y-4">
        {/* Total acoplado con las cuentas que lo componen */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Ahorro total
            </p>
            {hasUSD && (
              <div className="flex rounded-full bg-muted p-0.5 gap-0.5">
                {(["ARS", "USD"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      currency === c ? "bg-background text-foreground shadow" : "text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p
            className="text-[2.25rem] leading-tight font-bold tracking-tight"
            style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" }}
          >
            {formatCurrency(currency === "ARS" ? total.ars : total.usd, currency)}
          </p>
        </div>

        {/* Botones */}
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

        <Separator />

        {/* Cuentas que componen el total, en la moneda seleccionada */}
        {accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No hay cuentas. Creá una para rastrear el saldo por banco.
          </p>
        ) : visibleAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Ninguna cuenta tiene movimientos en {currency}.
          </p>
        ) : (
          <div className="-mx-5">
            {visibleAccounts.map(({ account, bal }, i) => (
              <div key={account.id}>
                <div className="flex items-center gap-3 px-5 py-2.5">
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
                    <p className={`text-xs font-medium mt-0.5 ${
                      (currency === "ARS" ? bal.ars : bal.usd) >= 0 ? "text-primary" : "text-destructive"
                    }`}>
                      {formatCurrency(currency === "ARS" ? bal.ars : bal.usd, currency)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(account)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(account)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {i < visibleAccounts.length - 1 && <Separator />}
              </div>
            ))}
          </div>
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
      </CardContent>
    </Card>
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
