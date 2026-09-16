"use client";

import React, { useEffect, useMemo, useState } from "react";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import ChevronFlow, { type ChevronItem } from "@/components/ChevronFlow";
import IndicatorDrawer from "@/components/IndicatorDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import ScenarioDrawer from "@/components/ScenarioDrawer";
import ObjectDrawer from "@/components/ObjectDrawer";
import ScenarioExecutionPanel from "@/components/ScenarioExecutionPanel";
import { Card, DataTable, KpiCard, Tag } from "@/components/ui";
import { useDemoStore } from "@/lib/store";
import { authorizedObjectIds, canDomain, intersectOrgScope } from "@/lib/config";
import { descendantOrgIds, orgName, orgPath } from "@/lib/org";
import { seed, templateById } from "@/lib/seed";
import { censusCounts, openMatterCount, penetratePaths } from "@/lib/fp-census";
import { ECONOMIC_BEHAVIORS, RIGHTS_TOPICS } from "@/lib/fp-topics";
import { fmtPct } from "@/lib/format";
import { openCountForPhase } from "@/lib/monitoring";
import { riskMatches, isOpen } from "@/lib/risks";
import { indicatorById } from "@/lib/metrics";
import { runnableDrawerIndicators } from "@/lib/indicator-scope";

export default function PropertyDomainView() {
  const { filters, risks, user } = useDemoStore();
  const [subjectId, setSubjectId] = useState(filters.orgId);
  const [subjectChildren, setSubjectChildren] = useState(filters.includeChildren);
  const [focusEntity, setFocusEntity] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "graph">("list");
  const [censusFilter, setCensusFilter] = useState<"N" | "C" | "P" | "T" | null>(null);
  const [topicId, setTopicId] = useState("PTY2-T-TRADE");
  const [behavior, setBehavior] = useState<(typeof ECONOMIC_BEHAVIORS)[number]["id"]>("nonlisted_transfer");
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);
  const [objectId, setObjectId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioSourceOpen, setScenarioSourceOpen] = useState(false);
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [ledgerMode, setLedgerMode] = useState<"all" | "hit" | "uneval">("all");

  const globalOrgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );

  useEffect(() => {
    setSubjectId(filters.orgId);
    setSubjectChildren(filters.includeChildren);
    setFocusEntity(null);
    setRiskId(null);
    setObjectId(null);
    setScenarioId(null);
    setIndicatorId(null);
  }, [filters.orgId, filters.includeChildren, filters.periodStart, filters.periodEnd, filters.asOf, user?.id]);

  const pageOrgIds = useMemo(() => {
    const local = new Set(subjectChildren ? descendantOrgIds(subjectId) : [subjectId]);
    return new Set([...local].filter((id) => globalOrgIds.has(id)));
  }, [subjectId, subjectChildren, globalOrgIds]);

  const allowedObjectIds = useMemo(() => authorizedObjectIds(user), [user]);
  const census = useMemo(() => censusCounts(pageOrgIds, filters.asOf), [pageOrgIds, filters.asOf]);
  const matters = useMemo(() => openMatterCount(pageOrgIds), [pageOrgIds]);
  const eb = ECONOMIC_BEHAVIORS.find((x) => x.id === behavior)!;
  const template = templateById(eb.templateId);

  const domainRisks = risks.filter((r) => riskMatches(r, { domain: "RIGHTS", orgScope: pageOrgIds }));

  const chevrons: ChevronItem[] = useMemo(() => {
    if (topicId !== "PTY2-T-TRADE" || !template) return [];
    return template.phase_nodes
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((n) => {
        const c = openCountForPhase("RIGHTS", n.id, pageOrgIds, domainRisks, filters.asOf);
        const stay = seed.property_matters.filter(
          (m) => pageOrgIds.has(m.owner_org_id) && m.template_id === template.id && m.current_phase_id === n.id,
        ).length;
        const inst = seed.lifecycle_instances.find(
          (i) => i.template_id === template.id && i.phase_id === n.id && i.business_status === "not_applicable",
        );
        return {
          id: n.id,
          name: n.name,
          openCount: c.open,
          severity: c.maxSeverity,
          stayCount: stay,
          businessNote: inst ? "不适用（有依据）" : undefined,
        };
      });
  }, [topicId, template, pageOrgIds, domainRisks, filters.asOf]);

  const path = orgPath(subjectId).filter((o) => globalOrgIds.has(o.id) || o.id === filters.orgId);
  const gate = path.findIndex((o) => o.id === filters.orgId);
  const visiblePath = gate >= 0 ? path.slice(gate) : path;

  const listEntities = useMemo(() => {
    let rows = census.list;
    if (censusFilter === "C") rows = rows.filter((x) => x.class === "controlled");
    if (censusFilter === "P") rows = rows.filter((x) => x.class === "participating");
    if (censusFilter === "N") rows = census.list;
    return rows;
  }, [census, censusFilter]);

  const matterRows = useMemo(() => {
    let rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id));
    if (focusEntity) {
      rows = rows.filter((m) => m.investor_id === focusEntity || m.investee_id === focusEntity);
    }
    if (topicId === "PTY2-T-TRADE") {
      rows = rows.filter((m) => m.template_id === eb.templateId || ["产权转让", "无偿划转", "企业增资", "资产转让", "上市股份"].includes(m.matter_type));
      if (behavior === "free_transfer") rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id) && m.template_id === "PR-FREE-TEMPLATE-V12");
      if (behavior === "capital_increase") rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id) && m.template_id === "PR-CAPITAL-TEMPLATE-V12");
      if (behavior === "asset_transfer") rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id) && m.template_id === "PR-ASSET-TEMPLATE-V16");
      if (behavior === "listed_shares") rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id) && m.template_id === "PR-LISTED-TEMPLATE-V16");
      if (behavior === "nonlisted_transfer") {
        rows = seed.property_matters.filter(
          (m) => pageOrgIds.has(m.owner_org_id) && (m.template_id === "PR-TRANSFER-TEMPLATE-V12" || m.matter_type === "产权转让"),
        );
      }
      if (phaseId) rows = rows.filter((m) => m.current_phase_id === phaseId);
    } else if (topicId === "PTY2-T-REG") {
      rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id) && (m.matter_type === "产权登记" || m.template_id === "PR-REG-TEMPLATE-V12"));
    } else if (topicId === "PTY2-T-IDENTITY") {
      rows = [];
    } else {
      rows = seed.property_matters.filter((m) => pageOrgIds.has(m.owner_org_id) && m.matter_type === "股权与控制权");
    }
    if (focusEntity) rows = rows.filter((m) => m.investor_id === focusEntity || m.investee_id === focusEntity);
    return rows;
  }, [pageOrgIds, focusEntity, topicId, eb.templateId, behavior, phaseId]);

  const hitIds = new Set(
    seed.scenario_monitoring_coverage
      .filter((r) => r.domain === "RIGHTS" && r.topic_id === topicId && r.status === "evaluated_hit")
      .map((r) => r.monitoring_object_id),
  );
  const unevalIds = new Set(
    seed.scenario_monitoring_coverage
      .filter((r) => r.domain === "RIGHTS" && r.topic_id === topicId && r.status === "data_insufficient")
      .map((r) => r.monitoring_object_id),
  );

  const shownMatters = matterRows.filter((m) => {
    if (ledgerMode === "hit") return hitIds.has(m.id) || m.risk_ids.some((id) => hitIds.has(id));
    if (ledgerMode === "uneval") return unevalIds.has(m.id);
    return true;
  });

  const pctLabel = (v: number | null) => (v === null ? "不适用" : fmtPct(v));

  return (
    <div className="space-y-4">
      <PageHeader title="产权管理">
        <FilterBar />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="rights-subject-path">
        <span className="text-textsub">当前组织范围</span>
        {visiblePath.map((o, i) => (
          <span key={o.id} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-textsub">/</span>}
            <button
              type="button"
              className={o.id === subjectId ? "text-brand font-medium" : "text-textmain hover:text-brand"}
              onClick={() => {
                setSubjectId(o.id);
                setSubjectChildren(o.id === filters.orgId ? filters.includeChildren : true);
                setFocusEntity(null);
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
        {focusEntity && (
          <>
            <Tag tone="amber">当前法人 {seed.legal_entities.find((e) => e.id === focusEntity)?.name ?? focusEntity}</Tag>
            <button type="button" className="h-7 px-2 rounded-[6px] border border-line text-[12px]" onClick={() => setFocusEntity(null)}>
              清除法人选择
            </button>
          </>
        )}
      </div>

      <Card title="法人及股权全景">
        {canDomain(user, "RIGHTS") ? (
          <div className="reg-kpis-domain">
            <KpiCard name="纳管法人户数" value={String(census.N)} unit="户" compare={census.check ? `B+C+P+U=${census.B}+${census.C}+${census.P}+${census.U}` : "构成待核"} onOpen={() => setCensusFilter("N")} returnKey="N" />
            <KpiCard name="控股及实际控制企业" value={String(census.C)} unit="户" compare={pctLabel(census.cPct)} dataState={`全资${census.whollyInC}／非全资${census.nonWhollyInC}`} onOpen={() => setCensusFilter("C")} returnKey="C" />
            <KpiCard name="参股企业" value={String(census.P)} unit="户" compare={pctLabel(census.pPct)} onOpen={() => setCensusFilter("P")} returnKey="P" />
            <KpiCard name="在办产权事项" value={String(matters.count)} unit="项" compare="按事项ID去重" onOpen={() => { setCensusFilter("T"); setTopicId("PTY2-T-TRADE"); }} returnKey="T" />
          </div>
        ) : (
          <p className="text-[13px] text-textsub">当前身份不能查看产权经营数据。</p>
        )}
        <p className="text-[12px] text-textsub mt-2">控制待核实 {census.U} 户单列。分支机构不算法人。点击股权图中的法人只聚焦档案，四卡仍为当前组织范围。</p>

        <div className="flex gap-2 mt-4 mb-3">
          <button type="button" className={`h-8 px-3 rounded-[6px] border text-[12px] ${view === "list" ? "border-brand bg-tint text-brand" : "border-line"}`} onClick={() => setView("list")}>
            法人清单
          </button>
          <button type="button" className={`h-8 px-3 rounded-[6px] border text-[12px] ${view === "graph" ? "border-brand bg-tint text-brand" : "border-line"}`} onClick={() => setView("graph")}>
            股权关系
          </button>
        </div>

        {view === "list" ? (
          <DataTable
            rows={listEntities}
            rowKey={(r) => r.entity.id}
            onRowClick={(r) => {
              setFocusEntity(r.entity.id);
              setObjectId(r.entity.id);
            }}
            empty="当前组织范围内没有纳入产权管理的法人。"
            pageSize={8}
            columns={[
              { key: "name", title: "法人", minWidth: "180px", render: (r) => r.entity.name },
              { key: "id", title: "主体ID", width: "110px", render: (r) => <span className="num">{r.entity.id}</span> },
              {
                key: "class",
                title: "口径",
                width: "120px",
                render: (r) => ({ body: "海工本体", controlled: "控股及实控", participating: "参股", unverified: "控制待核实" }[r.class]),
              },
              { key: "own", title: "全资", width: "70px", render: (r) => (r.whollyOwned ? "是" : "否") },
              { key: "basis", title: "控制依据", minWidth: "180px", render: (r) => r.controlBasis || "—" },
              {
                key: "edge",
                title: "直接持股",
                render: (r) =>
                  r.directEdges.length
                    ? r.directEdges.map((e) => `${e.investorId} ${e.pct}%`).join("；")
                    : "—",
              },
            ]}
          />
        ) : (
          <EquityGraph orgIds={pageOrgIds} asOf={filters.asOf} focus={focusEntity} onFocus={(id) => { setFocusEntity(id); setObjectId(id); }} />
        )}
        {focusEntity && (
          <div className="mt-3 text-[13px] text-textsub">
            穿透权益（完整无环路径乘积）：{" "}
            {penetratePaths(focusEntity)
              .map((p) => `${p.path.join("→")} ${(p.product * 100).toFixed(2)}%`)
              .join("；") || "链路不全，待核实"}
          </div>
        )}
      </Card>

      <Card title="产权事项监管" id="rights-topics">
        <div className="flex flex-wrap gap-2 mb-4">
          {RIGHTS_TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTopicId(t.id);
                setPhaseId(null);
              }}
              className={`h-[48px] px-4 rounded-[6px] border text-[13px] ${
                topicId === t.id ? "border-brand bg-tint text-brand font-medium" : "border-line text-textsub hover:bg-tint"
              }`}
            >
              {t.short}
            </button>
          ))}
        </div>

        {topicId === "PTY2-T-TRADE" && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[12px] text-textsub">经济行为</span>
              {ECONOMIC_BEHAVIORS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBehavior(b.id);
                    setPhaseId(null);
                  }}
                  className={`h-8 px-3 rounded-[6px] border text-[12px] ${behavior === b.id ? "border-brand bg-tint text-brand" : "border-line"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {behavior === "free_transfer" && <Tag tone="neutral">无偿划转无价款，不生成价款逾期</Tag>}
            {behavior === "listed_shares" && <Tag tone="neutral">上市股份模板，不套非上市挂牌</Tag>}
            {template && (
              <div className="mt-3">
                <ChevronFlow items={chevrons} value={phaseId} onChange={setPhaseId} ariaLabel="产权交易监管节点" />
              </div>
            )}
          </>
        )}

        <div className="flex gap-1 my-3">
          {(
            [
              ["all", "全部对象"],
              ["hit", "命中对象"],
              ["uneval", "未评估对象"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLedgerMode(id)}
              className={`h-8 px-3 rounded-[6px] border text-[12px] ${ledgerMode === id ? "border-brand bg-tint text-brand" : "border-line text-textsub"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {topicId === "PTY2-T-IDENTITY" && shownMatters.length === 0 && (
          <p className="text-[13px] text-textsub mb-3">当前范围无业务</p>
        )}

        <DataTable
          rows={shownMatters}
          rowKey={(m) => m.id}
          onRowClick={(m) => setObjectId(m.id)}
          empty={matterRows.length === 0 ? "当前范围无业务" : "当前筛选没有事项。"}
          pageSize={8}
          compactEmpty
          columns={[
            { key: "name", title: "事项", minWidth: "200px", render: (m) => m.name },
            { key: "type", title: "类型", width: "110px", render: (m) => m.matter_type },
            { key: "phase", title: "当前环节", width: "120px", render: (m) => templateById(m.template_id)?.phase_nodes.find((n) => n.id === m.current_phase_id)?.name ?? m.current_phase_id },
            { key: "le", title: "相关法人", render: (m) => `${m.investor_id} → ${m.investee_id}` },
          ]}
        />

        <div className="mt-4">
          <ScenarioExecutionPanel
            domain="RIGHTS"
            topicId={topicId}
            phaseId={topicId === "PTY2-T-TRADE" ? phaseId : null}
            orgIds={pageOrgIds}
            allowedObjectIds={allowedObjectIds}
            scopeTitle={RIGHTS_TOPICS.find((t) => t.id === topicId)?.name ?? "专题"}
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
        indicatorOptions={runnableDrawerIndicators("RIGHTS")}
        onSwitchIndicator={setIndicatorId}
        allowIndicatorSwitch
        initialOrgId={subjectId}
        includeChildren={subjectChildren}
        scopeLabel={`${orgName(subjectId)}｜${filters.asOf}`}
        onOpenObject={setObjectId}
        onOpenRisk={setRiskId}
      />
      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel="产权管理" />
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

function EquityGraph({
  orgIds,
  asOf,
  focus,
  onFocus,
}: {
  orgIds: Set<string>;
  asOf: string;
  focus: string | null;
  onFocus: (id: string) => void;
}) {
  const { list } = censusCounts(orgIds, asOf);
  const ids = new Set(list.map((x) => x.entity.id));
  ids.add("LE-HQ");
  const edges = seed.ownership_snapshots.filter((s) => ids.has(s.investor_id) && ids.has(s.investee_id));
  const unique = new Map<string, typeof edges>();
  for (const e of edges) {
    const k = `${e.investor_id}->${e.investee_id}`;
    unique.set(k, [...(unique.get(k) ?? []), e]);
  }
  return (
    <div className="border border-line rounded-[8px] p-4 overflow-x-auto">
      <div className="min-w-[640px] space-y-3">
        {[...unique.entries()].map(([k, snaps]) => {
          const [from, to] = k.split("->");
          const fromName = seed.legal_entities.find((e) => e.id === from)?.name ?? from;
          const toName = seed.legal_entities.find((e) => e.id === to)?.name ?? to;
          const selected = focus === from || focus === to;
          return (
            <div key={k} className={`flex flex-wrap items-center gap-2 text-[13px] ${selected ? "bg-tint rounded-[6px] px-2 py-1" : ""}`}>
              <button type="button" className="text-brand hover:underline" onClick={() => onFocus(from)}>
                {fromName}
              </button>
              <span className="text-textsub">→</span>
              <button type="button" className="text-brand hover:underline" onClick={() => onFocus(to)}>
                {toName}
              </button>
              <span className="num text-textsub">
                {snaps.map((s) => `${s.pct}% · ${s.source_type} · ${s.effective_date}`).join(" ｜ ")}
              </span>
            </div>
          );
        })}
        {unique.size === 0 && <p className="text-textsub text-[13px]">当前范围没有可见持股边。</p>}
      </div>
      <p className="text-[12px] text-textsub mt-3">同一法人多条出资边共享一个主体ID。展开关系或点击边不扩大授权。</p>
    </div>
  );
}
