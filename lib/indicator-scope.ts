/**
 * 指标穿透抽屉的范围与节点判定（业需第 4.2 / 6.4 节）。
 * 取数必须是授权范围 ∩ 当前组织筛选，禁止按名称猜测指标。
 */

import { catalogIndicatorOnDomainPage, catalogIndicatorOnHomepage, catalogIndicatorVisible } from "./live-config";
import { childOrgs, descendantOrgIds, orgPath } from "./org";
import { INDICATORS, type IndicatorDef, type LeafMetric, type MetricStatus } from "./metrics";
import type { DomainId, Organization } from "./types";

export type DrawerSelection = { kind: "org"; id: string } | { kind: "leaf"; id: string };

/** 已启用、该入口配置为首页展示、且具备计算器的运行指标。按指标 ID 与领域标识过滤。 */
export function isRunnableDrawerIndicator(def: IndicatorDef, entry: "homepage" | "domain_page" = "homepage"): boolean {
  const catalogId = def.catalogIndicatorId ?? def.id;
  if (typeof def.leaves !== "function") return false;
  if (!catalogIndicatorVisible(catalogId)) return false;
  return entry === "domain_page" ? catalogIndicatorOnDomainPage(catalogId) : catalogIndicatorOnHomepage(catalogId);
}

export function runnableDrawerIndicators(domain: DomainId, entry: "homepage" | "domain_page" = "homepage"): IndicatorDef[] {
  return INDICATORS.filter((d) => d.domain === domain && isRunnableDrawerIndicator(d, entry));
}

export function switchableDrawerIndicators(
  domain: DomainId,
  options: IndicatorDef[],
  entry: "homepage" | "domain_page" = "homepage",
): IndicatorDef[] {
  const allowed = new Set(runnableDrawerIndicators(domain, entry).map((d) => d.id));
  return options.filter((d) => d.domain === domain && allowed.has(d.id) && isRunnableDrawerIndicator(d, entry));
}

export function isIndicatorAbnormalStatus(status: MetricStatus): boolean {
  return status === "risk" || status === "attention";
}

export function metricRollupOrgIds(
  orgId: string,
  initialOrgId: string,
  includeChildren: boolean,
  dataOrgIds: Set<string>,
): Set<string> {
  if (!dataOrgIds.has(orgId)) return new Set();
  if (orgId === initialOrgId && !includeChildren) {
    return new Set([orgId]);
  }
  return new Set(descendantOrgIds(orgId).filter((id) => dataOrgIds.has(id)));
}

export function resolveDrawerSelection(
  selection: DrawerSelection,
  initialOrgId: string,
  dataOrgIds: Set<string>,
  applicableLeafIds: Set<string>,
): DrawerSelection {
  if (selection.kind === "leaf") {
    if (applicableLeafIds.has(selection.id)) return selection;
    return { kind: "org", id: initialOrgId };
  }
  if (dataOrgIds.has(selection.id)) return selection;
  return { kind: "org", id: initialOrgId };
}

export function scopedIndicatorLeaves(leaves: LeafMetric[], dataOrgIds: Set<string>): LeafMetric[] {
  return leaves.filter((l) => dataOrgIds.has(l.orgId));
}

export function drawerChildOrgs(
  orgId: string,
  initialOrgId: string,
  includeChildren: boolean,
  dataOrgIds: Set<string>,
): Organization[] {
  if (!includeChildren && orgId === initialOrgId) return [];
  return childOrgs(orgId).filter((c) => descendantOrgIds(c.id).some((id) => dataOrgIds.has(id)));
}

/** 祖先仅用于路径展示，不进入可取数节点。 */
export function drawerAncestorPath(initialOrgId: string): Organization[] {
  const path = orgPath(initialOrgId);
  return path.slice(0, -1);
}

export function relatedMatterIds(leaves: LeafMetric[]): string[] {
  return [...new Set(leaves.flatMap((l) => l.riskIds))];
}
