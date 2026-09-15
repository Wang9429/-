"use client";

import React, { useMemo, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Tag, useOverlay, useOverlayCount } from "@/components/ui";
import { config, intersectOrgScope, objectAllowed, riskVisible } from "@/lib/config";
import { findObject } from "@/lib/objects";
import { useDemoStore } from "@/lib/store";
import { INDICATORS, computeIndicator } from "@/lib/metrics";
import { seed } from "@/lib/seed";
import { fmtAmount } from "@/lib/format";

const AiUiContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
} | null>(null);

export function AiUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <AiUiContext.Provider value={value}>{children}</AiUiContext.Provider>;
}

function useAiUi() {
  const ctx = React.useContext(AiUiContext);
  if (!ctx) throw new Error("AiUiProvider missing");
  return ctx;
}

/** 顶栏入口：页面内容不再被右下角悬浮按钮挡住。 */
export function AiToolbarButton() {
  const { open, setOpen } = useAiUi();
  if (open) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="h-9 px-3 rounded-[8px] border border-brand bg-brand text-white text-[13px] font-medium hover:bg-brandstrong"
      title="AI分析"
    >
      AI分析
    </button>
  );
}

/**
 * 右下 AI 分析入口。未连接真实模型时标注预置分析，
 * 只对已有样例事实的任务给出可点击依据。
 */
