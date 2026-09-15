"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import IndicatorDrawer, { formatMetricParts } from "@/components/IndicatorDrawer";
import ObjectDrawer from "@/components/ObjectDrawer";
import OrgPanorama from "@/components/OrgPanorama";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import { Card, DataTable, KpiCard, Modal, Notice, SeverityTag, Tag } from "@/components/ui";
import { IconAlert, IconClipboard, IconLayers, IconOverview, DOMAIN_ICONS } from "@/components/icons";
import { DOMAIN_META } from "@/lib/seed";
import { INDICATORS, indicatorById } from "@/lib/metrics";
import { orgName, ROOT_ORG_ID } from "@/lib/org";
import { authorizedObjectIds, authorizedOrgIds, can, canDomain, intersectOrgScope, riskVisible } from "@/lib/config";
import { findObject } from "@/lib/objects";
import { statusLabel } from "@/lib/risks";
import { fmtAmountSmart } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import type { RiskCase } from "@/lib/types";
import {
  highRiskOwnerOrgIds,
  includesHeadquarters,
  inScopeProjects,
  managedOrgCount,
  openHighRiskCases,
  overdueHighRiskCases,
  overviewDomainCards,
  relatedObjects,
  type DomainCardModel,
  type ExceptionSlot,
  type MetricSlot,
  type OverviewScope,
} from "@/lib/overview";

/**
 * 综合总览：总部领导首页。
 * 监管主体全景 + 专项领域监管概况。口径见 lib/overview.ts 与业需第 6 章。
 */

type CaseQuery =
  | { title: string; mode: "high-risk" }
  | { title: string; mode: "high-risk-overdue" }
  | { title: string; mode: "ids"; ids: string[] };

type ObjectQuery =
  | { title: string; mode: "projects" }
  | { title: string; mode: "related" }
  | { title: string; mode: "ids"; ids: string[] };

function metricValueText(slot: MetricSlot): { value: string; unit: string } {
  if (slot.status !== "ok" || !slot.def || !slot.metric) return { value: "—", unit: "" };
  if (slot.display === "numerator") {
    return { value: fmtAmountSmart(slot.metric.numerator), unit: slot.def.unit === "%" ? "万元" : slot.def.unit };
  }
  return formatMetricParts(slot.def, slot.metric);
}

