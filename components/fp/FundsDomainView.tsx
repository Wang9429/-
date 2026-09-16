"use client";

import React, { useEffect, useMemo, useState } from "react";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import IndicatorDrawer, { formatMetricParts } from "@/components/IndicatorDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import ScenarioDrawer from "@/components/ScenarioDrawer";
import ObjectDrawer from "@/components/ObjectDrawer";
import ScenarioExecutionPanel from "@/components/ScenarioExecutionPanel";
import { Card, KpiCard, Tag } from "@/components/ui";
import { useDemoStore } from "@/lib/store";
import { authorizedObjectIds, canDomain, intersectOrgScope } from "@/lib/config";
import { descendantOrgIds, orgName, orgPath } from "@/lib/org";
import { computeIndicator, indicatorById, type IndicatorDef } from "@/lib/metrics";
import { isRunnableDrawerIndicator } from "@/lib/indicator-scope";
import { CASH2_BS_IDS, CASH2_LIQ_IDS, CASH2_PROFIT_IDS, CASH_TOPICS } from "@/lib/fp-topics";
import { reportAvailability, statementOf, cashAccountStatementBridge } from "@/lib/finance";
import { formatComparableChange, priorYearPeriod } from "@/lib/fp-compare";
import { catalogIndicatorMeta } from "@/lib/live-config";
import { computeTrendPoints, eligibleTrendPoints, trendSpecOf } from "@/lib/fp-trend";
import { CompactSparkline, valueTimeLabel } from "@/components/fp/MetricTrend";
import { fmtAmountSmart } from "@/lib/format";
import { seed } from "@/lib/seed";
import { inDateRange } from "@/lib/period";
import { FP_GUARANTEES, FP_LENDS, FP_LOANS, FP_SME, FP_SPECIALS } from "@/lib/fp-seed";
import { yuanToWan } from "@/lib/format";

const TAB_IDS: { id: "profit" | "bs" | "liq"; label: string; ids: readonly string[] }[] = [
  { id: "profit", label: "盈利能力", ids: CASH2_PROFIT_IDS },
  { id: "bs", label: "资产负债状况", ids: CASH2_BS_IDS },
  { id: "liq", label: "资金流动性", ids: CASH2_LIQ_IDS },
];

