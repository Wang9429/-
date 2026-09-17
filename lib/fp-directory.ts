/**
 * 资金/产权业务页一级监管场景目录。
 * 以 R3.1 对照表（data/fp/primary_catalog_r31.json）为唯一来源，
 * 不从命中记录或已启用子场景反向生成。CASH2-P12 / S901 / S902 不进入本目录。
 */

import coverageJson from "@/data/fp/primary_catalog_r31.json";
import { fpScenarioRows, type FpScenarioRow } from "./fp-catalog";
import {
  CASH_CONDITIONAL_ROUTES,
  CASH_TOPIC_NAME,
  RIGHTS_TOPIC_NAME,
  canonicalRightsStage,
  isOfficialFpSub,
  resolvedTopicId,
} from "./fp-topics";
import type { DomainId } from "./types";

export interface CoveragePrimary {
  domain_id: "funds" | "property-rights";
  primary_id: string;
  primary_name: string;
  subscenario_ids: string[];
  main_topics: string[];
  conditional_topics: string[];
}

const coverage = coverageJson as {
  primary_records: CoveragePrimary[];
};

export const CASH_OFFICIAL_PRIMARY_IDS = coverage.primary_records
  .filter((r) => r.domain_id === "funds")
  .map((r) => r.primary_id);

export const RIGHTS_OFFICIAL_PRIMARY_IDS = coverage.primary_records
  .filter((r) => r.domain_id === "property-rights")
  .map((r) => r.primary_id);

const CASH_PRIMARY_SET = new Set(CASH_OFFICIAL_PRIMARY_IDS);
const RIGHTS_PRIMARY_SET = new Set(RIGHTS_OFFICIAL_PRIMARY_IDS);

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

function domainKey(domain: DomainId): CoveragePrimary["domain_id"] | null {
  if (domain === "CASH") return "funds";
  if (domain === "RIGHTS") return "property-rights";
  return null;
}

export function coveragePrimaries(domain: DomainId): CoveragePrimary[] {
  const key = domainKey(domain);
  if (!key) return [];
  return coverage.primary_records.filter((r) => r.domain_id === key);
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

function topicNameOf(topicId: string, domain: DomainId): string {
  if (domain === "CASH") return CASH_TOPIC_NAME[topicId] ?? topicId;
  return RIGHTS_TOPIC_NAME[topicId] ?? topicId;
}

function childFromRow(row: FpScenarioRow | undefined, id: string, domain: DomainId): DirectoryChild {
  return {
    id,
    name: row?.name ?? id,
    topicId: row ? resolvedTopicId(row.id, row.topic ?? row.stage, domain) : "",
    stage: row?.stage ?? row?.topic ?? "",
  };
}

export function officialDirectory(domain: DomainId): DirectoryGroup[] {
  const rows = officialRows(domain);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return coveragePrimaries(domain).map((p, order) => ({
    id: p.primary_id,
    name: p.primary_name,
    domain,
    order,
    children: p.subscenario_ids.map((id) => childFromRow(byId.get(id), id, domain)),
  }));
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
  const selected = canonicalRightsStage(phaseId) ?? canonicalRightsStage(phaseLabel ?? "") ?? phaseId;
  if (rowStage && (rowStage === selected || rowStage === phaseId)) return true;
  if (phaseLabel && (row.stage === phaseLabel || row.topic === phaseLabel)) return true;
  return false;
}

function childrenForTopic(
  primary: CoveragePrimary,
  rows: FpScenarioRow[],
  domain: DomainId,
  topicId: string,
): FpScenarioRow[] {
  const topicName = topicNameOf(topicId, domain);
  const inMain = primary.main_topics.includes(topicName);
  const inCond = primary.conditional_topics.includes(topicName);
  if (!inMain && !inCond) return [];
  const mine = rows.filter((r) => primary.subscenario_ids.includes(r.id));
  const mapped = mine.filter((r) => subTopicIds(r, domain).includes(topicId));
  if (mapped.length > 0) return mapped;
  return mine;
}

/** 指定专题/环节下的官方子场景，仍挂在原始一级项下。 */
export function scopedDirectory(
  domain: DomainId,
  topicId?: string | null,
  phaseId?: string | null,
  phaseLabel?: string | null,
): DirectoryGroup[] {
  if (!topicId && !phaseId) return officialDirectory(domain);
  const rows = officialRows(domain);
  return coveragePrimaries(domain)
    .map((p, order) => {
      let kids = topicId ? childrenForTopic(p, rows, domain, topicId) : rows.filter((r) => r.primary_id === p.primary_id);
      if (domain === "RIGHTS" && phaseId) {
        kids = kids.filter((r) => rowMatchesPhase(r, phaseId, phaseLabel));
      }
      return {
        id: p.primary_id,
        name: p.primary_name,
        domain,
        order,
        children: kids.map((r) => childFromRow(r, r.id, domain)),
      };
    })
    .filter((g) => g.children.length > 0);
}

export function officialSubIds(domain: DomainId): string[] {
  return officialDirectory(domain).flatMap((g) => g.children.map((c) => c.id));
}

export function isOfficialPrimary(id: string): boolean {
  return CASH_PRIMARY_SET.has(id) || RIGHTS_PRIMARY_SET.has(id);
}

export function coverageEntry(primaryId: string): CoveragePrimary | undefined {
  return coverage.primary_records.find((r) => r.primary_id === primaryId);
}
