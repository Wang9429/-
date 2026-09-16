/**
 * 综合总览计算依据（业需第 6 章 / 定位说明第 2 节）。
 * 页面数字必须走本模块，禁止把样本核对值写死到卡片。
 */

import { coverageRows, seed } from "./seed";
import { childOrgs, descendantOrgIds, isManagedUnit, orgById, orgUnitTypeLabel, ROOT_ORG_ID } from "./org";
import { computeIndicator, indicatorById, type IndicatorContext, type IndicatorDef, type NodeMetric } from "./metrics";
import { catalogIndicatorOnHomepage, catalogIndicatorVisible } from "./live-config";
import { isCoverageCandidate } from "./monitoring";
import { findObject } from "./objects";
import {
  isOpenRectificationAt,
  isOverdueRectification,
  isRectifiedClosedInPeriod,
  riskAtAsOf,
} from "./risks";
import type { DomainId, Organization, RiskCase, RuleEvaluation } from "./types";

export const OVERVIEW_DOMAIN_ORDER: DomainId[] = ["FA", "EQ", "INTL", "CASH", "RIGHTS", "ENG"];

export type OrgMonitorStatus = "no_business" | "pending" | "not_started" | "partial" | "complete";

export interface OverviewScope {
  orgIds: Set<string>;
  authorizedOrgIds: Set<string>;
  allowedObjectIds: string[] | null;
  risks: RiskCase[];
  asOf: string;
  periodStart: string;
  periodEnd: string;
  ctx: IndicatorContext;
}

function objectAllowedInScope(objectId: string, allowed: string[] | null): boolean {
  if (allowed === null) return true;
  return allowed.includes(objectId);
}

function overlapsPeriod(start: string | undefined, end: string | null | undefined, periodStart: string, periodEnd: string): boolean {
  const from = start ?? "1900-01-01";
  const to = end ?? "9999-12-31";
  return from <= periodEnd && to >= periodStart;
}

export function overviewIndicatorEnabled(def: IndicatorDef): boolean {
  const catalogId = def.catalogIndicatorId ?? def.id;
  return catalogIndicatorVisible(catalogId);
}

export function overviewIndicatorOnHomepage(def: IndicatorDef): boolean {
  const catalogId = def.catalogIndicatorId ?? def.id;
  return catalogIndicatorOnHomepage(catalogId);
}

