import { seed } from "./seed";
import type { PriceObservation } from "./types";

/**
 * 历史事件窗口分析（完整业需 9.4）。
 * 基准日采用事件发生前最近一个有效观察日；标准化值 = 价格/基期价格×100。
 * 波动率按同频率对数收益率样本标准差计算，样本不足 20 个显示样本不足，
 * 不插值、不前值填充凑样本。
 */

const ANNUALIZE = 252;
const MIN_SAMPLES = 20;

export interface WindowPoint {
  date: string;
  value: number;
  normalized: number;
  offset: number;
}

export interface WindowStats {
  seriesId: string;
  seriesName: string;
  unit: string;
  baseDate: string | null;
  baseValue: number | null;
  points: WindowPoint[];
  endChangePct: number | null;
  maxChangePct: number | null;
  minChangePct: number | null;
  preMean: number | null;
  postMean: number | null;
  meanChangePct: number | null;
  preVolatility: number | null;
  postVolatility: number | null;
  preSamples: number;
  postSamples: number;
  note: string[];
}

const obsFor = (seriesId: string): PriceObservation[] =>
  seed.price_observations
    .filter((o) => o.series_id === seriesId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function logReturnStd(values: number[]): number | null {
  if (values.length < 2) return null;
  const rets: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] <= 0 || values[i - 1] <= 0) return null; // 非正价格不做对数收益率
    rets.push(Math.log(values[i] / values[i - 1]));
  }
  if (rets.length < MIN_SAMPLES) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(ANNUALIZE) * 100;
}

export function analyzeWindow(
  seriesId: string,
  eventDate: string,
  beforeDays: number,
  afterDays: number,
): WindowStats {
  const series = seed.price_series.find((s) => s.id === seriesId);
  const obs = obsFor(seriesId);
  const note: string[] = [];

  const before = obs.filter((o) => o.date < eventDate);
  const base = before.length ? before[before.length - 1] : null;
  if (!base) {
    note.push("事件发生前没有有效观察日，无法建立基期。");
  } else if (base.date !== addDays(eventDate, -1)) {
    note.push(`基准日采用事件发生前最近一个有效观察日 ${base.date}（非交易日与缺失日已跳过）。`);
  }

  const from = addDays(eventDate, -beforeDays);
  const to = addDays(eventDate, afterDays);
  const windowObs = obs.filter((o) => o.date >= from && o.date <= to);

  if (windowObs.length && (windowObs[0].date > from || windowObs[windowObs.length - 1].date < to)) {
    note.push("窗口存在截断：序列样本未完整覆盖所选前后区间。");
  }

  const points: WindowPoint[] = windowObs.map((o) => ({
    date: o.date,
    value: o.value,
    normalized: base ? (o.value / base.value) * 100 : 0,
    offset: Math.round(
      (Date.parse(`${o.date}T00:00:00Z`) - Date.parse(`${eventDate}T00:00:00Z`)) / 86400000,
    ),
  }));

  const pre = windowObs.filter((o) => o.date < eventDate).map((o) => o.value);
  const post = windowObs.filter((o) => o.date >= eventDate).map((o) => o.value);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const preMean = mean(pre);
  const postMean = mean(post);

  const last = points[points.length - 1];
  const normalized = points.map((p) => p.normalized);

  const preVol = logReturnStd(pre);
  const postVol = logReturnStd(post);
  if (preVol === null && pre.length > 1) note.push(`事件前有效收益率样本 ${Math.max(pre.length - 1, 0)} 个，少于 ${MIN_SAMPLES} 个，波动率显示样本不足。`);
  if (postVol === null && post.length > 1) note.push(`事件后有效收益率样本 ${Math.max(post.length - 1, 0)} 个，少于 ${MIN_SAMPLES} 个，波动率显示样本不足。`);

  return {
    seriesId,
    seriesName: series?.name ?? seriesId,
    unit: series?.unit ?? "",
    baseDate: base?.date ?? null,
    baseValue: base?.value ?? null,
    points,
    endChangePct: base && last ? last.normalized - 100 : null,
    maxChangePct: normalized.length ? Math.max(...normalized) - 100 : null,
    minChangePct: normalized.length ? Math.min(...normalized) - 100 : null,
    preMean,
    postMean,
    meanChangePct: preMean && postMean ? ((postMean - preMean) / preMean) * 100 : null,
    preVolatility: preVol,
    postVolatility: postVol,
    preSamples: Math.max(pre.length - 1, 0),
    postSamples: Math.max(post.length - 1, 0),
    note,
  };
}

/** 同一事件窗口内是否还有其他已登记事件，用于标注重叠。 */
export function overlappingEvents(eventId: string, from: string, to: string) {
  return seed.international_events.filter(
    (e) => e.id !== eventId && e.event_date >= from && e.event_date <= to,
  );
}