export default function AiPanel() {
  const { filters, risks, user, canAct } = useDemoStore();
  const { open, setOpen } = useAiUi();
  const [task, setTask] = useState<string>("explain_metric");
  const [scopeNote, setScopeNote] = useState(false);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const overlayCount = useOverlayCount();
  const { zIndex, containerRef } = useOverlay(open, close, { isolateFocus: true });
  const fabZ = 40 + (overlayCount + 1) * 10;
  const showFab = !open && overlayCount > 0;
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!showFab) {
      setHeaderHost(null);
      return;
    }
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-overlay-header-actions]")];
    setHeaderHost(nodes.at(-1) ?? null);
  }, [showFab, overlayCount]);

  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );

  const content = useMemo(() => {
    if (!canAct("ai.use")) {
      return {
        title: "当前身份不能使用 AI 分析",
        sections: [{ h: "说明", p: "只读或配置维护身份不能读取业务分析。请切换已获授权的监管身份后再分析。" }],
      };
    }
    if (user && user.data_scope.mode === "none") {
      return {
        title: "当前身份不能读取业务分析",
        sections: [{ h: "说明", p: "系统配置管理员不自动获得业务数据。请切换总部或单位监管身份后再分析。" }],
      };
    }

    const objectInScope = (objectId: string) => {
      const obj = findObject(objectId);
      if (!obj) return false;
      return orgIds.has(obj.orgId) && objectAllowed(user, obj.orgId, objectId);
    };
    const riskInScope = (id: string) => {
      const r = risks.find((x) => x.id === id);
      return Boolean(r && orgIds.has(r.owner_org_id) && riskVisible(user, r));
    };

    if (task === "explain_metric") {
      if (!objectInScope("FA-P001")) {
        return {
          title: "超出当前授权范围",
          sections: [{ h: "说明", p: "投资成本偏差分析绑定基地能力提升项目，当前用户授权范围或筛选范围内不可见该对象。" }],
        };
      }
      const def = INDICATORS.find((i) => i.id === "FA-I07")!;
      const leaf = def.leaves({ ...filters, risks }).find((l) => l.objectId === "FA-P001");
      const m = computeIndicator(def, new Set(["ORG-A1"]), { ...filters, risks });
      return {
        title: "投资成本偏差解释",
        sections: [
          {
            h: "分析结论摘要",
            p: `基地能力提升项目预计完工投资 ${fmtAmount(11800)} 万元，有效批准概算 ${fmtAmount(10000)} 万元，差额 ${fmtAmount(1800)} 万元，偏差率 18%。这是预测偏差，不能直接解释为已经超支。`,
          },
          {
            h: "关键事实与依据",
            p: leaf
              ? leaf.extras.map((x) => `${x.label}：${x.value}`).join("；")
              : `当前范围 ${filters.orgId}，期间 ${filters.periodStart}~${filters.periodEnd}。`,
          },
          {
            h: "待核查问题",
            p: "没有原批准成本分项和变化记录时，只能解释当前五项构成，不能认定某一成本包造成全部超概。",
          },
          {
            h: "建议采取的动作",
            p: "打开该项目计算依据核对五项构成来源，并在事项中记录核查说明。当前节点指标值 " + (m.value ?? "—") + "%。",
          },
        ],
      };
    }
    if (task === "explain_hit") {
      if (!riskInScope("R07") || !objectInScope("P-PAY001")) {
        return {
          title: "超出当前授权范围",
          sections: [{ h: "说明", p: "付款事项不在当前用户授权范围或筛选范围内。" }],
        };
      }
      const r = risks.find((x) => x.id === "R07");
      return {
        title: "付款事项命中依据",
        sections: [
          { h: "分析结论摘要", p: "付款超有效批准 400 万元，形成核查线索；未超过业务可支付上限 2000 万元。" },
          { h: "关键事实与依据", p: "实付 1200 万元，有效批准 800 万元，业务可支付上限 2000 万元。资金、工程、国际化打开同一事项。" },
          { h: "待核查问题", p: "是否存在可覆盖差额的当时有效批准？是否属于控制缺陷而非已确认损失？" },
          { h: "建议采取的动作", p: r ? `打开 ${r.title}，由单位办理人员提交整改材料，总部复核人员独立复核。` : "打开付款事项办理。" },
        ],
      };
    }
    if (task === "compare_materials") {
      if (!objectInScope("AS001")) {
        return {
          title: "超出当前授权范围",
          sections: [{ h: "说明", p: "专用装备A 不在当前用户授权范围或筛选范围内。" }],
        };
      }
      const as001 = seed.assets.find((a) => a.id === "AS001");
      return {
        title: "资产利用核查建议",
        sections: [
          { h: "分析结论摘要", p: "专用装备A 连续两个完整季度利用率低于阈值，已形成整改逾期事项。" },
          { h: "关键事实与依据", p: "2025 年四季度 48%、2026 年一季度 46%；4–6 月 47%、45%、40% 为月度走势。同类资产总体利用率仍可为 60%。" },
          { h: "待核查问题", p: "数据本身不能证明投资决策失误或资产已经闲置。需核任务需求、可用工时、检维修和调配。" },
          { h: "建议采取的动作", p: as001 ? `打开 ${as001.name} 档案，对照专用装备B 本期利用率。` : "打开资产档案。" },
        ],
      };
    }
    if (!objectInScope("ENG-P001")) {
      return {
        title: "超出当前授权范围",
        sections: [{ h: "说明", p: "境外工程项目不在当前用户授权范围或筛选范围内。" }],
      };
    }
    const eng = seed.engineering_projects.find((p) => p.id === "ENG-P001");
    return {
      title: "境外项目情景说明",
      sections: [
        { h: "分析结论摘要", p: "基础预计完工毛利率 12%。在钢材 +10%、运费 +25% 假设下，增量成本 148 万元，情景毛利率 11.26%。" },
        { h: "关键事实与依据", p: `合同收入 20000 万元，基准成本 17600 万元。${eng ? eng.name : "境外海洋工程项目"} 关联航线事件。` },
        { h: "待核查问题", p: "此结果是条件测算，不是价格预测，也不是已发生损失 148 万元。" },
        { h: "建议采取的动作", p: "在国际化业务中调整冲击假设，并回到工程领域核对基础预测未被覆盖。" },
      ],
    };
  }, [task, filters, risks, canAct, user, orgIds]);

  const fabButton = (
    <button
      type="button"
      data-ai-fab=""
      onClick={() => setOpen(true)}
      className={
        headerHost
          ? "h-8 px-2.5 rounded-[6px] border border-brand bg-brand text-white text-[12px] font-medium hover:bg-brandstrong"
          : "fixed h-11 px-3 rounded-full text-white text-[13px] font-medium shadow-[0_8px_20px_rgba(11,31,58,0.25)] hover:bg-brandstrong"
      }
      style={
        headerHost
          ? undefined
          : {
              left: 16,
              bottom: 24,
              background: "var(--brand)",
              zIndex: fabZ,
            }
      }
      title="AI分析（抽屉打开时仍可使用）"
    >
      AI分析
    </button>
  );

  return (
    <>
      {showFab && (headerHost ? createPortal(fabButton, headerHost) : fabButton)}
      {open && (
        <div
          ref={containerRef}
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex }}
          role="dialog"
          aria-modal="true"
          aria-label="AI分析"
          tabIndex={-1}
        >
          <div className="absolute inset-0 bg-[#0b1f3a]/25 sup-fade pointer-events-none" aria-hidden />
          <aside className="absolute top-0 right-0 h-full w-[460px] max-w-[100vw] bg-surface border-l border-line flex flex-col shadow-[-8px_0_24px_rgba(11,31,58,0.12)] pointer-events-auto">
          <div className="h-14 px-5 border-b border-line flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold">AI分析</div>
              <button type="button" className="text-[12px] text-brand hover:underline" onClick={() => setScopeNote((v) => !v)}>
                {config.ai.mode_display} · 未连接模型服务
              </button>
            </div>
            <button type="button" className="text-textsub hover:text-textmain" onClick={close} aria-label="关闭">
              ✕
            </button>
          </div>
          {scopeNote && (
            <div className="px-5 py-3 text-[12px] text-textsub border-b border-line leading-5">
              当前为预置分析。支持指标解释、规则命中、材料比对和核查建议四类任务，输出绑定已有样例事实。不替代专业判断，不自动关闭事项或发布配置。
            </div>
          )}
          <div className="px-5 py-3 flex flex-wrap gap-1.5 border-b border-line">
            {config.ai.tasks.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTask(t.id)}
                className={`h-8 px-2.5 rounded-[6px] text-[12px] border ${
                  task === t.id ? "bg-brand text-white border-brand" : "border-line text-textmain hover:bg-tint"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
            <Tag tone="brand">{content.title}</Tag>
            {content.sections.map((s) => (
              <div key={s.h}>
                <div className="text-[13px] font-medium text-textmain mb-1">{s.h}</div>
                <p className="text-[13px] text-textsub leading-6">{s.p}</p>
              </div>
            ))}
            <p className="text-[12px] text-textsub">{config.ai.unrecognized_question}</p>
          </div>
          <div className="px-5 py-3 border-t border-line">
            <Button onClick={close}>关闭</Button>
          </div>
          </aside>
        </div>
      )}
    </>
  );
}
