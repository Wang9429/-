"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import IndicatorDrawer, { formatMetricParts } from "@/components/IndicatorDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import { Card, DataTable, KpiCard, Modal, Notice, SeverityTag, Tag } from "@/components/ui";
import {
  IconAlert,
  IconBars,
  IconClock,
  IconClipboard,
  DOMAIN_ICONS,
} from "@/components/icons";
import { DOMAIN_META, coverageRows, seed } from "@/lib/seed";
import { INDICATORS, computeIndicator, indicatorById } from "@/lib/metrics";
import { childOrgs, descendantOrgIds, orgName, ROOT_ORG_ID } from "@/lib/org";
import { authorizedObjectIds, can, canDomain, intersectOrgScope, riskVisible } from "@/lib/config";
import { findObject } from "@/lib/objects";
import { isOpen, isOverdueRectification, riskMatches, statusLabel } from "@/lib/risks";
import { fmtAmountSmart } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import type { DomainId, RiskCase } from "@/lib/types";
import { catalogIndicatorOnHomepage } from "@/lib/live-config";

/**
 * 综合总览（V1.6 口径 + V1.6.1 视觉）。
 * 标题筛选 → 四张指标 → 六领域独立卡 → 重点事项 → 单位风险矩阵 → 待复核 / 近期事件。
 * 事项数字打开共用 Modal 清单，详情抽屉叠在清单之上。
 */

const DOMAIN_KPI: Record<DomainId, string> = {
  FA: "FA-I06",
  EQ: "EQ-I11",
  INTL: "INTL-CNT",
  CASH: "CASH-I02",
  RIGHTS: "RIGHTS-DIFF",
  ENG: "ENG-I01",
};

const DOMAIN_ORDER: DomainId[] = ["FA", "EQ", "INTL", "CASH", "RIGHTS", "ENG"];

function highlightTitle(r: RiskCase): string {
  if (r.id === "R01") return "基地能力提升项目预计投资偏差";
  if (r.id === "R02") return "关键生产设备利用偏低";
  if (r.id === "R05") return "境外工程预计毛利偏离目标";
  return r.title;
}

function highlightFact(r: RiskCase): string {
  if (r.id === "R01") return "预计超有效概算 18%";
  if (r.id === "R02") return "整改期限已过";
  if (r.id === "R05") return "预计 12%／目标 15%";
  return r.title;
}

function progressOf(r: RiskCase, asOf: string): { text: string; tone: "red" | "amber" | "brand" | "neutral" } {
  const overdue = isOverdueRectification(r, asOf);
  if (r.status === "pending_review") return { text: "待核查", tone: "amber" };
  if (r.status === "rectifying" && overdue) return { text: "整改中 · 逾期", tone: "red" };
  if (r.status === "rectifying") return { text: "整改中", tone: "brand" };
  if (r.status === "pending_verification") return { text: "待复核", tone: "brand" };
  return { text: statusLabel[r.status] ?? r.status, tone: "neutral" };
}