export default function OverviewPage() {
  const { filters, risks, setFilters, user, catalog } = useDemoStore();
  const [riskId, setRiskId] = useState<string | null>(null);
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [objectId, setObjectId] = useState<string | null>(null);
  const [caseScope, setCaseScope] = useState<CaseQuery | null>(null);
  const [objectScope, setObjectScope] = useState<ObjectQuery | null>(null);
  const [ownerListOpen, setOwnerListOpen] = useState(false);
  const listScrollRef = useRef(0);

  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );
  const authOrgs = useMemo(() => authorizedOrgIds(user), [user]);

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

  const visibleRisks = useMemo(() => risks.filter((r) => riskVisible(user, r)), [risks, user]);

  const overviewScope: OverviewScope = useMemo(
    () => ({
      orgIds,
      authorizedOrgIds: authOrgs,
      allowedObjectIds: ctx.allowedObjectIds ?? null,
      risks: visibleRisks,
      asOf: filters.asOf,
      ctx,
    }),
    [orgIds, authOrgs, ctx, visibleRisks, filters.asOf],
  );

  const unitCount = managedOrgCount(orgIds);
  const projectRows = useMemo(
    () => inScopeProjects(orgIds, overviewScope.allowedObjectIds),
    [orgIds, overviewScope.allowedObjectIds],
  );
  const highRisk = useMemo(() => openHighRiskCases(visibleRisks, orgIds), [visibleRisks, orgIds]);
  const overdueHighRisk = useMemo(
    () => overdueHighRiskCases(visibleRisks, orgIds, filters.asOf),
    [visibleRisks, orgIds, filters.asOf],
  );
  const ownerIds = useMemo(() => highRiskOwnerOrgIds(visibleRisks, orgIds), [visibleRisks, orgIds]);

  const domainCards = useMemo(
    () => overviewDomainCards(overviewScope, (d) => canDomain(user, d)),
    [overviewScope, user, catalog],
  );

  const scopeLabel = `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}`;

  useEffect(() => {
    setCaseScope(null);
    setObjectScope(null);
    setOwnerListOpen(false);
    setRiskId(null);
    setIndicatorId(null);
    setObjectId(null);
  }, [filters.orgId, filters.includeChildren, filters.periodStart, filters.periodEnd, filters.asOf, user?.id]);

  const openOverlay = () => {
    listScrollRef.current = typeof window !== "undefined" ? window.scrollY : 0;
  };
  const restoreScroll = () => {
    const y = listScrollRef.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
  };

  const caseRows: RiskCase[] = (() => {
    if (!caseScope) return [];
    if (caseScope.mode === "high-risk") return highRisk;
    if (caseScope.mode === "high-risk-overdue") return overdueHighRisk;
    return caseScope.ids.map((id) => visibleRisks.find((r) => r.id === id)).filter((r): r is RiskCase => Boolean(r));
  })();

  const objectRows = (() => {
    if (!objectScope) return [];
    if (objectScope.mode === "projects") return projectRows;
    if (objectScope.mode === "related") return relatedObjects(orgIds, overviewScope.allowedObjectIds);
    return objectScope.ids.map((id) => {
      const obj = findObject(id);
      return {
        id,
        name: obj?.name ?? id,
        orgId: obj?.orgId ?? "",
        kind: (obj?.type ?? "object") as
          | "fixed_asset_project"
          | "equity_project"
          | "engineering_project"
          | "asset"
          | "object",
      };
    });
  })();

  const selectUnit = (orgId: string) => {
    setFilters({ orgId, includeChildren: true });
  };

  const openCases = (query: CaseQuery) => {
    openOverlay();
    setCaseScope(query);
  };
  const openObjects = (query: ObjectQuery) => {
    openOverlay();
    setObjectScope(query);
  };

  const openException = (slot: ExceptionSlot) => {
    if (slot.count === null || slot.count === 0) return;
    openOverlay();
    if (slot.kind === "eng-high-risk") {
      setCaseScope({ title: slot.label, mode: "ids", ids: slot.riskIds });
      return;
    }
    if (slot.kind === "indicator" && slot.indicatorId) {
      setIndicatorId(slot.indicatorId);
      return;
    }
    setObjectScope({ title: slot.label, mode: "ids", ids: slot.objectIds });
  };

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

      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold text-textmain">监管主体全景</h2>
        <div className="reg-kpis">
          <KpiCard
            name="纳管单位数"
            value={unitCount}
            unit="家"
            compare={includesHeadquarters(orgIds) ? "含总部" : "不含总部"}
            icon={<IconOverview size={20} />}
            scopeLabel={scopeLabel}
            returnKey="kpi-units"
          />
          <KpiCard
            name="在管项目数"
            value={projectRows.length}
            unit="个"
            compare="固定资产投资、股权投资、工程去重"
            icon={<IconLayers size={20} />}
            scopeLabel={scopeLabel}
            onOpen={() => openObjects({ title: "在管项目", mode: "projects" })}
            returnKey="kpi-projects"
          />
          <KpiCard
            name="涉及未关闭高风险事项的责任单位数"
            value={ownerIds.length}
            unit="家"
            compare="按实际责任单位去重"
            icon={<IconClipboard size={20} />}
            scopeLabel={scopeLabel}
            onOpen={() => {
              openOverlay();
              setOwnerListOpen(true);
            }}
            returnKey="kpi-owners"
          />
          <div
            className="text-left bg-surface border border-line rounded-[10px] px-5 py-[18px] min-h-[168px] h-full flex gap-3.5 shadow-[0_2px_10px_rgba(17,43,77,0.04)]"
            title={scopeLabel}
          >
            <span
              className="shrink-0 w-10 h-10 rounded-[8px] flex items-center justify-center"
              style={{ background: "var(--risk-red-bg)", color: "var(--risk-red-fg)" }}
            >
              <IconAlert size={20} />
            </span>
            <span className="min-w-0 flex-1 flex flex-col h-full">
              <span className="text-[13px] text-textsub leading-5">未关闭高风险事项数</span>
              <button
                type="button"
                className="mt-2 flex h-10 items-end gap-1 text-left"
                style={{ color: "var(--risk-red-fg)" }}
                data-overlay-return="kpi-high-risk"
                onClick={() => openCases({ title: "未关闭高风险事项", mode: "high-risk" })}
              >
                <span className="num text-[32px] font-semibold leading-none">{highRisk.length}</span>
                <span className="text-[14px] text-textsub mb-0.5">件</span>
              </button>
              <button
                type="button"
                className="mt-auto pt-2 text-[13px] text-left hover:underline"
                style={{ color: overdueHighRisk.length ? "var(--risk-red-fg)" : "var(--text-sub)" }}
                data-overlay-return="kpi-overdue-high-risk"
                onClick={() => openCases({ title: "逾期高风险事项", mode: "high-risk-overdue" })}
              >
                逾期高风险 {overdueHighRisk.length} 件
              </button>
            </span>
          </div>
        </div>

        <Card
          title="主体层级"
          right={
            <button
              type="button"
              className="text-[13px] text-brand hover:underline whitespace-nowrap"
              onClick={() => openObjects({ title: "关联项目与资产", mode: "related" })}
            >
              查看关联项目/资产
            </button>
          }
        >
          <OrgPanorama
            selectedOrgId={authOrgs.has(filters.orgId) ? filters.orgId : [...authOrgs][0] ?? ROOT_ORG_ID}
            authorizedOrgIds={authOrgs}
            scope={overviewScope}
            onSelect={selectUnit}
            onReturnHq={() => selectUnit(ROOT_ORG_ID)}
          />
        </Card>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-textmain mb-3">专项领域监管概况</h2>
        <div className="reg-domains">
          {domainCards.map((card) => (
            <DomainOverviewCard
              key={card.domain}
              card={card}
              onOpenIndicator={(id) => {
                openOverlay();
                setIndicatorId(id);
              }}
              onOpenException={openException}
            />
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(caseScope)}
        onClose={() => {
          setCaseScope(null);
          restoreScroll();
        }}
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

      <Modal
        open={ownerListOpen}
        onClose={() => {
          setOwnerListOpen(false);
          restoreScroll();
        }}
        title="高风险责任单位"
        subtitle={`来源范围：${scopeLabel}｜共 ${ownerIds.length} 家，按实际责任单位去重`}
        width={640}
      >
        <DataTable
          rows={ownerIds.map((id) => ({ id }))}
          rowKey={(r) => r.id}
          empty="当前范围没有未关闭高风险事项的责任单位。"
          compactEmpty
          columns={[
            { key: "name", title: "责任单位", render: (r) => orgName(r.id) },
            {
              key: "n",
              title: "未关闭高风险",
              width: "120px",
              nowrap: true,
              render: (r) => openHighRiskCases(visibleRisks, new Set([r.id])).length,
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
                  onClick={() => {
                    setOwnerListOpen(false);
                    selectUnit(r.id);
                  }}
                >
                  查看该单位
                </button>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        open={Boolean(objectScope)}
        onClose={() => {
          setObjectScope(null);
          restoreScroll();
        }}
        title={objectScope?.title ?? "对象清单"}
        subtitle={`来源范围：${scopeLabel}｜共 ${objectRows.length} 条；打开档案不改变组织范围`}
        width={800}
      >
        <DataTable
          rows={objectRows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setObjectId(r.id)}
          empty="当前范围没有关联对象。"
          compactEmpty
          columns={[
            { key: "name", title: "名称", render: (r) => r.name },
            {
              key: "kind",
              title: "类型",
              width: "140px",
              nowrap: true,
              render: (r) =>
                "kind" in r
                  ? r.kind === "fixed_asset_project"
                    ? "固定资产投资项目"
                    : r.kind === "equity_project"
                      ? "股权投资项目"
                      : r.kind === "engineering_project"
                        ? "工程项目"
                        : r.kind === "asset"
                          ? "资产"
                          : "对象"
                  : "对象",
            },
            {
              key: "org",
              title: "归属单位",
              width: "150px",
              nowrap: true,
              render: (r) => ("orgId" in r && r.orgId ? orgName(r.orgId) : "—"),
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
                    setObjectId(r.id);
                  }}
                >
                  查看档案
                </button>
              ),
            },
          ]}
        />
      </Modal>

      <IndicatorDrawer
        open={Boolean(indicatorId)}
        onClose={() => {
          setIndicatorId(null);
          restoreScroll();
        }}
        indicator={indicatorId ? indicatorById(indicatorId) ?? null : null}
        indicatorOptions={INDICATORS}
        onSwitchIndicator={setIndicatorId}
        initialOrgId={filters.orgId}
        includeChildren={filters.includeChildren}
        scopeLabel={scopeLabel}
        onOpenObject={setObjectId}
        onOpenRisk={setRiskId}
      />
      <ObjectDrawer objectId={objectId} onClose={() => setObjectId(null)} onOpenRisk={setRiskId} />
      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel="综合总览" />
    </div>
  );
}

