"use client";

import React, { useEffect, useMemo, useState } from "react";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import IndicatorDrawer, { formatKpiCaption, formatMetricParts } from "@/components/IndicatorDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import ScenarioDrawer from "@/components/ScenarioDrawer";
import ObjectDrawer from "@/components/ObjectDrawer";
import ScenarioExecutionPanel from "@/components/ScenarioExecutionPanel";
import { Card, KpiCard, Tag } from "@/components/ui";
import { useDemoStore } from "@/lib/store";
import { authorizedObjectIds, canDomain, intersectOrgScope } from "@/lib/config";
import { childOrgs, descendantOrgIds, isManagedUnit, orgName, orgPath, orgUnitTypeLabel } from "@/lib/org";
import { computeIndicator, indicatorById, type IndicatorDef } from "@/lib/metrics";
import { isRunnableDrawerIndicator } from "@/lib/indicator-scope";
import { CASH2_BS_IDS, CASH2_LIQ_IDS, CASH2_PROFIT_IDS, CASH_TOPICS } from "@/lib/fp-topics";
import { reportAvailability, statementOf } from "@/lib/finance";
import { fmtAmountSmart } from "@/lib/format";
import { seed } from "@/lib/seed";
import { inDateRange } from "@/lib/period";
import { FP_GUARANTEES, FP_LENDS, FP_LOANS, FP_SME, FP_SPECIALS } from "@/lib/fp-seed";
import { yuanToWan } from "@/lib/format";

const TAB_IDS: { id: "profit" | "bs" | "liq"; label: string; ids: readonly string[] }[] = [
  { id: "profit", label: "盈利能力", ids: CASH2_PROFIT_IDS },
  { id: "bs", label: "资产负债", ids: CASH2_BS_IDS },
  { id: "liq", label: "资金流动性", ids: CASH2_LIQ_IDS },
];

