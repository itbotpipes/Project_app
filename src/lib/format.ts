// Indian-style currency + short number formatting

export function inr(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Compact: 4500000 -> ₹45.0L, 12000000 -> ₹1.20Cr */
export function inrShort(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}
