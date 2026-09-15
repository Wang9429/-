"use client";

import React from "react";

/**
 * 首页横向肩形箭头。每个箭头只放“阶段名称 + 未关闭事项N件”，
 * 不放对象数、场景数、覆盖率或进度百分比（完整业需 3.5 / 5.2）。
 * 选中用主蓝描边 + 明确选中标识；风险仍用红黄独立语义，两者不互相覆盖。
 */

export interface ChevronItem {
  id: string;
  name: string;
  openCount: number;
  severity: "red" | "yellow" | null;
  /** 业务状态说明，用于悬停提示；与监管状态分开 */
  businessNote?: string;
}

const ARROW = 13;
const outerClip = (first: boolean) =>
  first
    ? `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%)`
    : `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%, ${ARROW}px 50%)`;

export default function ChevronFlow({
  items,
  value,
  onChange,
  ariaLabel = "业务阶段",
}: {
  items: ChevronItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 h-[62px] px-3 rounded-[6px] border text-[13px] transition-colors duration-150 ${
          value === null
            ? "border-brand bg-tint text-brand font-medium"
            : "border-line bg-surface text-textsub hover:bg-tint"
        }`}
        title="默认选项，表示本领域全部环节；不是第一个业务流程阶段"
      >
        全部环节
      </button>
      <div
        className="flex-1 min-w-0 overflow-x-auto pb-1"
        role="tablist"
        aria-label={ariaLabel}
      >
        <div className="flex items-stretch min-w-max">
          {items.map((item, i) => {
            const selected = value === item.id;
            const borderColor = selected ? "var(--brand)" : "var(--border)";
            const innerBg = selected ? "var(--tint)" : "#ffffff";
            const countTone =
              item.openCount === 0
                ? "var(--risk-neutral-fg)"
                : item.severity === "red"
                  ? "var(--risk-red-fg)"
                  : "var(--risk-amber-fg)";
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(item.id)}
                title={`${item.name}｜未关闭事项 ${item.openCount} 件${
                  item.businessNote ? `｜业务状态：${item.businessNote}` : ""
                }｜统计范围：当前组织及期间内与本环节实际关联的事项去重`}
                className="relative h-[62px] shrink-0 transition-[filter] duration-150 hover:brightness-[0.99]"
                style={{
                  width: 132,
                  marginLeft: i === 0 ? 0 : -ARROW + 3,
                  padding: selected ? 2 : 1,
                  background: borderColor,
                  clipPath: outerClip(i === 0),
                  zIndex: items.length - i,
                }}
              >
                <span
                  className="absolute inset-0 flex flex-col justify-center"
                  style={{
                    margin: selected ? 2 : 1,
                    background: innerBg,
                    clipPath: outerClip(i === 0),
                    paddingLeft: i === 0 ? 14 : ARROW + 10,
                    paddingRight: ARROW + 6,
                  }}
                >
                  <span
                    className={`text-[13px] leading-[18px] text-left whitespace-nowrap ${
                      selected ? "text-brand font-medium" : "text-textmain"
                    }`}
                  >
                    {item.name}
                  </span>
                  <span className="text-left text-[12px] leading-[18px] mt-0.5">
                    <span className="text-textsub">未关闭 </span>
                    <span className="num font-semibold" style={{ color: countTone }}>
                      {item.openCount}
                    </span>
                    <span className="text-textsub"> 件</span>
                    {item.openCount > 0 && (
                      <span style={{ color: countTone }} aria-hidden>
                        {" "}
                        {item.severity === "red" ? "●" : "▲"}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <span className="absolute left-0 bottom-0 h-[3px] bg-brand" style={{ right: ARROW + 4, left: i === 0 ? 12 : ARROW + 8 }} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
