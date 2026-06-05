import { NextRequest, NextResponse } from "next/server";

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

/**
 * Obtiene el precio de cierre de SPY en una fecha específica
 * para calcular el ROI del benchmark desde el inicio del portafolio.
 */
async function fetchHistoricalPrice(ticker: string, dateStr: string): Promise<number | null> {
  try {
    const date    = new Date(dateStr + "T12:00:00Z");
    const period1 = Math.floor(date.getTime() / 1000);
    const period2 = period1 + 60 * 60 * 24 * 7; // +7 días buffer (fines de semana, feriados)
    const url     = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      next: { revalidate: 3600 }, // cache 1 hora para histórico
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Primer cierre disponible en el rango
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(closes)) return null;
    const first = closes.find((v: number | null) => v != null);
    return typeof first === "number" ? first : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const tickers  = req.nextUrl.searchParams.get("tickers");
  const spyStart = req.nextUrl.searchParams.get("spyStart"); // YYYY-MM-DD, primer buy_date del portafolio

  if (!tickers) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickerList = [...new Set(
    tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
  )];

  // Siempre incluir SPY para benchmark
  if (!tickerList.includes("SPY")) tickerList.push("SPY");

  // Fetch precios actuales en paralelo
  const priceEntries = await Promise.all(
    tickerList.map(async (ticker) => [ticker, await fetchCurrentPrice(ticker)] as const)
  );
  const prices: Record<string, number | null> = Object.fromEntries(priceEntries);

  // Si viene fecha de inicio, fetchear precio histórico de SPY
  let spyStartPrice: number | null = null;
  if (spyStart) {
    spyStartPrice = await fetchHistoricalPrice("SPY", spyStart);
  }

  return NextResponse.json({ prices, spyStartPrice });
}
