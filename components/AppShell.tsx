"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import { NAV_ITEMS, AS_OF, seed } from "@/lib/seed";
import { orgById, orgLevelLabel, orgPath } from "@/lib/org";
import { authorizedObjectIds, authorizedOrgIds, can, canDomain, config, riskVisible } from "@/lib/config";
import { useDemoStore } from "@/lib/store";
import { Modal, Tag, selectClass } from "@/components/ui";
import { isOpen } from "@/lib/risks";
import AiPanel from "@/components/AiPanel";

const PERIOD_OPTIONS = [
  { id: "h1-2026", label: "2026年上半年（默认）", start: "2026-01-01", end: "2026-06-30" },
  { id: "q2-2026", label: "2026年第二季度", start: "2026-04-01", end: "2026-06-30" },
  { id: "q1-2026", label: "2026年第一季度", start: "2026-01-01", end: "2026-03-31" },
  { id: "y2025-h2", label: "2025年下半年（历史事实范围）", start: "2025-07-01", end: "2025-12-31" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    filters,
    setFilters,
    dirty,
    saveError,
    user,
    setUserId,
    configUsers,
    risks,
  } = useDemoStore();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [more, setMore] = useState(false);

  const allowedOrgs = useMemo(() => authorizedOrgIds(user), [user]);
  const pendingCount = useMemo(
    () => risks.filter((r) => isOpen(r) && riskVisible(user, r)).length,
    [risks, user],
  );
  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => can(user, "business.read") && canDomain(user, item.domain)),
    [user],
  );

  const currentPeriodId =
    PERIOD_OPTIONS.find((p) => p.start === filters.periodStart && p.end === filters.periodEnd)?.id ??
    "custom";

  const path = orgPath(filters.orgId);
  const orgOptions = seed.organizations.filter((o) => allowedOrgs.has(o.id));

  return (
    <div className="min-h-screen flex bg-pagebg">
      <nav
        className="shrink-0 sticky top-0 h-screen flex flex-col"
        style={{
          background: "var(--nav-deep)",
          flex: "0 0 248px",
          width: 248,
        }}
        aria-label="一级导航"
      >
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-white text-[15px] font-semibold tracking-wide leading-5">
            {config.ui.brand_lines[0]}
          </div>
          <div className="text-[#E7EFFA] text-[15px] mt-0.5 leading-5">{config.ui.brand_lines[1]}</div>
        </div>
        <ul className="py-2 flex-1 overflow-auto min-h-0">
          {navItems.map((item) => {
            const active = pathname === item.route || pathname.startsWith(`${item.route}/`);
            return (
              <li key={item.id}>
                <Link
                  href={item.route}
                  className={`relative flex items-center gap-2.5 px-5 h-12 text-[15px] transition-colors duration-150 ${
                    active ? "text-white font-medium" : "text-[#E7EFFA] hover:text-white hover:bg-white/5"
                  }`}
                  style={active ? { background: "var(--nav-active)" } : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {active && <span className="absolute left-0 top-0 h-full w-[3px] bg-white" />}
                  <span className="min-w-0 leading-5">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-white/10">
          <Link
            href="/settings"
            className={`relative flex items-center px-5 h-12 text-[15px] ${
              pathname.startsWith("/settings")
                ? "text-white font-medium"
                : "text-[#E7EFFA] hover:text-white hover:bg-white/5"
            }`}
            style={pathname.startsWith("/settings") ? { background: "var(--nav-active)" } : undefined}
          >
            {pathname.startsWith("/settings") && (
              <span className="absolute left-0 top-0 h-full w-[3px] bg-white" />
            )}
            系统配置
          </Link>
          <div className="px-5 py-3 text-[11px] text-[#7f9bc4] leading-4">
            业务截至日 {AS_OF}
            <br />
            合成样例 · 功能验证
          </div>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[56px] shrink-0 bg-surface border-b border-line sticky top-0 z-30 flex items-center gap-3 px-6">
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-[12px] text-textsub shrink-0">组织范围</label>
            <select
              className={`${selectClass} w-[200px]`}
              value={allowedOrgs.has(filters.orgId) ? filters.orgId : orgOptions[0]?.id ?? filters.orgId}
              onChange={(e) => setFilters({ orgId: e.target.value })}
              aria-label="全局组织范围"
            >
              {(orgOptions.length ? orgOptions : seed.organizations).map((o) => (
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
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[12px] text-textsub">截至日</label>
            <select className={`${selectClass} w-[124px]`} value={filters.asOf} aria-label="业务截至日" disabled>
              <option value={AS_OF}>{AS_OF}</option>
            </select>
          </div>

          <div className="flex-1" />

          <Link
            href="/supervision-workbench"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-line text-[13px] text-textmain hover:bg-tint"
          >
            监管工作台
            <span className="num inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px]">
              {pendingCount}
            </span>
          </Link>
          <button
            className="h-8 px-3 rounded-[6px] border border-line text-[13px] text-textmain hover:bg-tint"
            onClick={() => setNoticeOpen(true)}
          >
            {config.data_notice.entry_label}
          </button>
          <div className="relative">
            <button
              className="h-8 px-3 rounded-[6px] border border-line text-[13px] text-textmain hover:bg-tint"
              onClick={() => setMore((v) => !v)}
            >
              更多
            </button>
            {more && (
              <div className="absolute right-0 mt-1 bg-surface border border-line rounded-[6px] shadow-md z-40 min-w-[160px] py-1">
                <Link href="/scenario-library" className="block px-3 py-2 text-[13px] hover:bg-tint" onClick={() => setMore(false)}>
                  场景规则库
                </Link>
                <Link href="/data-sources" className="block px-3 py-2 text-[13px] hover:bg-tint" onClick={() => setMore(false)}>
                  数据与运行
                </Link>
                <Link href="/settings?tab=data" className="block px-3 py-2 text-[13px] hover:bg-tint" onClick={() => setMore(false)}>
                  系统配置
                </Link>
              </div>
            )}
          </div>
          <select
            className={`${selectClass} w-[176px]`}
            value={user?.id ?? ""}
            onChange={(e) => setUserId(e.target.value)}
            aria-label="当前用户"
            title="本地身份切换，用于验证授权产品行为，不等于正式登录"
          >
            {configUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </header>

        <div className="px-6 py-2 bg-[#fafcff] border-b border-line flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-textsub">
          <span>
            当前范围：
            <span className="text-textmain">{path.map((o) => o.name).join(" / ")}</span>
            {orgById(filters.orgId) && (
              <>
                （{orgLevelLabel(orgById(filters.orgId)!)}·{filters.includeChildren ? "含下级" : "仅本级"}）
              </>
            )}
          </span>
          <span>
            统计期间：
            <span className="num text-textmain">
              {filters.periodStart} ~ {filters.periodEnd}
            </span>
          </span>
          <span>
            截至日：<span className="num text-textmain">{filters.asOf}</span>
          </span>
          <span>
            当前用户：<span className="text-textmain">{user?.name ?? "—"}</span>
          </span>
          {dirty && <Tag tone="brand">含本地办理修改</Tag>}
          {saveError && <Tag tone="red">{saveError}</Tag>}
          {user && !can(user, "business.read") && <Tag tone="amber">当前身份无业务数据权限</Tag>}
        </div>

        <main className="flex-1 min-w-0 p-6" key={user?.id ?? "anon"}>
          {children}
        </main>
      </div>

      <AiPanel key={user?.id ?? "anon"} />

      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} title="数据说明" width={640}>
        <p className="text-[14px] leading-6 text-textmain">{config.data_notice.text}</p>
        <p className="text-[13px] text-textsub mt-3 leading-6">
          真实历史事件日期与样例行情分别标识。AI 面板当前为预置分析，未连接模型服务。匿名名称不等于真实经营数据。
        </p>
      </Modal>
    </div>
  );
}
