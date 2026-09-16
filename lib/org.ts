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
  legal_unit: "所属公司",
  management_unit: "业务单元",
  branch: "分支机构",
  department: "总部部门",
  project_department: "项目部",
};

/** 计入纳管单位数的组织类型：所属公司、分支机构、确需纳管的业务单元及范围内总部。 */
export const MANAGED_UNIT_NODE_TYPES = new Set(["headquarters", "legal_unit", "management_unit", "branch"]);

export function isManagedUnit(o: Organization): boolean {
  if (o.unit_category === "department" || o.unit_category === "project_department") return false;
  if (o.node_type === "department" || o.node_type === "project_department") return false;
  return MANAGED_UNIT_NODE_TYPES.has(o.node_type);
}

export function orgUnitTypeLabel(o: Organization): string {
  if (o.unit_category === "company" || o.node_type === "legal_unit") return "所属公司";
  if (o.unit_category === "branch" || o.node_type === "branch") return "分支机构";
  if (o.unit_category === "business_unit" || o.node_type === "management_unit") return "业务单元";
  if (o.node_type === "headquarters") return "总部";
  return orgNodeTypeLabel[o.node_type] ?? "单位";
}

export function orgLevelLabel(o: Organization): string {
  return orgUnitTypeLabel(o);
}
