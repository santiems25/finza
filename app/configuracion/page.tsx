"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Pencil, Check, X, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getCreditCards, upsertCreditCard,
  getMonthlyConfigs, upsertMonthlyConfig, deleteMonthlyConfig,
  signOut,
} from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { FinzaLogo } from "@/components/layout/finza-logo";
import { getMonthName } from "@/lib/utils";
import type { CreditCard as CreditCardType, CreditCardMonthlyConfig } from "@/types";

/** Devuelve los próximos `n` meses (incluyendo el actual) */
function getMonthRange(pastMonths = 1, futureMonths = 5) {
  const now = new Date();
  const months: { month: number; year: number }[] = [];
  for (let i = -pastMonths; i <= futureMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear() });
  }
  return months;
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const [cards, setCards]                   = useState<CreditCardType[]>([]);
  const [monthlyConfigs, setMonthlyConfigs] = useState<CreditCardMonthlyConfig[]>([]);
  const [loading, setLoading]               = useState(true);
  const [loggingOut, setLoggingOut]         = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      toast({ title: "Error al cerrar sesión", variant: "destructive" });
      setLoggingOut(false);
    }
  };

  const load = useCallback(async () => {
    const [c, mc] = await Promise.all([getCreditCards(), getMonthlyConfigs()]);
    setCards(c);
    setMonthlyConfigs(mc);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveHabitual = async (card: CreditCardType) => {
    try {
      await upsertCreditCard(card);
      toast({ title: `✅ ${card.name} actualizada` });
      load();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const handleSaveMonthly = async (
    cfg: Omit<CreditCardMonthlyConfig, "id" | "created_at">
  ) => {
    try {
      await upsertMonthlyConfig(cfg);
      toast({ title: "✅ Guardado" });
      load();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const handleDeleteMonthly = async (id: string) => {
    try {
      await deleteMonthlyConfig(id);
      load();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-xs">Tarjetas de crédito</p>
      </div>

      {/* Branding */}
      <Card className="mb-5 border-0 bg-gradient-to-br from-blue-950/60 to-violet-950/60">
        <CardContent className="p-4 flex items-center gap-4">
          <FinzaLogo size="lg" />
          <div>
            <p className="text-xs text-muted-foreground">Versión 1.0</p>
            <p className="text-xs text-muted-foreground">Finanzas personales</p>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50 mb-5"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        <LogOut className="h-4 w-4" />
        {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
      </Button>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map(i => (
            <div key={i} className="h-72 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {cards.map(card => (
            <CardSection
              key={card.id}
              card={card}
              monthlyConfigs={monthlyConfigs.filter(mc => mc.credit_card_id === card.id)}
              onSaveHabitual={handleSaveHabitual}
              onSaveMonthly={handleSaveMonthly}
              onDeleteMonthly={handleDeleteMonthly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CardSection ──────────────────────────────────────────────────────────────

function CardSection({
  card, monthlyConfigs, onSaveHabitual, onSaveMonthly, onDeleteMonthly,
}: {
  card: CreditCardType;
  monthlyConfigs: CreditCardMonthlyConfig[];
  onSaveHabitual: (c: CreditCardType) => void;
  onSaveMonthly: (cfg: Omit<CreditCardMonthlyConfig, "id" | "created_at">) => void;
  onDeleteMonthly: (id: string) => void;
}) {
  const months = getMonthRange(1, 5);
  const now    = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <CreditCard className="h-3.5 w-3.5 text-white" />
          </div>
          {card.name}
          <Badge variant="outline" className="capitalize text-xs ml-auto">{card.card_type}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Días habituales */}
        <HabitualDays card={card} onSave={onSaveHabitual} />

        <Separator />

        {/* Meses */}
        <div className="space-y-1.5">
          {months.map(({ month, year }) => {
            const isCurrent = month === now.getMonth() && year === now.getFullYear();
            const override  = monthlyConfigs.find(mc => mc.month === month && mc.year === year);
            return (
              <MonthRow
                key={`${year}-${month}`}
                card={card}
                month={month}
                year={year}
                isCurrent={isCurrent}
                override={override}
                onSave={onSaveMonthly}
                onDelete={onDeleteMonthly}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── HabitualDays ─────────────────────────────────────────────────────────────

function HabitualDays({
  card,
  onSave,
}: {
  card: CreditCardType;
  onSave: (c: CreditCardType) => void;
}) {
  const [closingDay, setClosingDay] = useState(card.closing_day.toString());
  const [dueDay,     setDueDay]     = useState(card.due_day.toString());
  const [editing,   setEditing]     = useState(false);
  const [saving,    setSaving]      = useState(false);

  const isDirty = parseInt(closingDay) !== card.closing_day || parseInt(dueDay) !== card.due_day;

  const handleSave = async () => {
    const cd = parseInt(closingDay), dd = parseInt(dueDay);
    if (!validDay(cd) || !validDay(dd)) return;
    setSaving(true);
    await onSave({ ...card, closing_day: cd, due_day: dd });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
      {!editing ? (
        <>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Días habituales</p>
            <p className="text-sm font-medium">
              Cierre <strong>{card.closing_day}</strong> · Vence <strong>{card.due_day}</strong>
            </p>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground shrink-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <div className="w-full space-y-2.5">
          <p className="text-xs text-muted-foreground">Días habituales</p>
          <div className="grid grid-cols-2 gap-2">
            <DayInput label="Cierre" value={closingDay} onChange={setClosingDay} />
            <DayInput label="Vencimiento" value={dueDay} onChange={setDueDay} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={handleSave} disabled={!isDirty || saving}>
              <Check className="h-3 w-3" />{saving ? "..." : "Guardar"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-3" onClick={() => { setEditing(false); setClosingDay(card.closing_day.toString()); setDueDay(card.due_day.toString()); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MonthRow ─────────────────────────────────────────────────────────────────

function MonthRow({
  card, month, year, isCurrent, override, onSave, onDelete,
}: {
  card: CreditCardType;
  month: number;
  year: number;
  isCurrent: boolean;
  override?: CreditCardMonthlyConfig;
  onSave: (cfg: Omit<CreditCardMonthlyConfig, "id" | "created_at">) => void;
  onDelete: (id: string) => void;
}) {
  const displayClosing = override?.closing_day ?? card.closing_day;
  const displayDue     = override?.due_day     ?? card.due_day;

  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [closingDay, setClosingDay] = useState(displayClosing.toString());
  const [dueDay,     setDueDay]     = useState(displayDue.toString());

  // Sync cuando cambia override (tras reload)
  useEffect(() => {
    setClosingDay(displayClosing.toString());
    setDueDay(displayDue.toString());
  }, [displayClosing, displayDue]);

  const handleSave = async () => {
    const cd = parseInt(closingDay), dd = parseInt(dueDay);
    if (!validDay(cd) || !validDay(dd)) return;
    setSaving(true);
    await onSave({ credit_card_id: card.id, month, year, closing_day: cd, due_day: dd });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setClosingDay(displayClosing.toString());
    setDueDay(displayDue.toString());
    setEditing(false);
  };

  return (
    <div className={`rounded-lg px-3 py-2.5 transition-colors ${
      isCurrent ? "bg-primary/8 border border-primary/20" : "bg-muted/25"
    }`}>
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">
              {getMonthName(month)} {year}
            </span>
            {isCurrent && (
              <Badge className="text-[10px] h-4 px-1.5 shrink-0">Actual</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              Cierre <strong className="text-foreground">{displayClosing}</strong>
              {" · "}
              Vence <strong className="text-foreground">{displayDue}</strong>
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              {override && (
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(override.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs font-medium">{getMonthName(month)} {year}</p>
          <div className="grid grid-cols-2 gap-2">
            <DayInput label="Cierre" value={closingDay} onChange={setClosingDay} />
            <DayInput label="Vencimiento" value={dueDay} onChange={setDueDay} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
              <Check className="h-3 w-3" />{saving ? "..." : "Guardar"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-3" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DayInput / helpers ───────────────────────────────────────────────────────

function DayInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] mb-1 block text-muted-foreground">{label}</Label>
      <Input
        type="number" min="1" max="28"
        value={value} onChange={e => onChange(e.target.value)}
        inputMode="numeric" className="h-8 text-sm"
        max="31"
      />
    </div>
  );
}

function validDay(d: number) { return !isNaN(d) && d >= 1 && d <= 31; }
