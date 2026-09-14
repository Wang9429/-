import { coverageRows, seed } from "./seed";
import {
  isOpen,
  isOverdueRectification,
  isRectifiedClosedInPeriod,
  riskMatches,
} from "./risks";
import type { DomainId, MonitoringRow, RiskCase } from "./types";

export interface ScopeFilter {
  domain: DomainId;
  orgScope: Set<string>;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  phaseId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  scenarioId?: string | null;
}

/**
 * 观察归属：按业务窗口结束日 window_end 落入所选期间（含端点），
 * 且评估取得时间不晚于截至日；季度/滚动窗口不按重叠月份分摊（完整业需 5.3）。
 */
export function rowInScope(row: MonitoringRow, f: ScopeFilter): boolean {
  if (row.domain !== f.domain) return false;
  if (!f.orgScope.has(row.owner_org_id)) return false;
  if (row.window_end < f.periodStart || row.window_end > f.periodEnd) return false;
  if (row.snapshot_date > f.asOf) return false;
  if (f.phaseId && row.phase_id !== f.phaseId) return false;
  if (f.topicId && row.topic_id !== f.topicId) return false;
  if (f.subtopicId !== undefined && f.subtopicId !== null && row.subtopic_id !== f.subtopicId)
    return false;
  if (f.scenarioId && row.scenario_id !== f.scenarioId) return false;
  return true;
}

export function selectRows(f: ScopeFilter): MonitoringRow[] {
  return coverageRows.filter((r) => rowInScope(r, f));
}

const objKey = (r: MonitoringRow) => `${r.object_type}::${r.monitoring_object_id}`;

export interface ObjectRef {
  objectType: string;
  objectId: string;
}

export interface FiveCounts {
  /** 已实际评估至少一条适用规则或已完成人工核查的唯一对象 */
  monitoredObjects: ObjectRef[];
  /** 应评估（required 且非不适用/仅参考）的唯一对象 */
  requiredObjects: ObjectRef[];
  /** 当前观察期有效命中或人工明确线索的唯一对象 */
  hitObjects: ObjectRef[];
  /** 截至日仍未关闭且未排除的唯一 risk_id */
  openRiskIds: string[];
  /** 所选期间复核通过关闭、截至日仍 closed 且 close_reason=rectified */
  rectifiedClosedRiskIds: string[];
  /** 已进入整改责任范围、截至日仍未关闭且超过有效整改期限 */
  overdueRiskIds: string[];
  /** 数据不足/未到时点/不适用/参考的行数，用于覆盖说明 */
  gapCounts: Record<string, number>;
  /** 部分覆盖：已监测 < 应监测 */
  partialCoverage: boolean;
  rows: MonitoringRow[];
  objectTypeBreakdown: Record<string, { monitored: number; required: number; hit: number }>;
}

function dedupe(rows: MonitoringRow[]): ObjectRef[] {
  const map = new Map<string, ObjectRef>();
  for (const r of rows) {
    map.set(objKey(r), { objectType: r.object_type, objectId: r.monitoring_object_id });
  }
  return [...map.values()];
}

/**
 * 五数计算。对象数按 object_type+object_id 去重，事项数按 risk_id 去重，
 * 两者不混用（完整业需 5.3 / AGENTS.md）。
 */
