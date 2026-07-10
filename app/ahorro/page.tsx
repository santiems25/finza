"use client";

import { useEffect, useState, useCallback } from "react";
import { Landmark } from "lucide-react";
import { SavingsOverview } from "@/components/ahorro/savings-overview";
import { AccountsManager } from "@/components/ahorro/accounts-manager";
import {
  getExpenses, getIncomes, getFxTransactions,
  addFxTransaction, deleteFxTransaction,
  getBillingPayments, getCreditCards,
  getAccounts, upsertAccount, deleteAccount,
  getTransfers, addTransfer, deleteTransfer,
} from "@/lib/supabase";
import type {
  Expense, Income, FxTransaction, BillingPayment, Account, CreditCard, AccountTransfer,
} from "@/types";
import type { BalanceData } from "@/lib/balances";
import { Separator } from "@/components/ui/separator";

export default function AhorroPage() {
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [incomes, setIncomes]             = useState<Income[]>([]);
  const [fxTxs, setFxTxs]                 = useState<FxTransaction[]>([]);
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([]);
  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [cards, setCards]                 = useState<CreditCard[]>([]);
  const [transfers, setTransfers]         = useState<AccountTransfer[]>([]);
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    const [exp, inc, fx, bp, acc, crd, trf] = await Promise.all([
      getExpenses(),
      getIncomes(),
      getFxTransactions(),
      getBillingPayments(),
      getAccounts(),
      getCreditCards(),
      getTransfers(),
    ]);
    setExpenses(exp);
    setIncomes(inc);
    setFxTxs(fx);
    setBillingPayments(bp);
    setAccounts(acc);
    setCards(crd);
    setTransfers(trf);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const data: BalanceData = {
    expenses,
    incomes,
    cards,
    billingPayments,
    fxTransactions: fxTxs,
    transfers,
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-28 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Ahorro
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Saldo actualizado con ingresos y egresos
        </p>
      </div>

      <SavingsOverview
        accounts={accounts}
        data={data}
        onAddFx={async (tx) => { await addFxTransaction(tx); load(); }}
        onDeleteFx={async (id) => { await deleteFxTransaction(id); load(); }}
      />

      <Separator className="my-6" />

      <AccountsManager
        accounts={accounts}
        data={data}
        onUpsert={async (a) => { await upsertAccount(a); load(); }}
        onDelete={async (id) => { await deleteAccount(id); load(); }}
        onAddTransfer={async (t) => { await addTransfer(t); load(); }}
        onDeleteTransfer={async (id) => { await deleteTransfer(id); load(); }}
      />
    </div>
  );
}
