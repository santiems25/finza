"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExpenseCustomCategory } from "@/types";

interface Props {
  categories: ExpenseCustomCategory[];
  onUpsert: (cat: Partial<ExpenseCustomCategory>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMOJI_SUGGESTIONS = ["🛒","🏥","🐾","🎮","📚","🎬","🚗","🏠","✈️","🍕","💊","🎁","🔧","💄","🧴","🥗","☕","🍺","🎵","🏋️"];

export function CategoriesManager({ categories, onUpsert, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCustomCategory | null>(null);

  const openNew  = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: ExpenseCustomCategory) => { setEditing(c); setOpen(true); };

  const handleDelete = async (c: ExpenseCustomCategory) => {
    if (!confirm(`¿Eliminar categoría "${c.name}"?`)) return;
    await onDelete(c.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Categorías personalizadas
        </p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Nueva
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No hay categorías personalizadas todavía.
        </p>
      ) : (
        categories.map(cat => (
          <Card key={cat.id} className="border-border/40">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-xl shrink-0">{cat.icon}</span>
              <p className="flex-1 text-sm font-medium">{cat.name}</p>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(cat)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(cat)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            initial={editing ?? undefined}
            onSave={async (data) => { await onUpsert(editing ? { ...editing, ...data } : data); setOpen(false); }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({
  initial, onSave, onCancel,
}: {
  initial?: ExpenseCustomCategory;
  onSave: (data: Partial<ExpenseCustomCategory>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,   setName]   = useState(initial?.name   ?? "");
  const [icon,   setIcon]   = useState(initial?.icon   ?? "📦");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Ingresá un nombre"); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), icon, color: "bg-slate-500/15 text-slate-400" });
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
          placeholder="Salud, Mascota, Videojuegos..."
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus required
        />
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Ícono</Label>
        <Input
          placeholder="Escribí un emoji"
          value={icon}
          onChange={e => setIcon(e.target.value)}
          className="text-xl text-center"
          maxLength={4}
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {EMOJI_SUGGESTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => setIcon(emoji)}
              className={`text-lg p-1 rounded hover:bg-muted transition-colors ${icon === emoji ? "bg-muted ring-1 ring-primary" : ""}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando..." : (initial ? "Guardar" : "Crear")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