export default function FundsDomainView() {
  const { filters, risks, user, catalog } = useDemoStore();
  const [subjectId, setSubjectId] = useState(filters.orgId);
  const [subjectChildren, setSubjectChildren] = useState(filters.includeChildren);
  const [finTab, setFinTab] = useState<"profit" | "bs" | "liq">("profit");
  const [topicId, setTopicId] = useState<string>("CASH2-T-ACCOUNT");
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [indicatorOrg, setIndicatorOrg] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);
  const [objectId, setObjectId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioSourceOpen, setScenarioSourceOpen] = useState(false);

  const globalOrgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );

  useEffect(() => {
    setSubjectId(filters.orgId);
    setSubjectChildren(filters.includeChildren);
    setIndicatorId(null);
    setRiskId(null);
    setObjectId(null);
    setScenarioId(null);
  }, [filters.orgId, filters.includeChildren, filters.periodStart, filters.periodEnd, filters.asOf, user?.id]);

  useEffect(() => {
    setIndicatorId(null);
  }, [finTab]);

  const pageOrgIds = useMemo(() => {
    const local = new Set(subjectChildren ? descendantOrgIds(subjectId) : [subjectId]);
    return new Set([...local].filter((id) => globalOrgIds.has(id)));
  }, [subjectId, subjectChildren, globalOrgIds]);

  const allowedObjectIds = useMemo(() => authorizedObjectIds(user), [user]);
  const ctx = useMemo(
    () => ({
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      asOf: filters.asOf,
      risks,
      allowedObjectIds,
    }),
    [filters, risks, allowedObjectIds],
  );

  const kpiIds = TAB_IDS.find((t) => t.id === finTab)?.ids ?? CASH2_PROFIT_IDS;
  const kpiDefs = useMemo(() => {
    if (!canDomain(user, "CASH")) return [];
    return kpiIds
      .map((id) => indicatorById(id))
      .filter((d): d is IndicatorDef => Boolean(d && isRunnableDrawerIndicator(d, "domain_page")));
  }, [kpiIds, user, catalog]);

  const switchableDefs = kpiDefs;

  const path = orgPath(subjectId).filter((o) => globalOrgIds.has(o.id) || o.id === filters.orgId);
  const gate = path.findIndex((o) => o.id === filters.orgId);
  const visiblePath = gate >= 0 ? path.slice(gate) : path;

  const openIndicator = (id: string, orgId = subjectId) => {
    setIndicatorOrg(orgId);
    setIndicatorId(id);
  };

  const stmt = statementOf(subjectId, ctx, subjectId === "ORG-HQ" && subjectChildren ? "consolidated" : "standalone");
  const avail = reportAvailability(subjectId);
  const hqSelf = subjectId === "ORG-HQ" && !subjectChildren;

  const prior = priorYearPeriod(filters.periodStart, filters.periodEnd, filters.asOf);
  const priorCtx = useMemo(
    () => ({ ...ctx, periodStart: prior.periodStart, periodEnd: prior.periodEnd, asOf: prior.asOf }),
    [ctx, prior.periodStart, prior.periodEnd, prior.asOf],
  );
  const halfYear = filters.periodStart.endsWith("-01-01") && filters.periodEnd.endsWith("-06-30");

  const kpiBundle = (def: IndicatorDef) => {
    const m = computeIndicator(def, pageOrgIds, ctx);
    const priorM = computeIndicator(def, pageOrgIds, priorCtx);
    const yoy = formatComparableChange(def, m, priorM, prior.label);
    const meta = catalogIndicatorMeta(def.id);
    const spec = trendSpecOf(def.id, {
      applicability: meta?.trend_applicability === "never" ? "never" : undefined,
      homeVisible: meta?.trend_home_visible,
      detailVisible: meta?.trend_detail_visible,
      frequency: meta?.trend_frequency,
    });
    const rawPoints = spec
      ? computeTrendPoints(def, pageOrgIds, ctx, spec, computeIndicator)
      : [];
    const points = spec && spec.homeVisible ? eligibleTrendPoints(rawPoints, spec.minPoints) : null;
    const stmtAux =
      def.id === "CASH2-I06" && stmt
        ? `构成：负债总额 ${fmtAmountSmart(stmt.total_liabilities)} 万／净资产 ${fmtAmountSmart(stmt.equity)} 万`
        : def.id === "CASH2-I13" && stmt
          ? `构成：净利润 ${fmtAmountSmart(stmt.net_profit)} 万／平均净资产 ${
              stmt.equity_begin != null && stmt.equity != null
                ? fmtAmountSmart((stmt.equity_begin + stmt.equity) / 2)
                : "—"
            } 万，不年化`
          : def.id === "CASH2-I08" && stmt
            ? `构成：流动资产 ${fmtAmountSmart(stmt.current_assets)} 万／流动负债 ${fmtAmountSmart(stmt.current_liabilities)} 万`
            : undefined;
    return { m, yoy, spec, points, stmtAux };
  };

  const topicNavRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader title="资金管理">
        <FilterBar />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="funds-subject-path">
        <span className="text-textsub">当前主体</span>
        {visiblePath.map((o, i) => (
          <span key={o.id} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-textsub">/</span>}
            <button
              type="button"
              className={`hover:text-brand ${o.id === subjectId ? "text-brand font-medium" : "text-textmain"}`}
              onClick={() => {
                if (!globalOrgIds.has(o.id) && o.id !== filters.orgId) return;
                setSubjectId(o.id);
                setSubjectChildren(o.id === filters.orgId ? filters.includeChildren : true);
              }}
            >
              {o.name}
            </button>
          </span>
        ))}
        <Tag tone="brand">{subjectChildren ? "含下级" : "仅本级"}</Tag>
        <button
          type="button"
          className="h-7 px-2 rounded-[6px] border border-line text-[12px] hover:bg-tint"
          onClick={() => setSubjectChildren((v) => !v)}
        >
          切换{subjectChildren ? "仅本级" : "含下级"}
        </button>
        {hqSelf && <Tag tone="amber">总部本级，不是总部整体</Tag>}
      </div>

      <Card title="主体经营与财务状况">
        <div className="flex flex-wrap gap-2 mb-4">
          {TAB_IDS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFinTab(t.id)}
              data-testid={`funds-tab-${t.id}`}
              className={`h-9 px-3 rounded-[6px] border text-[13px] ${
                finTab === t.id ? "border-brand bg-tint text-brand font-medium" : "border-line text-textsub hover:bg-tint"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {hqSelf || avail === "no_report" ? (
          <p className="text-[13px] text-textsub mb-3">{hqSelf ? "无独立报表" : "无独立报表"}</p>
        ) : !stmt ? (
          <p className="text-[13px] text-textsub mb-3">本期缺数</p>
        ) : (
          <div className="text-[12px] text-textsub mb-3">
            {stmt.report_scope === "consolidated" ? "合并报表" : "个别报表"}｜{stmt.period_start}～{stmt.period_end}｜合成报告
          </div>
        )}
        <div className="reg-kpis-domain" data-testid="funds-kpi-grid">
          {kpiDefs.map((def) => {
            const statementKpi = def.id.startsWith("CASH2-");
            if ((hqSelf || avail === "no_report") && statementKpi) {
              return (
                <KpiCard
                  key={def.id}
                  name={def.name}
                  value="—"
                  dataState="无独立报表"
                  scopeLabel={`${orgName(subjectId)}${subjectChildren ? "（含下级）" : "（仅本级）"}`}
                  onOpen={() => openIndicator(def.id, subjectId)}
                  returnKey={def.id}
                />
              );
            }
            const { m, yoy, spec, points, stmtAux } = kpiBundle(def);
            const parts = formatMetricParts(def, m);
            const targetLine =
              def.target != null && m.value != null
                ? `${def.targetLabel ?? "目标"} ${def.target}${def.unit}，偏差 ${fmtAmountSmart(m.value - def.target)}${def.unit}`
                : null;
            const timeLabel = valueTimeLabel(spec, halfYear);
            const dataState = statementKpi
              ? stmt
                ? `${stmt.report_scope === "consolidated" ? "合并口径" : stmt.report_scope === "management" ? "管理汇总" : "个别口径"}${timeLabel ? `｜${timeLabel}` : ""}`
                : "本期缺数"
              : avail === "no_report"
                ? "无独立报表｜已有对象明细"
                : `账户口径${timeLabel ? `｜${timeLabel}` : ""}`;
            return (
              <KpiCard
                key={def.id}
                name={def.name}
                value={parts.value}
                unit={parts.unit}
                compare={yoy.text}
                compareTone={yoy.tone}
                dataState={dataState}
                scopeLabel={`${orgName(subjectId)}${subjectChildren ? "（含下级）" : "（仅本级）"}`}
                onOpen={() => openIndicator(def.id, subjectId)}
                returnKey={def.id}
                extra={
                  <>
                    {spec && points ? <CompactSparkline def={def} points={points} spec={spec} /> : null}
                    {stmtAux ? <span className="block mt-0.5">{stmtAux}</span> : null}
                    {targetLine ? <span className="block mt-0.5">{targetLine}</span> : null}
                  </>
                }
              />
            );
          })}
        </div>
      </Card>

      <div ref={topicNavRef} className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-pagebg" id="funds-topic-nav" style={{ background: "var(--page-bg)" }}>
        <Card title="资金专题监管">
          <div className="flex flex-wrap gap-2" data-testid="funds-topic-nav">
            {CASH_TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                data-testid={`funds-topic-${t.id}`}
                className={`h-[48px] px-4 rounded-[6px] border text-[13px] ${
                  topicId === t.id ? "border-brand bg-tint text-brand font-medium" : "border-line text-textsub hover:bg-tint"
                }`}
              >
                {t.short}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <ScenarioExecutionPanel
        domain="CASH"
        topicId={topicId}
        orgIds={pageOrgIds}
        allowedObjectIds={allowedObjectIds}
        scopeTitle={CASH_TOPICS.find((t) => t.id === topicId)?.name ?? "专题"}
        onOpenRisk={setRiskId}
        onOpenObject={setObjectId}
        onOpenScenario={(id, source) => {
          setScenarioSourceOpen(Boolean(source));
          setScenarioId(id);
        }}
        ledger={
          <details className="rounded-[8px] border border-line bg-[#fafcff]">
            <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">查看业务台账与账户报表对照</summary>
            <div className="px-4 pb-4">
              <TopicScale topicId={topicId} orgIds={pageOrgIds} />
            </div>
          </details>
        }
      />

      <IndicatorDrawer
        open={Boolean(indicatorId)}
        onClose={() => setIndicatorId(null)}
        indicator={indicatorId ? indicatorById(indicatorId) ?? null : null}
        indicatorOptions={switchableDefs}
        onSwitchIndicator={setIndicatorId}
        allowIndicatorSwitch
        drawerEntry="domain_page"
        initialOrgId={indicatorOrg ?? subjectId}
        includeChildren={indicatorOrg === subjectId ? subjectChildren : true}
        scopeLabel={`${orgName(indicatorOrg ?? subjectId)}｜${filters.periodStart}~${filters.periodEnd}`}
        onOpenObject={setObjectId}
        onOpenRisk={setRiskId}
      />
      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel="资金管理" />
      <ScenarioDrawer
        scenarioId={scenarioId}
        sourceOpen={scenarioSourceOpen}
        onClose={() => {
          setScenarioId(null);
          setScenarioSourceOpen(false);
        }}
        onOpenRisk={(id) => {
          setScenarioId(null);
          setRiskId(id);
        }}
        onOpenObject={(id) => {
          setScenarioId(null);
          setObjectId(id);
        }}
      />
      <ObjectDrawer objectId={objectId} onClose={() => setObjectId(null)} onOpenRisk={setRiskId} onOpenObject={setObjectId} />
    </div>
  );
}

function TopicScale({ topicId, orgIds }: { topicId: string; orgIds: Set<string> }) {
  const { filters } = useDemoStore();
  const accounts = seed.accounts.filter((a) => orgIds.has(a.owner_org_id));
  const bank = accounts.filter((a) => a.id !== "ACC-INT");
  const txs = seed.cash_transactions.filter(
    (t) => accounts.some((a) => a.id === t.account_id) && inDateRange(t.date, filters.periodStart, filters.periodEnd),
  );
  const inflows = txs.filter((t) => t.direction === "inflow");
  const outflows = txs.filter((t) => t.direction === "outflow");
  const loans = FP_LOANS.filter((l) => orgIds.has(l.owner_org_id));
  const guars = FP_GUARANTEES.filter((g) => orgIds.has(g.owner_org_id));
  const lends = FP_LENDS.filter((l) => orgIds.has(l.owner_org_id));
  const specs = FP_SPECIALS.filter((s) => orgIds.has(s.owner_org_id));
  const sme = FP_SME.filter((s) => orgIds.has(s.owner_org_id));

  const chips: string[] = [];
  if (topicId === "CASH2-T-ACCOUNT") {
    const total = bank.reduce((s, a) => s + yuanToWan(a.closing_balance_native * a.fx_to_cny), 0);
    const rest = bank.reduce((s, a) => s + yuanToWan(a.restricted_balance_native * a.fx_to_cny), 0);
    chips.push(
      `银行账户 ${bank.length} 户`,
      `确认余额 ${fmtAmountSmart(total)} 万元`,
      `受限 ${fmtAmountSmart(rest)} 万元`,
      `内部账户 ${accounts.filter((a) => a.id === "ACC-INT").length} 户`,
    );
    const specAcc = accounts.find((a) => a.id === "ACC-SPEC");
    if (specAcc) {
      chips.push(
        `专户ACC-SPEC ${fmtAmountSmart(yuanToWan(specAcc.closing_balance_native * specAcc.fx_to_cny))} 万元全部受限｜${specAcc.balance_as_of}`,
      );
    }
    const bridge = cashAccountStatementBridge();
    chips.push(`与总部合并报表${fmtAmountSmart(bridge.statementWan)}差额 ${fmtAmountSmart(bridge.gapWan)} 万元（差异待核实）`);
  } else if (topicId === "CASH2-T-PAYMENT") {
    chips.push(
      `收款 ${inflows.length} 笔 / ${fmtAmountSmart(inflows.reduce((s, t) => s + t.amount_wan_cny, 0))} 万元`,
      `付款 ${outflows.length} 笔 / ${fmtAmountSmart(outflows.reduce((s, t) => s + t.amount_wan_cny, 0))} 万元`,
      `逾期未付中小企业账款 ${fmtAmountSmart(sme.filter((s) => s.sme_at_contract).reduce((a, s) => a + Math.max(0, s.undisputed_wan - s.paid_wan), 0))} 万元`,
    );
  } else if (topicId === "CASH2-T-FINANCE") {
    chips.push(
      `外部融资未偿 ${fmtAmountSmart(loans.filter((l) => l.direction === "external_borrow").reduce((s, l) => s + l.outstanding_wan, 0))} 万元`,
      `内部借入 ${fmtAmountSmart(loans.filter((l) => l.direction === "internal_borrow").reduce((s, l) => s + l.outstanding_wan, 0))} 万元`,
      `担保责任 ${fmtAmountSmart(guars.filter((g) => g.kind === "loan_guarantee" && !g.released).reduce((s, g) => s + g.amount_wan, 0))} 万元`,
      `保函责任 ${fmtAmountSmart(guars.filter((g) => g.kind === "performance_bond" && !g.released).reduce((s, g) => s + g.amount_wan, 0))} 万元`,
    );
  } else if (topicId === "CASH2-T-OPERATION") {
    chips.push(
      `出借本金余额 ${fmtAmountSmart(lends.reduce((s, l) => s + l.outstanding_wan, 0))} 万元`,
      `到期未收回 ${fmtAmountSmart(lends.filter((l) => l.due_date <= filters.asOf).reduce((s, l) => s + (l.outstanding_wan - l.recovered_wan), 0))} 万元`,
    );
  } else if (topicId === "CASH2-T-SPECIAL") {
    chips.push(
      `专项项目 ${specs.length} 个`,
      `期间支出 ${fmtAmountSmart(specs.reduce((s, x) => s + x.spent_wan, 0))} 万元`,
      `确认结余 ${fmtAmountSmart(specs.reduce((s, x) => s + x.confirmed_balance_wan, 0))} 万元`,
    );
  } else {
    chips.push("已覆盖核心业务 2 项", "持续亏损业务 1 项");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Tag key={c} tone="neutral">
            {c}
          </Tag>
        ))}
      </div>
      {topicId === "CASH2-T-ACCOUNT" && <CashBridgeTable />}
    </div>
  );
}

function CashBridgeTable() {
  const bridge = cashAccountStatementBridge();
  return (
    <div className="overflow-x-auto text-[12px]" data-testid="cash-bridge">
      <table className="w-full min-w-[720px] border-collapse">
        <caption className="text-left text-textsub pb-2">
          账户与报表对照（万元）。加减按监管账户加、合并报表减。不能核证的标差异待核实，不编造调节项。
        </caption>
        <thead>
          <tr className="text-textsub border-b border-line">
            <th className="text-left font-medium py-1 pr-2">方向</th>
            <th className="text-right font-medium py-1 pr-2">金额</th>
            <th className="text-left font-medium py-1 pr-2">记录</th>
            <th className="text-left font-medium py-1 pr-2">来源</th>
            <th className="text-left font-medium py-1 pr-2">范围</th>
            <th className="text-left font-medium py-1">核证</th>
          </tr>
        </thead>
        <tbody>
          {[...bridge.lines, ...bridge.contrasts].map((l) => (
            <tr key={l.id} className="border-b border-line/70 align-top">
              <td className="py-1 pr-2 whitespace-nowrap">{l.direction}</td>
              <td className="py-1 pr-2 text-right num whitespace-nowrap">{fmtAmountSmart(l.amount_wan)}</td>
              <td className="py-1 pr-2">{l.name}</td>
              <td className="py-1 pr-2">{l.source}</td>
              <td className="py-1 pr-2">{l.scope}</td>
              <td className="py-1">{l.status === "verified" ? "已核" : "差异待核实"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

