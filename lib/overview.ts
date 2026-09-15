/**
 * 综合总览计算依据（业需第 6 章 / 定位说明第 2 节）。
 * 页面数字必须走本模块，禁止把样本核对值写死到卡片。
 */

import { coverageRows, seed } from "./seed";
import { childOrgs, descendantOrgIds, orgById, orgScope, ROOT_ORG_ID } from "./org";
import { computeIndicator, indicatorById, type IndicatorContext, type IndicatorDef, type NodeMetric } from "./metrics";
import { catalogIndicatorVisible } from "./live-config";
import { isCoverageCandidate } from "./monitoring";
import { isOpen, isOverdueRectification } from "./risks";
import type { DomainId, Organization, RiskCase } from "./types";

export const OVERVIEW_DOMAIN_ORDER: DomainId[] = ["FA", "EQ", "INTL", "CASH", "RIGHTS", "ENG"];

export type OrgCoverageState = "no_business" | "unevaluated" | "monitored";

export interface OverviewScope {
  /** 当前筛选 ∩ 授权后的组织集合（总体数字与领域卡） */
  orgIds: Set<string>;
  /** 当前身份可访问的组织（主体图节点统计，不受当前选中裁剪） */
  authorizedOrgIds: Set<string>;
  allowedObjectIds: string[] | null;
  risks: RiskCase[];
  asOf: string;
  ctx: IndicatorContext;
}

function objectAllowedInScope(objectId: string, allowed: string[] | null): boolean {
  if (allowed === null) return true;
  return allowed.includes(objectId);
}

/** 目录未登记的计算器可展示；已登记则只看是否启用，不要求 homepage，也不改目录。 */
export function overviewIndicatorEnabled(def: IndicatorDef): boolean {
  const catalogId = def.catalogIndicatorId ?? def.id;
  return catalogIndicatorVisible(catalogId);
}

/**
 * 纳管单位：组织主数据 ∩ 当前范围，按组织 ID 去重。
 * 总部（ORG-HQ）仅当其 ID 落在当前范围内时计入；不以法人/项目/账户/资产充抵。
 */
export function managedOrganizations(orgIds: Set<string>): Organization[] {
  return seed.organizations.filter((o) => orgIds.has(o.id)).sort((a, b) => a.id.localeCompare(b.id));
}

export function managedOrgCount(orgIds: Set<string>): number {
  return managedOrganizations(orgIds).length;
}

export function includesHeadquarters(orgIds: Set<string>): boolean {
  return orgIds.has(ROOT_ORG_ID);
}

/**
 * 在管项目：FA + EQ + ENG 主记录按项目 ID 去重。
 * 同一工程项目同时属于国际化业务时不重复计数。
 */
export function inScopeProjects(
  orgIds: Set<string>,
  allowedObjectIds: string[] | null,
): { id: string; name: string; orgId: string; kind: "fixed_asset_project" | "equity_project" | "engineering_project" }[] {
  const rows: { id: string; name: string; orgId: string; kind: "fixed_asset_project" | "equity_project" | "engineering_project" }[] = [];
  const seen = new Set<string>();
  const push = (
    id: string,
    name: string,
    orgId: string,
    kind: "fixed_asset_project" | "equity_project" | "engineering_project",
  ) => {
    if (!orgIds.has(orgId) || !objectAllowedInScope(id, allowedObjectIds) || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, name, orgId, kind });
  };
  for (const p of seed.fixed_asset_projects) push(p.id, p.name, p.owner_org_id, "fixed_asset_project");
  for (const p of seed.equity_projects) push(p.id, p.name, p.owner_org_id, "equity_project");
  for (const p of seed.engineering_projects) push(p.id, p.name, p.owner_org_id, "engineering_project");
  return rows;
}

export function inScopeProjectCount(orgIds: Set<string>, allowedObjectIds: string[] | null): number {
  return inScopeProjects(orgIds, allowedObjectIds).length;
}

export function inScopeAssets(orgIds: Set<string>, allowedObjectIds: string[] | null) {
  return seed.assets.filter((a) => orgIds.has(a.owner_org_id) && objectAllowedInScope(a.id, allowedObjectIds));
}

/** 未关闭且高风险；按事项 ID 跨领域去重（输入列表已是唯一事项）。 */
export function openHighRiskCases(risks: RiskCase[], orgIds: Set<string>): RiskCase[] {
  return risks.filter((r) => isOpen(r) && r.severity === "red" && orgIds.has(r.owner_org_id));
}

/** 逾期高风险：高风险未关闭子集，且已进入整改并超过有效期限。 */
export function overdueHighRiskCases(risks: RiskCase[], orgIds: Set<string>, asOf: string): RiskCase[] {
  return openHighRiskCases(risks, orgIds).filter((r) => isOverdueRectification(r, asOf));
}

