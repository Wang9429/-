"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import IndicatorDrawer from "@/components/IndicatorDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import { Card, DataTable, KpiCard, Notice, SeverityTag, Tag } from "@/components/ui";
import { DOMAIN_META, coverageRows, seed } from "@/lib/seed";
import { INDICATORS, computeIndicator, indicatorById, type IndicatorDef } from "@/lib/metrics";
import { childOrgs, descendantOrgIds, orgName, ROOT_ORG_ID } from "@/lib/org";
import { authorizedObjectIds, can, canDomain, intersectOrgScope, riskVisible } from "@/lib/config";
import { isOpen, isCurrentTaskOverdue, isOverdueRectification, rectificationDueDate, riskMatches, statusLabel } from "@/lib/risks";
import { fmtAmount, fmtDate, fmtPct } from "@/lib/format";
import { formatMetric } from "@/components/IndicatorDrawer";
import { useDemoStore } from "@/lib/store";
import type { DomainId, RiskCase } from "@/lib/types";

/**
 * P00 综合总览（完整业需第 6 章）。默认以总部监管问题为主线：
 * 未关闭、高风险、逾期与可判定覆盖在上，六领域摘要与单位×领域矩阵在中，
 * 重点事项、近期事件与督办入口在下。按 risk_id 去重，不做综合风险评分。
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
  FA: "投资成本偏差及转固后资产利用",
  EQ: "出资履约、收益回收及权益信息",
  INTL: "航线与成本敞口",
  CASH: "支付授权核查及出资、分红义务",
  RIGHTS: "同有效期的批准、登记与产权台账核对",
  ENG: "成本预测与 15% 目标的差距",
};

const DOMAIN_ORDER: DomainId[] = ["FA", "EQ", "INTL", "CASH", "RIGHTS", "ENG"];

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
  const overdue = open.filter((r) => isOverdueRectification(r, filters.asOf) || isCurrentTaskOverdue(r, filters.asOf));
  const pendingVerification = open.filter((r) => r.status === "pending_verification");

  const domainSummary = useMemo(
    () =>
      DOMAIN_ORDER.filter((d) => canDomain(user, d)).map((d) => {
        const domainRisks = risks.filter((r) => riskVisible(user, r) && riskMatches(r, { domain: d, orgScope: orgIds }));
        const o = domainRisks.filter(isOpen);
        const kpiId = DOMAIN_KPI[d];
        const def = indicatorById(kpiId);
        const kpis = def ? [{ def, metric: computeIndicator(def, orgIds, ctx) }] : [];
        const top = o
          .slice()
          .sort((a, b) => (a.severity === "red" ? -1 : 1) - (b.severity === "red" ? -1 : 1))[0];
        return { domain: d, open: o, red: o.filter((r) => r.severity === "red"), kpis, top };
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

  return (
    <div className="space-y-4">
      {!can(user, "business.read") && (
        <Notice tone="amber" title="当前身份无业务数据权限">
          配置维护权限不自动带来业务数据。请切换总部或单位监管身份查看指标与事项，或进入系统配置。
        </Notice>
      )}
      <div
        className="rounded-[8px] px-6 py-5 text-white"
        style={{ background: "linear-gradient(100deg, #0b1f3a 0%, #164b8e 68%, #1d5fd1 100%)" }}
      >
        <h1 className="text-[22px] font-semibold leading-7">综合总览</h1>
        <p className="text-[13px] text-[#c6d9f5] mt-1.5 max-w-4xl leading-5">
          从总部视角查看所属单位执行情况与重点监管事项。指标可穿透到项目，事项可跟踪核查与整改。
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Tag tone="neutral">{scopeLabel}</Tag>
        </div>
      </div>

      <Notice tone="neutral" title="关注摘要">
        关注投资成本偏差、设备利用及境外项目履约；当前有 {overdue.filter((r) => isOverdueRectification(r, filters.asOf)).length} 件整改事项逾期。
      </Notice>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {(() => {
          const def = indicatorById("FA-I06")!;
          const m = computeIndicator(def, orgIds, ctx);
          return (
            <KpiCard
              name="固定资产投资计划执行率"
              value={formatMetric(def, m)}
              unit={def.unit}
              compare={`完成 ${fmtAmount(m.numerator)} / 同期计划 ${fmtAmount(m.denominator)} 万元`}
              compareTone="amber"
              dataState="固定资产口径｜当前组织及期间"
              scopeLabel={scopeLabel}
              onOpen={() => setIndicatorId("FA-I06")}
            />
          );
        })()}
        <KpiCard
          name="未关闭监管事项"
          value={open.length}
          unit="件"
          compare={`待核查 ${open.filter((r) => r.status === "pending_review").length}、整改中 ${open.filter((r) => r.status === "rectifying").length}`}
          compareTone={open.length ? "amber" : "green"}
          dataState="含待核查、核查中、整改中、待复核"
          onOpen={() => openCases("未关闭监管事项", open)}
        />
        <KpiCard
          name="其中高风险事项"
          value={red.length}
          unit="件"
          compare="需优先处置"
          compareTone={red.length ? "red" : "green"}
          onOpen={() => openCases("高风险未关闭事项", red)}
        />
        <KpiCard
          name="逾期整改事项"
          value={open.filter((r) => isOverdueRectification(r, filters.asOf)).length}
          unit="件"
          compare="已进入整改责任范围且超过有效期限"
          compareTone="red"
          onOpen={() =>
            openCases(
              "逾期整改事项",
              open.filter((r) => isOverdueRectification(r, filters.asOf)),
            )
          }
        />
      </div>

      <Card
        title="六领域监管摘要"
        subtitle="每张卡片一个代表性业务数值、未关闭数和一个可追溯关注点。跨领域关联事项按同一事项合并计数。"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {domainSummary.map((s) => {
            const meta = DOMAIN_META[s.domain];
            return (
              <div
                key={s.domain}
                className="rounded-[8px] border border-line bg-surface p-4 hover:border-[#c3d8f7] transition-colors duration-150"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link href={meta.route} className="text-[15px] font-semibold text-textmain hover:text-brand">
                    {meta.label}
                  </Link>
                  <Link href={meta.route} className="text-[12px] text-brand hover:underline">
                    进入领域 ›
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {s.kpis.map(({ def, metric }) => (
                    <button
                      key={def.id}
                      onClick={() => setIndicatorId(def.id)}
                      className="text-left"
                      title={`${def.name}｜口径：${def.caliber}`}
                    >
                      <div className="text-[12px] text-textsub">{def.name}</div>
                      <div className="num text-[20px] font-semibold text-textmain leading-7">
                        {formatMetric(def, metric)}
                        {metric.value !== null && <span className="text-[12px] text-textsub ml-1">{def.unit}</span>}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    className="text-[13px] hover:underline"
                    style={{ color: s.open.length ? "var(--risk-amber-fg)" : "var(--text-sub)" }}
                    onClick={() => openCases(`${meta.label}未关闭事项`, s.open)}
                  >
                    未关闭 <span className="num font-semibold">{s.open.length}</span> 件
                  </button>
                  <button
                    className="text-[13px] hover:underline"
                    style={{ color: s.red.length ? "var(--risk-red-fg)" : "var(--text-sub)" }}
                    onClick={() => openCases(`${meta.label}高风险未关闭事项`, s.red)}
                  >
                    高风险 <span className="num font-semibold">{s.red.length}</span> 件
                  </button>
                </div>
                <div className="mt-2 min-h-[36px]">
                  <div className="text-[12px] text-textsub mb-1">{DOMAIN_FOCUS[s.domain]}</div>
                  {s.top ? (
                    <button
                      onClick={() => setRiskId(s.top!.id)}
                      className="text-left text-[13px] text-textmain hover:text-brand leading-5"
                    >
                      重点问题：{s.top.title}
                      <span className="num text-textsub ml-1">（{s.top.primary_object_id}）</span>
                    </button>
                  ) : (
                    <span className="text-[13px] text-textsub">当前范围未发现未关闭事项</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Notice tone="neutral" title="跨领域去重">
            一个资金异常可能同时出现在资金、工程、国际化三个领域。综合总览按事项编号只计一件；六领域引用次数之和可以大于综合总数。不得把引用次数称为新发现事项。
          </Notice>
        </div>
      </Card>

      <Card title="单位 × 领域风险矩阵" subtitle="单元格显示去重风险数与最高等级；点击定位到该单位该领域清单。根节点统计仍按 risk_id 去重，不由单元格求和">
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
                            <span className="text-textsub text-[13px]">{hasBusiness ? "未发现异常" : "无业务"}</span>
                          ) : (
                            <button
                              className="num text-[14px] hover:underline"
                              style={{ color: cellRed ? "var(--risk-red-fg)" : "var(--risk-amber-fg)" }}
                              onClick={() => openCases(`${o.name}·${DOMAIN_META[d].label}未关闭事项`, cell)}
                            >
                              {cell.length}
                              {cellRed > 0 ? " ●" : " ▲"}
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
        <Card
          title="重大事项清单"
          subtitle="默认按等级、逾期、影响与最近变化排序"
          right={
            <Link href="/supervision-workbench" className="text-[13px] text-brand hover:underline">
              进入监管工作台 ›
            </Link>
          }
        >
          <DataTable
            rows={highlightCases}
            rowKey={(r) => r.id}
            onRowClick={(r) => setRiskId(r.id)}
            empty="当前范围没有未关闭事项。"
            columns={[
              { key: "id", title: "事项", width: "70px", render: (r) => <span className="num">{r.id}</span> },
              { key: "title", title: "名称", render: (r) => r.title },
              { key: "sev", title: "等级", width: "84px", render: (r) => <SeverityTag severity={r.severity} /> },
              { key: "domain", title: "主领域", width: "110px", render: (r) => DOMAIN_META[r.primary_domain].short },
              { key: "status", title: "状态", width: "100px", render: (r) => statusLabel[r.status] },
              {
                key: "due",
                title: "有效期限",
                width: "110px",
                render: (r) => (
                  <span className="num" style={{ color: isOverdueRectification(r, filters.asOf) ? "var(--risk-red-fg)" : undefined }}>
                    {fmtDate(rectificationDueDate(r) ?? r.current_task_due_date)}
                  </span>
                ),
              },
            ]}
          />
          <p className="text-[12px] text-textsub mt-2">
            排序依据：高风险优先，其次逾期整改，再次待核查，最后按事项编号稳定排序。
          </p>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="待复核事项" subtitle="复核通过并关闭后才计入本期已整改闭环数">
          <DataTable
            rows={pendingVerification}
            rowKey={(r) => r.id}
            onRowClick={(r) => setRiskId(r.id)}
            empty="当前范围没有待复核事项。"
            columns={[
              { key: "id", title: "事项", width: "70px", render: (r) => <span className="num">{r.id}</span> },
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

        <Card title="重点单位业务规模比较" subtitle="合同额、投资额、资产余额与资金余额分项列示，不合成单一金额">
          <DataTable
            rows={matrixOrgs}
            rowKey={(o) => o.id}
            columns={[
              { key: "name", title: "单位", render: (o) => o.name },
              {
                key: "fa",
                title: "投资有效概算",
                align: "right",
                width: "130px",
                render: (o) => {
                  const scope = new Set([o.id, ...descendantOrgIds(o.id)]);
                  const v = seed.fixed_asset_projects
                    .filter((p) => scope.has(p.owner_org_id))
                    .reduce((s, p) => s + p.effective_approved_budget, 0);
                  return <span className="num">{v ? fmtAmount(v) : "—"}</span>;
                },
              },
              {
                key: "eq",
                title: "股权账面余额",
                align: "right",
                width: "130px",
                render: (o) => {
                  const scope = new Set([o.id, ...descendantOrgIds(o.id)]);
                  const v = seed.equity_projects
                    .filter((p) => scope.has(p.owner_org_id))
                    .reduce((s, p) => s + p.closing_book_balance_before_impairment - p.impairment_allowance, 0);
                  return <span className="num">{v ? fmtAmount(v) : "—"}</span>;
                },
              },
              {
                key: "eng",
                title: "工程合同额",
                align: "right",
                width: "120px",
                render: (o) => {
                  const scope = new Set([o.id, ...descendantOrgIds(o.id)]);
                  const v = seed.engineering_projects
                    .filter((p) => scope.has(p.owner_org_id))
                    .reduce((s, p) => s + p.contract_revenue_ex_vat, 0);
                  return <span className="num">{v ? fmtAmount(v) : "—"}</span>;
                },
              },
              {
                key: "cash",
                title: "资金余额",
                align: "right",
                width: "120px",
                render: (o) => {
                  const scope = new Set([o.id, ...descendantOrgIds(o.id)]);
                  const v = seed.accounts
                    .filter((a) => scope.has(a.owner_org_id))
                    .reduce((s, a) => s + a.closing_balance_native * a.fx_to_cny, 0);
                  return <span className="num">{v ? fmtAmount(v) : "—"}</span>;
                },
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
              { key: "id", title: "事项", width: "70px", render: (r) => <span className="num">{r.id}</span> },
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
