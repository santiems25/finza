"use client";

import { useEffect, useState, useCallback } from "react";
import { Landmark } from "lucide-react";
import { SavingsOverview } from "@/components/ahorro/savings-overview";
import {
  getSavingsConfig, updateSavingsConfig,
  getExpenses, getIncomes, getFxTransactions,
  addFxTransaction, deleteFxTransaction,
  getBillingPayments,
} from "@/lib/supabase";
import type { SavingsConfig, Expense, Income, FxTransaction, BillingPayment } from "@/types";

export default function AhorroPage() {
  const [config, setConfig]               = useState<SavingsConfig | null>(null);
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [incomes, setIncomes]             = useState<Income[]>([]);
  const [fxTxs, setFxTxs]                 = useState<FxTransaction[]>([]);
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    const [cfg, exp, inc, fx, bp] = await Promise.all([
      getSavingsConfig(),
      getExpenses(),
      getIncomes(),
      getFxTransactions(),
      getBillingPayments(),
    ]);
    setConfig(cfg);
    setExpenses(exp);
    setIncomes(inc);
    setFxTxs(fx);
    setBillingPayments(bp);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdateConfig = async (initial_ars: number, initial_usd: number) => {
    if (!config) return;
    await updateSavingsConfig(config.id, { initial_ars, initial_usd });
    load();
  };

  const handleAddFx = async (tx: Omit<FxTransaction, "id" | "created_at">) => {
    await addFxTransaction(tx);
    load();
  };

  const handleDeleteFx = async (id: string) => {
    await deleteFxTransaction(id);
    load();
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
        config={config}
        expenses={expenses}
        incomes={incomes}
        fxTransactions={fxTxs}
        billingPayments={billingPayments}
        onUpdateConfig={handleUpdateConfig}
        onAddFx={handleAddFx}
        onDeleteFx={handleDeleteFx}
      />
    </div>
  );
}