/**
 * 高风险责任单位：按实际责任单位 ID 去重，不把上级重复累计。
 */
export function highRiskOwnerOrgIds(risks: RiskCase[], orgIds: Set<string>): string[] {
  const ids = new Set<string>();
  for (const r of openHighRiskCases(risks, orgIds)) ids.add(r.owner_org_id);
  return [...ids].sort();
}

function hasBusinessObjects(orgIds: Set<string>, allowedObjectIds: string[] | null): boolean {
  if (inScopeProjects(orgIds, allowedObjectIds).length > 0) return true;
  if (inScopeAssets(orgIds, allowedObjectIds).length > 0) return true;
  if (seed.accounts.some((a) => orgIds.has(a.owner_org_id) && objectAllowedInScope(a.id, allowedObjectIds))) return true;
  if (seed.property_matters.some((m) => orgIds.has(m.owner_org_id) && objectAllowedInScope(m.id, allowedObjectIds)))
    return true;
  return false;
}

function hasCompletedMonitoring(orgIds: Set<string>): boolean {
  return coverageRows.some((row) => orgIds.has(row.owner_org_id) && !isCoverageCandidate(row));
}

export function orgCoverageState(
  orgId: string,
  allowedObjectIds: string[] | null,
): OrgCoverageState {
  const scope = new Set(descendantOrgIds(orgId));
  if (!hasBusinessObjects(scope, allowedObjectIds)) return "no_business";
  if (!hasCompletedMonitoring(scope)) return "unevaluated";
  return "monitored";
}

export interface OrgNodeStats {
  orgId: string;
  name: string;
  projectCount: number;
  openHighRiskCount: number;
  overdueHighRiskCount: number;
  coverage: OrgCoverageState;
}

/** 节点数字按该单位及其下级统计，与点击后「含下级」筛选一致。 */
export function orgNodeStats(
  orgId: string,
  scope: OverviewScope,
): OrgNodeStats {
  const org = orgById(orgId);
  const nodeOrgs = new Set(descendantOrgIds(orgId).filter((id) => scope.authorizedOrgIds.has(id)));
  return {
    orgId,
    name: org?.name ?? orgId,
    projectCount: inScopeProjectCount(nodeOrgs, scope.allowedObjectIds),
    openHighRiskCount: openHighRiskCases(scope.risks, nodeOrgs).length,
    overdueHighRiskCount: overdueHighRiskCases(scope.risks, nodeOrgs, scope.asOf).length,
    coverage: orgCoverageState(orgId, scope.allowedObjectIds),
  };
}

export function panoramaRootId(authorizedOrgIds: Set<string>): string {
  if (authorizedOrgIds.has(ROOT_ORG_ID)) return ROOT_ORG_ID;
  const roots = seed.organizations.filter((o) => authorizedOrgIds.has(o.id) && (!o.parent_id || !authorizedOrgIds.has(o.parent_id)));
  return roots[0]?.id ?? ROOT_ORG_ID;
}

export function visibleChildOrgs(parentId: string, authorizedOrgIds: Set<string>): Organization[] {
  return childOrgs(parentId).filter((o) => {
    if (authorizedOrgIds.has(o.id)) return true;
    return descendantOrgIds(o.id).some((id) => authorizedOrgIds.has(id));
  });
}

export type MetricSlotStatus = "ok" | "empty" | "disabled" | "missing";

export interface MetricSlot {
  indicatorId: string;
  label: string;
  display: "value" | "numerator";
  status: MetricSlotStatus;
  def?: IndicatorDef;
  metric?: NodeMetric;
  emptyReason?: string;
}

export interface ExceptionSlot {
  key: string;
  label: string;
  kind: "indicator" | "gap" | "positive-numerator" | "eng-high-risk";
  indicatorId?: string;
  count: number | null;
  emptyReason?: string;
  objectIds: string[];
  riskIds: string[];
}

export interface DomainCardModel {
  domain: DomainId;
  metrics: [MetricSlot, MetricSlot];
  exceptions: ExceptionSlot[];
  emptyKind?: "no_business" | "unevaluated" | "monitored_clear";
}

