/**
 * 资金经营指标的同期比较与同口径趋势。
 * 比率变化用百分点；同期为 0 或负数时展示增减额，不计算失真增长率。
 */

import type { IndicatorDef, NodeMetric } from "./metrics";
import { fmtAmountSmart, fmtPp } from "./format";

export type ComparablePeriod = {
  periodStart: string;
  periodEnd: string;
  asOf: string;
  label: string;
};

function shiftYear(iso: string, delta: number): string {
  const y = Number(iso.slice(0, 4)) + delta;
  return `${y}${iso.slice(4)}`;
}

function halfLabel(start: string, end: string): string {
  const y = start.slice(0, 4);
  if (start.endsWith("-01-01") && end.endsWith("-06-30")) return `${y}上半年`;
  if (start.endsWith("-07-01") && end.endsWith("-12-31")) return `${y}下半年`;
  if (start.endsWith("-01-01") && end.endsWith("-03-31")) return `${y}一季度`;
  if (start.endsWith("-04-01") && end.endsWith("-06-30")) return `${y}二季度`;
  return `${start}～${end}`;
}

/** 上年同起止日的可比期间。 */
export function priorYearPeriod(periodStart: string, periodEnd: string, asOf: string): ComparablePeriod {
  const periodStart2 = shiftYear(periodStart, -1);
  const periodEnd2 = shiftYear(periodEnd, -1);
  const asOf2 = shiftYear(asOf, -1);
  return {
    periodStart: periodStart2,
    periodEnd: periodEnd2,
    asOf: asOf2,
    label: halfLabel(periodStart2, periodEnd2),
  };
}

/** 已关账、与当前期间长度同口径的连续半年报（用于趋势）。 */
export const CLOSED_HALF_PERIODS: ComparablePeriod[] = [
  { periodStart: "2025-01-01", periodEnd: "2025-06-30", asOf: "2025-06-30", label: "2025上半年" },
  { periodStart: "2025-07-01", periodEnd: "2025-12-31", asOf: "2025-12-31", label: "2025下半年" },
  { periodStart: "2026-01-01", periodEnd: "2026-06-30", asOf: "2026-06-30", label: "2026上半年" },
];

export function sameCaliberTrendPeriods(periodStart: string, periodEnd: string): ComparablePeriod[] {
  const days =
    (Date.parse(`${periodEnd}T00:00:00Z`) - Date.parse(`${periodStart}T00:00:00Z`)) / 86400000;
  if (days >= 170 && days <= 190) return CLOSED_HALF_PERIODS;
  return [];
}

export function formatComparableChange(
  def: IndicatorDef,
  current: NodeMetric,
  prior: NodeMetric | null,
  priorLabel: string,
): { text: string; tone: "red" | "green" | "neutral" } {
  if (!prior || prior.value === null || current.value === null) {
    return { text: prior ? `${priorLabel}缺可比数` : "同期缺数", tone: "neutral" };
  }
  const diff = current.value - prior.value;
  const priorText =
    def.kind === "amount"
      ? `${fmtAmountSmart(prior.value)}${def.unit ? ` ${def.unit}` : ""}`
      : def.unit === "倍"
        ? `${prior.value.toFixed(2)} 倍`
        : `${prior.value.toFixed(2)}${def.unit === "%" || def.kind === "ratio" || def.kind === "signed_ratio" ? "%" : def.unit}`;

  if (def.kind === "ratio" || def.kind === "signed_ratio" || def.unit === "%") {
    return {
      text: `同期 ${priorText}，${fmtPp(diff)}`,
      tone: diff === 0 ? "neutral" : diff > 0 ? "green" : "red",
    };
  }

  if (prior.value <= 0) {
    const sign = diff > 0 ? "+" : "";
    return {
      text: `同期 ${priorText}，增减额 ${sign}${fmtAmountSmart(diff)}${def.unit ? ` ${def.unit}` : ""}`,
      tone: diff === 0 ? "neutral" : diff > 0 ? "green" : "red",
    };
  }

  const pct = (diff / Math.abs(prior.value)) * 100;
  const sign = diff > 0 ? "+" : "";
  return {
    text: `同期 ${priorText}，${sign}${fmtAmountSmart(diff)}${def.unit ? ` ${def.unit}` : ""}（${sign}${pct.toFixed(1)}%）`,
    tone: diff === 0 ? "neutral" : diff > 0 ? "green" : "red",
  };
}

/** 组织树等窄栏用的同期变化摘要。 */
export function formatYoyShort(
  def: IndicatorDef,
  current: NodeMetric,
  prior: NodeMetric | null,
): string {
  if (!prior || prior.value === null || current.value === null) return "同期缺数";
  const diff = current.value - prior.value;
  if (def.kind === "ratio" || def.kind === "signed_ratio" || def.unit === "%") {
    return fmtPp(diff);
  }
  if (prior.value <= 0) {
    const sign = diff > 0 ? "+" : "";
    return `增减额 ${sign}${fmtAmountSmart(diff)}${def.unit ? def.unit : ""}`;
  }
  const pct = (diff / Math.abs(prior.value)) * 100;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatTrendLine(
  def: IndicatorDef,
  points: { label: string; value: number | null }[],
): string {
  const usable = points.filter((p) => p.value !== null);
  if (usable.length < 2) return "同口径连续期间不足，不绘制趋势";
  return usable
    .map((p) => {
      const v =
        def.kind === "amount"
          ? fmtAmountSmart(p.value)
          : def.unit === "倍"
            ? (p.value as number).toFixed(2)
            : (p.value as number).toFixed(2) + (def.unit === "%" || def.kind === "ratio" ? "%" : "");
      return `${p.label} ${v}`;
    })
    .join(" → ");
}
