/**
 * 本轮为趋势展示补齐的合成历史。与当期 H1/H2/Q1 关账数勾稽，
 * 不改写 2026-06-30 账户 7152/834.4/6317.6 与报表 6800 的 352 万元待核实差异。
 * 月报不含净利润/期初净资产，避免把半年 ROE 拆成月度收益率。
 */

import type { Account } from "./types";

export interface HistoryStatement {
  id: string;
  org_id: string;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  as_of: string;
  closed: boolean;
  report_scope: "consolidated" | "standalone" | "management";
  currency: "CNY";
  amount_unit: "万元";
  revenue: number | null;
  operating_profit: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  equity: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
  operating_cf: number | null;
  interest_bearing_debt: number | null;
  cash_on_bs: number | null;
  net_profit: number | null;
  equity_begin: number | null;
  data_nature: string;
  missing_reason?: string;
}

export const MONTH_ENDS_2026H1 = [
  "2026-01-31",
  "2026-02-28",
  "2026-03-31",
  "2026-04-30",
  "2026-05-31",
  "2026-06-30",
] as const;

export const ACCOUNT_HISTORY_AS_OF = new Set<string>(MONTH_ENDS_2026H1);

const MONTH_START = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];

type FlowShare = { revenue: number; operating_profit: number; operating_cf: number };

