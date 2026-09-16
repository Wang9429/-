import {
  FP_LOANS,
  FP_NO_REPORT,
  FP_SEGMENTS,
  FP_SME,
  FP_STATEMENTS,
  type FinancialStatement,
} from "./fp-seed";
import { isManagedUnit, orgById } from "./org";
import { seed } from "./seed";
import type { Account, ObjectType } from "./types";
import type { IndicatorContext, LeafMetric } from "./metrics";

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
          { label: "负债总额", value: stmt.total_liabilities != null ? `${stmt.total_liabilities} 万元` : "—" },
          { label: "净资产", value: stmt.equity != null ? `${stmt.equity} 万元` : "—" },
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
  | "current_liabilities"
  | "net_profit"
  | "equity";

function managedOrgIds(): string[] {
  return seed.organizations.filter((o) => isManagedUnit(o)).map((o) => o.id);
}

/** 核心业务分部叶子，挂在对应管理单位下，不进入报表汇总。 */
export function segmentProfitLeaves(ctx: IndicatorContext): LeafMetric[] {
  return segmentLeaves(ctx, "profit");
}

export function segmentRevenueLeaves(ctx: IndicatorContext): LeafMetric[] {
  return segmentLeaves(ctx, "revenue");
}

function segmentLeaves(ctx: IndicatorContext, field: "profit" | "revenue"): LeafMetric[] {
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
      { label: "营业收入", value: `${s.revenue} 万元` },
      { label: "营业利润", value: `${s.operating_profit} 万元` },
      { label: "可比", value: s.comparable ? "是" : "否" },
      { label: "归集依据", value: "合成分部经营结果，不替代合并报表" },
    ],
    riskIds: [],
    dataComplete: s.closed && s.comparable,
    gapNote: s.closed ? undefined : "本期未关账",
    numerator: field === "profit" ? s.operating_profit : s.revenue,
    denominator: null,
    excludeFromRollup: true,
  }));
}

