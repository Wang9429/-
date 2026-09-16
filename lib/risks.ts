import { seed } from "./seed";
import type { CaseAction, DomainId, RiskCase, RiskStatus } from "./types";

export const OPEN_STATUSES: RiskStatus[] = [
  "pending_review",
  "investigating",
  "rectifying",
  "pending_verification",
];

/** 已确认需要整改、尚未复核关闭。不含待核查、核查中、已排除、确认无需整改。 */
export const OPEN_RECTIFICATION_STATUSES: RiskStatus[] = ["rectifying", "pending_verification"];

export const isOpen = (r: RiskCase) => OPEN_STATUSES.includes(r.status);

export function isOpenRectificationStatus(status: RiskStatus | null | undefined): boolean {
  return Boolean(status && OPEN_RECTIFICATION_STATUSES.includes(status));
}

export const severityLabel: Record<string, string> = { red: "高风险", yellow: "关注" };

export const statusLabel: Record<RiskStatus, string> = {
  pending_review: "待核查",
  investigating: "核查中",
  rectifying: "整改中",
  pending_verification: "待复核",
  excluded: "已排除",
  closed: "已关闭",
};

export const taskTypeLabel: Record<string, string> = {
  investigation: "核查",
  rectification: "整改",
  verification: "复核",
};

/** 该事项是否已进入整改责任范围（有有效整改期限）。 */
export function rectificationDueDate(r: RiskCase): string | null | undefined {
  if (r.status === "rectifying" || r.status === "pending_verification") {
    return r.rectification_plan?.due_date ?? r.current_task_due_date ?? null;
  }
  return undefined; // 未进入整改责任范围
}

/**
 * 逾期整改数口径（完整业需 5.3）：
 * 已进入整改责任范围、截至日仍未关闭（含待复核）且超过有效整改期限的唯一 risk_id。
 * 待复核不自动停表；核查/复核等其他办理 SLA 超期在工作台单列，不计入此数。
 */
export function isOverdueRectification(r: RiskCase, asOf: string): boolean {
  const due = rectificationDueDate(r);
  if (due === undefined) return false;
  if (due === null) return false; // 缺期限，按“缺期限”展示，不当作未逾期也不计入逾期数
  return due < asOf;
}

export function isMissingRectificationDeadline(r: RiskCase): boolean {
  const due = rectificationDueDate(r);
  return due === null;
}

/** 当前办理节点超期（核查/整改/复核各自期限），用于监管工作台单列。 */
export function isCurrentTaskOverdue(r: RiskCase, asOf: string): boolean {
  if (!isOpen(r)) return false;
  const due = r.current_task_due_date;
  if (!due) return false;
  return due < asOf;
}

/**
 * 本期已整改闭环：所选期间内复核通过关闭、截至日仍为 closed 且 close_reason=rectified。
 * 已重开事项当前不是 closed，不计入。
 */
export function isRectifiedClosedInPeriod(
  r: RiskCase,
  periodStart: string,
  periodEnd: string,
  asOf: string,
): boolean {
  if (r.status !== "closed") return false;
  if (r.close_reason !== "rectified") return false;
  if ((r.reopened_count ?? 0) > 0) return false;
  const closed = r.verified_closed_at ?? r.closed_at;
  if (!closed) return false;
  if (closed > asOf) return false;
  return closed >= periodStart && closed <= periodEnd;
}

/**
 * 按截至日还原事项状态：优先重放 effective_date ≤ 截至日的办理记录。
 * 若办理均晚于截至日，保留最早记录的办理前状态，不能把后来的整改写回历史。
 * 事项尚未发生则返回 null。
 */
export function statusAtAsOf(r: RiskCase, asOf: string, actions: CaseAction[] = seed.case_actions): RiskStatus | null {
  if (r.first_seen_at > asOf) return null;
  const all = actions
    .filter((a) => a.risk_id === r.id)
    .sort((a, b) => a.sequence - b.sequence || a.effective_date.localeCompare(b.effective_date));
  const relevant = all.filter((a) => a.effective_date <= asOf);
  if (relevant.length) {
    const last = relevant[relevant.length - 1];
    return (last.to_status as RiskStatus | undefined) ?? r.status;
  }
  if (all.length) {
    const first = all[0];
    return (first.from_status as RiskStatus | undefined) ?? "pending_review";
  }
  if (r.verified_closed_at && r.verified_closed_at > asOf) {
    if (r.first_seen_at <= asOf) return "rectifying";
  }
  if (r.closed_at && r.closed_at > asOf) {
    return isOpenRectificationStatus(r.status) ? r.status : "rectifying";
  }
  return r.status;
}