export default function OverviewPage() {
  const router = useRouter();
  const { filters, risks, setFilters, user, catalog } = useDemoStore();
  const [riskId, setRiskId] = useState<string | null>(null);
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [caseScope, setCaseScope] = useState<{ title: string; ids: string[] } | null>(null);
  const listScrollRef = useRef(0);

  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );

  const ctx = useMemo(
    () => ({
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      asOf: filters.asOf,
      risks,
      allowedObjectIds: authorizedObjectIds(user),
    }),
    [filters.periodStart, filters.periodEnd, filters.asOf, risks, user],
  );

  const scoped = useMemo(() => risks.filter((r) => riskVisible(user, r) && orgIds.has(r.owner_org_id)), [risks, orgIds, user]);
  const open = scoped.filter(isOpen);
  const red = open.filter((r) => r.severity === "red");
  const overdueRect = open.filter((r) => isOverdueRectification(r, filters.asOf));
  const pendingVerification = open.filter((r) => r.status === "pending_verification");
  const pendingReview = open.filter((r) => r.status === "pending_review");
  const rectifying = open.filter((r) => r.status === "rectifying");

  const domainSummary = useMemo(
    () =>
      DOMAIN_ORDER.filter((d) => canDomain(user, d)).map((d) => {
        const domainRisks = risks.filter((r) => riskVisible(user, r) && riskMatches(r, { domain: d, orgScope: orgIds }));
        const o = domainRisks.filter(isOpen);
        const kpiId = DOMAIN_KPI[d];
        const def = catalogIndicatorOnHomepage(kpiId) ? indicatorById(kpiId) : undefined;
        const kpis = def ? [{ def, metric: computeIndicator(def, orgIds, ctx) }] : [];
        return { domain: d, open: o, red: o.filter((r) => r.severity === "red"), kpis };
      }),
    [risks, orgIds, ctx, user, catalog],
  );

  const matrixOrgs = useMemo(() => {
    const base = filters.orgId === ROOT_ORG_ID ? childOrgs(ROOT_ORG_ID) : childOrgs(filters.orgId);
    const list = (base.length ? base : seed.organizations.filter((o) => o.id === filters.orgId)).filter((o) =>
      orgIds.has(o.id),
    );
    return list;
  }, [filters.orgId, orgIds]);

  const highlightCases = useMemo(() => {
    const preferred = ["R01", "R02", "R05"].map((id) => open.find((r) => r.id === id)).filter(Boolean) as RiskCase[];
    if (preferred.length >= 3) return preferred;
    const rest = open.filter((r) => !preferred.some((p) => p.id === r.id));
    return [...preferred, ...rest].slice(0, 3);
  }, [open]);

  const scopeLabel = `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}`;
  const openCases = (title: string, list: RiskCase[]) => {
    listScrollRef.current = typeof window !== "undefined" ? window.scrollY : 0;
    setCaseScope({ title, ids: list.map((r) => r.id) });
  };
  const closeCaseList = () => {
    const y = listScrollRef.current;
    setCaseScope(null);
    requestAnimationFrame(() => window.scrollTo(0, y));
  };
  const caseRows = caseScope
    ? caseScope.ids.map((id) => risks.find((r) => r.id === id)).filter((r): r is RiskCase => Boolean(r))
    : [];

  const showFaPlan = catalogIndicatorOnHomepage("FA-I06");
  const faDef = indicatorById("FA-I06")!;
  const faMetric = computeIndicator(faDef, orgIds, ctx);
  const faParts = formatMetricParts(faDef, faMetric);

  return (
    <div className="space-y-4">
      {!can(user, "business.read") && (
        <Notice tone="amber" title="当前身份无业务数据权限">
          配置维护权限不自动带来业务数据。请切换总部或单位监管身份查看指标与事项，或进入系统配置。
        </Notice>
      )}

      <PageHeader title="综合总览">
        <FilterBar />
      </PageHeader>

      <div className="reg-kpis">
        {showFaPlan && (
        <KpiCard
          name="固定资产投资计划执行率"
          value={faParts.value}
          unit={faParts.unit}
          compare={
            faMetric.status === "no_business"
              ? "当前范围无业务"
              : faMetric.status === "unknown"
                ? faMetric.emptyReason ?? "数据不足，未评估"
                : (
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="whitespace-nowrap">完成 {fmtAmountSmart(faMetric.numerator)} 万元</span>
                    <span className="whitespace-nowrap">同期计划 {fmtAmountSmart(faMetric.denominator)} 万元</span>
                  </span>
                )
          }
          icon={<IconBars size={20} />}
          scopeLabel={scopeLabel}
          onOpen={() => setIndicatorId("FA-I06")}
          returnKey="FA-I06"
        />
        )}
        <KpiCard
          name="未关闭监管事项"
          value={open.length}
          unit="件"
          compare={<span className="whitespace-nowrap">待核查 {pendingReview.length}／整改中 {rectifying.length}</span>}
          icon={<IconClipboard size={20} />}
          onOpen={() => openCases("未关闭监管事项", open)}
          returnKey="kpi-open-cases"
        />
        <KpiCard
          name="其中高风险事项"
          value={red.length}
          unit="件"
          compareTone="red"
          icon={<IconAlert size={20} />}
          iconTone="red"
          onOpen={() => openCases("高风险未关闭事项", red)}
          returnKey="kpi-red-cases"
        />
        <KpiCard
          name="逾期整改事项"
          value={overdueRect.length}
          unit="件"
          compareTone="red"
          icon={<IconClock size={20} />}
          iconTone="amber"
          onOpen={() => openCases("逾期整改事项", overdueRect)}
          returnKey="kpi-overdue-cases"
        />
      </div>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-[16px] font-semibold text-textmain">六领域监管概况</h2>
        </div>
        <div className="reg-domains">
          {domainSummary.map((s) => {
            const meta = DOMAIN_META[s.domain];
            const Icon = DOMAIN_ICONS[s.domain];
            const kpi = s.kpis[0];
            const parts = kpi ? formatMetricParts(kpi.def, kpi.metric) : { value: "—", unit: "" };
            return (
              <article
                key={s.domain}
                className="reg-domain-card bg-surface border border-line rounded-[10px] shadow-[0_2px_10px_rgba(17,43,77,0.04)] p-5"
              >
                <div className="flex items-center justify-between gap-2 min-h-8">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-[8px] bg-[#EAF1FD] text-brand flex items-center justify-center shrink-0">
                      {Icon && <Icon size={16} />}
                    </span>
                    <Link href={meta.route} className="text-[16px] font-semibold text-textmain hover:text-brand leading-5 whitespace-nowrap">
                      {meta.label}
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[12px] rounded-full px-2 py-0.5 border border-line whitespace-nowrap"
                    style={{ color: s.open.length ? "var(--risk-amber-fg)" : "var(--text-sub)" }}
                    data-overlay-return={`domain-open-${s.domain}`}
                    onClick={() => openCases(`${meta.label}未关闭事项`, s.open)}
                  >
                    未关闭 {s.open.length} 件
                  </button>
                </div>
                {kpi ? (
                  <button
                    type="button"
                    onClick={() => setIndicatorId(kpi.def.id)}
                    className="text-left min-h-[56px]"
                    title={kpi.def.name}
                    data-overlay-return={kpi.def.id}
                  >
                    <div className="text-[13px] text-textsub leading-5">{kpi.def.name}</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="num text-[26px] font-semibold text-textmain leading-none">
                        {parts.unit === "%" ? `${parts.value}%` : parts.value}
                      </span>
                      {parts.unit && parts.unit !== "%" && (
                        <span className="text-[14px] text-textsub whitespace-nowrap">{parts.unit}</span>
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="min-h-[56px] flex items-end">
                    <span className="text-[13px] text-textsub leading-5">当前首页无可展示指标</span>
                  </div>
                )}
                <div className="flex items-center justify-end">
                  <Link href={meta.route} className="text-[13px] text-brand shrink-0 hover:underline whitespace-nowrap">
                    进入领域 →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Card
        title="重点关注事项"
        right={
          <Link href="/supervision-workbench" className="text-[13px] text-brand hover:underline whitespace-nowrap">
            查看全部 →
          </Link>
        }
      >
        <div className="reg-table-wrap">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#f6f8fc]">
                <th className="px-3 py-3 text-left text-[13px] font-semibold text-textsub border-b border-line min-w-[200px]">关注事项</th>
                <th className="px-3 py-3 text-left text-[13px] font-semibold text-textsub border-b border-line min-w-[180px]">关键事实</th>
                <th className="px-3 py-3 text-left text-[13px] font-semibold text-textsub border-b border-line w-[140px] whitespace-nowrap">
                  当前进展
                </th>
                <th className="px-3 py-3 text-right text-[13px] font-semibold text-textsub border-b border-line w-[100px] whitespace-nowrap">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {highlightCases.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[13px] text-textsub">
                    当前范围没有未关闭事项。
                  </td>
                </tr>
              )}
              {highlightCases.map((r) => {
                const prog = progressOf(r, filters.asOf);
                return (
                  <tr key={r.id} className="border-b border-line hover:bg-tint">
                    <td className="px-3 py-2 text-textmain font-medium break-words leading-5 align-top">{highlightTitle(r)}</td>
                    <td className="px-3 py-2 text-textsub break-words leading-5 align-top">{highlightFact(r)}</td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <Tag tone={prog.tone}>{prog.text}</Tag>
                    </td>
                    <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                      <button type="button" className="text-[13px] text-brand hover:underline" onClick={() => setRiskId(r.id)}>
                        查看详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="单位风险分布">
        <div className="reg-table-wrap">
          <table className="reg-matrix w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#f6f8fc]">
                <th className="col-org px-3 py-2.5 text-left text-[13px] font-semibold text-textsub border-b border-line">单位</th>
                {DOMAIN_ORDER.filter((d) => canDomain(user, d)).map((d) => (
                  <th key={d} className="col-domain px-3 py-2.5 text-[13px] font-semibold text-textsub border-b border-line whitespace-nowrap">
                    {DOMAIN_META[d].short}
                  </th>
                ))}
                <th className="col-total px-3 py-2.5 text-[13px] font-semibold text-textsub border-b border-line">合计（去重）</th>
              </tr>
            </thead>
            <tbody>
              {matrixOrgs.map((o) => {
                const scope = new Set([o.id, ...descendantOrgIds(o.id)]);
                const unitRisks = risks.filter(
                  (r) => isOpen(r) && scope.has(r.owner_org_id) && riskVisible(user, r),
                );
                const hasBusiness =
                  coverageRows.some((r) => scope.has(r.owner_org_id)) ||
                  seed.fixed_asset_projects.some((p) => scope.has(p.owner_org_id)) ||
                  seed.equity_projects.some((p) => scope.has(p.owner_org_id)) ||
                  seed.engineering_projects.some((p) => scope.has(p.owner_org_id)) ||
                  seed.accounts.some((a) => scope.has(a.owner_org_id));
                return (
                  <tr key={o.id} className="border-b border-line hover:bg-tint transition-colors duration-150">
                    <td className="col-org px-3 py-2 text-textmain">
                      <button
                        className="hover:text-brand text-left"
                        onClick={() => setFilters({ orgId: o.id, includeChildren: true })}
                      >
                        {o.name}
                      </button>
                      {!hasBusiness && (
                        <div className="mt-1">
                          <Tag tone="neutral">当前范围无业务</Tag>
                        </div>
                      )}
                    </td>
                    {DOMAIN_ORDER.filter((d) => canDomain(user, d)).map((d) => {
                      const cell = unitRisks.filter((r) => riskMatches(r, { domain: d, orgScope: scope }));
                      const cellRed = cell.filter((r) => r.severity === "red").length;
                      return (
                        <td key={d} className="col-domain px-3 py-2">
                          {cell.length === 0 ? (
                            <span className="text-textsub text-[13px] leading-5">
                              {hasBusiness ? "本次监测未发现异常" : "无业务"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="num text-[14px] hover:underline"
                              style={{ color: cellRed ? "var(--risk-red-fg)" : "var(--risk-amber-fg)" }}
                              data-overlay-return={`matrix-${o.id}-${d}`}
                              onClick={() => openCases(`${o.name}·${DOMAIN_META[d].label}未关闭事项`, cell)}
                            >
                              {cell.length}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="col-total px-3 py-2">
                      <button
                        type="button"
                        className="num text-[14px] text-textmain hover:text-brand hover:underline"
                        data-overlay-return={`matrix-${o.id}-total`}
                        onClick={() => openCases(`${o.name}未关闭事项`, unitRisks)}
                      >
                        {unitRisks.length}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="reg-split">
        <Card title="待复核事项">
          <DataTable
            rows={pendingVerification}
            rowKey={(r) => r.id}
            onRowClick={(r) => setRiskId(r.id)}
            empty="当前范围没有待复核事项。"
            compactEmpty
            columns={[
              { key: "title", title: "名称", render: (r) => r.title },
              { key: "org", title: "责任单位", width: "150px", nowrap: true, render: (r) => orgName(r.owner_org_id) },
              {
                key: "overdue",
                title: "整改逾期",
                width: "96px",
                nowrap: true,
                render: (r) => (isOverdueRectification(r, filters.asOf) ? <Tag tone="red">逾期</Tag> : <span className="text-textsub">—</span>),
              },
            ]}
          />
        </Card>

        <Card title="近期外部事件及受影响对象">
          <DataTable
            rows={seed.international_events.slice().sort((a, b) => b.event_date.localeCompare(a.event_date))}
            rowKey={(e) => e.id}
            onRowClick={() => router.push("/international-business")}
            tableClassName="reg-event-table"
            columns={[
              { key: "date", title: "发生时间", width: "102px", nowrap: true, render: (e) => <span className="num">{e.event_date}</span> },
              { key: "title", title: "事件", render: (e) => e.title },
              {
                key: "nature",
                title: "数据性质",
                width: "108px",
                nowrap: true,
                render: (e) => (
                  <Tag tone={e.data_nature === "real_event" ? "brand" : "neutral"}>
                    {e.data_nature === "real_event" ? "真实事件日期" : "模拟事件"}
                  </Tag>
                ),
              },
              {
                key: "affected",
                title: "受影响对象",
                width: "136px",
                render: (e) => {
                  const ids = (e.affected_project_ids ?? []).filter((id) => {
                    const obj = findObject(id);
                    return obj ? orgIds.has(obj.orgId) : false;
                  });
                  return ids.length ? ids.join("、") : "当前范围无受影响对象";
                },
              },
            ]}
          />
        </Card>
      </div>

      <Modal
        open={Boolean(caseScope)}
        onClose={closeCaseList}
        title={caseScope?.title ?? "事项清单"}
        subtitle={`来源范围：${scopeLabel}｜截至日 ${filters.asOf}｜共 ${caseRows.length} 条`}
        width={920}
      >
        <DataTable
          rows={caseRows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setRiskId(r.id)}
          empty="该范围内没有事项。"
          compactEmpty
          columns={[
            { key: "title", title: "名称", render: (r) => r.title },
            { key: "sev", title: "等级", width: "92px", nowrap: true, render: (r) => <SeverityTag severity={r.severity} /> },
            { key: "status", title: "状态", width: "100px", nowrap: true, render: (r) => statusLabel[r.status] },
            { key: "org", title: "责任单位", width: "150px", nowrap: true, render: (r) => orgName(r.owner_org_id) },
            {
              key: "domains",
              title: "涉及领域",
              width: "168px",
              nowrap: true,
              render: (r) => r.domains.map((d) => DOMAIN_META[d].short).join("、"),
            },
            {
              key: "act",
              title: "操作",
              width: "88px",
              align: "right",
              nowrap: true,
              render: (r) => (
                <button
                  type="button"
                  className="text-[13px] text-brand hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRiskId(r.id);
                  }}
                >
                  查看详情
                </button>
              ),
            },
          ]}
        />
      </Modal>

      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel="综合总览" />
      <IndicatorDrawer
        open={Boolean(indicatorId)}
        onClose={() => setIndicatorId(null)}
        indicator={indicatorId ? indicatorById(indicatorId) ?? null : null}
        indicatorOptions={INDICATORS}
        onSwitchIndicator={setIndicatorId}
        initialOrgId={filters.orgId}
        includeChildren={filters.includeChildren}
        scopeLabel={scopeLabel}
      />
    </div>
  );
}
