"use client";

import React from "react";
import { fmtAmountSmart } from "@/lib/format";
import type { IndicatorDef } from "@/lib/metrics";
import type { TrendPoint, TrendSpec } from "@/lib/fp-trend";

function formatPoint(def: IndicatorDef, value: number): string {
  if (def.kind === "amount") return `${fmtAmountSmart(value)}${def.unit ? ` ${def.unit}` : ""}`;
  if (def.unit === "倍") return `${value.toFixed(2)} 倍`;
  if (def.kind === "count") return `${value}${def.unit}`;
  return `${value.toFixed(2)}${def.unit === "%" || def.kind === "ratio" || def.kind === "signed_ratio" ? "%" : def.unit}`;
}

function segments(points: TrendPoint[]): TrendPoint[][] {
  const out: TrendPoint[][] = [];
  let cur: TrendPoint[] = [];
  for (const p of points) {
    if (p.value === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function CompactSparkline({
  def,
  points,
  spec,
}: {
  def: IndicatorDef;
  points: TrendPoint[];
  spec: TrendSpec;
}) {
  const usable = points.filter((p) => p.value !== null);
  if (usable.length < spec.minPoints) return null;
  const vals = usable.map((p) => p.value as number);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const pad = 3;
  const xy = (p: TrendPoint, i: number, arr: TrendPoint[]) => {
    const idx = points.indexOf(p);
    const x = pad + (idx / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - (((p.value as number) - min) / span) * (h - pad * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  };
  return (
    <div className="mt-1.5" data-testid={`spark-${def.id}`} data-trend-chart="home">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden={false} role="img">
        <title>
          {spec.chartLabel}：
          {usable.map((p) => `${p.label} ${formatPoint(def, p.value as number)}`).join("，")}
        </title>
        {segments(points).map((seg, i) => (
          <path
            key={i}
            d={seg.map((p, j) => xy(p, j, seg)).join(" ")}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {usable.map((p) => {
          const idx = points.indexOf(p);
          const x = pad + (idx / Math.max(1, points.length - 1)) * (w - pad * 2);
          const y = h - pad - (((p.value as number) - min) / span) * (h - pad * 2);
          return <circle key={p.asOf} cx={x} cy={y} r="2" fill="var(--brand)" />;
        })}
      </svg>
      <div className="text-[11px] text-textsub leading-4">{spec.chartLabel}</div>
    </div>
  );
}

export function DetailTrend({
  def,
  points,
  spec,
}: {
  def: IndicatorDef;
  points: TrendPoint[];
  spec: TrendSpec;
}) {
  const usable = points.filter((p) => p.value !== null);
  if (usable.length < spec.minPoints) return null;
  const vals = usable.map((p) => p.value as number);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 560;
  const h = 160;
  const padX = 36;
  const padY = 18;
  const xy = (p: TrendPoint, i: number) => {
    const idx = points.indexOf(p);
    const x = padX + (idx / Math.max(1, points.length - 1)) * (w - padX * 2);
    const y = h - padY - (((p.value as number) - min) / span) * (h - padY * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  };
  return (
    <div className="border border-line rounded-[8px] p-4 bg-surface" data-testid="drawer-trend" data-trend-chart="detail">
      <div className="text-[14px] font-medium mb-1">趋势</div>
      <div className="text-[12px] text-textsub mb-2">{spec.chartLabel}，与首页小图同源，缺期留空不补零</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="var(--line)" />
        {min < 0 && (
          <line
            x1={padX}
            x2={w - padX}
            y1={h - padY - ((0 - min) / span) * (h - padY * 2)}
            y2={h - padY - ((0 - min) / span) * (h - padY * 2)}
            stroke="var(--line)"
            strokeDasharray="4 3"
          />
        )}
        {segments(points).map((seg, i) => (
          <path
            key={i}
            d={seg.map((p, j) => xy(p, j)).join(" ")}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {usable.map((p) => {
          const idx = points.indexOf(p);
          const x = padX + (idx / Math.max(1, points.length - 1)) * (w - padX * 2);
          const y = h - padY - (((p.value as number) - min) / span) * (h - padY * 2);
          return (
            <g key={p.asOf}>
              <circle cx={x} cy={y} r="3.5" fill="var(--brand)">
                <title>{`${p.label} ${formatPoint(def, p.value as number)}`}</title>
              </circle>
              <text x={x} y={h - 4} textAnchor="middle" className="fill-current" fontSize="10">
                {p.label.replace(/^\d{4}年/, "").replace("季度", "季")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function valueTimeLabel(spec: TrendSpec | null | undefined, halfYear: boolean): string | undefined {
  if (!spec) return undefined;
  if (spec.timeBasis === "period_amount" && halfYear) return spec.valueLabel;
  if (spec.timeBasis === "same_length_period_return") return spec.valueLabel;
  if (spec.timeBasis === "period_end" || spec.timeBasis === "point_snapshot") return spec.valueLabel;
  return spec.valueLabel;
}