function metricSlot(indicatorId: string, label: string, display: "value" | "numerator", orgIds: Set<string>, ctx: IndicatorContext): MetricSlot {
  const def = indicatorById(indicatorId);
  if (!def) return { indicatorId, label, display, status: "missing", emptyReason: "无计算依据" };
  if (!overviewIndicatorEnabled(def)) {
    return { indicatorId, label, display, status: "disabled", def, emptyReason: "指标未启用" };
  }
  const metric = computeIndicator(def, orgIds, ctx);
  if (metric.status === "no_business") {
    return { indicatorId, label, display, status: "empty", def, metric, emptyReason: "当前范围无业务" };
  }
  const raw = display === "numerator" ? metric.numerator : metric.value;
  if (raw === null || metric.status === "unknown") {
    return {
      indicatorId,
      label,
      display,
      status: "empty",
      def,
      metric,
      emptyReason: metric.emptyReason ?? "数据不足，未评估",
    };
  }
  return { indicatorId, label, display, status: "ok", def, metric };
}

function indicatorCountException(
  key: string,
  label: string,
  indicatorId: string,
  orgIds: Set<string>,
  ctx: IndicatorContext,
): ExceptionSlot {
  const def = indicatorById(indicatorId);
  if (!def) return { key, label, kind: "indicator", indicatorId, count: null, emptyReason: "无计算依据", objectIds: [], riskIds: [] };
  if (!overviewIndicatorEnabled(def)) {
    return { key, label, kind: "indicator", indicatorId, count: null, emptyReason: "指标未启用", objectIds: [], riskIds: [] };
  }
  const metric = computeIndicator(def, orgIds, ctx);
  if (metric.status === "no_business") {
    return { key, label, kind: "indicator", indicatorId, count: null, emptyReason: "当前范围无业务", objectIds: [], riskIds: [] };
  }
  if (metric.value === null || metric.status === "unknown") {
    return {
      key,
      label,
      kind: "indicator",
      indicatorId,
      count: null,
      emptyReason: metric.emptyReason ?? "数据不足，未评估",
      objectIds: metric.leaves.map((l) => l.objectId),
      riskIds: [],
    };
  }
  const leaves = metric.leaves.filter((l) => l.dataComplete);
  return {
    key,
    label,
    kind: "indicator",
    indicatorId,
    count: metric.value,
    objectIds: leaves.map((l) => l.objectId),
    riskIds: [],
  };
}

function gapException(
  key: string,
  label: string,
  indicatorId: string,
  orgIds: Set<string>,
  ctx: IndicatorContext,
): ExceptionSlot {
  const def = indicatorById(indicatorId);
  if (!def) return { key, label, kind: "gap", indicatorId, count: null, emptyReason: "无计算依据", objectIds: [], riskIds: [] };
  const metric = computeIndicator(def, orgIds, ctx);
  if (metric.status === "no_business") {
    return { key, label, kind: "gap", indicatorId, count: null, emptyReason: "当前范围无业务", objectIds: [], riskIds: [] };
  }
  if (metric.status === "unknown" && metric.leaves.length === 0) {
    return { key, label, kind: "gap", indicatorId, count: null, emptyReason: metric.emptyReason ?? "未评估", objectIds: [], riskIds: [] };
  }
  const hits = metric.leaves.filter((l) => {
    if (!l.dataComplete || l.numerator === null || l.denominator === null) return false;
    return l.numerator < l.denominator;
  });
  return { key, label, kind: "gap", indicatorId, count: hits.length, objectIds: hits.map((l) => l.objectId), riskIds: [] };
}

function positiveNumeratorException(
  key: string,
  label: string,
  indicatorId: string,
  orgIds: Set<string>,
  ctx: IndicatorContext,
): ExceptionSlot {
  const def = indicatorById(indicatorId);
  if (!def) return { key, label, kind: "positive-numerator", indicatorId, count: null, emptyReason: "无计算依据", objectIds: [], riskIds: [] };
  if (!overviewIndicatorEnabled(def)) {
    return { key, label, kind: "positive-numerator", indicatorId, count: null, emptyReason: "指标未启用", objectIds: [], riskIds: [] };
  }
  const metric = computeIndicator(def, orgIds, ctx);
  if (metric.status === "no_business") {
    return { key, label, kind: "positive-numerator", indicatorId, count: null, emptyReason: "当前范围无业务", objectIds: [], riskIds: [] };
  }
  if (metric.status === "unknown") {
    return {
      key,
      label,
      kind: "positive-numerator",
      indicatorId,
      count: null,
      emptyReason: metric.emptyReason ?? "数据不足，未评估",
      objectIds: [],
      riskIds: [],
    };
  }
  const hits = metric.leaves.filter((l) => l.dataComplete && (l.numerator ?? 0) > 0);
  return {
    key,
    label,
    kind: "positive-numerator",
    indicatorId,
    count: hits.length,
    objectIds: hits.map((l) => l.objectId),
    riskIds: [],
  };
}

