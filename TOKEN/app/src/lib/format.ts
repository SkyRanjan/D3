const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const formatTokens = (n: number) => integer.format(Math.round(n));

export const formatCompact = (n: number) => (Math.abs(n) < 10_000 ? formatTokens(n) : compact.format(n));

/** Per-request costs are fractions of a cent, so small amounts keep three significant digits. */
export function formatUSD(v: number): string {
  if (v === 0) return "$0";
  if (Math.abs(v) < 0.01) return `$${v.toPrecision(3)}`;
  if (Math.abs(v) < 1000) return `$${v.toFixed(Math.abs(v) < 1 ? 4 : 2)}`;
  return `$${compact.format(v)}`;
}

/** Axis ticks: just enough digits to tell ticks apart. */
export function formatUSDAxis(v: number): string {
  if (v === 0) return "$0";
  if (Math.abs(v) < 0.01) return `$${Number(v.toPrecision(2))}`;
  return Math.abs(v) < 1000 ? `$${Number(v.toFixed(2))}` : `$${compact.format(v)}`;
}

export const formatPercent = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
