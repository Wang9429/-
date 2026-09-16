import {
  FP_NO_REPORT,
  FP_SEGMENTS,
  FP_SME,
  FP_STATEMENTS,
  type FinancialStatement,
} from "./fp-seed";
import { orgById } from "./org";
import type { IndicatorContext, LeafMetric } from "./metrics";
import type { ObjectType } from "./types";

export function statementsForPeriod(ctx: { periodStart: string; periodEnd: string; asOf: string }): FinancialStatement[] {
  return FP_STATEMENTS.filter(
    (s) => s.period_start === ctx.periodStart && s.period_end === ctx.periodEnd && s.as_of === ctx.asOf,
  );
}

export function statementOf(
  orgId: string,
  ctx: { periodStart: string; periodEnd: string; asOf: string },
  prefer: "consolidated" | "standalone" | "any" = "any",
): FinancialStatement | undefined {
  const rows = statementsForPeriod(ctx).filter((s) => s.org_id === orgId);
  if (prefer === "consolidated") return rows.find((s) => s.report_scope === "consolidated") ?? rows[0];
  if (prefer === "standalone") return rows.find((s) => s.report_scope === "standalone") ?? rows[0];
  return rows.find((s) => s.report_scope === "consolidated") ?? rows[0];
}

export function reportAvailability(orgId: string): "ok" | "no_report" | "hq_self" {
  if (orgId === "ORG-HQ") return "ok";
  if (FP_NO_REPORT.has(orgId)) return "no_report";
  const o = orgById(orgId);
  if (!o) return "no_report";
  if (o.node_type === "department" || o.node_type === "project_department" || o.unit_category === "department") {
    return "no_report";
  }
  if (o.node_type === "branch" || o.unit_category === "branch") return "no_report";
  if (o.node_type === "management_unit" || o.unit_category === "business_unit") return "no_report";
  return FP_STATEMENTS.some((s) => s.org_id === orgId)
    ? "ok"
    : "no_report";
}

function leafBase(orgId: string, stmt: FinancialStatement | undefined, gap: string | undefined): Omit<LeafMetric, "numerator" | "denominator"> {
  const org = orgById(orgId);
  return {
    objectId: stmt?.id ?? `FS-NONE-${orgId}`,
    objectType: "legal_entity" as ObjectType,
    name: org?.name ?? orgId,
    orgId,
    extras: stmt
      ? [
          { label: "报表口径", value: stmt.report_scope === "consolidated" ? "合并报表" : stmt.report_scope === "standalone" ? "个别报表" : "管理汇总" },
          { label: "关账", value: stmt.closed ? "已关账" : "未关账" },
          { label: "数据性质", value: "合成报告，不冒用公开公司实际报表" },
          { label: "报告期间", value: `${stmt.period_start}～${stmt.period_end}` },
          { label: "资产=负债+权益", value: stmt.total_assets != null && stmt.total_liabilities != null && stmt.equity != null ? `${stmt.total_assets}=${stmt.total_liabilities}+${stmt.equity}` : "—" },
        ]
      : [{ label: "报表口径", value: gap ?? "无独立报表" }],
    riskIds: [],
    dataComplete: Boolean(stmt) && !gap,
    gapNote: gap,
  };
}

type StmtField =
  | "revenue"
  | "operating_profit"
  | "total_assets"
  | "total_liabilities"
  | "operating_cf"
  | "interest_bearing_debt"
  | "current_assets"
  | "current_liabilities";

