"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { BillingSummaryTab } from "@/components/gastos/billing-summary-tab";
import { CategoriesManager } from "@/components/gastos/categories-manager";
import {
  getCreditCards, getExpenses, deleteExpense, getMonthlyConfigs, getBillingPayments,
  getAccounts, getCustomCategories, upsertCustomCategory, deleteCustomCategory,
} from "@/lib/supabase";
import { formatCurrency, formatDate, getCategoryMeta } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type {
  CreditCard, CreditCardMonthlyConfig, Expense, BillingPayment,
  Account, ExpenseCustomCategory,
} from "@/types";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from "@/types";

type ActiveTab = "movimientos" | "resumenes" | "categorias";

export default function GastosPage() {
  const [expenses, setExpenses]               = useState<Expense[]>([]);
  const [cards, setCards]                     = useState<CreditCard[]>([]);
  const [monthlyConfigs, setMonthlyConfigs]   = useState<CreditCardMonthlyConfig[]>([]);
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([]);
  const [accounts, setAccounts]               = useState<Account[]>([]);
  const [customCategories, setCustomCategories] = useState<ExpenseCustomCategory[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [open, setOpen]                     = useState(false);
  const [search, setSearch]                 = useState("");
  const [filterCat, setFilterCat]           = useState<string>("all");
  const [activeTab, setActiveTab]           = useState<ActiveTab>("movimientos");
  const { toast } = useToast();

  const load = async () => {
    const [e, c, mc, bp, acc, cats] = await Promise.all([
      getExpenses(), getCreditCards(), getMonthlyConfigs(), getBillingPayments(),
      getAccounts(), getCustomCategories(),
    ]);
    setExpenses(e);
    setCards(c);
    setMonthlyConfigs(mc);
    setBillingPayments(bp);
    setAccounts(acc);
    setCustomCategories(cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast({ title: "Gasto eliminado" });
  };

  const handleSaved = () => {
    setOpen(false);
    load();
    toast({ title: "✅ Gasto guardado" });
  };

  // Cuántos resúmenes TC hay pendientes (para el badge en la tab)
  const creditExpenses = expenses.filter(e => e.payment_method === "credito" && e.billing_period);
  const pendingCount = (() => {
    const seen = new Set<string>();
    for (const e of creditExpenses) {
      if (!e.credit_card_id || e.billing_month == null || e.billing_year == null) continue;
      const key = `${e.credit_card_id}-${e.billing_year}-${e.billing_month}`;
      if (!seen.has(key)) {
        seen.add(key);
      }
    }
    const paidKeys = new Set(
      billingPayments.map(p => `${p.credit_card_id}-${p.billing_year}-${p.billing_month}`)
    );
    return [...seen].filter(k => !paidKeys.has(k)).length;
  })();

  // Filtros para movimientos
  const visible = expenses.filter(e => {
    const matchCat    = filterCat === "all" || e.category === filterCat;
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="px-4 pt-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gastos</h1>
          <p className="text-muted-foreground text-xs">{expenses.length} registros</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-1.5 bg-[#2d5016] hover:bg-[#3a6b1d] border-0"
            >
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo gasto</DialogTitle>
            </DialogHeader>
            <ExpenseForm
              cards={cards}
              monthlyConfigs={monthlyConfigs}
              accounts={accounts}
              customCategories={customCategories}
              onSaved={handleSaved}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Tabs ── */}
      <div className="flex rounded-lg bg-muted p-1 gap-1 mb-4">
        <button
          onClick={() => setActiveTab("movimientos")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            activeTab === "movimientos"
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Movimientos
        </button>
        <button
          onClick={() => setActiveTab("resumenes")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "resumenes"
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Resúmenes TC
          {pendingCount > 0 && (
            <span className={`inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold ${
              activeTab === "resumenes" ? "bg-primary text-primary-foreground" : "bg-amber-500 text-white"
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("categorias")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            activeTab === "categorias"
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Categorías
        </button>
      </div>

      {/* ── Tab: Movimientos ── */}
      {activeTab === "movimientos" && (
        <>
          {/* Filtros */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {customCategories.map(cat => (
                  <SelectItem key={cat.id} value={`custom_${cat.id}`}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">Sin resultados</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              {visible.map((expense, i) => {
                const card = cards.find(c => c.id === expense.credit_card_id);
                const { icon: catIcon, label: catLabel, bg: catBg, text: catText } =
                  getCategoryMeta(expense.category, customCategories);
                return (
                  <div key={expense.id}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-card">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-base ${catBg}`}>
                        {catIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{expense.description}</span>
                          {expense.total_installments > 1 && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {expense.installment_number}/{expense.total_installments}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-medium ${catText}`}>
                            {catLabel}
                          </span>
                          <span className="text-muted-foreground text-[10px]">·</span>
                          <span className="text-[10px] text-muted-foreground">
                            {PAYMENT_METHOD_ICONS[expense.payment_method]}{" "}
                            {PAYMENT_METHOD_LABELS[expense.payment_method]}
                            {card && ` ${card.name}`}
                          </span>
                          {expense.billing_period && (
                            <>
                              <span className="text-muted-foreground text-[10px]">·</span>
                              <span className="text-[10px] text-primary">{expense.billing_period}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${expense.currency === "USD" ? "text-emerald-400" : ""}`}>
                            {formatCurrency(expense.amount, expense.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(expense.date)}</p>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {i < visible.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Resúmenes TC ── */}
      {activeTab === "resumenes" && (
        <BillingSummaryTab
          expenses={expenses}
          cards={cards}
          monthlyConfigs={monthlyConfigs}
          billingPayments={billingPayments}
          customCategories={customCategories}
          onPaymentToggled={load}
        />
      )}

      {/* ── Tab: Categorías ── */}
      {activeTab === "categorias" && (
        <CategoriesManager
          categories={customCategories}
          onUpsert={async (cat) => { await upsertCustomCategory(cat); load(); }}
          onDelete={async (id) => { await deleteCustomCategory(id); load(); }}
        />
      )}
    </div>
  );
}
