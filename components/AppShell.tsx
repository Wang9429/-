"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import { NAV_ITEMS, AS_OF, seed } from "@/lib/seed";
import { orgById, orgLevelLabel, orgPath } from "@/lib/org";
import { ROLES, useDemoStore } from "@/lib/store";
import { Button, Modal, Notice, Tag, selectClass } from "@/components/ui";
import { isOpen } from "@/lib/risks";

const PERIOD_OPTIONS = [
  { id: "h1-2026", label: "2026年上半年（默认）", start: "2026-01-01", end: "2026-06-30" },
  { id: "q2-2026", label: "2026年第二季度", start: "2026-04-01", end: "2026-06-30" },
  { id: "q1-2026", label: "2026年第一季度", start: "2026-01-01", end: "2026-03-31" },
  { id: "y2025-h2", label: "2025年下半年（历史事实范围）", start: "2025-07-01", end: "2025-12-31" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { filters, setFilters, resetDemo, dirty, saveError, role, setRole, risks } = useDemoStore();
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => risks.filter((r) => isOpen(r)).length,
    [risks],
  );

  const currentPeriodId =
    PERIOD_OPTIONS.find((p) => p.start === filters.periodStart && p.end === filters.periodEnd)?.id ??
    "custom";

  const path = orgPath(filters.orgId);

  return (
    <div className="min-h-screen flex bg-pagebg">
      {/* 一级导航：深蓝 #0B1F3A，约216px */}
      <nav
        className="w-[216px] shrink-0 min-h-screen sticky top-0 h-screen flex flex-col"
        style={{ background: "var(--nav-deep)" }}
        aria-label="一级导航"
      >
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-white text-[15px] font-semibold tracking-wide">海油工程</div>
          <div className="text-[#9fc0ef] text-[13px] mt-0.5">穿透式监管平台</div>
          <div className="text-[#7f9bc4] text-[11px] mt-2">演示版 V1.3 · 模拟数据</div>
        </div>
        <ul className="py-2 flex-1 overflow-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.route || pathname.startsWith(`${item.route}/`);
            return (
              <li key={item.id}>
                <Link
                  href={item.route}
                  className={`relative flex items-center gap-2 px-5 h-11 text-[14px] transition-colors duration-150 ${
                    active
                      ? "text-white font-medium"
                      : "text-[#c6d6ec] hover:text-white hover:bg-white/5"
                  }`}
                  style={active ? { background: "var(--nav-active)" } : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {active && <span className="absolute left-0 top-0 h-full w-[3px] bg-white" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-[#7f9bc4] leading-4">
          业务截至日固定 {AS_OF}
          <br />
          数据性质：模拟演示
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部工具区：白色，约56px */}
        <header className="h-[56px] shrink-0 bg-surface border-b border-line sticky top-0 z-30 flex items-center gap-3 px-6">
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-[12px] text-textsub shrink-0">组织范围</label>
            <select
              className={`${selectClass} w-[184px]`}
              value={filters.orgId}
              onChange={(e) => setFilters({ orgId: e.target.value })}
              aria-label="全局组织范围"
            >
              {seed.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {"　".repeat(Math.max(0, o.management_level - 1))}
                  {o.name}
                </option>
              ))}
            </select>
            <div className="flex rounded-[6px] border border-line overflow-hidden shrink-0">
              {[
                { v: true, label: "含下级" },
                { v: false, label: "仅本级" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => setFilters({ includeChildren: opt.v })}
                  className={`h-8 px-2.5 text-[12px] transition-colors duration-150 ${
                    filters.includeChildren === opt.v
                      ? "bg-brand text-white"
                      : "bg-surface text-textsub hover:bg-tint"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[12px] text-textsub">统计期间</label>
            <select
              className={`${selectClass} w-[210px]`}
              value={currentPeriodId}
              onChange={(e) => {
                const p = PERIOD_OPTIONS.find((x) => x.id === e.target.value);
                if (p) setFilters({ periodStart: p.start, periodEnd: p.end });
              }}
              aria-label="统计期间"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              {currentPeriodId === "custom" && <option value="custom">自定义期间</option>}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[12px] text-textsub">截至日</label>
            <select
              className={`${selectClass} w-[124px]`}
              value={filters.asOf}
              onChange={(e) => setFilters({ asOf: e.target.value })}
              aria-label="业务截至日"
              title="首版仅开放已有完整快照的 2026-06-30"
            >
              <option value={AS_OF}>{AS_OF}</option>
            </select>
          </div>

          <div className="flex-1" />

          <Link
            href="/supervision-workbench"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-line text-[13px] text-textmain hover:bg-tint transition-colors duration-150"
            title="P77 监管工作台：待核查、整改跟踪、待复核与已办事项"
          >
            监管工作台
            <span className="num inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px]">
              {pendingCount}
            </span>
          </Link>
          <Link
            href="/scenario-library"
            className="h-8 px-3 inline-flex items-center rounded-[6px] border border-line text-[13px] text-textmain hover:bg-tint transition-colors duration-150"
            title="53 项投资子场景、38 项原 KRI 与规则定义"
          >
            场景规则库
          </Link>
          <Link
            href="/data-sources"
            className="h-8 px-3 inline-flex items-center rounded-[6px] border border-line text-[13px] text-textmain hover:bg-tint transition-colors duration-150"
            title="P76 数据情况、规则版本与演示重置"
          >
            数据依据
          </Link>
          <select
            className={`${selectClass} w-[150px]`}
            value={role}
            onChange={(e) => setRole(e.target.value as never)}
            aria-label="演示角色"
            title="角色切换仅改变前端演示范围与按钮，不构成生产权限"
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setResetOpen(true)}>重置演示数据</Button>
        </header>

        {/* 范围说明条 */}
        <div className="px-6 py-2 bg-[#fafcff] border-b border-line flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-textsub">
          <span>
            当前范围：
            <span className="text-textmain">
              {path.map((o) => o.name).join(" / ")}
            </span>
            （{orgLevelLabel(orgById(filters.orgId)!)}·{filters.includeChildren ? "含下级" : "仅本级"}）
          </span>
          <span>
            统计期间：<span className="num text-textmain">{filters.periodStart} ~ {filters.periodEnd}</span>
          </span>
          <span>
            截至日：<span className="num text-textmain">{filters.asOf}</span>
          </span>
          <Tag tone="neutral">{seed.display_notice}</Tag>
          {dirty && <Tag tone="brand">含本地演示办理修改</Tag>}
          {saveError && <Tag tone="red">{saveError}</Tag>}
        </div>

        <main className="flex-1 min-w-0 p-6">{children}</main>

        <footer className="px-6 py-3 text-[12px] text-textsub border-t border-line bg-surface">
          本 Demo 全部主体、人员、金额、业务记录、行情与分析均为模拟数据，不表达海油工程实际经营情况。真实历史事件日期仅作对比锚点，行情曲线为模拟重放。正式接口、实时行情、生产单点登录与真实模型调用不在本 Demo 范围。
        </footer>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="重置演示数据"
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setResetOpen(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                setToast("已恢复种子数据：8 件未关闭事项（红 4、黄 4），R09 保持已排除。");
                setTimeout(() => setToast(null), 4200);
              }}
            >
              确认重置
            </Button>
          </div>
        }
      >
        <Notice tone="amber" title="将清除本地演示修改">
          重置会清除本次会话中的认领、核查结论、整改提交、复核结果、督办与导入批次记录，恢复到种子基线：未关闭
          8 件（红 4、黄 4），待核查 5、整改中 3、当前逾期整改 1（R02），R09 保持已排除。原始种子文件不会被修改。
        </Notice>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] sup-fade">
          <div className="bg-surface border border-line rounded-[8px] shadow-[0_8px_24px_rgba(11,31,58,0.18)] px-4 py-3 text-[13px] text-textmain max-w-sm">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
