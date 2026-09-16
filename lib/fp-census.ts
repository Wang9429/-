import { descendantOrgIds, orgById } from "./org";
import { seed } from "./seed";
import { FP_CONTROLS, FP_SNAPSHOTS } from "./fp-seed";
import type { LegalEntity } from "./types";

export type CensusClass = "body" | "controlled" | "participating" | "unverified";

export interface CensusEntity {
  entity: LegalEntity;
  ownerOrgId: string;
  class: CensusClass;
  whollyOwned: boolean;
  controlBasis: string;
  listed?: boolean;
  directEdges: { investorId: string; pct: number; source: string; effective: string }[];
}

function inOrgScope(ownerOrgId: string, orgIds: Set<string>): boolean {
  if (orgIds.has(ownerOrgId)) return true;
  return descendantOrgIds(ownerOrgId).some((id) => orgIds.has(id)) || [...orgIds].some((id) => descendantOrgIds(id).includes(ownerOrgId));
}

export function censusEntities(orgIds: Set<string>, asOf: string): CensusEntity[] {
  void asOf;
  const snaps = [...seed.ownership_snapshots, ...FP_SNAPSHOTS.filter((s) => !seed.ownership_snapshots.some((x) => x.id === s.id))];
  const byId = new Map(seed.legal_entities.map((e) => [e.id, e]));
  const out = new Map<string, CensusEntity>();

  for (const c of FP_CONTROLS) {
    if (c.class === "external") continue;
    if (c.class === "body") {
      if (!orgIds.has(c.owner_org_id) && !orgIds.has("ORG-HQ") && !descendantOrgIds("ORG-HQ").some((id) => orgIds.has(id))) {
        continue;
      }
    } else if (!inOrgScope(c.owner_org_id, orgIds)) {
      continue;
    }
    const ent = byId.get(c.legal_entity_id);
    if (!ent) continue;
    if (out.has(ent.id)) continue;
    const edges = snaps
      .filter((s) => s.investee_id === ent.id)
      .map((s) => ({ investorId: s.investor_id, pct: s.pct, source: s.source_type, effective: s.effective_date }));
    const uniqueEdges = new Map<string, (typeof edges)[0]>();
    for (const e of edges) {
      const k = `${e.investorId}|${e.source}`;
      if (!uniqueEdges.has(k)) uniqueEdges.set(k, e);
    }
    out.set(ent.id, {
      entity: ent,
      ownerOrgId: c.owner_org_id,
      class: c.class,
      whollyOwned: c.wholly_owned,
      controlBasis: c.control_basis ?? "",
      listed: c.listed,
      directEdges: [...uniqueEdges.values()],
    });
  }

  if ([...orgIds].some((id) => id === "ORG-HQ" || orgById(id)?.parent_id === "ORG-HQ" || descendantOrgIds("ORG-HQ").includes(id))) {
    const hq = byId.get("LE-HQ");
    if (hq && !out.has("LE-HQ") && orgIds.has("ORG-HQ")) {
      out.set("LE-HQ", {
        entity: hq,
        ownerOrgId: "ORG-HQ",
        class: "body",
        whollyOwned: true,
        controlBasis: "海油工程本体",
        directEdges: [],
      });
    }
  }

  return [...out.values()].sort((a, b) => a.entity.id.localeCompare(b.entity.id));
}

export function censusCounts(orgIds: Set<string>, asOf: string) {
  const list = censusEntities(orgIds, asOf);
  const N = list.length;
  const B = list.filter((x) => x.class === "body").length;
  const C = list.filter((x) => x.class === "controlled").length;
  const P = list.filter((x) => x.class === "participating").length;
  const U = list.filter((x) => x.class === "unverified").length;
  const denom = N - B;
  const pct = (n: number) => (denom <= 0 ? null : (n / denom) * 100);
  return {
    list,
    N,
    B,
    C,
    P,
    U,
    check: N === B + C + P + U,
    cPct: pct(C),
    pPct: pct(P),
    whollyInC: list.filter((x) => x.class === "controlled" && x.whollyOwned).length,
    nonWhollyInC: list.filter((x) => x.class === "controlled" && !x.whollyOwned).length,
  };
}

export function openMatterCount(orgIds: Set<string>): { count: number; matters: typeof seed.property_matters } {
  const matters = seed.property_matters.filter((m) => orgIds.has(m.owner_org_id));
  const open = matters.filter((m) => {
    const tplEnd = ["注销", "关闭", "完成"];
    return !tplEnd.some((k) => m.current_phase_id.includes(k)) && m.matter_type !== "已终止";
  });
  return { count: open.length, matters: open };
}

export function penetratePaths(investeeId: string): { path: string[]; product: number }[] {
  const snaps = seed.ownership_snapshots;
  const edges = snaps.filter((s) => s.source_type.includes("登记") || s.source_type.includes("一致"));
  const byInvestee = new Map<string, typeof edges>();
  for (const e of edges) {
    byInvestee.set(e.investee_id, [...(byInvestee.get(e.investee_id) ?? []), e]);
  }
  const out: { path: string[]; product: number }[] = [];
  const walk = (id: string, path: string[], prod: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    const parents = byInvestee.get(id) ?? [];
    if (parents.length === 0) {
      out.push({ path: [...path], product: prod });
      return;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(id);
    const uniqueParents = [...new Map(parents.map((p) => [p.investor_id, p])).values()];
    for (const p of uniqueParents) {
      walk(p.investor_id, [p.investor_id, ...path], (prod * p.pct) / 100, nextSeen);
    }
  };
  walk(investeeId, [investeeId], 1, new Set());
  return out;
}
