"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Pencil, Check, X, Trash2, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  const [newCardOpen, setNewCardOpen]        = useState(false);
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

  const handleCreateCard = async (data: {
    name: string; card_type: "visa" | "master"; closing_day: number; due_day: number;
  }) => {
    try {
      await upsertCreditCard(data);
      toast({ title: `✅ Tarjeta "${data.name}" creada` });
      setNewCardOpen(false);
      load();
    } catch {
      toast({ title: "Error al crear tarjeta", variant: "destructive" });
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
        <h1 className="text-xl font-bold tracking-tight">Tarjetas</h1>
        <p className="text-muted-foreground text-xs">Tus tarjetas de crédito</p>
      </div>

      {/* Branding */}
      <Card className="mb-5 border-0 bg-gradient-to-br from-[#2d5016]/15 to-[#4a7c3f]/10">
        <CardContent className="p-4 flex items-center gap-4">
          <FinzaLogo size="lg" />
          <div>
            <p className="text-xs text-muted-foreground">Versión 1.0</p>
            <p className="text-xs text-muted-foreground">Tus finanzas en un solo lugar</p>
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

      {/* Botón nueva tarjeta */}
      <Button
        className="w-full gap-2 bg-[#2d5016] hover:bg-[#3a6b1d] border-0 mb-5"
        onClick={() => setNewCardOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Nueva tarjeta
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

      {/* Dialog nueva tarjeta */}
      <Dialog open={newCardOpen} onOpenChange={setNewCardOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Nueva tarjeta</DialogTitle>
          </DialogHeader>
          <NewCardForm onSave={handleCreateCard} onCancel={() => setNewCardOpen(false)} />
        </DialogContent>
      </Dialog>
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
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#2d5016] to-[#4a7c3f] flex items-center justify-center shrink-0">
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
        type="number" min="1" max="31"
        value={value} onChange={e => onChange(e.target.value)}
        inputMode="numeric" className="h-8 text-sm"
      />
    </div>
  );
}

function validDay(d: number) { return !isNaN(d) && d >= 1 && d <= 31; }

// ─── NewCardForm ───────────────────────────────────────────────────────────────

function NewCardForm({
  onSave, onCancel,
}: {
  onSave: (data: { name: string; card_type: "visa" | "master"; closing_day: number; due_day: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,       setName]       = useState("");
  const [cardType,   setCardType]   = useState<"visa" | "master">("visa");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay,     setDueDay]     = useState("12");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cd = parseInt(closingDay), dd = parseInt(dueDay);
    if (!name.trim()) { setError("Ingresá un nombre"); return; }
    if (!validDay(cd)) { setError("Día de cierre inválido (1-31)"); return; }
    if (!validDay(dd)) { setError("Día de vencimiento inválido (1-31)"); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), card_type: cardType, closing_day: cd, due_day: dd });
    } catch {
      setError("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <Label className="text-xs mb-1.5 block">Nombre de la tarjeta</Label>
        <Input
          placeholder="Ej: Visa Galicia, Master BBVA..."
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          required
        />
      </div>

      {/* Tipo */}
      <div>
        <Label className="text-xs mb-1.5 block">Tipo</Label>
        <Select value={cardType} onValueChange={v => setCardType(v as "visa" | "master")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="visa">Visa</SelectItem>
            <SelectItem value="master">Mastercard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Días */}
      <div className="grid grid-cols-2 gap-2">
        <DayInput label="Día de cierre" value={closingDay} onChange={setClosingDay} />
        <DayInput label="Día de vencimiento" value={dueDay} onChange={setDueDay} />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1 gap-1.5" disabled={saving}>
          <Plus className="h-4 w-4" />
          {saving ? "Guardando..." : "Crear tarjeta"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
