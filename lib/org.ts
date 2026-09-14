import { seed } from "./seed";
import type { Organization } from "./types";

export const ROOT_ORG_ID = "ORG-HQ";

export const orgById = (id: string | null | undefined): Organization | undefined =>
  id ? seed.organizations.find((o) => o.id === id) : undefined;

export const orgName = (id: string | null | undefined): string => orgById(id)?.name ?? "—";

export function childOrgs(id: string): Organization[] {
  return seed.organizations
    .filter((o) => o.parent_id === id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** 组织及其全部下级（含自身） */
export function descendantOrgIds(id: string): string[] {
  const out = [id];
  for (const c of childOrgs(id)) out.push(...descendantOrgIds(c.id));
  return out;
}

/**
 * 全局组织范围。includeChildren=false 表示“仅本级”。
 */
export function orgScope(orgId: string, includeChildren: boolean): Set<string> {
  return new Set(includeChildren ? descendantOrgIds(orgId) : [orgId]);
}

export function orgPath(id: string): Organization[] {
  const path: Organization[] = [];
  let cur = orgById(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? orgById(cur.parent_id) : undefined;
  }
  return path;
}

export const orgNodeTypeLabel: Record<string, string> = {
  headquarters: "总部",
  legal_unit: "二级单位",
  management_unit: "三级单位",
  branch: "分支机构",
};

export function orgLevelLabel(o: Organization): string {
  if (o.management_level === 1) return "总部";
  if (o.management_level === 2) return "二级单位";
  return orgNodeTypeLabel[o.node_type] ?? "三级单位";
}
