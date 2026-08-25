import { sellInvestment, updateInvestmentQuantity, addInvestment } from "@/lib/supabase";
import type { Investment } from "@/types";

const EPSILON = 1e-6;

/**
 * Vende `quantity` nominales de una posición, consumiendo los lotes más
 * antiguos primero (FIFO). Si un lote se consume parcialmente, se reduce
 * su cantidad y se crea un nuevo registro vendido con la porción vendida
 * (mismo precio/fecha de compra), preservando el costo histórico real.
 */
export async function sellFifo(
  lots: Investment[],
  quantity: number,
  sellPrice: number,
  sellDate: string
): Promise<void> {
  const sorted = [...lots].sort((a, b) => a.buy_date.localeCompare(b.buy_date));
  let remaining = quantity;

  for (const lot of sorted) {
    if (remaining <= EPSILON) break;

    if (lot.quantity <= remaining + EPSILON) {
      // Se vende el lote completo
      await sellInvestment(lot.id, sellPrice, sellDate);
      remaining -= lot.quantity;
    } else {
      // Venta parcial: se reduce el lote original y se registra la porción vendida
      const soldQty = remaining;
      await updateInvestmentQuantity(lot.id, lot.quantity - soldQty);
      await addInvestment({
        ticker:              lot.ticker,
        asset_type:          lot.asset_type,
        quantity:            soldQty,
        buy_price:           lot.buy_price,
        buy_date:            lot.buy_date,
        is_sold:             true,
        sell_price:          sellPrice,
        sell_date:           sellDate,
        notes:               lot.notes,
      });
      remaining = 0;
    }
  }
}

/** Costo (a precio de compra) de vender `quantity` nominales vía FIFO — para previews. */
export function estimateFifoCost(lots: Investment[], quantity: number): number {
  const sorted = [...lots].sort((a, b) => a.buy_date.localeCompare(b.buy_date));
  let remaining = quantity;
  let cost = 0;
  for (const lot of sorted) {
    if (remaining <= EPSILON) break;
    const consumed = Math.min(lot.quantity, remaining);
    cost += consumed * lot.buy_price;
    remaining -= consumed;
  }
  return cost;
}
