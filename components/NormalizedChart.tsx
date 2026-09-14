"use client";

import React from "react";
import type { WindowStats } from "@/lib/market";

/**
 * 基期 100 归一化折线。实际值实线，基期线虚线，事件日以竖线标注。
 * 保留坐标、单位与数据时间；不使用 3D、发光或旋转装饰。
 */

const LINE_COLORS = ["#1D5FD1", "#7aa7e9", "#0b1f3a", "#5a6b83"];

export default function NormalizedChart({
  series,
  height = 240,
  eventLabel,
}: {
  series: WindowStats[];
  height?: number;
  eventLabel?: string;
}) {
  const [hover, setHover] = React.useState<{ x: number; offset: number } | null>(null);

  const usable = series.filter((s) => s.points.length > 1);
  if (usable.length === 0) {
    return (
      <div className="text-[13px] text-textsub py-8 text-center border border-dashed border-line rounded-[6px]">
        所选窗口内没有足够的有效观察样本，无法绘制归一化曲线。
      </div>
    );
  }

  const offsets = usable.flatMap((s) => s.points.map((p) => p.offset));
  const minOff = Math.min(...offsets);
  const maxOff = Math.max(...offsets);
  const values = usable.flatMap((s) => s.points.map((p) => p.normalized));
  const minV = Math.min(...values, 100);
  const maxV = Math.max(...values, 100);
  const padV = (maxV - minV) * 0.12 || 2;
  const lo = minV - padV;
  const hi = maxV + padV;

  const W = 960;
  const H = height;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 26;

  const x = (off: number) => padL + ((off - minOff) / (maxOff - minOff || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);

  const ticks = [lo, (lo + hi) / 2, hi];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 640 }}
        role="img"
        aria-label="事件窗口归一化价格曲线"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const off = minOff + ((px - padL) / (W - padL - padR)) * (maxOff - minOff);
          setHover({ x: px, offset: Math.round(off) });
        }}
      >
        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e1e8f0" strokeWidth={1} />
            <text x={6} y={y(t) + 4} fontSize={11} fill="#5a6b83">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(100)} y2={y(100)} stroke="#9a6700" strokeDasharray="4 3" strokeWidth={1} />
        <text x={W - padR - 60} y={y(100) - 5} fontSize={11} fill="#9a6700">
          基期 100
        </text>

        <line x1={x(0)} x2={x(0)} y1={padT} y2={H - padB} stroke="#b42318" strokeWidth={1} />
        <text x={x(0) + 4} y={padT + 12} fontSize={11} fill="#b42318">
          {eventLabel ?? "事件日"}
        </text>

        {usable.map((s, i) => (
          <path
            key={s.seriesId}
            d={s.points.map((p, j) => `${j === 0 ? "M" : "L"}${x(p.offset)},${y(p.normalized)}`).join(" ")}
            fill="none"
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={1.6}
          />
        ))}

        {hover && (
          <line x1={hover.x} x2={hover.x} y1={padT} y2={H - padB} stroke="#c3d8f7" strokeWidth={1} />
        )}

        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="#e1e8f0" />
        <text x={padL} y={H - 8} fontSize={11} fill="#5a6b83">
          事件前 {Math.abs(minOff)} 天
        </text>
        <text x={W - padR - 80} y={H - 8} fontSize={11} fill="#5a6b83">
          事件后 {maxOff} 天
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
        {usable.map((s, i) => {
          const p = hover ? s.points.reduce((a, b) => (Math.abs(b.offset - hover.offset) < Math.abs(a.offset - hover.offset) ? b : a)) : null;
          return (
            <span key={s.seriesId} className="flex items-center gap-1.5 text-[12px] text-textsub">
              <span className="inline-block w-3 h-[2px]" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
              {s.seriesName}
              {p && (
                <span className="num text-textmain">
                  ｜{p.date}：{p.value.toFixed(2)} {s.unit}（归一 {p.normalized.toFixed(1)}）
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