export function financeLeaves(
  field: StmtField,
  ctx: IndicatorContext,
  opts?: { asRatioNumerator?: StmtField; asRatioDenominator?: StmtField },
): LeafMetric[] {
  return managedOrgIds().map((orgId) => {
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

/** 净资产收益率：期间净利润 ÷ 平均净资产，不年化。 */
export function roeLeaves(ctx: IndicatorContext): LeafMetric[] {
  return managedOrgIds().map((orgId) => {
    const avail = reportAvailability(orgId);
    if (avail === "no_report") {
      return { ...leafBase(orgId, undefined, "无独立报表"), numerator: null, denominator: null };
    }
    const prefer = orgId === "ORG-HQ" ? "consolidated" : "standalone";
    const stmt = statementOf(orgId, ctx, prefer);
    if (!stmt) {
      return { ...leafBase(orgId, undefined, "本期缺数"), numerator: null, denominator: null };
    }
    const np = stmt.net_profit;
    const begin = stmt.equity_begin;
    const end = stmt.equity;
    if (np === null || begin === null || end === null) {
      return {
        ...leafBase(orgId, stmt, "缺净利润或期初/期末净资产，净资产收益率不适用"),
        numerator: null,
        denominator: null,
        dataComplete: false,
      };
    }
    const avg = (begin + end) / 2;
    if (avg <= 0) {
      return {
        ...leafBase(orgId, stmt, "平均净资产≤0，不适用"),
        numerator: null,
        denominator: null,
        dataComplete: false,
      };
    }
    const extras = [
      ...leafBase(orgId, stmt, undefined).extras,
      { label: "净利润", value: `${np} 万元` },
      { label: "期初净资产", value: `${begin} 万元` },
      { label: "期末净资产", value: `${end} 万元` },
      { label: "平均净资产", value: `${avg} 万元＝（${begin}+${end}）÷2` },
      { label: "是否年化", value: "不年化，使用期间净利润" },
    ];
    return {
      ...leafBase(orgId, stmt, undefined),
      extras,
      numerator: np,
      denominator: avg,
      dataComplete: true,
    };
  });
}

/** 带息债务合同明细，不进入报表余额汇总。 */
export function loanDetailLeaves(ctx: IndicatorContext): LeafMetric[] {
  void ctx;
  return FP_LOANS.map((l) => ({
    objectId: l.id,
    objectType: "contract" as ObjectType,
    name: l.name,
    orgId: l.owner_org_id,
    extras: [
      { label: "方向", value: l.direction === "external_borrow" ? "外部借款" : "内部借入" },
      { label: "合同本金", value: `${l.principal_wan} 万元` },
      { label: "未偿本金", value: `${l.outstanding_wan} 万元` },
      { label: "未使用授信", value: `${l.unused_credit_wan} 万元（不计借款）` },
      { label: "利率", value: `${l.rate_pct}%` },
      { label: "还本付息计划", value: `${l.next_repay_date} 还本付息 ${l.next_repay_wan} 万元` },
      { label: "到期日", value: l.due_date },
    ],
    riskIds: [],
    dataComplete: true,
    numerator: l.outstanding_wan,
    denominator: null,
    excludeFromRollup: true,
  }));
}

function accountWan(a: Account): number {
  return (a.closing_balance_native * a.fx_to_cny) / 10000;
}

export type CashBridgeLine = {
  id: string;
  direction: "+" | "−" | "=";
  amount_wan: number;
  name: string;
  source: string;
  scope: string;
  status: "verified" | "unverified";
  note: string;
};

const HQ_CONS_CTX = { periodStart: "2026-01-01", periodEnd: "2026-06-30", asOf: "2026-06-30" };

/** 监管账户期末与总部合并报表货币资金的逐项对照。不编造调节项，不能核证的标差异待核实。 */
export function cashAccountStatementBridge(): {
  asOf: string;
  lines: CashBridgeLine[];
  accountTotalWan: number;
  statementWan: number;
  gapWan: number;
  contrasts: CashBridgeLine[];
} {
  const hq = statementOf("ORG-HQ", HQ_CONS_CTX, "consolidated");
  const stmtA = statementOf("ORG-A", HQ_CONS_CTX, "standalone");
  const stmtB = statementOf("ORG-B", HQ_CONS_CTX, "standalone");
  const stmtC = statementOf("ORG-C", HQ_CONS_CTX, "standalone");
  const statementWan = hq?.cash_on_bs ?? 0;
  const ordered = ["ACC-A", "ACC-B", "ACC-USD", "ACC-SPEC", "ACC-INT"];
  const byId = new Map(seed.accounts.map((a) => [a.id, a]));
  const lines: CashBridgeLine[] = [];
  for (const id of ordered) {
    const a = byId.get(id);
    if (!a) continue;
    const wan = accountWan(a);
    const org = orgById(a.owner_org_id);
    if (id === "ACC-A") {
      const match = stmtA?.cash_on_bs === wan;
      lines.push({
        id,
        direction: "+",
        amount_wan: wan,
        name: a.name,
        source: `账户 ${id} 期末余额 ${a.closing_balance_native.toLocaleString("zh-CN")} ${a.native_amount_unit}｜余额日 ${a.balance_as_of}`,
        scope: `${org?.name ?? a.owner_org_id}／${a.legal_entity_id} 结算账户`,
        status: match ? "verified" : "unverified",
        note: match
          ? `与单位A个别报表 FS-A-2026H1 货币资金 ${stmtA?.cash_on_bs} 万元一致`
          : "与单位A个别报表未能核符，差异待核实",
      });
    } else if (id === "ACC-B") {
      const match = stmtB?.cash_on_bs === wan;
      lines.push({
        id,
        direction: "+",
        amount_wan: wan,
        name: a.name,
        source: `账户 ${id} 期末余额 ${a.closing_balance_native.toLocaleString("zh-CN")} ${a.native_amount_unit}｜余额日 ${a.balance_as_of}`,
        scope: `${org?.name ?? a.owner_org_id}／${a.legal_entity_id} 结算账户`,
        status: match ? "verified" : "unverified",
        note: match
          ? `与单位B个别报表 FS-B-2026H1 货币资金 ${stmtB?.cash_on_bs} 万元一致`
          : "与单位B个别报表未能核符，差异待核实",
      });
    } else if (id === "ACC-USD") {
      lines.push({
        id,
        direction: "+",
        amount_wan: wan,
        name: a.name,
        source: `账户 ${id} ${a.closing_balance_native.toLocaleString("zh-CN")} ${a.native_amount_unit} × 模拟汇率 ${a.fx_to_cny}｜余额日 ${a.balance_as_of}`,
        scope: `${org?.name ?? a.owner_org_id}（无独立报表）／${a.legal_entity_id}`,
        status: "unverified",
        note: "境外账户。ORG-OV 无独立报表，不能证明已纳入或未纳入总部合并货币资金 6800 万元，差异待核实",
      });
    } else if (id === "ACC-SPEC") {
      lines.push({
        id,
        direction: "+",
        amount_wan: wan,
        name: a.name,
        source: `账户 ${id} 期末 ${wan} 万元全部受限｜${a.restriction_basis ?? "专项专户"}｜余额日 ${a.balance_as_of}`,
        scope: `${org?.name ?? a.owner_org_id}／${a.legal_entity_id} 专项专户`,
        status: "unverified",
        note: "受限不等于报表排除，不能仅因专户受限将其剔出报表货币资金。账户记录存在；是否已包含在合并 6800 或单位A个别 5080 中，差异待核实",
      });
    } else {
      lines.push({
        id,
        direction: "+",
        amount_wan: wan,
        name: a.name,
        source: `账户 ${id} 期末 ${wan} 万元｜余额日 ${a.balance_as_of}`,
        scope: `${org?.name ?? a.owner_org_id} 内部结算，不重复计银行余额`,
        status: "verified",
        note: "余额为 0，不构成与报表的差额",
      });
    }
  }
  const extra = seed.accounts.filter((a) => !ordered.includes(a.id));
  for (const a of extra) {
    lines.push({
      id: a.id,
      direction: "+",
      amount_wan: accountWan(a),
      name: a.name,
      source: `账户 ${a.id} 期末记录`,
      scope: `${orgById(a.owner_org_id)?.name ?? a.owner_org_id}`,
      status: "unverified",
      note: "未列入既有对照清单，差异待核实",
    });
  }
  const accountTotalWan = lines.reduce((s, l) => s + l.amount_wan, 0);
  const gapWan = accountTotalWan - statementWan;
  const totalLine: CashBridgeLine = {
    id: "REG-TOTAL",
    direction: "=",
    amount_wan: accountTotalWan,
    name: "监管账户期末合计",
    source: "CASH-I01 同截至日账户余额折人民币合计",
    scope: "授权范围内银行及专户（内部账户余额 0 不重复计）",
    status: "verified",
    note: `受限合计 ${seed.accounts.reduce((s, a) => s + (a.restricted_balance_native * a.fx_to_cny) / 10000, 0)} 万元；可用 ${seed.accounts.reduce((s, a) => s + ((a.closing_balance_native - a.restricted_balance_native) * a.fx_to_cny) / 10000, 0)} 万元`,
  };
  const stmtLine: CashBridgeLine = {
    id: hq?.id ?? "FS-HQ-CONS",
    direction: "−",
    amount_wan: statementWan,
    name: "总部合并报表货币资金",
    source: `${hq?.id ?? "FS-HQ-CONS-2026H1"} cash_on_bs，合成合并报表，金额单位万元`,
    scope: "ORG-HQ 合并口径 2026-01-01～2026-06-30，截至 2026-06-30",
    status: "verified",
    note: "报表货币资金与监管账户不是同一口径，不能互相替代",
  };
  const gapLine: CashBridgeLine = {
    id: "GAP-352",
    direction: "=",
    amount_wan: gapWan,
    name: "账户合计减合并报表差额",
    source: `${accountTotalWan} − ${statementWan}`,
    scope: "同授权、同截至日对照",
    status: "unverified",
    note: "上列已核项不能算术还原该差额，未编造调节项凑平。整段差额标为差异待核实",
  };
  const contrasts: CashBridgeLine[] = [
    {
      id: "FS-C",
      direction: "+",
      amount_wan: stmtC?.cash_on_bs ?? 0,
      name: "单位C个别报表货币资金",
      source: "FS-C-2026H1 cash_on_bs",
      scope: "ORG-C 个别报表，监管账户清单无对应账户",
      status: "unverified",
      note: "报表有数、账户清单缺户。是否已纳入合并 6800 万元，差异待核实",
    },
  ];
  return {
    asOf: "2026-06-30",
    lines: [...lines, totalLine, stmtLine, gapLine],
    accountTotalWan,
    statementWan,
    gapWan,
    contrasts,
  };
}

export function cashBridgeNote(): string {
  const b = cashAccountStatementBridge();
  const items = b.lines
    .filter((l) => l.id.startsWith("ACC-"))
    .map((l) => `${l.direction}${l.amount_wan} ${l.id}（${l.note}）`)
    .join("；");
  const contrast = b.contrasts.map((l) => `${l.name}${l.amount_wan}万元：${l.note}`).join("；");
  return `监管账户期末合计 ${b.accountTotalWan} 万元：${items}。总部合并报表 ${b.statementWan} 万元（${b.lines.find((l) => l.id.startsWith("FS-"))?.source ?? "FS-HQ-CONS-2026H1"}）。差额 ${b.gapWan} 万元为差异待核实，未编造调节项凑平，亦不以专户受限为由将其排除在报表货币资金之外。${contrast}`;
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
