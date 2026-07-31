"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { IncomeForm } from "@/components/dashboard/income-form";
import {
  getCreditCards, getMonthlyConfigs, getAccounts, getCustomCategories,
} from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type {
  CreditCard, CreditCardMonthlyConfig, Account, ExpenseCustomCategory,
} from "@/types";

/** Evento global: cualquier pantalla que muestre gastos/ingresos puede
 *  escucharlo para refrescar sus datos tras un alta hecha desde el botón
 *  flotante (útil si se agrega un movimiento estando en otra sección). */
export const MOVEMENT_SAVED_EVENT = "finems:movement-saved";

const today = new Date().toISOString().split("T")[0];

/** Botón "+" flotante en la barra de navegación: agrega un gasto o ingreso
 *  sin importar en qué sección de la app estés. */
export function QuickAddMovementButton() {
  const [open, setOpen] = useState(false);
  const [movementType, setMovementType] = useState<"gasto" | "ingreso">("gasto");
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [monthlyConfigs, setMonthlyConfigs] = useState<CreditCardMonthlyConfig[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customCategories, setCustomCategories] = useState<ExpenseCustomCategory[]>([]);
  const { toast } = useToast();

  const loadFormData = async () => {
    try {
      const [c, mc, acc, cats] = await Promise.all([
        getCreditCards(), getMonthlyConfigs(), getAccounts(), getCustomCategories(),
      ]);
      setCards(c);
      setMonthlyConfigs(mc);
      setAccounts(acc);
      setCustomCategories(cats);
    } catch {
      // Sin sesión (ej. login/register) — el botón no debería estar visible ahí
    }
  };

  useEffect(() => { loadFormData(); }, []);

  const handleSaved = (message: string) => {
    setOpen(false);
    window.dispatchEvent(new Event(MOVEMENT_SAVED_EVENT));
    toast({ title: message });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Nuevo movimiento"
        className="h-14 w-14 rounded-full bg-[#2d5016] hover:bg-[#3a6b1d] border-4 border-background shadow-lg flex items-center justify-center text-white transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>

          <div className="flex rounded-lg bg-muted p-1 gap-1 mb-1">
            <button
              onClick={() => setMovementType("gasto")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                movementType === "gasto" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gasto
            </button>
            <button
              onClick={() => setMovementType("ingreso")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                movementType === "ingreso" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ingreso
            </button>
          </div>

          {movementType === "gasto" ? (
            <ExpenseForm
              cards={cards}
              monthlyConfigs={monthlyConfigs}
              accounts={accounts}
              customCategories={customCategories}
              onCategoriesChanged={loadFormData}
              onSaved={() => handleSaved("✅ Gasto guardado")}
            />
          ) : (
            <IncomeForm
              defaultDate={today}
              onSaved={() => handleSaved("✅ Ingreso registrado")}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
