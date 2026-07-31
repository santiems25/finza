"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Account, FxTransaction } from "@/types";

interface Props {
  accounts: Account[];
  transactions: FxTransaction[];
  onDeleteFx: (id: string) => Promise<void>;
}

export function DollarPurchaseHistory({ accounts, transactions, onDeleteFx }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (transactions.length === 0) return null;

  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <button className="w-full text-left" onClick={() => setExpanded(e => !e)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Historial de compra
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {transactions.length}
              </Badge>
            </CardTitle>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-0 rounded-lg border overflow-hidden">
          {transactions.map((tx, i) => {
            const account = accounts.find(a => a.id === tx.account_id);
            return (
              <div key={tx.id}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0 text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatDate(tx.date)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        ${tx.exchange_rate.toLocaleString("es-AR")}/USD
                      </span>
                      {account && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{account.name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-destructive">
                        − {formatCurrency(tx.ars_amount, "ARS")}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-emerald-400">
                        + {formatCurrency(tx.usd_amount, "USD")}
                      </span>
                    </div>
                    {tx.notes && (
                      <p className="text-muted-foreground/70 truncate">{tx.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onDeleteFx(tx.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {i < transactions.length - 1 && <Separator />}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
