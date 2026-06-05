"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { Position } from "@/types";

// Paleta para dark mode — 10 colores distinguibles
const PALETTE = [
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#22d3ee", // cyan-400
  "#fb923c", // orange-400
  "#f472b6", // pink-400
  "#a3e635", // lime-400
  "#818cf8", // indigo-400
];

interface Slice {
  ticker: string;
  value: number;
  percent: number;
  color: string;
}

interface Props {
  positions: Position[];
}

export function PortfolioChart({ positions }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const totalValue = positions.reduce(
    (s, p) => s + (p.currentValue ?? p.totalCost),
    0
  );

  if (totalValue === 0 || positions.length === 0) return null;

  const slices: Slice[] = positions.map((p, i) => {
    const value = p.currentValue ?? p.totalCost;
    return {
      ticker:  p.ticker,
      value,
      percent: (value / totalValue) * 100,
      color:   PALETTE[i % PALETTE.length],
    };
  });

  // ── SVG donut ──────────────────────────────────────────────────────────────
  const SIZE        = 220;
  const STROKE      = 32;
  const R           = (SIZE - STROKE) / 2;
  const CIRCUMF     = 2 * Math.PI * R;
  const GAP         = CIRCUMF * 0.008; // pequeño gap entre slices

  let cumulativePct = 0;

  const activeSlice = hovered ? slices.find(s => s.ticker === hovered) : null;

  return (
    <div className="space-y-5">
      {/* Donut */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
            {/* Track */}
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={STROKE}
            />
            {/* Slices */}
            {slices.map((slice) => {
              const dash   = (slice.percent / 100) * CIRCUMF - GAP;
              const offset = -(cumulativePct / 100) * CIRCUMF;
              cumulativePct += slice.percent;
              const isActive = hovered === slice.ticker;
              return (
                <circle
                  key={slice.ticker}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isActive ? STROKE + 6 : STROKE}
                  strokeDasharray={`${Math.max(0, dash)} ${CIRCUMF}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  style={{ transition: "stroke-width 0.15s ease" }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(slice.ticker)}
                  onMouseLeave={() => setHovered(null)}
                  onTouchStart={() => setHovered(h => h === slice.ticker ? null : slice.ticker)}
                />
              );
            })}
          </svg>

          {/* Centro — muestra total o slice hovereado */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {activeSlice ? (
              <>
                <span
                  className="text-sm font-bold font-mono"
                  style={{ color: activeSlice.color }}
                >
                  {activeSlice.ticker}
                </span>
                <span className="text-base font-bold mt-0.5">
                  {activeSlice.percent.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(activeSlice.value, "USD")}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-sm font-bold mt-0.5">
                  {formatCurrency(totalValue, "USD")}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {positions.length} posición{positions.length !== 1 ? "es" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="space-y-2">
        {slices.map(slice => {
          const isActive = hovered === slice.ticker;
          return (
            <button
              key={slice.ticker}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 transition-colors text-left ${
                isActive ? "bg-muted/60" : "hover:bg-muted/30"
              }`}
              onMouseEnter={() => setHovered(slice.ticker)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered(h => h === slice.ticker ? null : slice.ticker)}
            >
              {/* Barra de color proporcional */}
              <div className="flex-shrink-0 flex items-center gap-2 w-24">
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    width: `${Math.max(8, (slice.percent / slices[0].percent) * 64)}px`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
              <span className="font-mono text-sm font-semibold flex-shrink-0 w-16">
                {slice.ticker}
              </span>
              <div className="flex-1 flex items-center justify-end gap-3">
                <span className="text-xs text-muted-foreground">
                  {slice.percent.toFixed(1)}%
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(slice.value, "USD")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
