/** 金额、比例、日期显示口径统一在此维护（完整业需 3.2.2 / 14.3）。 */

export const WAN = "万元";

export function fmtAmount(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtAmount0(v: number | null | undefined): string {
  return fmtAmount(v, 0);
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function fmtSignedPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = v.toFixed(digits);
  return `${v > 0 ? "+" : ""}${s}%`;
}

export function fmtPp(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}个百分点`;
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("zh-CN");
}

export function fmtDate(v: string | null | undefined): string {
  return v && v.length > 0 ? v : "—";
}

/** 天数差：自然日 */
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function dateLte(a: string, b: string): boolean {
  return a <= b;
}

export function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function periodLabel(start: string, end: string): string {
  return `${start} 至 ${end}`;
}