/** 核心业务分部利润叶子，挂在对应管理单位下，供营业利润等继续下钻。 */
export function segmentProfitLeaves(ctx: IndicatorContext): LeafMetric[] {
  const inWindow = FP_SEGMENTS.filter((s) => s.period_end >= ctx.periodStart && s.period_end <= ctx.periodEnd);
  const source = inWindow.length ? inWindow : FP_SEGMENTS.filter((s) => s.closed);
  const latest = new Map<string, (typeof FP_SEGMENTS)[0]>();
  for (const s of source) {
    const k = `${s.org_id}::${s.name}`;
    const prev = latest.get(k);
    if (!prev || s.period_end > prev.period_end) latest.set(k, s);
  }
  return [...latest.values()].map((s) => ({
    objectId: s.id,
    objectType: "legal_entity" as ObjectType,
    name: s.name,
    orgId: s.org_id,
    extras: [
      { label: "核心业务", value: s.name },
      { label: "期间", value: `${s.period_start}～${s.period_end}` },
      { label: "营业利润", value: `${s.operating_profit} 万元` },
      { label: "可比", value: s.comparable ? "是" : "否" },
    ],
    riskIds: [],
    dataComplete: s.closed && s.comparable,
    gapNote: s.closed ? undefined : "本期未关账",
    numerator: s.operating_profit,
    denominator: null,
  }));
}

export function financeLeaves(
  field: StmtField,
  ctx: IndicatorContext,
  opts?: { asRatioNumerator?: StmtField; asRatioDenominator?: StmtField },
): LeafMetric[] {
  const orgs = ["ORG-HQ", "ORG-A", "ORG-B", "ORG-C", "ORG-A1", "ORG-OV"];
  return orgs.map((orgId) => {
    const avail = reportAvailability(orgId);
    if (avail === "no_report") {
      return {
        ...leafBase(orgId, undefined, "无独立报表"),
        numerator: null,
        denominator: null,
      };
    }
    const prefer = orgId === "ORG-HQ" ? "consolidated" : "standalone";
    const stmt = statementOf(orgId, ctx, prefer);
    if (!stmt) {
      return {
        ...leafBase(orgId, undefined, "本期缺数"),
        numerator: null,
        denominator: null,
      };
    }
    const n = opts?.asRatioNumerator ? stmt[opts.asRatioNumerator] : stmt[field];
    const d = opts?.asRatioDenominator ? stmt[opts.asRatioDenominator] : null;
    const ratioInvalid =
      opts?.asRatioDenominator && (d === null || d === undefined || d <= 0);
    return {
      ...leafBase(orgId, stmt, ratioInvalid ? "分母为0或数据不足，按不适用处理" : undefined),
      numerator: ratioInvalid ? null : n,
      denominator: opts?.asRatioDenominator ? d : null,
      dataComplete: !ratioInvalid && n !== null && n !== undefined,
    };
  });
}

export function cashBridgeNote(): string {
  return "总部合并报表货币资金6800万元；原银行账户监管口径6632万元，差额168万元为在途及未纳入专户视图的调节项。专项专户ACC-SPEC新增520万元（截至2026-06-30，专项〔2026〕12号，全部受限）计入监管账户后合计7152万元，受限834.4万元，可用仍为6317.6万元。内部结算账户ACC-INT余额为0，不重复计银行余额。报表货币资金与监管账户不是同一口径，不能互相替代。";
}

export function consecutiveLossPeriods(orgId: string, n = 3): { count: number; name: string; profits: number[] } | null {
  const rows = FP_SEGMENTS.filter((s) => s.org_id === orgId && s.closed && s.comparable).sort((a, b) =>
    a.period_end.localeCompare(b.period_end),
  );
  if (rows.length === 0) return null;
  const byName = new Map<string, typeof rows>();
  for (const r of rows) {
    byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  }
  for (const [name, list] of byName) {
    const tail = list.slice(-n);
    if (tail.length < n) continue;
    if (tail.every((x) => x.operating_profit < 0)) {
      return { count: n, name, profits: tail.map((x) => x.operating_profit) };
    }
  }
  return null;
}

export function smeOverdueWan(orgIds: Set<string>, asOf: string): number {
  return FP_SME.filter((s) => orgIds.has(s.owner_org_id) && s.sme_at_contract === true && s.due_date <= asOf).reduce(
    (a, s) => a + Math.max(0, s.undisputed_wan - s.paid_wan),
    0,
  );
}