function DomainOverviewCard({
  card,
  onOpenIndicator,
  onOpenException,
}: {
  card: DomainCardModel;
  onOpenIndicator: (id: string) => void;
  onOpenException: (slot: ExceptionSlot) => void;
}) {
  const meta = DOMAIN_META[card.domain];
  const Icon = DOMAIN_ICONS[card.domain];
  const hits = card.exceptions.filter((e) => e.count !== null && e.count > 0);
  return (
    <article className="reg-domain-card bg-surface border border-line rounded-[10px] shadow-[0_2px_10px_rgba(17,43,77,0.04)] p-5">
      <div className="flex items-center justify-between gap-2 min-h-8">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[8px] bg-[#EAF1FD] text-brand flex items-center justify-center shrink-0">
            {Icon && <Icon size={16} />}
          </span>
          <Link href={meta.route} className="text-[16px] font-semibold text-textmain hover:text-brand leading-5 truncate">
            {meta.label}
          </Link>
        </div>
        <Link href={meta.route} className="text-[13px] text-brand shrink-0 hover:underline whitespace-nowrap">
          进入领域 →
        </Link>
      </div>
      <div className="reg-domain-metrics">
        {card.metrics.map((slot, i) => {
          const parts = metricValueText(slot);
          const clickable = slot.status === "ok" && slot.def;
          const inner = (
            <>
              <div className="text-[13px] text-textsub leading-5">{slot.label}</div>
              <div className="flex items-baseline gap-1 mt-1 min-w-0">
                <span className="num text-[22px] font-semibold text-textmain leading-none truncate">
                  {parts.unit === "%" ? `${parts.value}%` : parts.value}
                </span>
                {parts.unit && parts.unit !== "%" && (
                  <span className="text-[13px] text-textsub whitespace-nowrap">{parts.unit}</span>
                )}
              </div>
              {slot.status !== "ok" && (
                <div className="text-[12px] text-textsub mt-1 leading-4">{slot.emptyReason ?? "—"}</div>
              )}
            </>
          );
          if (clickable) {
            return (
              <button
                key={`${slot.indicatorId}-${slot.display}-${i}`}
                type="button"
                className="text-left min-w-0"
                onClick={() => onOpenIndicator(slot.indicatorId)}
                data-overlay-return={slot.indicatorId}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={`${slot.indicatorId}-${slot.display}-${i}`} className="min-w-0">
              {inner}
            </div>
          );
        })}
      </div>
      <div className="reg-domain-exceptions">
        {hits.map((slot) => (
          <button
            key={slot.key}
            type="button"
            className="text-[12px] rounded-full px-2 py-0.5 border border-line whitespace-nowrap"
            style={{ color: "var(--risk-amber-fg)" }}
            onClick={() => onOpenException(slot)}
          >
            {slot.label} {slot.count}
          </button>
        ))}
        {hits.length === 0 && card.emptyKind === "no_business" && <Tag tone="neutral">无业务</Tag>}
        {hits.length === 0 && card.emptyKind === "unevaluated" && <Tag tone="neutral">未评估</Tag>}
        {hits.length === 0 && card.emptyKind === "monitored_clear" && (
          <span className="text-[12px] text-textsub">本次监测未发现异常</span>
        )}
      </div>
    </article>
  );
}
