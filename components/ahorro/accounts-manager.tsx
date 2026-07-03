"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Building2, Wallet, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency, parseAmount } from "@/lib/utils";
import type { Account, Expense, Income, CreditCard, BillingPayment } from "@/types";

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
  expenses: Expense[];
  incomes: Income[];
  cards: CreditCard[];
  billingPayments: BillingPayment[];
  onUpsert: (a: Partial<Account>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CASH_METHODS = ["efectivo", "debito", "mercado_pago"];

export function AccountsManager({ accounts, expenses, incomes, cards, billingPayments, onUpsert, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

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

  // Balance por cuenta:
  //   initial + incomes − gastos cash de la cuenta − gastos de TC pagados
  //   cuya tarjeta está vinculada a esta cuenta
  const balanceOf = (account: Account) => {
    const isTCPaid = (e: Expense) =>
      billingPayments.some(
        p =>
          p.credit_card_id === e.credit_card_id &&
          p.billing_month  === e.billing_month  &&
          p.billing_year   === e.billing_year
      );

    // IDs de tarjetas vinculadas a esta cuenta
    const linkedCardIds = new Set(
      cards.filter(c => c.account_id === account.id).map(c => c.id)
    );

    const belongsToAccount = (e: Expense) => {
      if (CASH_METHODS.includes(e.payment_method)) return e.account_id === account.id;
      if (e.payment_method === "credito") {
        // Gasto de TC: pertenece a la cuenta si la tarjeta está vinculada,
        // y se descuenta solo cuando el resumen fue pagado
        return !!e.credit_card_id && linkedCardIds.has(e.credit_card_id) && isTCPaid(e);
      }
      return false;
    };

    const incARS = incomes
      .filter(i => i.account_id === account.id && i.currency === "ARS")
      .reduce((s, i) => s + i.amount, 0);
    const incUSD = incomes
      .filter(i => i.account_id === account.id && i.currency === "USD")
      .reduce((s, i) => s + i.amount, 0);
    const expARS = expenses
      .filter(e => e.currency === "ARS" && belongsToAccount(e))
      .reduce((s, e) => s + e.amount, 0);
    const expUSD = expenses
      .filter(e => e.currency === "USD" && belongsToAccount(e))
      .reduce((s, e) => s + e.amount, 0);
    return {
      ars: account.initial_ars + incARS - expARS,
      usd: account.initial_usd + incUSD - expUSD,
    };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cuentas
        </p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Nueva cuenta
        </Button>
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
    </div>
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
