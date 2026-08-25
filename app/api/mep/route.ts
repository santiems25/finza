import { NextResponse } from "next/server";

/**
 * Cotización del dólar MEP (Bolsa) vía dolarapi.com — gratis, sin API key.
 * Se cachea 5 minutos para no golpear el servicio en cada request.
 */
export async function GET() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/bolsa", {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ compra: null, venta: null });
    const data = await res.json();
    return NextResponse.json({
      compra: typeof data?.compra === "number" ? data.compra : null,
      venta:  typeof data?.venta  === "number" ? data.venta  : null,
    });
  } catch {
    return NextResponse.json({ compra: null, venta: null });
  }
}