function stmt(
  partial: Omit<HistoryStatement, "currency" | "amount_unit" | "data_nature" | "closed"> & {
    closed?: boolean;
  },
): HistoryStatement {
  return {
    currency: "CNY",
    amount_unit: "万元",
    data_nature: "synthetic_statement",
    closed: partial.closed ?? true,
    ...partial,
  };
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function monthlyStock(
  dec: { assets: number; liab: number; equity: number; ca: number; cl: number; debt: number; cash: number },
  mar: { assets: number; liab: number; equity: number; ca: number; cl: number; debt: number; cash: number },
  jun: { assets: number; liab: number; equity: number; ca: number; cl: number; debt: number; cash: number },
  monthIndex: number,
) {
  if (monthIndex <= 2) {
    const t = (monthIndex + 1) / 3;
    return {
      total_assets: lerp(dec.assets, mar.assets, t),
      total_liabilities: lerp(dec.liab, mar.liab, t),
      equity: lerp(dec.equity, mar.equity, t),
      current_assets: lerp(dec.ca, mar.ca, t),
      current_liabilities: lerp(dec.cl, mar.cl, t),
      interest_bearing_debt: lerp(dec.debt, mar.debt, t),
      cash_on_bs: lerp(dec.cash, mar.cash, t),
    };
  }
  const t = (monthIndex - 2) / 3;
  return {
    total_assets: lerp(mar.assets, jun.assets, t),
    total_liabilities: lerp(mar.liab, jun.liab, t),
    equity: lerp(mar.equity, jun.equity, t),
    current_assets: lerp(mar.ca, jun.ca, t),
    current_liabilities: lerp(mar.cl, jun.cl, t),
    interest_bearing_debt: lerp(mar.debt, jun.debt, t),
    cash_on_bs: lerp(mar.cash, jun.cash, t),
  };
}

function monthlyRows(
  orgId: string,
  legal: string,
  scope: HistoryStatement["report_scope"],
  flows: FlowShare[],
  dec: Parameters<typeof monthlyStock>[0],
  mar: Parameters<typeof monthlyStock>[1],
  jun: Parameters<typeof monthlyStock>[2],
): HistoryStatement[] {
  return flows.map((f, i) => {
    const stock = monthlyStock(dec, mar, jun, i);
    return stmt({
      id: `FS-${orgId}-${MONTH_ENDS_2026H1[i].replace(/-/g, "")}`,
      org_id: orgId,
      legal_entity_id: legal,
      period_start: MONTH_START[i],
      period_end: MONTH_ENDS_2026H1[i],
      as_of: MONTH_ENDS_2026H1[i],
      report_scope: scope,
      revenue: f.revenue,
      operating_profit: f.operating_profit,
      operating_cf: f.operating_cf,
      net_profit: null,
      equity_begin: null,
      ...stock,
    });
  });
}

/** 总部合并：月度发生额合计 = 2026H1；3月/6月末与 Q1/H1 期末一致。 */
const HQ_FLOWS: FlowShare[] = [
  { revenue: 12800, operating_profit: 980, operating_cf: 680 },
  { revenue: 12200, operating_profit: 1020, operating_cf: 720 },
  { revenue: 14000, operating_profit: 1120, operating_cf: 800 },
  { revenue: 14800, operating_profit: 1180, operating_cf: 860 },
  { revenue: 13600, operating_profit: 1080, operating_cf: 820 },
  { revenue: 14600, operating_profit: 1180, operating_cf: 920 },
];

const A_FLOWS: FlowShare[] = [
  { revenue: 4800, operating_profit: 280, operating_cf: 210 },
  { revenue: 4700, operating_profit: 290, operating_cf: 220 },
  { revenue: 5200, operating_profit: 310, operating_cf: 240 },
  { revenue: 5400, operating_profit: 330, operating_cf: 250 },
  { revenue: 5300, operating_profit: 310, operating_cf: 240 },
  { revenue: 5600, operating_profit: 340, operating_cf: 260 },
];

const B_FLOWS: FlowShare[] = [
  { revenue: 3400, operating_profit: 300, operating_cf: 240 },
  { revenue: 3300, operating_profit: 310, operating_cf: 250 },
  { revenue: 3600, operating_profit: 330, operating_cf: 270 },
  { revenue: 3800, operating_profit: 350, operating_cf: 280 },
  { revenue: 3900, operating_profit: 340, operating_cf: 270 },
  { revenue: 4000, operating_profit: 350, operating_cf: 290 },
];

const C_FLOWS: FlowShare[] = [
  { revenue: 1700, operating_profit: 130, operating_cf: 90 },
  { revenue: 1650, operating_profit: 140, operating_cf: 95 },
  { revenue: 1850, operating_profit: 150, operating_cf: 100 },
  { revenue: 1900, operating_profit: 150, operating_cf: 105 },
  { revenue: 1900, operating_profit: 150, operating_cf: 100 },
  { revenue: 2000, operating_profit: 160, operating_cf: 110 },
];

export const FP_HISTORY_STATEMENTS: HistoryStatement[] = [
  ...monthlyRows(
    "ORG-HQ",
    "LE-HQ",
    "consolidated",
    HQ_FLOWS,
    { assets: 180000, liab: 99000, equity: 81000, ca: 52000, cl: 35000, debt: 27000, cash: 6600 },
    { assets: 182000, liab: 100500, equity: 81500, ca: 53000, cl: 35500, debt: 27800, cash: 6700 },
    { assets: 186000, liab: 102000, equity: 84000, ca: 54000, cl: 36000, debt: 28500, cash: 6800 },
  ),
  ...monthlyRows(
    "ORG-A",
    "LE-A",
    "standalone",
    A_FLOWS,
    { assets: 62000, liab: 34500, equity: 27500, ca: 18200, cl: 12100, debt: 11500, cash: 4800 },
    { assets: 62800, liab: 34700, equity: 28100, ca: 18600, cl: 12300, debt: 11700, cash: 4920 },
    { assets: 64000, liab: 35000, equity: 29000, ca: 19000, cl: 12500, debt: 12000, cash: 5080 },
  ),
  ...monthlyRows(
    "ORG-B",
    "LE-B",
    "standalone",
    B_FLOWS,
    { assets: 40800, liab: 18000, equity: 22800, ca: 13600, cl: 8700, debt: 7600, cash: 1400 },
    { assets: 41300, liab: 18000, equity: 23300, ca: 13800, cl: 8850, debt: 7800, cash: 1440 },
    { assets: 42000, liab: 18000, equity: 24000, ca: 14000, cl: 9000, debt: 8000, cash: 1480 },
  ),
  ...monthlyRows(
    "ORG-C",
    "LE-C",
    "standalone",
    C_FLOWS,
    { assets: 20400, liab: 8700, equity: 11700, ca: 6700, cl: 3850, debt: 2400, cash: 380 },
    { assets: 20700, liab: 8850, equity: 11850, ca: 6850, cl: 3920, debt: 2450, cash: 390 },
    { assets: 21000, liab: 9000, equity: 12000, ca: 7000, cl: 4000, debt: 2500, cash: 400 },
  ),
  stmt({
    id: "FS-HQ-CONS-2026Q2",
    org_id: "ORG-HQ",
    legal_entity_id: "LE-HQ",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    as_of: "2026-06-30",
    report_scope: "consolidated",
    revenue: 43000,
    operating_profit: 3440,
    total_assets: 186000,
    total_liabilities: 102000,
    equity: 84000,
    current_assets: 54000,
    current_liabilities: 36000,
    operating_cf: 2600,
    interest_bearing_debt: 28500,
    cash_on_bs: 6800,
    net_profit: 2580,
    equity_begin: 81500,
  }),
  stmt({
    id: "FS-HQ-CONS-2025Q3",
    org_id: "ORG-HQ",
    legal_entity_id: "LE-HQ",
    period_start: "2025-07-01",
    period_end: "2025-09-30",
    as_of: "2025-09-30",
    report_scope: "consolidated",
    revenue: 39000,
    operating_profit: 3100,
    total_assets: 178000,
    total_liabilities: 98500,
    equity: 79500,
    current_assets: 51000,
    current_liabilities: 34500,
    operating_cf: 2200,
    interest_bearing_debt: 26500,
    cash_on_bs: 6500,
    net_profit: 2300,
    equity_begin: 78000,
  }),
  stmt({
    id: "FS-HQ-CONS-2025Q4",
    org_id: "ORG-HQ",
    legal_entity_id: "LE-HQ",
    period_start: "2025-10-01",
    period_end: "2025-12-31",
    as_of: "2025-12-31",
    report_scope: "consolidated",
    revenue: 41000,
    operating_profit: 3300,
    total_assets: 180000,
    total_liabilities: 99000,
    equity: 81000,
    current_assets: 52000,
    current_liabilities: 35000,
    operating_cf: 2400,
    interest_bearing_debt: 27000,
    cash_on_bs: 6600,
    net_profit: 2500,
    equity_begin: 79500,
  }),
  stmt({
    id: "FS-A-2026Q1",
    org_id: "ORG-A",
    legal_entity_id: "LE-A",
    period_start: "2026-01-01",
    period_end: "2026-03-31",
    as_of: "2026-03-31",
    report_scope: "standalone",
    revenue: 14700,
    operating_profit: 880,
    total_assets: 62800,
    total_liabilities: 34700,
    equity: 28100,
    current_assets: 18600,
    current_liabilities: 12300,
    operating_cf: 670,
    interest_bearing_debt: 11700,
    cash_on_bs: 4920,
    net_profit: 660,
    equity_begin: 27500,
  }),
  stmt({
    id: "FS-A-2026Q2",
    org_id: "ORG-A",
    legal_entity_id: "LE-A",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    as_of: "2026-06-30",
    report_scope: "standalone",
    revenue: 16300,
    operating_profit: 980,
    total_assets: 64000,
    total_liabilities: 35000,
    equity: 29000,
    current_assets: 19000,
    current_liabilities: 12500,
    operating_cf: 750,
    interest_bearing_debt: 12000,
    cash_on_bs: 5080,
    net_profit: 735,
    equity_begin: 28100,
  }),
];

export interface AccountMonthEnd {
  as_of: string;
  account_id: string;
  closing_balance_native: number;
  restricted_balance_native: number;
}

/** 6 月末与现账户台账一致；其余月末为合成余额，不覆盖 2026-05-15。 */
export const FP_ACCOUNT_MONTH_ENDS: AccountMonthEnd[] = [
  { as_of: "2026-01-31", account_id: "ACC-A", closing_balance_native: 86000000, restricted_balance_native: 3000000 },
  { as_of: "2026-02-28", account_id: "ACC-A", closing_balance_native: 78000000, restricted_balance_native: 3000000 },
  { as_of: "2026-03-31", account_id: "ACC-A", closing_balance_native: 69000000, restricted_balance_native: 3000000 },
  { as_of: "2026-04-30", account_id: "ACC-A", closing_balance_native: 61000000, restricted_balance_native: 3000000 },
  { as_of: "2026-05-31", account_id: "ACC-A", closing_balance_native: 54500000, restricted_balance_native: 3000000 },
  { as_of: "2026-06-30", account_id: "ACC-A", closing_balance_native: 50800000, restricted_balance_native: 3000000 },
  { as_of: "2026-01-31", account_id: "ACC-B", closing_balance_native: 22000000, restricted_balance_native: 0 },
  { as_of: "2026-02-28", account_id: "ACC-B", closing_balance_native: 20500000, restricted_balance_native: 0 },
  { as_of: "2026-03-31", account_id: "ACC-B", closing_balance_native: 18800000, restricted_balance_native: 0 },
  { as_of: "2026-04-30", account_id: "ACC-B", closing_balance_native: 17200000, restricted_balance_native: 0 },
  { as_of: "2026-05-31", account_id: "ACC-B", closing_balance_native: 15800000, restricted_balance_native: 0 },
  { as_of: "2026-06-30", account_id: "ACC-B", closing_balance_native: 14800000, restricted_balance_native: 0 },
  { as_of: "2026-01-31", account_id: "ACC-USD", closing_balance_native: 92000, restricted_balance_native: 20000 },
  { as_of: "2026-02-28", account_id: "ACC-USD", closing_balance_native: 94000, restricted_balance_native: 20000 },
  { as_of: "2026-03-31", account_id: "ACC-USD", closing_balance_native: 96000, restricted_balance_native: 20000 },
  { as_of: "2026-04-30", account_id: "ACC-USD", closing_balance_native: 98000, restricted_balance_native: 20000 },
  { as_of: "2026-05-31", account_id: "ACC-USD", closing_balance_native: 99000, restricted_balance_native: 20000 },
  { as_of: "2026-06-30", account_id: "ACC-USD", closing_balance_native: 100000, restricted_balance_native: 20000 },
  { as_of: "2026-01-31", account_id: "ACC-SPEC", closing_balance_native: 7600000, restricted_balance_native: 7600000 },
  { as_of: "2026-02-28", account_id: "ACC-SPEC", closing_balance_native: 7000000, restricted_balance_native: 7000000 },
  { as_of: "2026-03-31", account_id: "ACC-SPEC", closing_balance_native: 6400000, restricted_balance_native: 6400000 },
  { as_of: "2026-04-30", account_id: "ACC-SPEC", closing_balance_native: 5800000, restricted_balance_native: 5800000 },
  { as_of: "2026-05-31", account_id: "ACC-SPEC", closing_balance_native: 5500000, restricted_balance_native: 5500000 },
  { as_of: "2026-06-30", account_id: "ACC-SPEC", closing_balance_native: 5200000, restricted_balance_native: 5200000 },
];

export function accountBalancesAt(account: Account, asOf: string): { closing: number; restricted: number } | null {
  if (asOf === account.balance_as_of) {
    return { closing: account.closing_balance_native, restricted: account.restricted_balance_native };
  }
  const row = FP_ACCOUNT_MONTH_ENDS.find((x) => x.account_id === account.id && x.as_of === asOf);
  if (!row) return null;
  return { closing: row.closing_balance_native, restricted: row.restricted_balance_native };
}

export interface CensusMonthSnap {
  as_of: string;
  N: number;
  C: number;
  P: number;
  T: number;
}

/** 法人户数可持平；在办事项按已确认事项进度变化。6 月末由实时统计覆盖。 */
export const FP_CENSUS_MONTH_ENDS: CensusMonthSnap[] = [
  { as_of: "2026-01-31", N: 10, C: 5, P: 1, T: 6 },
  { as_of: "2026-02-28", N: 10, C: 5, P: 1, T: 7 },
  { as_of: "2026-03-31", N: 10, C: 5, P: 1, T: 8 },
  { as_of: "2026-04-30", N: 10, C: 5, P: 1, T: 9 },
  { as_of: "2026-05-31", N: 10, C: 5, P: 1, T: 9 },
];

export function censusSnapAt(asOf: string): CensusMonthSnap | undefined {
  return FP_CENSUS_MONTH_ENDS.find((s) => s.as_of === asOf);
}

export interface AccountOpeningRecord {
  account_id: string;
  opened_on: string;
  approval_required: boolean;
  approval_on: string | null;
  evidence_complete: boolean;
  search_note: string;
}

export const FP_ACCOUNT_OPENINGS: AccountOpeningRecord[] = [
  {
    account_id: "ACC-A",
    opened_on: "2024-03-12",
    approval_required: true,
    approval_on: "2024-03-01",
    evidence_complete: true,
    search_note: "开户日前有有效批准，检索完整",
  },
  {
    account_id: "ACC-B",
    opened_on: "2025-06-08",
    approval_required: true,
    approval_on: null,
    evidence_complete: true,
    search_note: "银行确认与台账齐全，开户日前无有效批准",
  },
  {
    account_id: "ACC-USD",
    opened_on: "2025-01-20",
    approval_required: true,
    approval_on: null,
    evidence_complete: false,
    search_note: "缺开户日有效制度及完整审批检索结果，未评估",
  },
  {
    account_id: "ACC-SPEC",
    opened_on: "2026-01-08",
    approval_required: true,
    approval_on: "2026-01-05",
    evidence_complete: true,
    search_note: "专户开立批准与来源文件齐全",
  },
];

export interface NameLicenseRecord {
  matter_id: string;
  entity_id: string;
  registered_name: string;
  trade_name: string;
  auth_file: string | null;
  auth_until: string | null;
  exit_event_on: string | null;
  note: string;
}

export const FP_NAME_LICENSES: NameLicenseRecord[] = [
  {
    matter_id: "PTY-M011",
    entity_id: "LE-PART",
    registered_name: "参股设计公司",
    trade_name: "海工设计",
    auth_file: "字号授权〔2024〕3号",
    auth_until: "2026-03-31",
    exit_event_on: "2026-04-15",
    note: "合作终止后仍使用授权字号，待资料核查",
  },
  {
    matter_id: "PTY-M012",
    entity_id: "LE-A",
    registered_name: "二级单位A所属企业",
    trade_name: "海工A",
    auth_file: "字号授权〔2025〕1号",
    auth_until: "2027-12-31",
    exit_event_on: null,
    note: "授权有效，使用主体与文件一致",
  },
];
