/**
 * 资金/产权指标分类与趋势。配置字段优先，缺省回落到本表。
 * 不补零、不插值、不把半年 ROE 拆成月度收益率。
 */

import type { CatalogIndicator } from "./config-catalog";
import type { ComparablePeriod } from "./fp-compare";
import type { IndicatorContext, IndicatorDef, NodeMetric } from "./metrics";

export type MetricCategoryId = "profitability" | "balance_sheet" | "liquidity" | "property_census";

export type TrendFrequency = "month" | "quarter" | "half";

export type TrendTimeBasis =
  | "period_amount"
  | "period_end"
  | "period_ratio"
  | "same_length_period_return"
  | "point_snapshot";

export interface TrendSpec {
  applicability: "conditional" | "never";
  frequency: TrendFrequency;
  timeBasis: TrendTimeBasis;
  homeVisible: boolean;
  detailVisible: boolean;
  minPoints: number;
  preferredWindow: number;
  valueLabel: string;
  chartLabel: string;
}

export interface TrendPoint {
  label: string;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  value: number | null;
}

export const CATEGORY_LABEL: Record<MetricCategoryId, string> = {
  profitability: "盈利能力",
  balance_sheet: "资产负债状况",
  liquidity: "资金流动性",
  property_census: "法人及股权统计",
};

export const METRIC_CATEGORY: Record<string, MetricCategoryId> = {
  "CASH2-I01": "profitability",
  "CASH2-I02": "profitability",
  "CASH2-I03": "profitability",
  "CASH2-I13": "profitability",
  "CASH2-I04": "balance_sheet",
  "CASH2-I06": "balance_sheet",
  "CASH2-I07": "balance_sheet",
  "CASH2-I08": "balance_sheet",
  "CASH-I01": "liquidity",
  "CASH-I02": "liquidity",
  "CASH-I07": "liquidity",
  "CASH2-I09": "liquidity",
  "PTY2-I01": "property_census",
  "PTY2-I02": "property_census",
  "PTY2-I03": "property_census",
  "PTY2-I04": "property_census",
};

const FLOW: Omit<TrendSpec, "homeVisible" | "detailVisible"> = {
  applicability: "conditional",
  frequency: "month",
  timeBasis: "period_amount",
  minPoints: 2,
  preferredWindow: 6,
  valueLabel: "上半年累计",
  chartLabel: "月度发生额",
};

const STOCK: Omit<TrendSpec, "homeVisible" | "detailVisible"> = {
  applicability: "conditional",
  frequency: "month",
  timeBasis: "period_end",
  minPoints: 2,
  preferredWindow: 6,
  valueLabel: "期末余额",
  chartLabel: "月末余额",
};

const RATIO_M: Omit<TrendSpec, "homeVisible" | "detailVisible"> = {
  applicability: "conditional",
  frequency: "month",
  timeBasis: "period_ratio",
  minPoints: 2,
  preferredWindow: 6,
  valueLabel: "期间比率",
  chartLabel: "各月比率",
};

const ROE: Omit<TrendSpec, "homeVisible" | "detailVisible"> = {
  applicability: "conditional",
  frequency: "quarter",
  timeBasis: "same_length_period_return",
  minPoints: 2,
  preferredWindow: 4,
  valueLabel: "期间收益率，不年化",
  chartLabel: "季度收益率",
};

const CENSUS: Omit<TrendSpec, "homeVisible" | "detailVisible"> = {
  applicability: "conditional",
  frequency: "month",
  timeBasis: "point_snapshot",
  minPoints: 2,
  preferredWindow: 6,
  valueLabel: "时点户数",
  chartLabel: "月末快照",
};

export const DEFAULT_TREND: Record<string, TrendSpec> = {
  "CASH2-I01": { ...FLOW, homeVisible: true, detailVisible: true },
  "CASH2-I02": { ...FLOW, homeVisible: true, detailVisible: true },
  "CASH2-I03": { ...RATIO_M, homeVisible: true, detailVisible: true, valueLabel: "期间比率" },
  "CASH2-I13": { ...ROE, homeVisible: true, detailVisible: true },
  "CASH2-I04": { ...STOCK, homeVisible: true, detailVisible: true },
  "CASH2-I06": { ...RATIO_M, homeVisible: true, detailVisible: true, chartLabel: "各月末比率" },
  "CASH2-I07": { ...STOCK, homeVisible: true, detailVisible: true },
  "CASH2-I08": { ...RATIO_M, homeVisible: true, detailVisible: true, chartLabel: "各月末倍" },
  "CASH-I01": { ...STOCK, homeVisible: true, detailVisible: true },
  "CASH-I02": { ...STOCK, homeVisible: true, detailVisible: true },
  "CASH-I07": { ...RATIO_M, homeVisible: true, detailVisible: true, chartLabel: "各月末占比" },
  "CASH2-I09": { ...FLOW, homeVisible: true, detailVisible: true },
  "PTY2-I01": { ...CENSUS, applicability: "never", homeVisible: false, detailVisible: false },
  "PTY2-I02": { ...CENSUS, applicability: "never", homeVisible: false, detailVisible: false },
  "PTY2-I03": { ...CENSUS, applicability: "never", homeVisible: false, detailVisible: false },
  "PTY2-I04": { ...CENSUS, applicability: "never", homeVisible: false, detailVisible: false, valueLabel: "时点事项数" },
};

