"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { getCreditCards, getExpenses, deleteExpense, getMonthlyConfigs } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { CreditCard, CreditCardMonthlyConfig, Expense, ExpenseCategory } from "@/types";
import {
  CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS,
  PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS
} from "@/types";
import { FinzaLogo } from "@/components/layout/finza-logo";

export default function GastosPage() {
  const [expenses, setExpenses]             = useState<Expense[]>([]);
  const [cards, setCards]                   = useState<CreditCard[]>([]);
  const [monthlyConfigs, setMonthlyConfigs] = useState<CreditCardMonthlyConfig[]>([]);
  const [loading, setLoading]               = useState(true);
  const [open, setOpen]                     = useState(false);
  const [search, setSearch]                 = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const { toast } = useToast();

  const load = async () => {
    const [e, c, mc] = await Promise.all([getExpenses(), getCreditCards(), getMonthlyConfigs()]);
    setExpenses(e);
    setCards(c);
    setMonthlyConfigs(mc);
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

  // Filtros locales
  const visible = expenses.filter(e => {
    const matchCat    = filterCat === "all" || e.category === filterCat;
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gastos</h1>
          <p className="text-muted-foreground text-xs">{expenses.length} registros</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0">
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo gasto</DialogTitle>
            </DialogHeader>
            <ExpenseForm cards={cards} monthlyConfigs={monthlyConfigs} onSaved={handleSaved} />
          </DialogContent>
        </Dialog>
      </div>

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
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {CATEGORY_ICONS[value]} {label}
                </SelectItem>
              )
            )}
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
            const card   = cards.find(c => c.id === expense.credit_card_id);
            const colors = CATEGORY_COLORS[expense.category];
            return (
              <div key={expense.id}>
                <div className="flex items-center gap-3 px-4 py-3 bg-card">
                  {/* Ícono de categoría */}
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-base ${colors.bg}`}>
                    {CATEGORY_ICONS[expense.category]}
                  </div>

                  {/* Info */}
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
                      <span className={`text-[10px] font-medium ${colors.text}`}>
                        {CATEGORY_LABELS[expense.category]}
                      </span>
                      <span className="text-muted-foreground text-[10px]">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {PAYMENT_METHOD_ICONS[expense.payment_method]} {PAYMENT_METHOD_LABELS[expense.payment_method]}
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

                  {/* Monto + eliminar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${expense.currency === "USD" ? "text-emerald-400" : ""}`}>
                        {formatCurrency(expense.amount, expense.currency)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(expense.date)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
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
    </div>
  );
}
