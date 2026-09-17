"use client";

import React from "react";
import { DataTable, Tag } from "@/components/ui";
import type { VerificationView } from "@/lib/fp-display";

const TONE: Record<VerificationView["resultTone"], "red" | "green" | "amber" | "neutral"> = {
  red: "red",
  green: "green",
  amber: "amber",
  neutral: "neutral",
};

export default function VerificationPanel({
  view,
  compact,
}: {
  view: VerificationView;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-line p-4 space-y-3" data-testid="verification-panel">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-[15px] font-semibold text-textmain">{view.objectName}</h4>
        <span className="num text-[12px] text-textsub">对象编号 {view.objectId}</span>
        <span className="text-[13px] text-textsub">{view.ruleName}</span>
        <span className="num text-[12px] text-textsub">规则编号 {view.ruleId}</span>
      </div>

      <div>
        <div className="text-[12px] text-textsub mb-1">核验要求</div>
        <p className="text-[14px] text-textmain leading-6">{view.requirement}</p>
      </div>

      <div>
        <div className="text-[12px] text-textsub mb-1">实际事实</div>
        {view.facts.length === 0 ? (
          <p className="text-[13px] text-textsub">暂无已核对事实。</p>
        ) : (
          <DataTable
            dense
            rows={view.facts}
            rowKey={(f) => f.label}
            columns={[
              { key: "l", title: "业务字段", width: "180px", render: (f) => f.label },
              { key: "v", title: "核验数值", render: (f) => <span className="num">{f.value}</span> },
              { key: "n", title: "说明", render: (f) => <span className="text-[12px] text-textsub">{f.note ?? "—"}</span> },
            ]}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-textsub">核验结果</span>
        <Tag tone={TONE[view.resultTone]}>{view.resultLabel}</Tag>
      </div>

      {!compact && (
        <div className="text-[12px] text-textsub leading-5 space-y-0.5">
          <div>计算口径：{view.formula}</div>
          <div>
            规则版本 {view.ruleVersion}
            {view.window ? `｜观察窗口 ${view.window}` : ""}
          </div>
          {(view.sourceSystem || view.sourceDoc || view.sourceDate) && (
            <div>
              {view.sourceSystem ? `来源 ${view.sourceSystem}` : ""}
              {view.sourceDoc ? `｜单据 ${view.sourceDoc}` : ""}
              {view.sourceDate ? `｜日期 ${view.sourceDate}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
