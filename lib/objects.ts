import { objectTypeLabel, seed } from "./seed";
import type { ObjectType } from "./types";

/**
 * 对象查找的唯一入口。同一对象在任何页面只有一个档案，
 * 不因切换 Tab 或领域重建（完整业需 3.5 / 4.2.1）。
 */

export interface ObjectRecord {
  id: string;
  type: ObjectType;
  name: string;
  orgId: string;
  typeLabel: string;
}

export function findObject(id: string): ObjectRecord | undefined {
  const fa = seed.fixed_asset_projects.find((p) => p.id === id);
  if (fa) return { id, type: "fixed_asset_project", name: fa.name, orgId: fa.owner_org_id, typeLabel: objectTypeLabel.fixed_asset_project };

  const asset = seed.assets.find((a) => a.id === id);
  if (asset) return { id, type: "asset", name: asset.name, orgId: asset.owner_org_id, typeLabel: objectTypeLabel.asset };

  const eq = seed.equity_projects.find((p) => p.id === id);
  if (eq) return { id, type: "equity_project", name: eq.name, orgId: eq.owner_org_id, typeLabel: objectTypeLabel.equity_project };

  const eng = seed.engineering_projects.find((p) => p.id === id);
  if (eng) return { id, type: "engineering_project", name: eng.name, orgId: eng.owner_org_id, typeLabel: objectTypeLabel.engineering_project };

  const acc = seed.accounts.find((a) => a.id === id);
  if (acc) return { id, type: "account", name: acc.name, orgId: acc.owner_org_id, typeLabel: objectTypeLabel.account };

  const pm = seed.property_matters.find((m) => m.id === id);
  if (pm) return { id, type: "property_matter", name: pm.name, orgId: pm.owner_org_id, typeLabel: objectTypeLabel.property_matter };

  const tx = seed.cash_transactions.find((t) => t.id === id);
  if (tx) {
    const account = seed.accounts.find((a) => a.id === tx.account_id);
    return {
      id,
      type: "cash_transaction",
      name: `${tx.direction === "outflow" ? "支出" : "收入"} ${tx.amount_wan_cny} 万元（${tx.date}）`,
      orgId: account?.owner_org_id ?? "ORG-HQ",
      typeLabel: objectTypeLabel.cash_transaction,
    };
  }

  const le = seed.legal_entities.find((e) => e.id === id);
  if (le) {
    const org = seed.organizations.find((o) => o.legal_entity_id === id);
    return { id, type: "legal_entity", name: le.name, orgId: org?.id ?? "ORG-HQ", typeLabel: objectTypeLabel.legal_entity };
  }

  const ct = seed.contracts.find((c) => c.id === id);
  if (ct) {
    const proj = seed.engineering_projects.find((p) => p.id === ct.project_id);
    return { id, type: "contract", name: `${ct.kind}合同 ${ct.id}`, orgId: proj?.owner_org_id ?? "ORG-HQ", typeLabel: objectTypeLabel.contract };
  }

  const ob = seed.obligations.find((o) => o.id === id);
  if (ob) {
    const proj =
      seed.engineering_projects.find((p) => p.id === ob.project_id) ??
      seed.equity_projects.find((p) => p.id === ob.project_id);
    return { id, type: "obligation", name: `${ob.kind} ${ob.id}`, orgId: proj?.owner_org_id ?? "ORG-HQ", typeLabel: objectTypeLabel.obligation };
  }

  return undefined;
}

export const objectName = (id: string): string => findObject(id)?.name ?? id;

/** 对象所属管理组织；用于把对象清单按组织范围过滤 */
export const objectOrg = (id: string): string | undefined => findObject(id)?.orgId;
