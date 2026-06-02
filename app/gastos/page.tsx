"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { getCreditCards, getExpenses, deleteExpense } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { CreditCard, Expense, ExpenseCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, PAYMENT_METHOD_LABELS } from "@/types";

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const [e, c] = await Promise.all([getExpenses(), getCreditCards()]);
    setExpenses(e);
    setCards(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Gasto eliminado" });
  };

  const handleSaved = () => {
    setOpen(false);
    load();
    toast({ title: "Gasto guardado correctamente" });
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gastos</h1>
          <p className="text-muted-foreground text-sm">{expenses.length} registros</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Nuevo gasto</DialogTitle>
            </DialogHeader>
            <ExpenseForm cards={cards} onSaved={handleSaved} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay gastos registrados</p>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl border overflow-hidden">
          {expenses.map((expense, i) => {
            const card = cards.find((c) => c.id === expense.credit_card_id);
            return (
              <div key={expense.id}>
                <div className="flex items-center gap-3 px-4 py-3 bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{expense.description}</span>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[expense.category as ExpenseCategory]}`}
                        variant="outline"
                      >
                        {CATEGORY_LABELS[expense.category as ExpenseCategory]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatDate(expense.date)}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[expense.payment_method]}
                        {card && ` ${card.name}`}
                      </span>
                      {expense.billing_period && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-primary">{expense.billing_period}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-semibold ${expense.currency === "USD" ? "text-emerald-400" : ""}`}>
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
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
                {i < expenses.length - 1 && <Separator />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
