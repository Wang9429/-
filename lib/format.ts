/** 金额、比例、日期显示口径统一在此维护（完整业需 3.2.2 / 14.3）。 */

export const WAN = "万元";
/** 人民币「元」折万元。账户原币×汇率得到的是元，展示万元时用此函数；已经是万元的金额不要再除。 */
export const YUAN_PER_WAN = 10000;

export function yuanToWan(yuan: number): number {
  return yuan / YUAN_PER_WAN;
}

function trimFixed(v: number, digits: number): string {
  if (digits <= 0) return v.toFixed(0);
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

export function fmtAmount(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** KPI 与卡片用：保留千分位，去掉无意义的尾随小数。 */
export function fmtAmountSmart(v: number | null | undefined, maxDigits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

export function fmtAmount0(v: number | null | undefined): string {
  return fmtAmount(v, 0);
}

/** 返回不含百分号的数字文本。调用方只追加一次单位。 */
export function fmtPctNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return trimFixed(v, digits);
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  const n = fmtPctNumber(v, digits);
  return n === "—" ? "—" : `${n}%`;
}

export function fmtSignedPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const n = trimFixed(v, digits);
  return `${v > 0 ? "+" : ""}${n}%`;
}

export function fmtPp(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${trimFixed(v, digits)}个百分点`;
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