export function computeFiveCounts(f: ScopeFilter, risks: RiskCase[]): FiveCounts {
  const rows = selectRows(f);

  const monitoredRows = rows.filter(
    (r) => r.status === "evaluated_hit" || r.status === "evaluated_clear",
  );
  const requiredRows = rows.filter(
    (r) => r.required && r.status !== "not_applicable" && r.status !== "reference_only",
  );
  const hitRows = rows.filter((r) => r.status === "evaluated_hit");

  const monitoredObjects = dedupe(monitoredRows);
  const requiredObjects = dedupe(requiredRows);
  const hitObjects = dedupe(hitRows);

  const gapCounts: Record<string, number> = {};
  for (const r of rows) gapCounts[r.status] = (gapCounts[r.status] ?? 0) + 1;

  // 事项：既取所选监测行上的 risk_ids，也取 risk_context_links 的实际关联，
  // 保证历史遗留事项（本期无评估）仍然可见（完整业需 5.3 “历史遗留”）。
  const riskIdsFromRows = new Set<string>();
  for (const r of rows) r.risk_ids.forEach((id) => riskIdsFromRows.add(id));

  const linkFilter = {
    domain: f.domain,
    orgScope: f.orgScope,
    phaseId: f.phaseId ?? null,
    topicId: f.topicId ?? null,
    subtopicId: f.subtopicId ?? null,
  };

  const candidates = new Set<string>(riskIdsFromRows);
  for (const r of risks) {
    if (f.scenarioId && !r.scenario_ids.includes(f.scenarioId)) continue;
    if (riskMatches(r, linkFilter)) candidates.add(r.id);
  }

  const byId = new Map(risks.map((r) => [r.id, r]));
  const openRiskIds: string[] = [];
  const rectifiedClosedRiskIds: string[] = [];
  const overdueRiskIds: string[] = [];

  for (const id of candidates) {
    const r = byId.get(id);
    if (!r) continue;
    if (!f.orgScope.has(r.owner_org_id)) continue;
    if (f.scenarioId && !r.scenario_ids.includes(f.scenarioId)) continue;
    if (isOpen(r)) {
      openRiskIds.push(id);
      if (isOverdueRectification(r, f.asOf)) overdueRiskIds.push(id);
    }
    if (isRectifiedClosedInPeriod(r, f.periodStart, f.periodEnd, f.asOf)) {
      rectifiedClosedRiskIds.push(id);
    }
  }

  const objectTypeBreakdown: Record<string, { monitored: number; required: number; hit: number }> = {};
  const bump = (t: string, key: "monitored" | "required" | "hit") => {
    objectTypeBreakdown[t] ??= { monitored: 0, required: 0, hit: 0 };
    objectTypeBreakdown[t][key] += 1;
  };
  monitoredObjects.forEach((o) => bump(o.objectType, "monitored"));
  requiredObjects.forEach((o) => bump(o.objectType, "required"));
  hitObjects.forEach((o) => bump(o.objectType, "hit"));

  return {
    monitoredObjects,
    requiredObjects,
    hitObjects,
    openRiskIds: openRiskIds.sort(),
    rectifiedClosedRiskIds: rectifiedClosedRiskIds.sort(),
    overdueRiskIds: overdueRiskIds.sort(),
    gapCounts,
    partialCoverage: monitoredObjects.length < requiredObjects.length,
    rows,
    objectTypeBreakdown,
  };
}

/** 阶段箭头上的未关闭事项数：按该阶段实际关联的 risk_id 去重。 */
export function openCountForPhase(
  domain: DomainId,
  phaseId: string,
  orgScope: Set<string>,
  risks: RiskCase[],
  asOf: string,
): { open: number; maxSeverity: "red" | "yellow" | null; riskIds: string[] } {
  void asOf;
  const ids: string[] = [];
  let maxSeverity: "red" | "yellow" | null = null;
  for (const r of risks) {
    if (!isOpen(r)) continue;
    if (!riskMatches(r, { domain, orgScope, phaseId })) continue;
    ids.push(r.id);
    if (r.severity === "red") maxSeverity = "red";
    else if (maxSeverity !== "red") maxSeverity = "yellow";
  }
  return { open: ids.length, maxSeverity, riskIds: ids.sort() };
}

export function openCountForTopic(
  domain: DomainId,
  topicId: string,
  orgScope: Set<string>,
  risks: RiskCase[],
): { open: number; maxSeverity: "red" | "yellow" | null; riskIds: string[] } {
  const ids: string[] = [];
  let maxSeverity: "red" | "yellow" | null = null;
  for (const r of risks) {
    if (!isOpen(r)) continue;
    if (!riskMatches(r, { domain, orgScope, topicId })) continue;
    ids.push(r.id);
    if (r.severity === "red") maxSeverity = "red";
    else if (maxSeverity !== "red") maxSeverity = "yellow";
  }
  return { open: ids.length, maxSeverity, riskIds: ids.sort() };
}

/** 领域未关闭事项数（不按阶段/专题细分）。 */
export function openCountForDomain(
  domain: DomainId,
  orgScope: Set<string>,
  risks: RiskCase[],
): { open: number; red: number; yellow: number; riskIds: string[] } {
  const ids: string[] = [];
  let red = 0;
  let yellow = 0;
  for (const r of risks) {
    if (!isOpen(r)) continue;
    if (!riskMatches(r, { domain, orgScope })) continue;
    ids.push(r.id);
    if (r.severity === "red") red += 1;
    else yellow += 1;
  }
  return { open: ids.length, red, yellow, riskIds: ids.sort() };
}

/** 领域内本期出现过监测行的场景清单（含仅有覆盖候选的场景）。 */
export function scenariosInScope(f: ScopeFilter): string[] {
  const rows = selectRows({ ...f, scenarioId: null });
  const set = new Set<string>();
  rows.forEach((r) => set.add(r.scenario_id));
  return [...set].sort();
}

/** 领域内所有已配置场景（含无实例场景，用于显示模板与空态）。 */
export function configuredScenarios(domain: DomainId, phaseId?: string | null): string[] {
  const set = new Set<string>();
  for (const row of coverageRows) {
    if (row.domain !== domain) continue;
    if (phaseId && row.phase_id !== phaseId) continue;
    set.add(row.scenario_id);
  }
  if (!phaseId) {
    for (const s of seed.supplemental_scenarios) {
      if (s.domain === domain) set.add(s.id);
    }
  }
  return [...set].sort();
}
