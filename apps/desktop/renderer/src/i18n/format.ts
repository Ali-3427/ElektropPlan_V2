const TR_NUM = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatNumberTr(value: number | null | undefined, fractionDigits?: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (fractionDigits === undefined) return TR_NUM.format(value);
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumberTr(value, fractionDigits)} %`;
}

export function formatAmp(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumberTr(value, fractionDigits)} A`;
}

export function formatVolt(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumberTr(value, fractionDigits)} V`;
}

/** Parses a TR-formatted number string ("1.234,56" or "1,5") to number. Empty => null. */
export function parseNumberTr(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  // Remove thousands separators (dots), then replace decimal comma with dot.
  const normalized = trimmed.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return n;
}