export function riskAtAsOf(r: RiskCase, asOf: string, actions: CaseAction[] = seed.case_actions): RiskCase | null {
  const status = statusAtAsOf(r, asOf, actions);
  if (!status) return null;
  if (status === r.status) return r;
  return { ...r, status };
}

export function isOpenRectificationAt(r: RiskCase, asOf: string, actions: CaseAction[] = seed.case_actions): boolean {
  const snapshot = riskAtAsOf(r, asOf, actions);
  if (!snapshot) return false;
  return isOpenRectificationStatus(snapshot.status);
}

/** 截至日仍存在的事项快照；晚于截至日才发生的事项不出现。 */
export function snapshotRisksAtAsOf(
  risks: RiskCase[],
  asOf: string,
  actions: CaseAction[] = seed.case_actions,
): RiskCase[] {
  const out: RiskCase[] = [];
  for (const r of risks) {
    const snap = riskAtAsOf(r, asOf, actions);
    if (snap) out.push(snap);
  }
  return out;
}

export type RectificationStageCensus = {
  pending: string[];
  rectifying: string[];
  pendingVerification: string[];
  closedOrExcluded: string[];
  openRectification: string[];
};

/** 待核查不计未关闭整改；整改中、待复核计入；关闭/排除移出。 */
export function rectificationStageCensus(risks: RiskCase[]): RectificationStageCensus {
  const pending: string[] = [];
  const rectifying: string[] = [];
  const pendingVerification: string[] = [];
  const closedOrExcluded: string[] = [];
  for (const r of risks) {
    if (r.status === "pending_review" || r.status === "investigating") pending.push(r.id);
    else if (r.status === "rectifying") rectifying.push(r.id);
    else if (r.status === "pending_verification") pendingVerification.push(r.id);
    else closedOrExcluded.push(r.id);
  }
  pending.sort();
  rectifying.sort();
  pendingVerification.sort();
  closedOrExcluded.sort();
  return {
    pending,
    rectifying,
    pendingVerification,
    closedOrExcluded,
    openRectification: [...rectifying, ...pendingVerification].sort(),
  };
}

/** 事项在某领域出现（按 risk_context_links 的实际关联，不按场景模板铺开）。 */
export function riskDomains(riskId: string): DomainId[] {
  const set = new Set<DomainId>();
  for (const l of seed.risk_context_links) if (l.risk_id === riskId) set.add(l.domain);
  return [...set];
}

export function riskPhaseIds(riskId: string, domain: DomainId): string[] {
  const out = new Set<string>();
  for (const l of seed.risk_context_links) {
    if (l.risk_id === riskId && l.domain === domain) l.phase_ids.forEach((p) => out.add(p));
  }
  return [...out];
}

export function riskTopicIds(riskId: string, domain: DomainId): string[] {
  const out = new Set<string>();
  for (const l of seed.risk_context_links) {
    if (l.risk_id === riskId && l.domain === domain && l.topic_id) out.add(l.topic_id);
  }
  return [...out];
}

export function riskSubtopic(riskId: string, domain: DomainId): string | null {
  const l = seed.risk_context_links.find((x) => x.risk_id === riskId && x.domain === domain);
  return l?.subtopic_id ?? null;
}

export interface RiskFilter {
  domain?: DomainId;
  orgScope?: Set<string>;
  phaseId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
}

export function riskMatches(r: RiskCase, f: RiskFilter): boolean {
  if (f.orgScope && !f.orgScope.has(r.owner_org_id)) return false;
  if (!f.domain) return true;
  const links = seed.risk_context_links.filter((l) => l.risk_id === r.id && l.domain === f.domain);
  if (links.length === 0) return false;
  if (f.phaseId) {
    if (!links.some((l) => l.phase_ids.includes(f.phaseId as string))) return false;
  }
  if (f.topicId) {
    if (!links.some((l) => l.topic_id === f.topicId)) return false;
  }
  if (f.subtopicId) {
    if (!links.some((l) => (l.subtopic_id ?? null) === f.subtopicId)) return false;
  }
  return true;
}

export function nextSequence(actions: CaseAction[]): number {
  return actions.reduce((m, a) => Math.max(m, a.sequence), 0) + 1;
}
