/**
 * 资金/产权业务页一级监管场景目录。
 * 以用户原始 11+10 一级 ID 为唯一来源，不从命中记录或已启用子场景反向生成。
 * CASH2-P12 / S901 / S902 为补充草稿，不进入本目录。
 */

import { fpScenarioRows, type FpScenarioRow } from "./fp-catalog";
import {
  CASH_CONDITIONAL_ROUTES,
  canonicalRightsStage,
  isOfficialFpSub,
  resolvedTopicId,
} from "./fp-topics";
import type { DomainId } from "./types";

export const CASH_OFFICIAL_PRIMARY_IDS = [
  "CASH2-P01",
  "CASH2-P02",
  "CASH2-P03",
  "CASH2-P04",
  "CASH2-P05",
  "CASH2-P06",
  "CASH2-P07",
  "CASH2-P08",
  "CASH2-P09",
  "CASH2-P10",
  "CASH2-P11",
] as const;

export const RIGHTS_OFFICIAL_PRIMARY_IDS = [
  "PTY2-P01",
  "PTY2-P02",
  "PTY2-P03",
  "PTY2-P04",
  "PTY2-P05",
  "PTY2-P06",
  "PTY2-P07",
  "PTY2-P08",
  "PTY2-P09",
  "PTY2-P10",
] as const;

const CASH_PRIMARY_SET = new Set<string>(CASH_OFFICIAL_PRIMARY_IDS);
const RIGHTS_PRIMARY_SET = new Set<string>(RIGHTS_OFFICIAL_PRIMARY_IDS);

export interface DirectoryChild {
  id: string;
  name: string;
  topicId: string;
  stage: string;
}

export interface DirectoryGroup {
  id: string;
  name: string;
  domain: DomainId;
  order: number;
  children: DirectoryChild[];
}

function primarySet(domain: DomainId): Set<string> {
  return domain === "CASH" ? CASH_PRIMARY_SET : domain === "RIGHTS" ? RIGHTS_PRIMARY_SET : new Set();
}

function officialRows(domain: DomainId): FpScenarioRow[] {
  const { funds, property } = fpScenarioRows();
  const rows = domain === "CASH" ? funds : domain === "RIGHTS" ? property : [];
  const allowed = primarySet(domain);
  return rows.filter((r) => allowed.has(r.primary_id) && isOfficialFpSub(r.id));
}

export function subTopicIds(row: FpScenarioRow, domain: DomainId): string[] {
  const main = resolvedTopicId(row.id, row.topic ?? row.stage, domain);
  const extra = domain === "CASH" ? (CASH_CONDITIONAL_ROUTES[row.id] ?? []) : [];
  return [...new Set([main, ...extra])];
}

export function officialDirectory(domain: DomainId): DirectoryGroup[] {
  const ids = domain === "CASH" ? CASH_OFFICIAL_PRIMARY_IDS : domain === "RIGHTS" ? RIGHTS_OFFICIAL_PRIMARY_IDS : [];
  const rows = officialRows(domain);
  return ids.map((id, order) => {
    const children = rows.filter((r) => r.primary_id === id);
    const name = children[0]?.primary_name ?? id;
    return {
      id,
      name,
      domain,
      order,
      children: children.map((r) => ({
        id: r.id,
        name: r.name,
        topicId: resolvedTopicId(r.id, r.topic ?? r.stage, domain),
        stage: r.stage ?? r.topic ?? "",
      })),
    };
  });
}

export function rowMatchesTopic(row: FpScenarioRow, domain: DomainId, topicId: string | null | undefined): boolean {
  if (!topicId) return true;
  return subTopicIds(row, domain).includes(topicId);
}

export function rowMatchesPhase(
  row: FpScenarioRow,
  phaseId: string | null | undefined,
  phaseLabel?: string | null,
): boolean {
  if (!phaseId) return true;
  const rowStage = canonicalRightsStage(row.stage) ?? canonicalRightsStage(row.topic);
  const selected =
    canonicalRightsStage(phaseId) ?? canonicalRightsStage(phaseLabel ?? "") ?? phaseId;
  if (rowStage && (rowStage === selected || rowStage === phaseId)) return true;
  if (phaseLabel && (row.stage === phaseLabel || row.topic === phaseLabel)) return true;
  return false;
}

/** 指定专题/环节下的官方子场景，仍挂在原始一级项下；无命中的一级项在未选专题时也保留。 */
export function scopedDirectory(
  domain: DomainId,
  topicId?: string | null,
  phaseId?: string | null,
  phaseLabel?: string | null,
): DirectoryGroup[] {
  const rows = officialRows(domain);
  const ids = domain === "CASH" ? CASH_OFFICIAL_PRIMARY_IDS : domain === "RIGHTS" ? RIGHTS_OFFICIAL_PRIMARY_IDS : [];
  const byPrimary = new Map<string, FpScenarioRow[]>();
  for (const row of rows) {
    if (!rowMatchesTopic(row, domain, topicId)) continue;
    if (domain === "RIGHTS" && !rowMatchesPhase(row, phaseId, phaseLabel)) continue;
    const list = byPrimary.get(row.primary_id) ?? [];
    list.push(row);
    byPrimary.set(row.primary_id, list);
  }
  return ids
    .map((id, order) => {
      const children = byPrimary.get(id) ?? [];
      const fallback = rows.find((r) => r.primary_id === id);
      return {
        id,
        name: fallback?.primary_name ?? children[0]?.primary_name ?? id,
        domain,
        order,
        children: children.map((r) => ({
          id: r.id,
          name: r.name,
          topicId: resolvedTopicId(r.id, r.topic ?? r.stage, domain),
          stage: r.stage ?? r.topic ?? "",
        })),
      };
    })
    .filter((g) => (topicId || phaseId ? g.children.length > 0 : true));
}

export function officialSubIds(domain: DomainId): string[] {
  return officialDirectory(domain).flatMap((g) => g.children.map((c) => c.id));
}

export function isOfficialPrimary(id: string): boolean {
  return CASH_PRIMARY_SET.has(id) || RIGHTS_PRIMARY_SET.has(id);
}
