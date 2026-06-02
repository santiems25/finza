"use client";

import { useEffect, useState } from "react";
import { CreditCard, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCreditCards, upsertCreditCard } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { CreditCard as CreditCardType } from "@/types";

export default function ConfiguracionPage() {
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    getCreditCards().then((c) => { setCards(c); setLoading(false); });
  }, []);

  const handleSave = async (card: CreditCardType) => {
    try {
      await upsertCreditCard(card);
      toast({ title: `${card.name} actualizada` });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  return (
    <div className="px-4 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">Ajustá tus tarjetas de crédito</p>
      </div>

      {/* Info box sobre la lógica */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Día de cierre:</strong> Último día del período. Los gastos hasta ese día van al resumen del mes actual.</p>
              <p><strong className="text-foreground">Día de vencimiento:</strong> Día del mes siguiente en que debés pagar el resumen.</p>
              <p className="pt-1">Ejemplo: cierre el 5, vencimiento el 20. Un gasto del 3 de junio → resumen de Junio. Un gasto del 10 de junio → resumen de Julio.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Tarjetas
        </h2>
        {loading ? (
          <div className="space-y-3">
            <div className="h-48 bg-muted/50 rounded-xl animate-pulse" />
            <div className="h-48 bg-muted/50 rounded-xl animate-pulse" />
          </div>
        ) : (
          cards.map((card) => (
            <CreditCardEditor key={card.id} card={card} onSave={handleSave} />
          ))
        )}
      </div>

      <Separator className="my-8" />

      {/* Info sobre billing */}
      <div className="space-y-3 pb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Cómo funciona el resumen
        </h2>
        <BillingExampleCard />
      </div>
    </div>
  );
}

function CreditCardEditor({
  card,
  onSave,
}: {
  card: CreditCardType;
  onSave: (card: CreditCardType) => void;
}) {
  const [closingDay, setClosingDay] = useState(card.closing_day.toString());
  const [dueDay, setDueDay] = useState(card.due_day.toString());
  const [saving, setSaving] = useState(false);

  const isDirty =
    parseInt(closingDay) !== card.closing_day || parseInt(dueDay) !== card.due_day;

  const handleSave = async () => {
    const cd = parseInt(closingDay);
    const dd = parseInt(dueDay);
    if (isNaN(cd) || cd < 1 || cd > 28 || isNaN(dd) || dd < 1 || dd > 28) return;
    setSaving(true);
    await onSave({ ...card, closing_day: cd, due_day: dd });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            {card.name}
          </CardTitle>
          <Badge variant="outline" className="capitalize text-xs">
            {card.card_type}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Configurá los días de cierre y vencimiento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1.5 block">Día de cierre</Label>
            <Input
              type="number"
              min="1"
              max="28"
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground mt-1">Día 1–28</p>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Día de vencimiento</Label>
            <Input
              type="number"
              min="1"
              max="28"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground mt-1">Día 1–28</p>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
          <p className="text-muted-foreground">
            Cierra el <strong className="text-foreground">{closingDay || "?"}</strong> de cada mes
          </p>
          <p className="text-muted-foreground">
            Vence el <strong className="text-foreground">{dueDay || "?"}</strong> del mes siguiente
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="w-full gap-2"
          size="sm"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </CardContent>
    </Card>
  );
}

function BillingExampleCard() {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
        <p className="font-medium text-foreground">Ejemplo con cierre el día 5:</p>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Gasto el 3 de junio</span>
            <span className="text-primary font-medium">→ Resumen Junio</span>
          </div>
          <div className="flex justify-between">
            <span>Gasto el 5 de junio</span>
            <span className="text-primary font-medium">→ Resumen Junio</span>
          </div>
          <div className="flex justify-between">
            <span>Gasto el 6 de junio</span>
            <span className="text-amber-400 font-medium">→ Resumen Julio</span>
          </div>
          <div className="flex justify-between">
            <span>Gasto el 30 de junio</span>
            <span className="text-amber-400 font-medium">→ Resumen Julio</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
