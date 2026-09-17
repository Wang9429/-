import { objectTypeLabel, seed } from "./seed";
import type { ObjectType } from "./types";
import { FP_GOVERNANCE, FP_GUARANTEES, FP_LENDS, FP_LOANS, FP_SEGMENTS, FP_SME, FP_SPECIALS } from "./fp-seed";
import { FP_BANK_CONFIRMATIONS, FP_PERMITS, FP_SALARY_ADJS, FP_VOUCHERS } from "./fp-r32-seed";

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
    return { id, type: "contract", name: `${ct.kind}合同`, orgId: proj?.owner_org_id ?? "ORG-HQ", typeLabel: objectTypeLabel.contract };
  }

  const ob = seed.obligations.find((o) => o.id === id);
  if (ob) {
    const proj =
      seed.engineering_projects.find((p) => p.id === ob.project_id) ??
      seed.equity_projects.find((p) => p.id === ob.project_id) ??
      seed.fixed_asset_projects.find((p) => p.id === ob.project_id);
    return { id, type: "obligation", name: ob.kind, orgId: proj?.owner_org_id ?? "ORG-HQ", typeLabel: objectTypeLabel.obligation };
  }

  const extra = lookupFpObject(id);
  if (extra) return extra;

  return undefined;
}

export function allObjectIds(): string[] {
  const ids = new Set<string>();
  const add = (rows?: { id: string }[]) => {
    for (const row of rows ?? []) ids.add(row.id);
  };
  add(seed.fixed_asset_projects);
  add(seed.assets);
  add(seed.equity_projects);
  add(seed.engineering_projects);
  add(seed.accounts);
  add(seed.property_matters);
  add(seed.cash_transactions);
  add(seed.legal_entities);
  add(seed.contracts);
  add(seed.obligations);
  add(FP_LOANS);
  add(FP_GUARANTEES);
  add(FP_LENDS);
  add(FP_SPECIALS);
  add(FP_SME);
  add(FP_SEGMENTS);
  add(FP_GOVERNANCE);
  add(FP_BANK_CONFIRMATIONS);
  add(FP_VOUCHERS);
  add(FP_SALARY_ADJS);
  add(FP_PERMITS);
  return [...ids];
}

function lookupFpObject(id: string): ObjectRecord | undefined {
  const loan = FP_LOANS.find((x) => x.id === id);
  if (loan) return { id, type: "contract", name: loan.name, orgId: loan.owner_org_id, typeLabel: "借款合同" };
  const g = FP_GUARANTEES.find((x) => x.id === id);
  if (g) return { id, type: "contract", name: g.name, orgId: g.owner_org_id, typeLabel: g.kind === "performance_bond" ? "保函" : "担保" };
  const lend = FP_LENDS.find((x) => x.id === id);
  if (lend) return { id, type: "contract", name: lend.name, orgId: lend.owner_org_id, typeLabel: "出借合同" };
  const spec = FP_SPECIALS.find((x) => x.id === id);
  if (spec) return { id, type: "contract", name: spec.name, orgId: spec.owner_org_id, typeLabel: "专项资金" };
  const sme = FP_SME.find((x) => x.id === id);
  if (sme) return { id, type: "obligation", name: sme.name, orgId: sme.owner_org_id, typeLabel: objectTypeLabel.obligation };
  const seg = FP_SEGMENTS.find((x) => x.id === id);
  if (seg) return { id, type: "legal_entity", name: `${seg.name}（${seg.period_start}～${seg.period_end}）`, orgId: seg.org_id, typeLabel: "核心业务" };
  const gov = FP_GOVERNANCE.find((x) => x.id === id);
  if (gov) {
    const le = seed.legal_entities.find((e) => e.id === gov.legal_entity_id);
    return {
      id,
      type: "legal_entity",
      name: le?.name ?? "控股企业治理权利",
      orgId: gov.owner_org_id,
      typeLabel: objectTypeLabel.legal_entity,
    };
  }
  const bank = FP_BANK_CONFIRMATIONS.find((x) => x.id === id);
  if (bank) {
    const le = seed.legal_entities.find((e) => e.id === bank.legal_entity_id);
    return {
      id,
      type: "account",
      name: `${le?.name ?? "法人"}银行确认清单`,
      orgId: bank.owner_org_id,
      typeLabel: "银行确认清单",
    };
  }
  const vch = FP_VOUCHERS.find((x) => x.id === id);
  if (vch) return { id, type: "cash_transaction", name: `费用凭据 ${vch.voucher_no}`, orgId: vch.owner_org_id, typeLabel: "费用凭据" };
  const sal = FP_SALARY_ADJS.find((x) => x.id === id);
  if (sal) return { id, type: "cash_transaction", name: `薪酬标准调整 ${sal.scheme_id}`, orgId: sal.owner_org_id, typeLabel: "薪酬调整" };
  const perm = FP_PERMITS.find((x) => x.id === id);
  if (perm) return { id, type: "property_matter", name: `许可证件 ${perm.permit_no}`, orgId: perm.owner_org_id, typeLabel: "许可证件" };
  return undefined;
}

export const objectName = (id: string): string => findObject(id)?.name ?? id;

/** 对象所属管理组织；用于把对象清单按组织范围过滤 */
export const objectOrg = (id: string): string | undefined => findObject(id)?.orgId;
