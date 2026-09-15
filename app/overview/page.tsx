"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import IndicatorDrawer, { formatMetricParts } from "@/components/IndicatorDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import { Card, DataTable, KpiCard, Notice, SeverityTag, Tag } from "@/components/ui";
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
import { isOpen, isOverdueRectification, riskMatches, statusLabel } from "@/lib/risks";
import { fmtAmountSmart } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import type { DomainId, RiskCase } from "@/lib/types";

/**
 * 综合总览（V1.6 口径 + V1.6.1 视觉）。
 * 标题筛选 → 关注摘要 → 四张指标 → 六领域独立卡 → 重点事项 → 单位风险矩阵。
 */

const DOMAIN_KPI: Record<DomainId, string> = {
  FA: "FA-I06",
  EQ: "EQ-I11",
  INTL: "INTL-CNT",
  CASH: "CASH-I02",
  RIGHTS: "RIGHTS-DIFF",
  ENG: "ENG-I01",
};

const DOMAIN_FOCUS: Record<DomainId, string> = {
  FA: "预计完工投资偏差",
  EQ: "到期出资履约",
  INTL: "航线与成本敞口",
  CASH: "支付授权核查",
  RIGHTS: "多来源权益信息核对",
  ENG: "成本预测与目标差距",
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
  const { filters, risks, setFilters, user } = useDemoStore();
  const [riskId, setRiskId] = useState<string | null>(null);
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [caseScope, setCaseScope] = useState<{ title: string; ids: string[] } | null>(null);

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
        const def = indicatorById(kpiId);
        const kpis = def ? [{ def, metric: computeIndicator(def, orgIds, ctx) }] : [];
        return { domain: d, open: o, red: o.filter((r) => r.severity === "red"), kpis };
      }),
    [risks, orgIds, ctx, user],
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
  const openCases = (title: string, list: RiskCase[]) => setCaseScope({ title, ids: list.map((r) => r.id) });
  const domainRefCount = domainSummary.reduce((s, d) => s + d.open.length, 0);

  const faDef = indicatorById("FA-I06")!;
  const faMetric = computeIndicator(faDef, orgIds, ctx);
  const faParts = formatMetricParts(faDef, faMetric);

  return (
    <div className="space-y-5">
      {!can(user, "business.read") && (
        <Notice tone="amber" title="当前身份无业务数据权限">
          配置维护权限不自动带来业务数据。请切换总部或单位监管身份查看指标与事项，或进入系统配置。
        </Notice>
      )}

      <PageHeader title="综合总览" subtitle="总部及所属单位监管情况">
        <FilterBar />
      </PageHeader>

      <p className="text-[13px] text-textsub leading-5">
        关注投资成本、资产利用及境外履约，当前有
        <span className="num text-textmain font-medium"> {overdueRect.length} </span>
        件整改事项逾期。
      </p>

      <div className="reg-kpis">
        <KpiCard
          name="固定资产投资计划执行率"
          value={faParts.value}
          unit={faParts.unit}
          compare={`完成 ${fmtAmountSmart(faMetric.numerator)}／同期计划 ${fmtAmountSmart(faMetric.denominator)} 万元`}
          icon={<IconBars size={20} />}
          scopeLabel={scopeLabel}
          onOpen={() => setIndicatorId("FA-I06")}
        />
        <KpiCard
          name="未关闭监管事项"
          value={open.length}
          unit="件"
          compare={`待核查 ${pendingReview.length}／整改中 ${rectifying.length}`}
          icon={<IconClipboard size={20} />}
          onOpen={() => openCases("未关闭监管事项", open)}
        />
        <KpiCard
          name="其中高风险事项"
          value={red.length}
          unit="件"
          compare="重点关注"
          compareTone="red"
          icon={<IconAlert size={20} />}
          iconTone="red"
          onOpen={() => openCases("高风险未关闭事项", red)}
        />
        <KpiCard
          name="逾期整改事项"
          value={overdueRect.length}
          unit="件"
          compare="需跟进"
          compareTone="red"
          icon={<IconClock size={20} />}
          iconTone="amber"
          onOpen={() => openCases("逾期整改事项", overdueRect)}
        />
      </div>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-[16px] font-semibold text-textmain">六领域监管概况</h2>
          <p className="text-[12px] text-textsub">跨领域关联事项合并计数</p>
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
                className="bg-surface border border-line rounded-[10px] shadow-[0_2px_10px_rgba(17,43,77,0.04)] p-5 min-h-[174px] flex flex-col"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-[8px] bg-[#EAF1FD] text-brand flex items-center justify-center shrink-0">
                      {Icon && <Icon size={16} />}
                    </span>
                    <Link href={meta.route} className="text-[16px] font-semibold text-textmain hover:text-brand leading-5">
                      {meta.label}
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[12px] rounded-full px-2 py-0.5 border border-line"
                    style={{ color: s.open.length ? "var(--risk-amber-fg)" : "var(--text-sub)" }}
                    onClick={() => openCases(`${meta.label}未关闭事项`, s.open)}
                  >
                    未关闭 {s.open.length} 件
                  </button>
                </div>
                {kpi && (
                  <button
                    type="button"
                    onClick={() => setIndicatorId(kpi.def.id)}
                    className="text-left mt-3"
                    title={kpi.def.name}
                  >
                    <div className="text-[13px] text-textsub">{kpi.def.name}</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="num text-[26px] font-semibold text-textmain leading-none">
                        {parts.unit === "%" ? `${parts.value}%` : parts.value}
                      </span>
                      {parts.unit && parts.unit !== "%" && (
                        <span className="text-[14px] text-textsub">{parts.unit}</span>
                      )}
                    </div>
                  </button>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-textsub leading-5 line-clamp-2">关注：{DOMAIN_FOCUS[s.domain]}</span>
                  <Link href={meta.route} className="text-[13px] text-brand shrink-0 hover:underline">
                    进入领域 →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        <p className="text-[12px] text-textsub mt-2">
          总览按事项合并计数 {open.length} 件；六领域引用合计 {domainRefCount} 次，引用次数之和可以大于综合总数，不作为新发现事项。
        </p>
      </section>

      <Card
        title="重点关注事项"
        subtitle="默认展示有依据的三条记录：投资偏差、资产利用及境外毛利"
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
                <th className="px-3 py-3 text-left text-[13px] font-semibold text-textsub border-b border-line">关注事项</th>
                <th className="px-3 py-3 text-left text-[13px] font-semibold text-textsub border-b border-line">关键事实</th>
                <th className="px-3 py-3 text-left text-[13px] font-semibold text-textsub border-b border-line w-[140px]">
                  当前进展
                </th>
                <th className="px-3 py-3 text-right text-[13px] font-semibold text-textsub border-b border-line w-[100px]">
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

      <Card title="单位风险分布" subtitle="单元格为该单位该领域未关闭事项数；合计按事项去重，不由单元格相加">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#f6f8fc]">
                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-textsub border-b border-line">单位</th>
                {DOMAIN_ORDER.filter((d) => canDomain(user, d)).map((d) => (
                  <th key={d} className="px-3 py-2.5 text-center text-[13px] font-semibold text-textsub border-b border-line whitespace-nowrap">
                    {DOMAIN_META[d].short}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-textsub border-b border-line">合计（去重）</th>
              </tr>
            </thead>
            <tbody>
              {matrixOrgs.map((o) => {
                const scope = new Set([o.id, ...descendantOrgIds(o.id)]);
                const unitRisks = risks.filter((r) => isOpen(r) && scope.has(r.owner_org_id));
                const hasBusiness =
                  coverageRows.some((r) => scope.has(r.owner_org_id)) ||
                  seed.fixed_asset_projects.some((p) => scope.has(p.owner_org_id)) ||
                  seed.equity_projects.some((p) => scope.has(p.owner_org_id)) ||
                  seed.engineering_projects.some((p) => scope.has(p.owner_org_id)) ||
                  seed.accounts.some((a) => scope.has(a.owner_org_id));
                return (
                  <tr key={o.id} className="border-b border-line hover:bg-tint transition-colors duration-150">
                    <td className="px-3 py-2 text-textmain">
                      <button
                        className="hover:text-brand"
                        onClick={() => setFilters({ orgId: o.id, includeChildren: true })}
                        title="点击进入该单位管理范围"
                      >
                        {o.name}
                      </button>
                      {!hasBusiness && <Tag tone="neutral">当前范围无业务</Tag>}
                    </td>
                    {DOMAIN_ORDER.filter((d) => canDomain(user, d)).map((d) => {
                      const cell = unitRisks.filter((r) => riskMatches(r, { domain: d, orgScope: scope }));
                      const cellRed = cell.filter((r) => r.severity === "red").length;
                      return (
                        <td key={d} className="px-3 py-2 text-center">
                          {cell.length === 0 ? (
                            <span className="text-textsub text-[13px]">{hasBusiness ? "本次监测未发现异常" : "无业务"}</span>
                          ) : (
                            <button
                              className="num text-[14px] hover:underline"
                              style={{ color: cellRed ? "var(--risk-red-fg)" : "var(--risk-amber-fg)" }}
                              onClick={() => openCases(`${o.name}·${DOMAIN_META[d].label}未关闭事项`, cell)}
                            >
                              {cell.length}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <button
                        className="num text-[14px] text-textmain hover:text-brand hover:underline"
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="待复核事项" subtitle="复核通过并关闭后才计入本期已整改闭环数">
          <DataTable
            rows={pendingVerification}
            rowKey={(r) => r.id}
            onRowClick={(r) => setRiskId(r.id)}
            empty="当前范围没有待复核事项。"
            columns={[
              { key: "title", title: "名称", render: (r) => r.title },
              { key: "org", title: "责任单位", width: "150px", render: (r) => orgName(r.owner_org_id) },
              {
                key: "overdue",
                title: "整改逾期",
                width: "110px",
                render: (r) => (isOverdueRectification(r, filters.asOf) ? <Tag tone="red">逾期</Tag> : <span className="text-textsub">—</span>),
              },
            ]}
          />
        </Card>

        <Card title="近期外部事件及受影响对象" subtitle="点击事件进入国际化业务查看关联业务与影响测算">
          <DataTable
            rows={seed.international_events.slice().sort((a, b) => b.event_date.localeCompare(a.event_date))}
            rowKey={(e) => e.id}
            onRowClick={() => router.push("/international-business")}
            columns={[
              { key: "date", title: "发生时间", width: "110px", render: (e) => <span className="num">{e.event_date}</span> },
              { key: "title", title: "事件", render: (e) => e.title },
              {
                key: "nature",
                title: "数据性质",
                width: "130px",
                render: (e) => (
                  <Tag tone={e.data_nature === "real_event" ? "brand" : "neutral"}>
                    {e.data_nature === "real_event" ? "真实事件日期" : "模拟事件"}
                  </Tag>
                ),
              },
              {
                key: "affected",
                title: "受影响对象",
                render: (e) => (e.affected_project_ids?.length ? e.affected_project_ids.join("、") : "待核实"),
              },
            ]}
          />
        </Card>
      </div>

      {caseScope && (
        <Card
          title={caseScope.title}
          subtitle={`来源范围：${scopeLabel}｜截至日 ${filters.asOf}`}
          right={
            <button className="text-[13px] text-brand hover:underline" onClick={() => setCaseScope(null)}>
              关闭清单
            </button>
          }
        >
          <DataTable
            rows={caseScope.ids.map((id) => risks.find((r) => r.id === id)!).filter(Boolean)}
            rowKey={(r) => r.id}
            onRowClick={(r) => setRiskId(r.id)}
            empty="该范围内没有事项。"
            columns={[
              { key: "title", title: "名称", render: (r) => r.title },
              { key: "sev", title: "等级", width: "84px", render: (r) => <SeverityTag severity={r.severity} /> },
              { key: "status", title: "状态", width: "100px", render: (r) => statusLabel[r.status] },
              { key: "org", title: "责任单位", width: "150px", render: (r) => orgName(r.owner_org_id) },
              {
                key: "domains",
                title: "涉及领域",
                render: (r) => r.domains.map((d) => DOMAIN_META[d].short).join("、"),
              },
            ]}
          />
        </Card>
      )}

      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel="综合总览" />
      <IndicatorDrawer
        open={Boolean(indicatorId)}
        onClose={() => setIndicatorId(null)}
        indicator={indicatorId ? indicatorById(indicatorId) ?? null : null}
        indicatorOptions={INDICATORS}
        onSwitchIndicator={setIndicatorId}
        initialOrgId={filters.orgId}
        scopeLabel={scopeLabel}
      />
    </div>
  );
}