export default function FundsDomainView() {
  const { filters, risks, user, catalog } = useDemoStore();
  const [subjectId, setSubjectId] = useState(filters.orgId);
  const [subjectChildren, setSubjectChildren] = useState(filters.includeChildren);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([filters.orgId]));
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
    setExpanded(new Set([filters.orgId]));
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

  const path = orgPath(subjectId).filter((o) => globalOrgIds.has(o.id) || o.id === filters.orgId);
  const gate = path.findIndex((o) => o.id === filters.orgId);
  const visiblePath = gate >= 0 ? path.slice(gate) : path;

  const compareRows = useMemo(() => {
    const kids = childOrgs(subjectId).filter((c) => {
      if (!isManagedUnit(c) && c.node_type !== "headquarters") return false;
      return globalOrgIds.has(c.id) || descendantOrgIds(c.id).some((id) => globalOrgIds.has(id));
    });
    return kids;
  }, [subjectId, globalOrgIds]);

  const openIndicator = (id: string, orgId = subjectId) => {
    setIndicatorOrg(orgId);
    setIndicatorId(id);
  };

  const stmt = statementOf(subjectId, ctx, subjectId === "ORG-HQ" && subjectChildren ? "consolidated" : "standalone");
  const avail = reportAvailability(subjectId);
  const hqSelf = subjectId === "ORG-HQ" && !subjectChildren;

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
        <div className="reg-kpis-domain">
          {kpiDefs.map((def) => {
            if (hqSelf || avail === "no_report") {
              return (
                <KpiCard
                  key={def.id}
                  name={def.name}
                  value="—"
                  dataState={hqSelf ? "无独立报表" : "无独立报表"}
                  scopeLabel={`${orgName(subjectId)}${subjectChildren ? "（含下级）" : "（仅本级）"}`}
                  returnKey={def.id}
                />
              );
            }
            const m = computeIndicator(def, pageOrgIds, ctx);
            const parts = formatMetricParts(def, m);
            const caption = formatKpiCaption(m, def);
            return (
              <KpiCard
                key={def.id}
                name={def.name}
                value={parts.value}
                unit={parts.unit}
                compare={caption.compare}
                dataState={caption.dataState}
                scopeLabel={`${orgName(subjectId)}${subjectChildren ? "（含下级）" : "（仅本级）"}`}
                onOpen={() => openIndicator(def.id, subjectId)}
                returnKey={def.id}
              />
            );
          })}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[880px] w-full text-[13px]">
            <thead>
              <tr className="text-textsub border-b border-line">
                <th className="text-left font-medium py-2 pr-3">单位</th>
                <th className="text-left font-medium py-2 pr-3">类型</th>
                {kpiDefs.map((d) => (
                  <th key={d.id} className="text-right font-medium py-2 px-2">
                    {d.name}
                  </th>
                ))}
                <th className="text-left font-medium py-2 pl-3">报表</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.length === 0 && (
                <tr>
                  <td colSpan={kpiDefs.length + 3} className="py-4 text-textsub">
                    无下一级管理单位。可直接查看本级业务对象。
                  </td>
                </tr>
              )}
              {flattenUnits(compareRows, expanded, globalOrgIds).map(({ org: row, depth }) => {
                const ids = new Set(descendantOrgIds(row.id).filter((id) => globalOrgIds.has(id)));
                if (!ids.size) ids.add(row.id);
                const st = reportAvailability(row.id);
                const children = childOrgs(row.id).filter(
                  (c) =>
                    (isManagedUnit(c) || c.node_type === "headquarters") &&
                    (globalOrgIds.has(c.id) || descendantOrgIds(c.id).some((id) => globalOrgIds.has(id))),
                );
                return (
                  <tr key={row.id} className="border-b border-line/70">
                    <td className="py-2 pr-3" style={{ paddingLeft: 8 + depth * 16 }}>
                      <button type="button" className="text-brand hover:underline" onClick={() => { setSubjectId(row.id); setSubjectChildren(true); }}>
                        {row.name}
                      </button>
                      {children.length > 0 && (
                        <button
                          type="button"
                          className="ml-2 text-[12px] text-textsub hover:text-brand"
                          onClick={() =>
                            setExpanded((prev) => {
                              const n = new Set(prev);
                              if (n.has(row.id)) n.delete(row.id);
                              else n.add(row.id);
                              return n;
                            })
                          }
                          title="只展开真实下级，不改变当前主体"
                        >
                          {expanded.has(row.id) ? "收起" : "展开"}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-textsub">{orgUnitTypeLabel(row)}</td>
                    {kpiDefs.map((d) => {
                      if (st === "no_report") {
                        return (
                          <td key={d.id} className="text-right px-2 text-textsub">
                            无独立报表
                          </td>
                        );
                      }
                      const m = computeIndicator(d, ids, ctx);
                      const parts = formatMetricParts(d, m);
                      return (
                        <td key={d.id} className="text-right px-2">
                          <button type="button" className="num text-brand hover:underline" onClick={() => openIndicator(d.id, row.id)}>
                            {parts.value}
                            {parts.unit ? ` ${parts.unit}` : ""}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2 pl-3 text-textsub">{st === "no_report" ? "无独立报表" : statementOf(row.id, ctx)?.report_scope === "consolidated" ? "合并" : "个别"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="资金专题监管">
        <div className="flex flex-wrap gap-2 mb-4">
          {CASH_TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopicId(t.id)}
              className={`h-[48px] px-4 rounded-[6px] border text-[13px] ${
                topicId === t.id ? "border-brand bg-tint text-brand font-medium" : "border-line text-textsub hover:bg-tint"
              }`}
            >
              {t.short}
            </button>
          ))}
        </div>
        <TopicScale topicId={topicId} orgIds={pageOrgIds} />
        <p className="text-[12px] text-textsub mt-3">
          账户、收付、融资等业务对象从下方监管场景执行情况进入：点场景打开定义，点命中对象或未关闭事项查看挂钩明细。
        </p>
        <div className="mt-4">
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
          />
        </div>
      </Card>

      <IndicatorDrawer
        open={Boolean(indicatorId)}
        onClose={() => setIndicatorId(null)}
        indicator={indicatorId ? indicatorById(indicatorId) ?? null : null}
        indicatorOptions={kpiDefs}
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
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <Tag key={c} tone="neutral">
          {c}
        </Tag>
      ))}
    </div>
  );
}

function flattenUnits(
  rows: ReturnType<typeof childOrgs>,
  expanded: Set<string>,
  globalOrgIds: Set<string>,
  depth = 0,
): { org: (typeof rows)[number]; depth: number }[] {
  const out: { org: (typeof rows)[number]; depth: number }[] = [];
  for (const row of rows) {
    out.push({ org: row, depth });
    if (!expanded.has(row.id)) continue;
    const kids = childOrgs(row.id).filter(
      (c) =>
        (isManagedUnit(c) || c.node_type === "headquarters") &&
        (globalOrgIds.has(c.id) || descendantOrgIds(c.id).some((id) => globalOrgIds.has(id))),
    );
    out.push(...flattenUnits(kids, expanded, globalOrgIds, depth + 1));
  }
  return out;
}