export function managedOrganizations(orgIds: Set<string>): Organization[] {
  return seed.organizations
    .filter((o) => orgIds.has(o.id) && isManagedUnit(o))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function managedOrgCount(orgIds: Set<string>): number {
  return managedOrganizations(orgIds).length;
}

export function includesHeadquarters(orgIds: Set<string>): boolean {
  return orgIds.has(ROOT_ORG_ID) && isManagedUnit(orgById(ROOT_ORG_ID)!);
}

export type ProjectKind = "fixed_asset_project" | "equity_project" | "engineering_project";

export interface OverviewProjectRow {
  id: string;
  name: string;
  orgId: string;
  kind: ProjectKind;
  projectType: string;
  status: string;
  managedStart?: string;
  managedEnd?: string | null;
}

export function inScopeProjects(
  orgIds: Set<string>,
  allowedObjectIds: string[] | null,
  periodStart = "2026-01-01",
  periodEnd = "2026-06-30",
): OverviewProjectRow[] {
  const rows: OverviewProjectRow[] = [];
  const seen = new Set<string>();
  const push = (row: OverviewProjectRow, start?: string, end?: string | null) => {
    if (!orgIds.has(row.orgId) || !objectAllowedInScope(row.id, allowedObjectIds) || seen.has(row.id)) return;
    if (!overlapsPeriod(start, end, periodStart, periodEnd)) return;
    seen.add(row.id);
    rows.push(row);
  };
  for (const p of seed.fixed_asset_projects) {
    push(
      {
        id: p.id,
        name: p.name,
        orgId: p.owner_org_id,
        kind: "fixed_asset_project",
        projectType: p.project_type,
        status: p.status ?? p.phase,
        managedStart: p.managed_start,
        managedEnd: p.managed_end,
      },
      p.managed_start,
      p.managed_end,
    );
  }
  for (const p of seed.equity_projects) {
    push(
      {
        id: p.id,
        name: p.name,
        orgId: p.owner_org_id,
        kind: "equity_project",
        projectType: p.investment_type,
        status: p.status ?? p.phase,
        managedStart: p.managed_start,
        managedEnd: p.managed_end,
      },
      p.managed_start,
      p.managed_end,
    );
  }
  for (const p of seed.engineering_projects) {
    push(
      {
        id: p.id,
        name: p.name,
        orgId: p.owner_org_id,
        kind: "engineering_project",
        projectType: p.phase,
        status: p.status ?? p.phase,
        managedStart: p.managed_start,
        managedEnd: p.managed_end,
      },
      p.managed_start,
      p.managed_end,
    );
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

export function inScopeProjectCount(
  orgIds: Set<string>,
  allowedObjectIds: string[] | null,
  periodStart?: string,
  periodEnd?: string,
): number {
  return inScopeProjects(orgIds, allowedObjectIds, periodStart, periodEnd).length;
}

export function inScopeAssets(orgIds: Set<string>, allowedObjectIds: string[] | null) {
  return seed.assets.filter((a) => orgIds.has(a.owner_org_id) && objectAllowedInScope(a.id, allowedObjectIds));
}

function evalInWindow(e: RuleEvaluation, scope: Pick<OverviewScope, "periodStart" | "periodEnd" | "asOf">): boolean {
  if (e.window_end < scope.periodStart || e.window_end > scope.periodEnd) return false;
  if (e.evaluated_at > scope.asOf) return false;
  return true;
}

function ownerOfObject(objectId: string): string | undefined {
  const fromCoverage = coverageRows.find(
    (row) => row.monitoring_object_id === objectId || row.subject_object_id === objectId,
  );
  if (fromCoverage?.owner_org_id) return fromCoverage.owner_org_id;
  const fromRisk = seed.risk_cases.find((r) => r.primary_object_id === objectId);
  if (fromRisk?.owner_org_id) return fromRisk.owner_org_id;
  const obj = findObject(objectId);
  if (!obj) return undefined;
  if (obj.type === "legal_entity" && obj.orgId === ROOT_ORG_ID) {
    const org = seed.organizations.find((o) => o.legal_entity_id === objectId);
    return org?.id;
  }
  return obj.orgId;
}

export interface HitRecord {
  ruleId: string;
  objectId: string;
  objectType: string;
  orgId: string;
  domain: DomainId | null;
  evaluationId?: string;
  coverageId?: string;
}

function domainFromRule(ruleId: string): DomainId | null {
  if (ruleId.startsWith("FA-")) return "FA";
  if (ruleId.startsWith("EQ-")) return "EQ";
  if (ruleId.startsWith("ENG-")) return "ENG";
  if (ruleId.startsWith("CASH-")) return "CASH";
  if (ruleId.startsWith("INT")) return "INTL";
  if (ruleId.startsWith("PTY-") || ruleId.startsWith("RIGHTS-")) return "RIGHTS";
  if (ruleId.startsWith("MANUAL")) return null;
  return null;
}

/** 所选期间内、截至日之前的有效规则命中；已排除误报不计入。按规则+对象去重，不按运行次数累加。 */
export function validHitRecords(scope: OverviewScope, domain?: DomainId): HitRecord[] {
  const key = (ruleId: string, objectId: string) => `${ruleId}::${objectId}`;
  const excluded = new Set<string>();
  const map = new Map<string, HitRecord>();

  for (const e of seed.rule_evaluations) {
    if (!evalInWindow(e, scope)) continue;
    const orgId = ownerOfObject(e.subject_object_id);
    if (!orgId || !scope.orgIds.has(orgId)) continue;
    if (!objectAllowedInScope(e.subject_object_id, scope.allowedObjectIds)) continue;
    const d = domainFromRule(e.rule_id);
    if (domain && d && d !== domain) continue;
    if (domain && !d && domain !== "ENG") continue;
    const k = key(e.rule_id, e.subject_object_id);
    if (e.effective_result === "excluded") {
      excluded.add(k);
      map.delete(k);
      continue;
    }
    if (e.effective_result !== "hit") continue;
    if (excluded.has(k)) continue;
    map.set(k, {
      ruleId: e.rule_id,
      objectId: e.subject_object_id,
      objectType: findObject(e.subject_object_id)?.type ?? "object",
      orgId,
      domain: d,
      evaluationId: e.id,
    });
  }

  for (const row of coverageRows) {
    if (isCoverageCandidate(row)) continue;
    if (row.status !== "evaluated_hit") continue;
    if (row.window_end < scope.periodStart || row.window_end > scope.periodEnd) continue;
    if (row.snapshot_date > scope.asOf) continue;
    if (!scope.orgIds.has(row.owner_org_id)) continue;
    if (!objectAllowedInScope(row.monitoring_object_id, scope.allowedObjectIds)) continue;
    if (domain && row.domain !== domain) continue;
    for (const ruleId of row.rule_ids ?? []) {
      const k = key(ruleId, row.monitoring_object_id);
      if (excluded.has(k) || map.has(k)) continue;
      map.set(k, {
        ruleId,
        objectId: row.monitoring_object_id,
        objectType: row.object_type,
        orgId: row.owner_org_id,
        domain: row.domain,
        coverageId: row.id,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.objectId.localeCompare(b.objectId));
}

export function hitRuleIds(scope: OverviewScope, domain?: DomainId): string[] {
  return [...new Set(validHitRecords(scope, domain).map((h) => h.ruleId))].sort();
}

/** 规则命中涉及单位：按命中对象的实际归属单位去重，不把上级汇总节点重复计入。 */
export function hitOwnerOrgIds(scope: OverviewScope): string[] {
  return [...new Set(validHitRecords(scope).map((h) => h.orgId))].sort();
}

export function scopedRisksAtAsOf(scope: OverviewScope): RiskCase[] {
  const out: RiskCase[] = [];
  for (const r of scope.risks) {
    const snap = riskAtAsOf(r, scope.asOf);
    if (!snap) continue;
    if (!scope.orgIds.has(snap.owner_org_id)) continue;
    if (!objectAllowedInScope(snap.primary_object_id, scope.allowedObjectIds)) continue;
    out.push(snap);
  }
  return out;
}

export function openRectificationCases(scope: OverviewScope, domain?: DomainId): RiskCase[] {
  return scopedRisksAtAsOf(scope).filter((r) => {
    if (!isOpenRectificationAt(r, scope.asOf)) return false;
    if (domain && !r.domains.includes(domain)) return false;
    return true;
  });
}

export function completedRectificationCases(scope: OverviewScope, domain?: DomainId): RiskCase[] {
  return scopedRisksAtAsOf(scope).filter((r) => {
    if (!isRectifiedClosedInPeriod(r, scope.periodStart, scope.periodEnd, scope.asOf)) return false;
    if (domain && !r.domains.includes(domain)) return false;
    return true;
  });
}

export function overdueRectificationCases(scope: OverviewScope, domain?: DomainId): RiskCase[] {
  return openRectificationCases(scope, domain).filter((r) => isOverdueRectification(r, scope.asOf));
}

function hasBusinessObjects(orgIds: Set<string>, allowedObjectIds: string[] | null, periodStart: string, periodEnd: string): boolean {
  if (inScopeProjects(orgIds, allowedObjectIds, periodStart, periodEnd).length > 0) return true;
  if (inScopeAssets(orgIds, allowedObjectIds).length > 0) return true;
  if (seed.accounts.some((a) => orgIds.has(a.owner_org_id) && objectAllowedInScope(a.id, allowedObjectIds))) return true;
  if (seed.property_matters.some((m) => orgIds.has(m.owner_org_id) && objectAllowedInScope(m.id, allowedObjectIds)))
    return true;
  return false;
}

export function orgMonitorStatus(orgIds: Set<string>, scope: OverviewScope): OrgMonitorStatus {
  if (!hasBusinessObjects(orgIds, scope.allowedObjectIds, scope.periodStart, scope.periodEnd)) return "no_business";
  const rows = coverageRows.filter((row) => {
    if (!orgIds.has(row.owner_org_id)) return false;
    if (row.window_end < scope.periodStart || row.window_end > scope.periodEnd) return false;
    if (row.snapshot_date > scope.asOf) return false;
    if (!objectAllowedInScope(row.monitoring_object_id, scope.allowedObjectIds)) return false;
    return true;
  });
  const candidates = rows.filter(isCoverageCandidate);
  const actual = rows.filter((r) => !isCoverageCandidate(r));
  const evaluated = actual.filter((r) => r.status === "evaluated_hit" || r.status === "evaluated_clear");
  const required = actual.filter(
    (r) => r.required && r.status !== "not_applicable" && r.status !== "reference_only",
  );
  const evals = seed.rule_evaluations.filter((e) => {
    if (!evalInWindow(e, scope)) return false;
    const orgId = ownerOfObject(e.subject_object_id);
    return Boolean(orgId && orgIds.has(orgId) && objectAllowedInScope(e.subject_object_id, scope.allowedObjectIds));
  });
  if (evaluated.length === 0 && evals.length === 0) {
    if (candidates.length > 0) return "pending";
    return "not_started";
  }
  if (required.length > 0 && evaluated.length < required.length) return "partial";
  const projectIds = inScopeProjects(orgIds, scope.allowedObjectIds, scope.periodStart, scope.periodEnd).map((p) => p.id);
  const monitoredObjects = new Set([
    ...evaluated.map((r) => r.monitoring_object_id),
    ...evals.map((e) => e.subject_object_id),
  ]);
  const uncovered = projectIds.filter((id) => !monitoredObjects.has(id));
  if (uncovered.length > 0 && monitoredObjects.size > 0) return "partial";
  return "complete";
}

export const monitorStatusLabel: Record<OrgMonitorStatus, string> = {
  no_business: "无业务",
  pending: "待确认",
  not_started: "未开展监测",
  partial: "部分完成",
  complete: "已完成",
};

export interface OrgNodeStats {
  orgId: string;
  name: string;
  unitType: string;
  projectCount: number;
  hitRuleCount: number;
  hitRuleDisplay: string;
  openRectificationCount: number;
  overdueRectificationCount: number;
  monitorStatus: OrgMonitorStatus;
  monitorLabel: string;
  hasChildren: boolean;
}

function statsForOrgSet(orgId: string, orgIds: Set<string>, scope: OverviewScope): OrgNodeStats {
  const org = orgById(orgId);
  const nodeScope: OverviewScope = { ...scope, orgIds };
  const monitorStatus = orgMonitorStatus(orgIds, scope);
  const hitRuleCount = hitRuleIds(nodeScope).length;
  const showHitNumber = monitorStatus === "complete" || monitorStatus === "partial" || hitRuleCount > 0;
  return {
    orgId,
    name: org?.name ?? orgId,
    unitType: org ? orgUnitTypeLabel(org) : "单位",
    projectCount: inScopeProjectCount(orgIds, scope.allowedObjectIds, scope.periodStart, scope.periodEnd),
    hitRuleCount,
    hitRuleDisplay: showHitNumber ? String(hitRuleCount) : "—",
    openRectificationCount: openRectificationCases(nodeScope).length,
    overdueRectificationCount: overdueRectificationCases(nodeScope).length,
    monitorStatus,
    monitorLabel: monitorStatusLabel[monitorStatus],
    hasChildren: visibleChildOrgs(orgId, scope.authorizedOrgIds).length > 0,
  };
}

export function orgNodeStats(orgId: string, scope: OverviewScope): OrgNodeStats {
  const nodeOrgs = new Set(descendantOrgIds(orgId).filter((id) => scope.authorizedOrgIds.has(id)));
  return statsForOrgSet(orgId, nodeOrgs, scope);
}

export function orgStatsInOrgSet(orgId: string, orgIds: Set<string>, scope: OverviewScope): OrgNodeStats {
  return statsForOrgSet(orgId, orgIds, scope);
}

export function authorizedDescendantOrgIds(orgId: string, authorizedOrgIds: Set<string>): Set<string> {
  return new Set(descendantOrgIds(orgId).filter((id) => authorizedOrgIds.has(id)));
}

export function panoramaRootId(authorizedOrgIds: Set<string>): string {
  if (authorizedOrgIds.has(ROOT_ORG_ID)) return ROOT_ORG_ID;
  const roots = seed.organizations.filter((o) => authorizedOrgIds.has(o.id) && (!o.parent_id || !authorizedOrgIds.has(o.parent_id)));
  return roots[0]?.id ?? ROOT_ORG_ID;
}

export function visibleChildOrgs(parentId: string, authorizedOrgIds: Set<string>): Organization[] {
  return childOrgs(parentId).filter((o) => {
    if (!isManagedUnit(o)) return false;
    if (authorizedOrgIds.has(o.id)) return true;
    return descendantOrgIds(o.id).some((id) => authorizedOrgIds.has(id) && isManagedUnit(orgById(id)!));
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

export interface DomainCardModel {
  domain: DomainId;
  metrics: MetricSlot[];
  hitRuleCount: number;
  hitRecords: HitRecord[];
  openRectificationCount: number;
  openRectificationIds: string[];
  overdueRectificationCount: number;
  overdueRectificationIds: string[];
}

function metricSlot(
  indicatorId: string,
  label: string,
  display: "value" | "numerator",
  orgIds: Set<string>,
  ctx: IndicatorContext,
): MetricSlot {
  const def = indicatorById(indicatorId);
  if (!def) return { indicatorId, label, display, status: "missing", emptyReason: "无计算依据" };
  if (!overviewIndicatorEnabled(def) || !overviewIndicatorOnHomepage(def)) {
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

function eqHomepageSlots(orgIds: Set<string>, ctx: IndicatorContext): MetricSlot[] {
  const slots = [metricSlot("EQ-BALANCE", "股权投资账面金额", "value", orgIds, ctx)];
  const secondCandidates: [string, string][] = [
    ["EQ-I15", "期间会计投资收益率"],
    ["EQ-X01-RATE", "到期出资履约率"],
    ["EQ-X02-RATE", "已到期分红回收率"],
  ];
  for (const [id, label] of secondCandidates) {
    const slot = metricSlot(id, label, "value", orgIds, ctx);
    if (slot.status !== "disabled" && slot.status !== "missing") {
      slots.push(slot);
      break;
    }
  }
  return slots.filter((s) => s.status !== "disabled" && s.status !== "missing");
}

const DOMAIN_METRIC_BUILDERS: Record<DomainId, (orgIds: Set<string>, ctx: IndicatorContext) => MetricSlot[]> = {
  FA: (orgIds, ctx) =>
    [
      metricSlot("FA-I06", "投资完成额", "numerator", orgIds, ctx),
      metricSlot("FA-I06", "投资计划执行率", "value", orgIds, ctx),
    ].filter((s) => s.status !== "disabled" && s.status !== "missing"),
  EQ: eqHomepageSlots,
  INTL: (orgIds, ctx) =>
    [
      metricSlot("INTL-CNT", "境外项目数", "value", orgIds, ctx),
      metricSlot("INTL-EXPOSURE", "未定价成本敞口", "value", orgIds, ctx),
    ].filter((s) => s.status !== "disabled" && s.status !== "missing"),
  CASH: (orgIds, ctx) =>
    [
      metricSlot("CASH-I02", "可用资金", "value", orgIds, ctx),
      metricSlot("CASH-I07", "受限资金占比", "value", orgIds, ctx),
    ].filter((s) => s.status !== "disabled" && s.status !== "missing"),
  RIGHTS: (orgIds, ctx) =>
    [
      metricSlot("RIGHTS-ENTITIES", "纳入产权管理企业数", "value", orgIds, ctx),
      metricSlot("RIGHTS-MATTERS", "在办产权事项数", "value", orgIds, ctx),
    ].filter((s) => s.status !== "disabled" && s.status !== "missing"),
  ENG: (orgIds, ctx) =>
    [
      metricSlot("ENG-REVENUE", "有效合同额", "value", orgIds, ctx),
      metricSlot("ENG-I01", "预计完工毛利率", "value", orgIds, ctx),
    ].filter((s) => s.status !== "disabled" && s.status !== "missing"),
};

export function overviewDomainCards(scope: OverviewScope, canDomain: (d: DomainId) => boolean): DomainCardModel[] {
  return OVERVIEW_DOMAIN_ORDER.filter(canDomain).map((domain) => {
    const hits = validHitRecords(scope, domain);
    const open = openRectificationCases(scope, domain);
    const overdue = overdueRectificationCases(scope, domain);
    return {
      domain,
      metrics: DOMAIN_METRIC_BUILDERS[domain](scope.orgIds, scope.ctx),
      hitRuleCount: [...new Set(hits.map((h) => h.ruleId))].length,
      hitRecords: hits,
      openRectificationCount: open.length,
      openRectificationIds: open.map((r) => r.id),
      overdueRectificationCount: overdue.length,
      overdueRectificationIds: overdue.map((r) => r.id),
    };
  });
}

export function relatedObjects(orgIds: Set<string>, allowedObjectIds: string[] | null, periodStart?: string, periodEnd?: string) {
  const projects = inScopeProjects(orgIds, allowedObjectIds, periodStart, periodEnd);
  const assets = inScopeAssets(orgIds, allowedObjectIds).map((a) => ({
    id: a.id,
    name: a.name,
    orgId: a.owner_org_id,
    kind: "asset" as const,
    projectType: a.asset_type,
    status: a.status,
  }));
  return [...projects, ...assets];
}

export function hitObjectsByType(hits: HitRecord[]): { type: string; objects: HitRecord[] }[] {
  const map = new Map<string, HitRecord[]>();
  for (const h of hits) {
    const list = map.get(h.objectType) ?? [];
    if (!list.some((x) => x.objectId === h.objectId)) list.push(h);
    map.set(h.objectType, list);
  }
  return [...map.entries()].map(([type, objects]) => ({ type, objects }));
}

/** @deprecated 旧口径，仅供对照脚本识别已替换。 */
export function openHighRiskCases(risks: RiskCase[], orgIds: Set<string>): RiskCase[] {
  return risks.filter((r) => ["pending_review", "investigating", "rectifying", "pending_verification"].includes(r.status) && r.severity === "red" && orgIds.has(r.owner_org_id));
}

export function overdueHighRiskCases(risks: RiskCase[], orgIds: Set<string>, asOf: string): RiskCase[] {
  return openHighRiskCases(risks, orgIds).filter((r) => isOverdueRectification(r, asOf));
}

export function highRiskOwnerOrgIds(risks: RiskCase[], orgIds: Set<string>): string[] {
  const ids = new Set<string>();
  for (const r of openHighRiskCases(risks, orgIds)) ids.add(r.owner_org_id);
  return [...ids].sort();
}
