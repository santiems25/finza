/** Cotización de venta del dólar MEP actual, o null si no se pudo obtener. */
export async function fetchMepRate(): Promise<number | null> {
  try {
    const res = await fetch("/api/mep");
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.venta === "number" ? data.venta : null;
  } catch {
    return null;
  }
}
