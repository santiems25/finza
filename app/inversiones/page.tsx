"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { InvestmentForm } from "@/components/inversiones/investment-form";
import { PortfolioChart } from "@/components/inversiones/portfolio-chart";
import { SellDialog } from "@/components/inversiones/sell-dialog";
import { DividendsSection } from "@/components/inversiones/dividends-section";
import { InvestmentAccountCard } from "@/components/inversiones/investment-account-card";
import {
  getInvestments, deleteInvestment, getDividends,
  getAccounts, upsertAccount, getTransfers, addTransfer,
  getFxTransactions,
} from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type {
  Investment, Position, SoldLot, AssetType, Dividend, Account, AccountTransfer, FxTransaction,
} from "@/types";
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from "@/types";

// ─── Tipos de filtro ──────────────────────────────────────────────────────────
type StatusFilter = "activas" | "vendidas" | "todas";

// ─── Helpers de agrupación ────────────────────────────────────────────────────

function groupIntoPositions(
  lots: Investment[],
  prices: Record<string, number | null>
): Position[] {
  const map = new Map<string, Investment[]>();
  for (const lot of lots.filter(l => !l.is_sold)) {
    const key = `${lot.ticker}|${lot.asset_type}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(lot);
  }
  return Array.from(map.entries()).map(([key, lots]) => {
    const [ticker, asset_type] = key.split("|") as [string, AssetType];
    const totalQty    = lots.reduce((s, l) => s + l.quantity, 0);
    const totalCost   = lots.reduce((s, l) => s + l.buy_price * l.quantity, 0);
    const avgBuyPrice = totalCost / totalQty;
    const currentPrice = prices[ticker.toUpperCase()] ?? null;
    const currentValue = currentPrice != null ? currentPrice * totalQty : null;
    const unrealizedPnL = currentValue != null ? currentValue - totalCost : null;
    const unrealizedPnLPct = unrealizedPnL != null && totalCost > 0
      ? (unrealizedPnL / totalCost) * 100 : null;
    return {
      ticker, asset_type, totalQty, totalCost, avgBuyPrice,
      firstBuyDate: lots.map(l => l.buy_date).sort()[0],
      lots,
      currentPrice, currentValue, unrealizedPnL, unrealizedPnLPct,
    };
  }).sort((a, b) => (b.currentValue ?? b.totalCost) - (a.currentValue ?? a.totalCost));
}

function getSoldLots(lots: Investment[]): SoldLot[] {
  return lots
    .filter(l => l.is_sold && l.sell_price != null)
    .map(l => {
      const cost           = l.buy_price * l.quantity;
      const proceeds       = l.sell_price! * l.quantity;
      const realizedPnL    = proceeds - cost;
      const realizedPnLPct = cost > 0 ? (realizedPnL / cost) * 100 : 0;
      return { ...l, realizedPnL, realizedPnLPct };
    })
    .sort((a, b) => new Date(b.sell_date!).getTime() - new Date(a.sell_date!).getTime());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InversionesPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [prices, setPrices]           = useState<Record<string, number | null>>({});
  const [spyCurrent, setSpyCurrent]   = useState<number | null>(null);
  const [spyStart, setSpyStart]       = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [open, setOpen]               = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("activas");
  const [assetFilter, setAssetFilter]   = useState<AssetType | "todas">("todas");
  const [sellPosition, setSellPosition] = useState<Position | null>(null);
  const [dividends, setDividends]       = useState<Dividend[]>([]);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [transfers, setTransfers]       = useState<AccountTransfer[]>([]);
  const [fxTxs, setFxTxs]               = useState<FxTransaction[]>([]);
  const { toast } = useToast();

  const investmentAccount = accounts.find(a => a.account_type === "investment") ?? null;

  const fetchPrices = useCallback(async (invs: Investment[]) => {
    const active = invs.filter(i => !i.is_sold);
    if (active.length === 0) { setPrices({}); return; }
    const tickers   = [...new Set(active.map(i => i.ticker.toUpperCase()))].join(",");
    const firstDate = active.map(i => i.buy_date).sort()[0];
    const res       = await fetch(`/api/inversiones?tickers=${tickers}&spyStart=${firstDate}`);
    const data      = await res.json();
    setPrices(data.prices ?? {});
    setSpyCurrent(data.prices?.["SPY"] ?? null);
    setSpyStart(data.spyStartPrice ?? null);
  }, []);

  const load = useCallback(async () => {
    const [inv, divs, acc, trf, fx] = await Promise.all([
      getInvestments(), getDividends(), getAccounts(), getTransfers(), getFxTransactions(),
    ]);
    setInvestments(inv);
    setDividends(divs);
    setTransfers(trf);
    setFxTxs(fx);

    // Auto-provisionar la cuenta de Inversiones si todavía no existe
    let acc2 = acc;
    if (!acc.some(a => a.account_type === "investment")) {
      await upsertAccount({
        name: "Inversiones", account_type: "investment", currency: "ARS",
        initial_ars: 0, initial_usd: 0,
      });
      acc2 = await getAccounts();
    }
    setAccounts(acc2);

    await fetchPrices(inv);
    setLoading(false);
  }, [fetchPrices]);

  const refresh = async () => {
    setRefreshing(true);
    const inv = await getInvestments();
    setInvestments(inv);
    await fetchPrices(inv);
    setRefreshing(false);
    toast({ title: "Precios actualizados" });
  };

  useEffect(() => { load(); }, [load]);

  const handleSaved  = () => { setOpen(false); load(); toast({ title: "✅ Compra registrada" }); };
  const handleSold   = () => { setSellPosition(null); load(); toast({ title: "✅ Venta registrada" }); };
  const handleDelete = async (id: string) => {
    await deleteInvestment(id);
    load();
    toast({ title: "Posición eliminada" });
  };

  // ── Posiciones y métricas ─────────────────────────────────────────────────
  const positions = useMemo(() => groupIntoPositions(investments, prices), [investments, prices]);
  const soldLots  = useMemo(() => getSoldLots(investments), [investments]);

  const totalCost        = positions.reduce((s, p) => s + p.totalCost, 0);
  const totalValue       = positions.reduce((s, p) => s + (p.currentValue ?? p.totalCost), 0);
  const unrealizedPnL    = totalValue - totalCost;
  const unrealizedPnLPct = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;
  const realizedPnL      = soldLots.reduce((s, l) => s + l.realizedPnL, 0);
  const totalDividends   = dividends.reduce((s, d) => s + d.amount, 0);
  const totalPnL         = unrealizedPnL + realizedPnL + totalDividends;

  // ── Plata disponible en la cuenta de Inversiones (sin invertir) ────────────
  const totalEverInvested = investments.reduce((s, i) => s + i.buy_price * i.quantity, 0);
  // Rendimiento total = todo lo ganado desde que empezaste a invertir, sobre
  // todo lo que invertiste alguna vez (activo + vendido)
  const totalPnLPct      = totalEverInvested > 0 ? (totalPnL / totalEverInvested) * 100 : 0;
  const totalSaleProceeds = soldLots.reduce((s, l) => s + (l.sell_price ?? 0) * l.quantity, 0);

  let cashArs = investmentAccount?.initial_ars ?? 0;
  let cashUsd = investmentAccount?.initial_usd ?? 0;
  if (investmentAccount) {
    for (const t of transfers) {
      if (t.to_account_id === investmentAccount.id) {
        if (t.currency === "ARS") cashArs += t.amount; else cashUsd += t.amount;
      }
      if (t.from_account_id === investmentAccount.id) {
        if (t.currency === "ARS") cashArs -= t.amount; else cashUsd -= t.amount;
      }
    }
    for (const fx of fxTxs) {
      if (fx.account_id === investmentAccount.id) {
        cashArs -= fx.ars_amount;
        cashUsd += fx.usd_amount;
      }
    }
  }
  cashUsd += totalSaleProceeds + totalDividends - totalEverInvested;

  const sourceAccounts = accounts.filter(a => a.account_type !== "investment");

  // Benchmark SPY
  const spyPct = spyCurrent != null && spyStart != null && spyStart > 0
    ? ((spyCurrent - spyStart) / spyStart) * 100
    : null;
  const portfolioBeatsSpy = spyPct != null && totalPnLPct > spyPct;

  // ── Filtros aplicados ─────────────────────────────────────────────────────
  const filteredPositions = positions.filter(
    p => assetFilter === "todas" || p.asset_type === assetFilter
  );
  const filteredSoldLots = soldLots.filter(
    l => assetFilter === "todas" || l.asset_type === assetFilter
  );

  // Asset types presentes
  const assetTypes = [...new Set(investments.map(i => i.asset_type))] as AssetType[];

  if (loading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        {[0, 1, 2].map(i => <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-2">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Portafolio</h1>
          <p className="text-muted-foreground text-xs">
            {positions.length} posición{positions.length !== 1 ? "es" : ""} activa{positions.length !== 1 ? "s" : ""}
            {soldLots.length > 0 && ` · ${soldLots.length} vendida${soldLots.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-[#2d5016] hover:bg-[#3a6b1d] border-0">
                <Plus className="h-4 w-4" /> Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar compra</DialogTitle></DialogHeader>
              <InvestmentForm
                investmentAccountId={investmentAccount?.id ?? null}
                availableArs={cashArs}
                onSaved={handleSaved}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {investments.length === 0 ? (
        <>
          <EmptyState onAdd={() => setOpen(true)} />
          {investmentAccount && (
            <div className="mt-4">
              <InvestmentAccountCard
                sourceAccounts={sourceAccounts}
                investmentAccountId={investmentAccount.id}
                cashArs={cashArs}
                cashUsd={cashUsd}
                onAddTransfer={async (t) => { await addTransfer(t); load(); }}
              />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {/* ── Dashboard de métricas (lo principal: rendimiento) ── */}
          <PortfolioDashboard
            totalCost={totalCost}
            totalValue={totalValue}
            unrealizedPnL={unrealizedPnL}
            unrealizedPnLPct={unrealizedPnLPct}
            realizedPnL={realizedPnL}
            totalDividends={totalDividends}
            totalPnL={totalPnL}
            totalPnLPct={totalPnLPct}
            spyPct={spyPct}
            portfolioBeatsSpy={portfolioBeatsSpy}
            activeCount={positions.length}
            soldCount={soldLots.length}
          />

          {/* ── Cuenta de Inversiones (siempre separada) ── */}
          {investmentAccount && (
            <InvestmentAccountCard
              sourceAccounts={sourceAccounts}
              investmentAccountId={investmentAccount.id}
              cashArs={cashArs}
              cashUsd={cashUsd}
              onAddTransfer={async (t) => { await addTransfer(t); load(); }}
            />
          )}

          {/* ── Composición del portafolio ── */}
          {positions.length > 0 && (
            <Card className="rounded-2xl border-border/50 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Composición</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PortfolioChart positions={positions} />
              </CardContent>
            </Card>
          )}

          {/* ── Filtros de tipo de asset ── */}
          {assetTypes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <FilterChip label="Todas" active={assetFilter === "todas"} onClick={() => setAssetFilter("todas")} />
              {assetTypes.map(t => (
                <FilterChip
                  key={t}
                  label={ASSET_TYPE_LABELS[t]}
                  active={assetFilter === t}
                  onClick={() => setAssetFilter(t)}
                />
              ))}
            </div>
          )}

          {/* ── Tabs activas/vendidas ── */}
          <div className="flex rounded-lg bg-muted p-1 gap-1">
            {(["activas", "vendidas", "todas"] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
                  statusFilter === f
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "activas" ? `Activas (${positions.length})` :
                 f === "vendidas" ? `Vendidas (${soldLots.length})` : "Todas"}
              </button>
            ))}
          </div>

          {/* ── Lista de posiciones activas ── */}
          {(statusFilter === "activas" || statusFilter === "todas") && (
            <div className="space-y-2">
              {filteredPositions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Sin posiciones activas</p>
              ) : (
                filteredPositions.map(pos => (
                  <PositionCard
                    key={`${pos.ticker}-${pos.asset_type}`}
                    position={pos}
                    onSell={() => setSellPosition(pos)}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Lista de ventas ── */}
          {(statusFilter === "vendidas" || statusFilter === "todas") && soldLots.length > 0 && (
            <div className="space-y-2">
              {statusFilter === "todas" && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Vendidas</p>}
              {filteredSoldLots.map(lot => (
                <SoldCard key={lot.id} lot={lot} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* ── Dividendos ── */}
          <DividendsSection
            dividends={dividends}
            availableTickers={[...new Set(investments.map(i => i.ticker.toUpperCase()))]}
            onChanged={load}
          />
        </div>
      )}

      {/* ── Sell dialog ── */}
      <Dialog open={!!sellPosition} onOpenChange={open => { if (!open) setSellPosition(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Vender posición — {sellPosition?.ticker}</DialogTitle>
          </DialogHeader>
          {sellPosition && (
            <SellDialog
              position={sellPosition}
              currentPrice={prices[sellPosition.ticker.toUpperCase()] ?? null}
              onSold={handleSold}
              onCancel={() => setSellPosition(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PortfolioDashboard ───────────────────────────────────────────────────────

function PortfolioDashboard({
  totalCost, totalValue, unrealizedPnL, unrealizedPnLPct,
  realizedPnL, totalDividends, totalPnL, totalPnLPct, spyPct, portfolioBeatsSpy, activeCount, soldCount,
}: {
  totalCost: number; totalValue: number;
  unrealizedPnL: number; unrealizedPnLPct: number;
  realizedPnL: number; totalDividends: number; totalPnL: number; totalPnLPct: number;
  spyPct: number | null; portfolioBeatsSpy: boolean;
  activeCount: number; soldCount: number;
}) {
  const isUp = totalPnL >= 0;
  const isUnrealizedUp = unrealizedPnL >= 0;

  return (
    <Card className={`rounded-2xl shadow-none ${isUp ? "border-emerald-500/20" : "border-destructive/20"}`}>
      <CardContent className="p-5 space-y-4">
        {/* Rendimiento total (no realizado + realizado + dividendos) — cifra protagonista */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
            Rendimiento total
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`text-[2.25rem] leading-tight font-bold tracking-tight ${isUp ? "text-emerald-500" : "text-destructive"}`}
              style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" }}
            >
              {isUp ? "+" : ""}{formatCurrency(totalPnL, "USD")}
            </span>
            <span className={`text-sm font-medium ${isUp ? "text-emerald-500" : "text-destructive"}`}>
              ({isUp ? "+" : ""}{totalPnLPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <Separator />

        {/* Valor invertido vs actual */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Invertido</p>
            <p className="text-xl font-bold">{formatCurrency(totalCost, "USD")}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Valor en activos</p>
            <p className="text-xl font-bold">{formatCurrency(totalValue, "USD")}</p>
          </div>
        </div>

        {/* No realizado + realizado + dividendos + SPY benchmark */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">No realizado</p>
            <p className={`text-sm font-semibold ${isUnrealizedUp ? "text-emerald-500" : "text-destructive"}`}>
              {isUnrealizedUp ? "+" : ""}{formatCurrency(unrealizedPnL, "USD")}
            </p>
          </div>
          {soldCount > 0 && (
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Realizado</p>
              <p className={`text-sm font-semibold ${realizedPnL >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {realizedPnL >= 0 ? "+" : ""}{formatCurrency(realizedPnL, "USD")}
              </p>
            </div>
          )}
          {totalDividends > 0 && (
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Dividendos</p>
              <p className="text-sm font-semibold text-emerald-500">
                +{formatCurrency(totalDividends, "USD")}
              </p>
            </div>
          )}
          {spyPct != null && (
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                vs SPY
                {portfolioBeatsSpy
                  ? <span className="text-emerald-500">↑</span>
                  : <span className="text-destructive">↓</span>}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-sm font-semibold ${portfolioBeatsSpy ? "text-emerald-500" : "text-destructive"}`}>
                  {totalPnLPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  vs {spyPct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PositionCard ─────────────────────────────────────────────────────────────

function PositionCard({
  position: pos, onSell, onDelete,
}: {
  position: Position;
  onSell: () => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUp = (pos.unrealizedPnL ?? 0) >= 0;
  const hasPrice = pos.currentPrice != null;

  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="p-4">
        {/* Header de posición — tap para expandir lotes */}
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => { if (pos.lots.length > 1) setExpanded(e => !e); }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base font-mono">{pos.ticker}</span>
              <Badge className={`text-[10px] h-4 px-1.5 ${ASSET_TYPE_COLORS[pos.asset_type]}`} variant="outline">
                {ASSET_TYPE_LABELS[pos.asset_type]}
              </Badge>
              {pos.lots.length > 1 && (
                <span className="text-[10px] text-muted-foreground">{pos.lots.length} lotes</span>
              )}
            </div>

            {/* Métricas principales */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {pos.totalQty} × ${pos.avgBuyPrice.toFixed(2)} prom.
                </span>
                <span className="text-xs text-muted-foreground">
                  Costo: {formatCurrency(pos.totalCost, "USD")}
                </span>
              </div>
              {hasPrice ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Actual: {formatCurrency(pos.currentPrice!, "USD")}
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(pos.currentValue!, "USD")}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60">Precio no disponible</p>
              )}
            </div>

            {/* P&L */}
            {hasPrice && (
              <div className={`mt-2 flex items-center gap-2 ${isUp ? "text-emerald-400" : "text-destructive"}`}>
                {isUp
                  ? <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  : <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
                <span className="text-sm font-semibold">
                  {isUp ? "+" : ""}{formatCurrency(pos.unrealizedPnL!, "USD")}
                </span>
                <span className="text-xs">
                  ({isUp ? "+" : ""}{pos.unrealizedPnLPct!.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>

          {/* Acción de venta + indicador de expansión */}
          <div className="flex flex-col gap-1 shrink-0 items-end" onClick={e => e.stopPropagation()}>
            {pos.lots.length > 1 && (
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onSell}
            >
              Vender
            </Button>
          </div>
        </div>

        {/* Lotes individuales (expandido, solo informativo) */}
        {expanded && pos.lots.length > 1 && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lotes individuales</p>
            {pos.lots.map(lot => (
              <LotRow
                key={lot.id}
                lot={lot}
                currentPrice={pos.currentPrice}
                onDelete={() => onDelete(lot.id)}
              />
            ))}
          </div>
        )}

        {/* Lote único: botón de eliminar */}
        {pos.lots.length === 1 && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost" size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-destructive gap-1"
              onClick={() => onDelete(pos.lots[0].id)}
            >
              <Trash2 className="h-3 w-3" /> Eliminar lote
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── LotRow ───────────────────────────────────────────────────────────────────

function LotRow({
  lot, currentPrice, onDelete,
}: {
  lot: Investment;
  currentPrice: number | null;
  onDelete: () => void;
}) {
  const cost  = lot.buy_price * lot.quantity;
  const value = currentPrice != null ? currentPrice * lot.quantity : null;
  const pnl   = value != null ? value - cost : null;
  const isUp  = (pnl ?? 0) >= 0;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
      <div className="flex-1 min-w-0 text-xs">
        <p className="text-muted-foreground">{formatDate(lot.buy_date)} · {lot.quantity} acc × ${lot.buy_price}</p>
        {pnl != null && (
          <p className={`font-medium ${isUp ? "text-emerald-400" : "text-destructive"}`}>
            {isUp ? "+" : ""}{formatCurrency(pnl, "USD")}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={onDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── SoldCard ─────────────────────────────────────────────────────────────────

function SoldCard({ lot, onDelete }: { lot: SoldLot; onDelete: (id: string) => void }) {
  const isUp = lot.realizedPnL >= 0;
  return (
    <Card className="rounded-2xl border-border/50 shadow-none opacity-70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold font-mono">{lot.ticker}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Vendida</Badge>
              <Badge className={`text-[10px] h-4 px-1.5 ${ASSET_TYPE_COLORS[lot.asset_type]}`} variant="outline">
                {ASSET_TYPE_LABELS[lot.asset_type]}
              </Badge>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
              <p>{lot.quantity} acc · Compra {formatCurrency(lot.buy_price, "USD")} · Venta {formatCurrency(lot.sell_price!, "USD")}</p>
              <p>
                Comprado {formatDate(lot.buy_date)}
                {lot.sell_date && ` · Vendido ${formatDate(lot.sell_date)}`}
              </p>
            </div>
            <div className={`mt-2 flex items-center gap-1.5 ${isUp ? "text-emerald-400" : "text-destructive"}`}>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span className="text-sm font-semibold">
                {isUp ? "+" : ""}{formatCurrency(lot.realizedPnL, "USD")}
              </span>
              <span className="text-xs">
                ({isUp ? "+" : ""}{lot.realizedPnLPct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(lot.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2d5016]/15 to-[#4a7c3f]/10 flex items-center justify-center mx-auto">
        <DollarSign className="h-8 w-8 text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-medium">No hay posiciones registradas</p>
        <p className="text-xs text-muted-foreground mt-1">Registrá tu primera compra para empezar a trackear tu portafolio</p>
      </div>
      <Button onClick={onAdd} className="bg-[#2d5016] hover:bg-[#3a6b1d] border-0">
        <Plus className="h-4 w-4 mr-2" /> Registrar primera compra
      </Button>
    </div>
  );
}