export function categoryIdOf(indicatorId: string, catalogRow?: CatalogIndicator | null): MetricCategoryId | null {
  const fromCatalog = catalogRow?.category_id;
  if (
    fromCatalog === "profitability" ||
    fromCatalog === "balance_sheet" ||
    fromCatalog === "liquidity" ||
    fromCatalog === "property_census"
  ) {
    return fromCatalog;
  }
  return METRIC_CATEGORY[indicatorId] ?? null;
}

export function usesFinancialStatement(indicatorId: string): boolean {
  return (
    indicatorId.startsWith("CASH2-I") &&
    indicatorId !== "CASH2-I10" &&
    indicatorId !== "CASH2-I11" &&
    indicatorId !== "CASH2-I12"
  );
}

export function trendSpecOf(
  indicatorId: string,
  override?: Partial<Pick<TrendSpec, "applicability" | "homeVisible" | "detailVisible" | "frequency">>,
): TrendSpec | null {
  if (/^PTY2-I0[1-4]$/.test(indicatorId)) {
    const base = DEFAULT_TREND[indicatorId];
    if (!base) return null;
    return { ...base, applicability: "never", homeVisible: false, detailVisible: false };
  }
  const base = DEFAULT_TREND[indicatorId];
  if (!base) return null;
  return { ...base, ...override };
}

function lastDay(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) };
}

/** 所选期间内、不晚于截至日的已覆盖月份（月末）。 */
export function monthEndsInWindow(periodStart: string, periodEnd: string, asOf: string): ComparablePeriod[] {
  const start = parseIso(periodStart);
  const endBound = asOf < periodEnd ? asOf : periodEnd;
  const end = parseIso(endBound);
  const out: ComparablePeriod[] = [];
  let y = start.y;
  let m = start.m;
  while (y < end.y || (y === end.y && m <= end.m)) {
    const asOfM = lastDay(y, m);
    if (asOfM <= endBound && asOfM >= periodStart) {
      if (!(m === end.m && y === end.y && end.d < Number(asOfM.slice(8, 10)) && asOfM > asOf)) {
        if (asOfM <= asOf) {
          out.push({
            periodStart: monthStart(y, m),
            periodEnd: asOfM,
            asOf: asOfM,
            label: `${y}年${m}月`,
          });
        }
      }
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const CLOSED_QUARTERS: ComparablePeriod[] = [
  { periodStart: "2025-07-01", periodEnd: "2025-09-30", asOf: "2025-09-30", label: "2025三季度" },
  { periodStart: "2025-10-01", periodEnd: "2025-12-31", asOf: "2025-12-31", label: "2025四季度" },
  { periodStart: "2026-01-01", periodEnd: "2026-03-31", asOf: "2026-03-31", label: "2026一季度" },
  { periodStart: "2026-04-01", periodEnd: "2026-06-30", asOf: "2026-06-30", label: "2026二季度" },
];

export function quartersInWindow(periodStart: string, periodEnd: string, asOf: string): ComparablePeriod[] {
  return CLOSED_QUARTERS.filter((q) => q.asOf <= asOf && q.periodEnd >= periodStart && q.periodStart <= periodEnd);
}

export function trendPeriodsFor(spec: TrendSpec, periodStart: string, periodEnd: string, asOf: string): ComparablePeriod[] {
  if (spec.frequency === "quarter") {
    const all = quartersInWindow("2025-01-01", periodEnd, asOf).filter((q) => q.asOf <= asOf);
    return all.slice(-spec.preferredWindow);
  }
  if (spec.frequency === "half") {
    return [];
  }
  const months = monthEndsInWindow(periodStart, periodEnd, asOf);
  return months.slice(-spec.preferredWindow);
}

export function computeTrendPoints(
  def: IndicatorDef,
  orgIds: Set<string>,
  ctx: IndicatorContext,
  spec: TrendSpec,
  compute: (d: IndicatorDef, ids: Set<string>, c: IndicatorContext) => NodeMetric,
): TrendPoint[] {
  if (spec.applicability === "never") return [];
  const periods = trendPeriodsFor(spec, ctx.periodStart, ctx.periodEnd, ctx.asOf);
  return periods.map((p) => {
    const m = compute(def, orgIds, {
      ...ctx,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      asOf: p.asOf,
    });
    return {
      label: p.label,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      asOf: p.asOf,
      value: m.value,
    };
  });
}

export function eligibleTrendPoints(points: TrendPoint[], minPoints = 2): TrendPoint[] | null {
  const usable = points.filter((p) => p.value !== null);
  if (usable.length < minPoints) return null;
  return points;
}

export function sameSeriesValues(a: TrendPoint[], b: TrendPoint[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.asOf === b[i]?.asOf && p.value === b[i]?.value);
}