function engHighRiskException(orgIds: Set<string>, risks: RiskCase[]): ExceptionSlot {
  const list = risks.filter((r) => isOpen(r) && r.severity === "red" && r.domains.includes("ENG") && orgIds.has(r.owner_org_id));
  return {
    key: "eng-focus",
    label: "重点履约异常",
    kind: "eng-high-risk",
    count: list.length,
    objectIds: [],
    riskIds: list.map((r) => r.id),
  };
}

const DOMAIN_CARD_BUILDERS: Record<DomainId, (orgIds: Set<string>, ctx: IndicatorContext, risks: RiskCase[]) => DomainCardModel> = {
  FA: (orgIds, ctx) => ({
    domain: "FA",
    metrics: [
      metricSlot("FA-I06", "投资完成额", "numerator", orgIds, ctx),
      metricSlot("FA-I06", "投资计划执行率", "value", orgIds, ctx),
    ],
    exceptions: [
      indicatorCountException("fa-overbudget", "预计超概项目", "FA-CNT-OVERBUDGET", orgIds, ctx),
      positiveNumeratorException("fa-idle", "低效资产", "FA-I14", orgIds, ctx),
    ],
  }),
  EQ: (orgIds, ctx) => ({
    domain: "EQ",
    metrics: [
      metricSlot("EQ-BALANCE", "股权投资账面余额", "value", orgIds, ctx),
      metricSlot("EQ-CASH-DEVIATION", "现金回报目标偏差", "value", orgIds, ctx),
    ],
    exceptions: [
      gapException("eq-due", "到期出资", "EQ-X01-RATE", orgIds, ctx),
      gapException("eq-div", "分红异常", "EQ-X02-RATE", orgIds, ctx),
    ],
  }),
  INTL: (orgIds, ctx) => ({
    domain: "INTL",
    metrics: [
      metricSlot("INTL-CNT", "境外在管项目数", "value", orgIds, ctx),
      metricSlot("INTL-EXPOSURE", "未定价成本敞口", "value", orgIds, ctx),
    ],
    exceptions: [indicatorCountException("intl-affected", "外部事件涉及的项目", "INTL-AFFECTED", orgIds, ctx)],
  }),
  CASH: (orgIds, ctx) => ({
    domain: "CASH",
    metrics: [
      metricSlot("CASH-I02", "可用资金", "value", orgIds, ctx),
      metricSlot("CASH-I07", "受限资金占比", "value", orgIds, ctx),
    ],
    exceptions: [indicatorCountException("cash-pay", "异常支付事项", "CASH-I06", orgIds, ctx)],
  }),
  RIGHTS: (orgIds, ctx) => ({
    domain: "RIGHTS",
    metrics: [
      metricSlot("RIGHTS-ENTITIES", "纳入产权管理企业数", "value", orgIds, ctx),
      metricSlot("RIGHTS-MATTERS", "在办产权事项数", "value", orgIds, ctx),
    ],
    exceptions: [indicatorCountException("rights-diff", "权益信息待核实差异", "RIGHTS-DIFF", orgIds, ctx)],
  }),
  ENG: (orgIds, ctx, risks) => ({
    domain: "ENG",
    metrics: [
      metricSlot("ENG-REVENUE", "有效合同额", "value", orgIds, ctx),
      metricSlot("ENG-I01", "预计完工毛利率", "value", orgIds, ctx),
    ],
    exceptions: [engHighRiskException(orgIds, risks)],
  }),
};

export function overviewDomainCards(scope: OverviewScope, canDomain: (d: DomainId) => boolean): DomainCardModel[] {
  return OVERVIEW_DOMAIN_ORDER.filter(canDomain).map((domain) => {
    const card = DOMAIN_CARD_BUILDERS[domain](scope.orgIds, scope.ctx, scope.risks);
    const metricEmpty = card.metrics.every((m) => m.status !== "ok");
    const exceptionHits = card.exceptions.filter((e) => e.count && e.count > 0);
    if (metricEmpty && exceptionHits.length === 0) {
      const noBiz = card.metrics.some((m) => m.emptyReason === "当前范围无业务") && card.metrics.every((m) => m.status !== "ok");
      card.emptyKind = noBiz ? "no_business" : "unevaluated";
    } else if (exceptionHits.length === 0 && card.metrics.some((m) => m.status === "ok")) {
      card.emptyKind = "monitored_clear";
    }
    return card;
  });
}

export function relatedObjects(orgIds: Set<string>, allowedObjectIds: string[] | null) {
  const projects = inScopeProjects(orgIds, allowedObjectIds);
  const assets = inScopeAssets(orgIds, allowedObjectIds).map((a) => ({
    id: a.id,
    name: a.name,
    orgId: a.owner_org_id,
    kind: "asset" as const,
  }));
  return [...projects, ...assets];
}
