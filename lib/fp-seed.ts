/**
 * FP 专项增量样例。追加到现有 seed，不改写 R07/R08 金额事实与办理记录。
 * 财务报表为合成报告，仅覆盖需演示的报告主体。
 */

import type {
  Account,
  BusinessLink,
  CaseAction,
  CashTransaction,
  Contract,
  Evidence,
  LegalEntity,
  LifecycleInstance,
  LifecycleTemplate,
  MonitoringRow,
  Obligation,
  OwnershipSnapshot,
  PropertyMatter,
  RiskCase,
  RiskContextLink,
  RuleEvaluation,
} from "./types";

export interface FinancialStatement {
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
  data_nature: string;
  missing_reason?: string;
}

export interface CoreBusinessResult {
  id: string;
  name: string;
  org_id: string;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  closed: boolean;
  operating_profit: number;
  comparable: boolean;
}

export interface LoanFacility {
  id: string;
  name: string;
  owner_org_id: string;
  legal_entity_id: string;
  direction: "external_borrow" | "internal_borrow";
  principal_wan: number;
  outstanding_wan: number;
  rate_pct: number;
  start_date: string;
  due_date: string;
  next_repay_date: string;
  next_repay_wan: number;
  unused_credit_wan: number;
  related_id?: string;
}

export interface GuaranteeFacility {
  id: string;
  name: string;
  owner_org_id: string;
  guarantor_id: string;
  beneficiary_id: string;
  kind: "loan_guarantee" | "performance_bond";
  amount_wan: number;
  start_date: string;
  end_date: string;
  released: boolean;
  engineering_contract_id?: string;
}

export interface LendingFacility {
  id: string;
  name: string;
  owner_org_id: string;
  lender_id: string;
  borrower_id: string;
  principal_wan: number;
  outstanding_wan: number;
  due_date: string;
  recovered_wan: number;
  purpose: string;
  related_borrow_id?: string;
}

export interface SpecialFund {
  id: string;
  name: string;
  owner_org_id: string;
  designated_account_id: string;
  received_wan: number;
  spent_wan: number;
  confirmed_balance_wan: number;
  purpose_catalog: string[];
  source_doc: string;
}

export interface SmePayable {
  id: string;
  name: string;
  owner_org_id: string;
  contract_id: string;
  supplier_id: string;
  sme_at_contract: boolean | null;
  start_event: string;
  start_date: string;
  contracted_days: number;
  due_date: string;
  undisputed_wan: number;
  paid_wan: number;
  disputed_wan: number;
}

export interface PaymentControl {
  transaction_id: string;
  approver_id: string;
  approver_limit_wan: number;
  authorized_entity_ids: string[];
  payee_account_before?: string;
  payee_account_after?: string;
  change_date?: string;
  independent_review_at?: string | null;
  executed_payee_account?: string;
}

export interface EntityControl {
  legal_entity_id: string;
  owner_org_id: string;
  class: "body" | "controlled" | "participating" | "unverified" | "external";
  wholly_owned: boolean;
  control_basis?: string;
  control_as_of: string;
  listed?: boolean;
}

export interface GovernanceRight {
  id: string;
  legal_entity_id: string;
  owner_org_id: string;
  charter_board_seats: number;
  appointed_seats: number;
  voting_pct: number;
  blocked: boolean;
  evidence_ids: string[];
  note: string;
}

export interface ValuationReport {
  id: string;
  matter_id: string;
  kind: "asset_appraisal" | "audit";
  issued_on: string;
  valid_until: string;
  used_on: string;
}

export interface PropertyEvent {
  id: string;
  matter_id: string;
  event_type: string;
  effective_date: string;
  filing_due: string | null;
  filed_on: string | null;
  registration_applicable: boolean;
}

export const FP_STATEMENTS: FinancialStatement[] = [
  {
    id: "FS-HQ-CONS-2026H1",
    org_id: "ORG-HQ",
    legal_entity_id: "LE-HQ",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    as_of: "2026-06-30",
    closed: true,
    report_scope: "consolidated",
    currency: "CNY",
    amount_unit: "万元",
    revenue: 82000,
    operating_profit: 6560,
    total_assets: 186000,
    total_liabilities: 102000,
    equity: 84000,
    current_assets: 54000,
    current_liabilities: 36000,
    operating_cf: 4800,
    interest_bearing_debt: 28500,
    cash_on_bs: 6800,
    data_nature: "synthetic_statement",
  },
  {
    id: "FS-HQ-CONS-2025H1",
    org_id: "ORG-HQ",
    legal_entity_id: "LE-HQ",
    period_start: "2025-01-01",
    period_end: "2025-06-30",
    as_of: "2025-06-30",
    closed: true,
    report_scope: "consolidated",
    currency: "CNY",
    amount_unit: "万元",
    revenue: 78000,
    operating_profit: 7020,
    total_assets: 176000,
    total_liabilities: 98000,
    equity: 78000,
    current_assets: 50000,
    current_liabilities: 34000,
    operating_cf: 5100,
    interest_bearing_debt: 26000,
    cash_on_bs: 6400,
    data_nature: "synthetic_statement",
  },
  {
    id: "FS-A-2026H1",
    org_id: "ORG-A",
    legal_entity_id: "LE-A",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    as_of: "2026-06-30",
    closed: true,
    report_scope: "standalone",
    currency: "CNY",
    amount_unit: "万元",
    revenue: 31000,
    operating_profit: 1860,
    total_assets: 64000,
    total_liabilities: 35000,
    equity: 29000,
    current_assets: 19000,
    current_liabilities: 12500,
    operating_cf: 1420,
    interest_bearing_debt: 12000,
    cash_on_bs: 5080,
    data_nature: "synthetic_statement",
  },
  {
    id: "FS-B-2026H1",
    org_id: "ORG-B",
    legal_entity_id: "LE-B",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    as_of: "2026-06-30",
    closed: true,
    report_scope: "standalone",
    currency: "CNY",
    amount_unit: "万元",
    revenue: 22000,
    operating_profit: 1980,
    total_assets: 42000,
    total_liabilities: 18000,
    equity: 24000,
    current_assets: 14000,
    current_liabilities: 9000,
    operating_cf: 1600,
    interest_bearing_debt: 8000,
    cash_on_bs: 1480,
    data_nature: "synthetic_statement",
  },
  {
    id: "FS-C-2026H1",
    org_id: "ORG-C",
    legal_entity_id: "LE-C",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    as_of: "2026-06-30",
    closed: true,
    report_scope: "standalone",
    currency: "CNY",
    amount_unit: "万元",
    revenue: 11000,
    operating_profit: 880,
    total_assets: 21000,
    total_liabilities: 9000,
    equity: 12000,
    current_assets: 7000,
    current_liabilities: 4000,
    operating_cf: 600,
    interest_bearing_debt: 2500,
    cash_on_bs: 400,
    data_nature: "synthetic_statement",
  },
];

export const FP_NO_REPORT = new Set(["ORG-A1", "ORG-OV", "ORG-HQ-SELF"]);

export const FP_SEGMENTS: CoreBusinessResult[] = [
  {
    id: "SEG-A-EPCI-2025Q4",
    name: "海洋工程总承包",
    org_id: "ORG-A",
    legal_entity_id: "LE-A",
    period_start: "2025-10-01",
    period_end: "2025-12-31",
    closed: true,
    operating_profit: -120,
    comparable: true,
  },
  {
    id: "SEG-A-EPCI-2026Q1",
    name: "海洋工程总承包",
    org_id: "ORG-A",
    legal_entity_id: "LE-A",
    period_start: "2026-01-01",
    period_end: "2026-03-31",
    closed: true,
    operating_profit: -180,
    comparable: true,
  },
  {
    id: "SEG-A-EPCI-2026Q2",
    name: "海洋工程总承包",
    org_id: "ORG-A",
    legal_entity_id: "LE-A",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    closed: true,
    operating_profit: -210,
    comparable: true,
  },
  {
    id: "SEG-B-FAB-2026Q1",
    name: "陆地建造",
    org_id: "ORG-B",
    legal_entity_id: "LE-B",
    period_start: "2026-01-01",
    period_end: "2026-03-31",
    closed: true,
    operating_profit: 420,
    comparable: true,
  },
  {
    id: "SEG-B-FAB-2026Q2",
    name: "陆地建造",
    org_id: "ORG-B",
    legal_entity_id: "LE-B",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    closed: true,
    operating_profit: 510,
    comparable: true,
  },
];

export const FP_LEGAL_ENTITIES: LegalEntity[] = [
  { id: "LE-CTRL", name: "海工控股装备公司", country: "中国", role: "investee" },
  { id: "LE-PART", name: "海工参股设计公司", country: "中国", role: "investee" },
  { id: "LE-MP", name: "双路径持股海工服务公司", country: "中国", role: "investee" },
  { id: "LE-U", name: "全资待核实控制企业", country: "中国", role: "investee" },
  { id: "LE-EXT", name: "外部交易对手丁", country: "中国", role: "counterparty" },
];

export const FP_CONTROLS: EntityControl[] = [
  { legal_entity_id: "LE-HQ", owner_org_id: "ORG-HQ", class: "body", wholly_owned: true, control_basis: "海油工程本体", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-A", owner_org_id: "ORG-A", class: "controlled", wholly_owned: true, control_basis: "章程及董事会席位", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-B", owner_org_id: "ORG-B", class: "controlled", wholly_owned: true, control_basis: "章程及董事会席位", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-C", owner_org_id: "ORG-C", class: "controlled", wholly_owned: true, control_basis: "章程及董事会席位", control_as_of: "2026-06-30" },
  { legal_entity_id: "JV002", owner_org_id: "ORG-B", class: "controlled", wholly_owned: true, control_basis: "全资+董事任免依据", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-CTRL", owner_org_id: "ORG-A", class: "controlled", wholly_owned: false, control_basis: "51%股权+董事会过半数席位", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-PART", owner_org_id: "ORG-C", class: "participating", wholly_owned: false, control_basis: "已确认不控制", control_as_of: "2026-06-30" },
  { legal_entity_id: "JV001", owner_org_id: "ORG-A1", class: "unverified", wholly_owned: false, control_basis: "仅有持股比例，控制结论未确认", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-MP", owner_org_id: "ORG-A", class: "unverified", wholly_owned: false, control_basis: "多路径持股，控制结论未确认", control_as_of: "2026-06-30" },
  { legal_entity_id: "LE-U", owner_org_id: "ORG-A", class: "unverified", wholly_owned: true, control_basis: "100%权益，控制结论未确认", control_as_of: "2026-06-30" },
];

export const FP_SNAPSHOTS: OwnershipSnapshot[] = [
  { id: "OWN-CTRL", investor_id: "LE-A", investee_id: "LE-CTRL", source_type: "批准及登记一致", pct: 51, effective_date: "2025-01-01", snapshot_date: "2026-06-30" },
  { id: "OWN-PART", investor_id: "LE-C", investee_id: "LE-PART", source_type: "批准及登记一致", pct: 18, effective_date: "2024-06-01", snapshot_date: "2026-06-30" },
  { id: "OWN-MP-A", investor_id: "LE-A", investee_id: "LE-MP", source_type: "工商登记快照", pct: 40, effective_date: "2025-03-01", snapshot_date: "2026-06-30" },
  { id: "OWN-MP-B", investor_id: "LE-B", investee_id: "LE-MP", source_type: "工商登记快照", pct: 30, effective_date: "2025-03-01", snapshot_date: "2026-06-30" },
  { id: "OWN-U", investor_id: "LE-A", investee_id: "LE-U", source_type: "批准及登记一致", pct: 100, effective_date: "2024-01-01", snapshot_date: "2026-06-30" },
];

export const FP_ACCOUNTS: Account[] = [
  {
    id: "ACC-SPEC",
    owner_org_id: "ORG-A",
    legal_entity_id: "LE-A",
    name: "二级单位A专项资金专户",
    currency: "CNY",
    opening_balance_native: 8000000,
    closing_balance_native: 5200000,
    restricted_balance_native: 5200000,
    fx_to_cny: 1,
    native_amount_unit: "元人民币",
    balance_as_of: "2026-06-30",
    opening_balance_date: "2026-01-01",
    restriction_basis: "专项〔2026〕12号，海洋工程技能提升专项专户，用途限培训/教材/实训设备，截至2026-06-30全部受限",
  },
  {
    id: "ACC-INT",
    owner_org_id: "ORG-HQ",
    legal_entity_id: "LE-HQ",
    name: "总部内部结算账户（不重复计银行余额）",
    currency: "CNY",
    opening_balance_native: 0,
    closing_balance_native: 0,
    restricted_balance_native: 0,
    fx_to_cny: 1,
    native_amount_unit: "元人民币",
    balance_as_of: "2026-06-30",
    opening_balance_date: "2026-01-01",
  },
];

export const FP_TX: CashTransaction[] = [
  {
    id: "P-FP-AUTH",
    project_id: null,
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 500,
    approved_amount: 500,
    date: "2026-06-18",
  },
  {
    id: "P-FP-AUTH-OK",
    project_id: null,
    account_id: "ACC-B",
    direction: "outflow",
    amount_wan_cny: 200,
    approved_amount: 200,
    date: "2026-06-16",
  },
  {
    id: "P-FP-ACCCHG",
    project_id: null,
    contract_id: "CT-FP-CHG",
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 260,
    approved_amount: 260,
    date: "2026-06-08",
  },
  {
    id: "P-FP-ACCCHG-OK",
    project_id: null,
    contract_id: "CT-FP-CHG-OK",
    account_id: "ACC-B",
    direction: "outflow",
    amount_wan_cny: 180,
    approved_amount: 180,
    date: "2026-06-20",
  },
  {
    id: "P-FP-SME",
    project_id: null,
    contract_id: "CT-SME-01",
    obligation_id: "OB-SME-01",
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 0,
    approved_amount: 90,
    date: "2026-06-30",
  },
  {
    id: "P-FP-SPEC",
    project_id: null,
    contract_id: "CT-SPEC-01",
    account_id: "ACC-SPEC",
    direction: "outflow",
    amount_wan_cny: 80,
    approved_amount: 80,
    date: "2026-05-20",
  },
  {
    id: "P-FP-SPEC-OK",
    project_id: null,
    contract_id: "CT-SPEC-01",
    account_id: "ACC-SPEC",
    direction: "outflow",
    amount_wan_cny: 120,
    approved_amount: 120,
    date: "2026-04-12",
  },
  {
    id: "R-PTY-XFER",
    project_id: null,
    contract_id: "CT-PTY-XFER",
    obligation_id: "OB-PTY-XFER",
    account_id: "ACC-A",
    direction: "inflow",
    amount_wan_cny: 480,
    date: "2026-06-05",
  },
  {
    id: "P-LEND-01",
    project_id: null,
    contract_id: "CT-LEND-01",
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 600,
    approved_amount: 600,
    date: "2025-12-15",
  },
];

export const FP_CONTRACTS: Contract[] = [
  { id: "CT-FP-CHG", project_id: null, counterparty_id: "VENDOR-01", kind: "采购付款", effective_amount_ex_vat: 260 },
  { id: "CT-FP-CHG-OK", project_id: null, counterparty_id: "VENDOR-01", kind: "采购付款", effective_amount_ex_vat: 180 },
  { id: "CT-SME-01", project_id: null, counterparty_id: "VENDOR-SME", kind: "中小企业采购", effective_amount_ex_vat: 90 },
  { id: "CT-SPEC-01", project_id: null, kind: "专项支出", effective_amount_ex_vat: 200 },
  { id: "CT-PTY-XFER", project_id: null, counterparty_id: "LE-EXT", kind: "产权转让价款", effective_amount_ex_vat: 800 },
  { id: "CT-LOAN-01", project_id: null, kind: "外部借款", effective_amount_ex_vat: 12000 },
  { id: "CT-LEND-01", project_id: null, counterparty_id: "JV001", kind: "资金出借", effective_amount_ex_vat: 600 },
  { id: "CT-GUAR-01", project_id: "ENG-P001", counterparty_id: "JV001", kind: "借款担保", effective_amount_ex_vat: 3000 },
  { id: "CT-BOND-01", project_id: "ENG-P001", kind: "履约保函", effective_amount_ex_vat: 1500 },
];

export const FP_OBLIGATIONS: Obligation[] = [
  {
    id: "OB-SME-01",
    project_id: "ENG-P001",
    contract_id: "CT-SME-01",
    kind: "中小企业账款",
    amount_due: 90,
    amount_received: 0,
    due_date: "2026-05-20",
  },
  {
    id: "SME-02",
    project_id: "FA-P003",
    contract_id: "CT-SME-MISS",
    kind: "中小企业账款",
    amount_due: 40,
    amount_received: 0,
    due_date: "2026-05-16",
  },
  {
    id: "OB-PTY-XFER",
    project_id: "EQ-P001",
    contract_id: "CT-PTY-XFER",
    kind: "转让价款",
    amount_due: 800,
    amount_received: 480,
    due_date: "2026-06-30",
  },
];

export const FP_CONTROLS_PAY: PaymentControl[] = [
  {
    transaction_id: "P-PAY001",
    approver_id: "USER-A-CASH",
    approver_limit_wan: 2000,
    authorized_entity_ids: ["LE-A"],
    executed_payee_account: "VENDOR-01-ACC",
  },
  {
    transaction_id: "P-FA001",
    approver_id: "USER-A-CASH",
    approver_limit_wan: 5000,
    authorized_entity_ids: ["LE-A"],
  },
  {
    transaction_id: "P-FP-AUTH",
    approver_id: "USER-A-CASH",
    approver_limit_wan: 300,
    authorized_entity_ids: ["LE-A"],
  },
  {
    transaction_id: "P-FP-AUTH-OK",
    approver_id: "USER-B-CASH",
    approver_limit_wan: 500,
    authorized_entity_ids: ["LE-B"],
  },
  {
    transaction_id: "P-FP-ACCCHG",
    approver_id: "USER-A-CASH",
    approver_limit_wan: 500,
    authorized_entity_ids: ["LE-A"],
    payee_account_before: "VENDOR-01-ACC",
    payee_account_after: "VENDOR-01-ACC-NEW",
    change_date: "2026-06-01",
    independent_review_at: null,
    executed_payee_account: "VENDOR-01-ACC-NEW",
  },
  {
    transaction_id: "P-FP-ACCCHG-OK",
    approver_id: "USER-B-CASH",
    approver_limit_wan: 500,
    authorized_entity_ids: ["LE-B"],
    payee_account_before: "VENDOR-01-ACC",
    payee_account_after: "VENDOR-01-ACC-B",
    change_date: "2026-06-10",
    independent_review_at: "2026-06-12",
    executed_payee_account: "VENDOR-01-ACC-B",
  },
];

export const FP_LOANS: LoanFacility[] = [
  {
    id: "LOAN-01",
    name: "单位A流动资金借款",
    owner_org_id: "ORG-A",
    legal_entity_id: "LE-A",
    direction: "external_borrow",
    principal_wan: 12000,
    outstanding_wan: 9000,
    rate_pct: 3.1,
    start_date: "2025-09-01",
    due_date: "2027-09-01",
    next_repay_date: "2026-07-15",
    next_repay_wan: 800,
    unused_credit_wan: 3000,
  },
  {
    id: "LOAN-INT-01",
    name: "单位B向总部内部借入",
    owner_org_id: "ORG-B",
    legal_entity_id: "LE-B",
    direction: "internal_borrow",
    principal_wan: 2000,
    outstanding_wan: 2000,
    rate_pct: 2.4,
    start_date: "2026-03-01",
    due_date: "2026-12-31",
    next_repay_date: "2026-09-30",
    next_repay_wan: 2000,
    unused_credit_wan: 0,
    related_id: "LEND-INT-01",
  },
];

export const FP_LENDS: LendingFacility[] = [
  {
    id: "LEND-01",
    name: "单位A向被投企业A出借",
    owner_org_id: "ORG-A",
    lender_id: "LE-A",
    borrower_id: "JV001",
    principal_wan: 600,
    outstanding_wan: 600,
    due_date: "2026-05-31",
    recovered_wan: 0,
    purpose: "补充流动资金",
  },
  {
    id: "LEND-INT-01",
    name: "总部向单位B内部拆出",
    owner_org_id: "ORG-HQ",
    lender_id: "LE-HQ",
    borrower_id: "LE-B",
    principal_wan: 2000,
    outstanding_wan: 2000,
    due_date: "2026-12-31",
    recovered_wan: 0,
    purpose: "内部资金池拆借",
    related_borrow_id: "LOAN-INT-01",
  },
];

export const FP_GUARANTEES: GuaranteeFacility[] = [
  {
    id: "GUAR-01",
    name: "为被投企业A借款提供担保",
    owner_org_id: "ORG-A",
    guarantor_id: "LE-A",
    beneficiary_id: "JV001",
    kind: "loan_guarantee",
    amount_wan: 3000,
    start_date: "2025-10-01",
    end_date: "2027-10-01",
    released: false,
  },
  {
    id: "BOND-01",
    name: "ENG-P001履约保函",
    owner_org_id: "ORG-OV",
    guarantor_id: "LE-A",
    beneficiary_id: "CUSTOMER-01",
    kind: "performance_bond",
    amount_wan: 1500,
    start_date: "2026-01-15",
    end_date: "2026-12-31",
    released: false,
    engineering_contract_id: "SC001",
  },
];

export const FP_SPECIALS: SpecialFund[] = [
  {
    id: "SPEC-01",
    name: "海洋工程技能提升专项",
    owner_org_id: "ORG-A",
    designated_account_id: "ACC-SPEC",
    received_wan: 800,
    spent_wan: 200,
    confirmed_balance_wan: 520,
    purpose_catalog: ["培训", "教材", "实训设备"],
    source_doc: "专项〔2026〕12号",
  },
];

export const FP_SME: SmePayable[] = [
  {
    id: "SME-01",
    name: "中小企业分包进度款",
    owner_org_id: "ORG-A",
    contract_id: "CT-SME-01",
    supplier_id: "VENDOR-SME",
    sme_at_contract: true,
    start_event: "验收合格",
    start_date: "2026-03-21",
    contracted_days: 60,
    due_date: "2026-05-20",
    undisputed_wan: 90,
    paid_wan: 0,
    disputed_wan: 0,
  },
  {
    id: "SME-02",
    name: "缺企业规模未评估账款",
    owner_org_id: "ORG-B",
    contract_id: "CT-SME-MISS",
    supplier_id: "VENDOR-01",
    sme_at_contract: null,
    start_event: "交付",
    start_date: "2026-04-01",
    contracted_days: 45,
    due_date: "2026-05-16",
    undisputed_wan: 40,
    paid_wan: 0,
    disputed_wan: 0,
  },
];

export const FP_MATTERS: PropertyMatter[] = [
  {
    id: "PTY-M002",
    name: "被投企业A部分股权协议转让",
    matter_type: "产权转让",
    owner_org_id: "ORG-A",
    investor_id: "LE-A",
    investee_id: "JV001",
    related_project_id: "EQ-P001",
    template_id: "PR-TRANSFER-TEMPLATE-V12",
    current_phase_id: "PR-TRANSFER-V12-06",
    snapshot_ids: ["OWN-01A", "OWN-01B", "OWN-01C"],
    risk_ids: [],
    note: "有价款；结算交割可关联资金收款 R-PTY-XFER",
    data_nature: "simulated",
  },
  {
    id: "PTY-M003",
    name: "单位B所属企业无偿划转",
    matter_type: "无偿划转",
    owner_org_id: "ORG-B",
    investor_id: "LE-B",
    investee_id: "JV002",
    related_project_id: "EQ-P002",
    template_id: "PR-FREE-TEMPLATE-V12",
    current_phase_id: "PR-FREE-V12-05",
    snapshot_ids: ["OWN-02"],
    risk_ids: [],
    note: "无价款，不生成价款未收逾期",
    data_nature: "simulated",
  },
  {
    id: "PTY-M004",
    name: "控股装备公司增资",
    matter_type: "企业增资",
    owner_org_id: "ORG-A",
    investor_id: "LE-A",
    investee_id: "LE-CTRL",
    related_project_id: "EQ-P001",
    template_id: "PR-CAPITAL-TEMPLATE-V12",
    current_phase_id: "PR-CAPITAL-V12-06",
    snapshot_ids: ["OWN-CTRL"],
    risk_ids: [],
    note: "关注出资与稀释",
    data_nature: "simulated",
  },
  {
    id: "PTY-M005",
    name: "单位C闲置设备资产转让",
    matter_type: "资产转让",
    owner_org_id: "ORG-C",
    investor_id: "LE-C",
    investee_id: "LE-C",
    related_project_id: "",
    template_id: "PR-ASSET-TEMPLATE-V16",
    current_phase_id: "PR-ASSET-V16-04",
    snapshot_ids: [],
    risk_ids: [],
    note: "普通资产转让，不产生法人股权变更登记义务",
    data_nature: "simulated",
  },
  {
    id: "PTY-M006",
    name: "参股设计公司上市股份减持方案",
    matter_type: "上市股份",
    owner_org_id: "ORG-C",
    investor_id: "LE-C",
    investee_id: "LE-PART",
    related_project_id: "",
    template_id: "PR-LISTED-TEMPLATE-V16",
    current_phase_id: "PR-LISTED-V16-03",
    snapshot_ids: ["OWN-PART"],
    risk_ids: [],
    note: "使用上市股份模板，不套非上市挂牌",
    data_nature: "simulated",
  },
  {
    id: "PTY-M007",
    name: "超授权转让控股装备公司股权",
    matter_type: "产权转让",
    owner_org_id: "ORG-A",
    investor_id: "LE-A",
    investee_id: "LE-CTRL",
    related_project_id: "",
    template_id: "PR-TRANSFER-TEMPLATE-V12",
    current_phase_id: "PR-TRANSFER-V12-01",
    snapshot_ids: ["OWN-CTRL"],
    risk_ids: ["R-FP-006"],
    note: "交易规模超过授权权限边界样例",
    data_nature: "simulated",
  },
  {
    id: "PTY-M008",
    name: "评估报告超有效期仍用于定价",
    matter_type: "产权转让",
    owner_org_id: "ORG-B",
    investor_id: "LE-B",
    investee_id: "JV002",
    related_project_id: "",
    template_id: "PR-TRANSFER-TEMPLATE-V12",
    current_phase_id: "PR-TRANSFER-V12-03",
    snapshot_ids: ["OWN-02"],
    risk_ids: ["R-FP-035P"],
    note: "报告超有效使用期限",
    data_nature: "simulated",
  },
  {
    id: "PTY-M009",
    name: "双路径公司股东变更应登记未办",
    matter_type: "产权登记",
    owner_org_id: "ORG-A",
    investor_id: "LE-A",
    investee_id: "LE-MP",
    related_project_id: "",
    template_id: "PR-REG-TEMPLATE-V12",
    current_phase_id: "PR-REG-V12-03",
    snapshot_ids: ["OWN-MP-A", "OWN-MP-B"],
    risk_ids: ["R-FP-028"],
    note: "已确认应办变动登记且逾期；与JV001台账55%来源差异分开",
    data_nature: "simulated",
  },
  {
    id: "PTY-M010",
    name: "控股装备公司治理权利履职核查",
    matter_type: "股权与控制权",
    owner_org_id: "ORG-A",
    investor_id: "LE-A",
    investee_id: "LE-CTRL",
    related_project_id: "",
    template_id: "PR-CTRL-TEMPLATE-V16",
    current_phase_id: "PR-CTRL-V16-02",
    snapshot_ids: ["OWN-CTRL"],
    risk_ids: ["R-FP-032"],
    note: "专业核查：章程董事席位与实派不一致",
    data_nature: "simulated",
  },
];

export const FP_EVENTS: PropertyEvent[] = [
  {
    id: "PE-MP-01",
    matter_id: "PTY-M009",
    event_type: "股东变更",
    effective_date: "2026-03-01",
    filing_due: "2026-03-31",
    filed_on: null,
    registration_applicable: true,
  },
  {
    id: "PE-JV-LEDGER",
    matter_id: "PTY-M001",
    event_type: "来源核对",
    effective_date: "2026-01-01",
    filing_due: null,
    filed_on: "2026-01-15",
    registration_applicable: false,
  },
];

export const FP_REPORTS: ValuationReport[] = [
  {
    id: "VR-008",
    matter_id: "PTY-M008",
    kind: "asset_appraisal",
    issued_on: "2024-12-01",
    valid_until: "2025-12-01",
    used_on: "2026-04-10",
  },
  {
    id: "VR-002",
    matter_id: "PTY-M002",
    kind: "asset_appraisal",
    issued_on: "2026-02-01",
    valid_until: "2027-02-01",
    used_on: "2026-03-15",
  },
];

export const FP_GOVERNANCE: GovernanceRight[] = [
  {
    id: "GOV-CTRL",
    legal_entity_id: "LE-CTRL",
    owner_org_id: "ORG-A",
    charter_board_seats: 5,
    appointed_seats: 2,
    voting_pct: 51,
    blocked: true,
    evidence_ids: ["EVID-FP-032"],
    note: "章程应派5席中的3席，实际到任2席，重大事项表决连续两期缺席",
  },
];

export const FP_TEMPLATES: LifecycleTemplate[] = [
  {
    id: "PR-ASSET-TEMPLATE-V16",
    domain: "RIGHTS",
    matter_type: "ASSET",
    matter_type_name: "资产转让",
    phase_nodes: [
      { id: "PR-ASSET-V16-01", name: "方案及权限核验", display_order: 1 },
      { id: "PR-ASSET-V16-02", name: "决策审批", display_order: 2 },
      { id: "PR-ASSET-V16-03", name: "交易实施", display_order: 3 },
      { id: "PR-ASSET-V16-04", name: "签约结算与交割", display_order: 4 },
      { id: "PR-ASSET-V16-05", name: "归档跟踪", display_order: 5 },
    ],
    default_object_type: "property_matter",
    execution_note: "按资产制度核验交易方式和定价；不一定产生法人股权变更或国家出资企业产权登记。",
  },
  {
    id: "PR-LISTED-TEMPLATE-V16",
    domain: "RIGHTS",
    matter_type: "LISTED",
    matter_type_name: "上市公司股份",
    phase_nodes: [
      { id: "PR-LISTED-V16-01", name: "方案及权限核验", display_order: 1 },
      { id: "PR-LISTED-V16-02", name: "决策审批", display_order: 2 },
      { id: "PR-LISTED-V16-03", name: "证券监管路径", display_order: 3 },
      { id: "PR-LISTED-V16-04", name: "交易实施", display_order: 4 },
      { id: "PR-LISTED-V16-05", name: "结算交割", display_order: 5 },
      { id: "PR-LISTED-V16-06", name: "信息披露及归档", display_order: 6 },
    ],
    default_object_type: "property_matter",
    execution_note: "上市股份业务路由，不套非上市企业产权交易所挂牌模板。",
  },
  {
    id: "PR-CTRL-TEMPLATE-V16",
    domain: "RIGHTS",
    matter_type: "CONTROL",
    matter_type_name: "股权与控制权",
    phase_nodes: [
      { id: "PR-CTRL-V16-01", name: "治理安排", display_order: 1 },
      { id: "PR-CTRL-V16-02", name: "实际履职证据", display_order: 2 },
      { id: "PR-CTRL-V16-03", name: "差异核查", display_order: 3 },
      { id: "PR-CTRL-V16-04", name: "处置跟踪", display_order: 4 },
    ],
    default_object_type: "property_matter",
    execution_note: "按专题展示，不包装为所有企业必经行政流程。",
  },
];

function stage(id: string, objectId: string, templateId: string, phaseId: string, status: LifecycleInstance["business_status"], extra?: Partial<LifecycleInstance>): LifecycleInstance {
  return {
    id,
    object_id: objectId,
    template_id: templateId,
    phase_id: phaseId,
    business_status: status,
    approved_plan_start: "2026-01-01",
    approved_plan_end: "2026-12-31",
    actual_start: status === "not_started" || status === "not_applicable" ? null : "2026-02-01",
    actual_end: status === "completed" ? "2026-05-01" : null,
    forecast_end: status === "completed" ? "2026-05-01" : "2026-09-30",
    plan_version: "V1",
    evidence_ids: [],
    data_nature: "simulated",
    ...extra,
  };
}

export const FP_STAGES: LifecycleInstance[] = [
  stage("ST-M002-01", "PTY-M002", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-01", "completed"),
  stage("ST-M002-02", "PTY-M002", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-02", "completed"),
  stage("ST-M002-03", "PTY-M002", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-03", "completed"),
  stage("ST-M002-04", "PTY-M002", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-04", "completed"),
  stage("ST-M002-05", "PTY-M002", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-05", "completed"),
  stage("ST-M002-06", "PTY-M002", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-06", "in_progress"),
  stage("ST-M003-01", "PTY-M003", "PR-FREE-TEMPLATE-V12", "PR-FREE-V12-01", "completed"),
  stage("ST-M003-02", "PTY-M003", "PR-FREE-TEMPLATE-V12", "PR-FREE-V12-04", "completed"),
  stage("ST-M003-03", "PTY-M003", "PR-FREE-TEMPLATE-V12", "PR-FREE-V12-05", "in_progress"),
  stage("ST-M003-NA", "PTY-M003", "PR-FREE-TEMPLATE-V12", "PR-FREE-V12-03", "not_applicable", {
    evidence_ids: ["EVID-FP-FREE-NA"],
  }),
  stage("ST-M007-01", "PTY-M007", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-01", "in_progress"),
  stage("ST-M008-03", "PTY-M008", "PR-TRANSFER-TEMPLATE-V12", "PR-TRANSFER-V12-03", "in_progress"),
  stage("ST-M009-03", "PTY-M009", "PR-REG-TEMPLATE-V12", "PR-REG-V12-03", "in_progress"),
  stage("ST-M010-02", "PTY-M010", "PR-CTRL-TEMPLATE-V16", "PR-CTRL-V16-02", "in_progress"),
];

export const FP_EVIDENCE: Evidence[] = [
  { id: "EVID-FP-039", title: "P-PAY001 银行回单与批准单", data_nature: "simulated", source_type: "银行回单", recorded_at: "2026-06-12", body: "实付1200万元，该笔有效批准800万元，合同可支付上限2000万元。超批准400万元，未超业务上限。" },
  { id: "EVID-FP-037", title: "付款批准权限矩阵", data_nature: "simulated", source_type: "授权矩阵", recorded_at: "2026-06-18", body: "批准人当日有效金额权限300万元，本笔批准金额500万元。" },
  { id: "EVID-FP-024", title: "收款账户变更记录", data_nature: "simulated", source_type: "主数据", recorded_at: "2026-06-08", body: "2026-06-01变更收款账户，首次付款2026-06-08，独立核验记录缺失。" },
  { id: "EVID-FP-033", title: "中小企业合同付款条款", data_nature: "simulated", source_type: "合同", recorded_at: "2026-05-21", body: "验收合格日起60日付款。验收日2026-03-21，到期日2026-05-20。不以发票日+60日计算。" },
  { id: "EVID-FP-031", title: "专项支出用途对照", data_nature: "simulated", source_type: "专项台账", recorded_at: "2026-05-20", body: "允许目录：培训/教材/实训设备。该笔摘要为业务招待，无用途调整批准。" },
  { id: "EVID-FP-035", title: "核心业务分部利润", data_nature: "simulated", source_type: "管理报表", recorded_at: "2026-06-30", body: "海洋工程总承包连续三期已关账经营利润：-120、-180、-210万元。" },
  { id: "EVID-FP-006", title: "授权额度与拟转让规模", data_nature: "simulated", source_type: "授权文件", recorded_at: "2026-04-01", body: "单位授权转让上限持股变动10个百分点；本次拟转让15个百分点且无上收审批。" },
  { id: "EVID-FP-035P", title: "评估报告有效期", data_nature: "simulated", source_type: "评估报告", recorded_at: "2026-04-10", body: "报告有效使用至2025-12-01，实际用于定价时点2026-04-10。" },
  { id: "EVID-FP-028", title: "变动登记义务", data_nature: "simulated", source_type: "产权登记", recorded_at: "2026-04-01", body: "股东变更生效2026-03-01，应办期限30日，截至2026-06-30仍未申报。" },
  { id: "EVID-FP-032", title: "章程与董事到任对照", data_nature: "simulated", source_type: "治理材料", recorded_at: "2026-06-15", body: "章程约定控股股东委派3名董事，实际到任2名；不能仅凭51%股比认定已控权。" },
  { id: "EVID-FP-FREE-NA", title: "无偿划转不适用公开竞价", data_nature: "simulated", source_type: "划转批复", recorded_at: "2026-03-01", body: "无偿划转按批准文件实施，无价款，不适用公开挂牌及价款逾期规则。" },
];

function risk(partial: RiskCase): RiskCase {
  return partial;
}

export const FP_RISKS: RiskCase[] = [
  risk({
    id: "R-FP-037",
    title: "付款批准金额超过批准人权限200万元",
    primary_domain: "CASH",
    domains: ["CASH"],
    primary_object_id: "P-FP-AUTH",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-20",
    first_seen_at: "2026-06-18",
    last_seen_at: "2026-06-30",
    rule_id: "CASH2-R037",
    scenario_ids: ["CASH2-S037"],
    evidence_ids: ["EVID-FP-037"],
    data_nature: "simulated",
    responsible_role: "资金监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-024",
    title: "收款账户变更后未经独立核验即付款",
    primary_domain: "CASH",
    domains: ["CASH"],
    primary_object_id: "P-FP-ACCCHG",
    owner_org_id: "ORG-A",
    severity: "red",
    status: "pending_review",
    current_task_due_date: "2026-07-18",
    first_seen_at: "2026-06-08",
    last_seen_at: "2026-06-30",
    rule_id: "CASH2-R024",
    scenario_ids: ["CASH2-S024"],
    evidence_ids: ["EVID-FP-024"],
    data_nature: "simulated",
    responsible_role: "资金监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-033",
    title: "中小企业无争议到期账款90万元未付",
    primary_domain: "CASH",
    domains: ["CASH"],
    primary_object_id: "OB-SME-01",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-25",
    first_seen_at: "2026-05-21",
    last_seen_at: "2026-06-30",
    rule_id: "CASH2-R033",
    scenario_ids: ["CASH2-S033"],
    evidence_ids: ["EVID-FP-033"],
    data_nature: "simulated",
    responsible_role: "资金监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-031",
    title: "专项资金支出用途超出批准范围",
    primary_domain: "CASH",
    domains: ["CASH"],
    primary_object_id: "P-FP-SPEC",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-22",
    first_seen_at: "2026-05-20",
    last_seen_at: "2026-06-30",
    rule_id: "CASH2-R031",
    scenario_ids: ["CASH2-S031"],
    evidence_ids: ["EVID-FP-031"],
    data_nature: "simulated",
    responsible_role: "资金监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-035",
    title: "海洋工程总承包连续三期经营亏损",
    primary_domain: "CASH",
    domains: ["CASH"],
    primary_object_id: "SEG-A-EPCI-2026Q2",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-30",
    first_seen_at: "2026-06-30",
    last_seen_at: "2026-06-30",
    rule_id: "CASH2-R035",
    scenario_ids: ["CASH2-S035"],
    evidence_ids: ["EVID-FP-035"],
    data_nature: "simulated",
    responsible_role: "资金监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-006",
    title: "产权转让规模超过授权权限边界",
    primary_domain: "RIGHTS",
    domains: ["RIGHTS"],
    primary_object_id: "PTY-M007",
    owner_org_id: "ORG-A",
    severity: "red",
    status: "pending_review",
    current_task_due_date: "2026-07-15",
    first_seen_at: "2026-04-02",
    last_seen_at: "2026-06-30",
    rule_id: "PTY2-R006",
    scenario_ids: ["PTY2-S006"],
    evidence_ids: ["EVID-FP-006"],
    data_nature: "simulated",
    responsible_role: "产权监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-035P",
    title: "评估报告超过适用有效使用期限",
    primary_domain: "RIGHTS",
    domains: ["RIGHTS"],
    primary_object_id: "PTY-M008",
    owner_org_id: "ORG-B",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-12",
    first_seen_at: "2026-04-10",
    last_seen_at: "2026-06-30",
    rule_id: "PTY2-R035",
    scenario_ids: ["PTY2-S035"],
    evidence_ids: ["EVID-FP-035P"],
    data_nature: "simulated",
    responsible_role: "产权监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-028",
    title: "产权变动登记逾期未办理",
    primary_domain: "RIGHTS",
    domains: ["RIGHTS"],
    primary_object_id: "PTY-M009",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-08",
    first_seen_at: "2026-04-01",
    last_seen_at: "2026-06-30",
    rule_id: "PTY2-R028",
    scenario_ids: ["PTY2-S028"],
    evidence_ids: ["EVID-FP-028"],
    data_nature: "simulated",
    responsible_role: "产权监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
  risk({
    id: "R-FP-032",
    title: "控股权利未有效行使待专业核查",
    primary_domain: "RIGHTS",
    domains: ["RIGHTS"],
    primary_object_id: "LE-CTRL",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-28",
    first_seen_at: "2026-06-15",
    last_seen_at: "2026-06-30",
    rule_id: "PTY2-R032",
    scenario_ids: ["PTY2-S032"],
    evidence_ids: ["EVID-FP-032"],
    data_nature: "simulated",
    responsible_role: "产权监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  }),
];

export const FP_ACTIONS: CaseAction[] = [];

export const FP_LINKS: RiskContextLink[] = [
  { risk_id: "R07", domain: "CASH", primary_phase_id: null, topic_id: "CASH2-T-PAYMENT", phase_ids: [], associated_phase_ids: [] },
  { risk_id: "R-FP-037", domain: "CASH", primary_phase_id: null, topic_id: "CASH2-T-PAYMENT", phase_ids: [] },
  { risk_id: "R-FP-024", domain: "CASH", primary_phase_id: null, topic_id: "CASH2-T-PAYMENT", phase_ids: [] },
  { risk_id: "R-FP-033", domain: "CASH", primary_phase_id: null, topic_id: "CASH2-T-PAYMENT", phase_ids: [] },
  { risk_id: "R-FP-031", domain: "CASH", primary_phase_id: null, topic_id: "CASH2-T-SPECIAL", phase_ids: [] },
  { risk_id: "R-FP-035", domain: "CASH", primary_phase_id: null, topic_id: "CASH2-T-OPERATING", phase_ids: [] },
  { risk_id: "R-FP-006", domain: "RIGHTS", primary_phase_id: "PR-TRANSFER-V12-01", topic_id: "PTY2-T-TRADE", phase_ids: ["PR-TRANSFER-V12-01"] },
  { risk_id: "R-FP-035P", domain: "RIGHTS", primary_phase_id: "PR-TRANSFER-V12-03", topic_id: "PTY2-T-TRADE", phase_ids: ["PR-TRANSFER-V12-03"] },
  { risk_id: "R-FP-028", domain: "RIGHTS", primary_phase_id: "PR-REG-V12-03", topic_id: "PTY2-T-REG", phase_ids: ["PR-REG-V12-03"] },
  { risk_id: "R-FP-032", domain: "RIGHTS", primary_phase_id: "PR-CTRL-V16-02", topic_id: "PTY2-T-CONTROL", phase_ids: ["PR-CTRL-V16-02"] },
];

export const FP_BUSINESS_LINKS: BusinessLink[] = [
  { id: "BL-PTY-CASH-1", from_id: "PTY-M002", to_id: "R-PTY-XFER", relation_type: "transfer_proceeds", domains: ["RIGHTS", "CASH"], as_of: "2026-06-30", data_nature: "simulated", evidence_ids: [] },
  { id: "BL-PTY-CASH-2", from_id: "PTY-M002", to_id: "CT-PTY-XFER", relation_type: "transfer_contract", domains: ["RIGHTS", "CASH"], as_of: "2026-06-30", data_nature: "simulated" },
  { id: "BL-PTY-CASH-3", from_id: "PTY-M002", to_id: "OB-PTY-XFER", relation_type: "transfer_obligation", domains: ["RIGHTS", "CASH"], as_of: "2026-06-30", data_nature: "simulated" },
  { id: "BL-GUAR-PTY", from_id: "GUAR-01", to_id: "JV001", relation_type: "guarantee_of", domains: ["CASH", "RIGHTS"], as_of: "2026-06-30", data_nature: "simulated" },
  { id: "BL-GUAR-CT", from_id: "GUAR-01", to_id: "CT-GUAR-01", relation_type: "guarantee_contract", domains: ["CASH"], as_of: "2026-06-30", data_nature: "simulated" },
  { id: "BL-LEND-PTY", from_id: "LEND-01", to_id: "JV001", relation_type: "lending_to", domains: ["CASH", "RIGHTS"], as_of: "2026-06-30", data_nature: "simulated" },
  { id: "BL-M002-RET", from_id: "R-PTY-XFER", to_id: "PTY-M002", relation_type: "settles", domains: ["CASH", "RIGHTS"], as_of: "2026-06-05", data_nature: "simulated" },
  { id: "BL-PAY-ENG", from_id: "P-PAY001", to_id: "SC001", relation_type: "paid_under", domains: ["CASH", "ENG"], as_of: "2026-06-12", data_nature: "simulated" },
];

function mon(partial: Partial<MonitoringRow>): MonitoringRow {
  return {
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    snapshot_date: "2026-06-30",
    window_start: "2026-01-01",
    window_end: "2026-06-30",
    required: true,
    missing_data: [],
    note: "首批路径评估",
    data_nature: "simulated",
    rule_coverage: "fp_first_batch",
    stage_instance_id: null,
    scope_evidence_ids: [],
    scope_basis: "样例对象与规则评估证据明确关联",
    phase_id: null,
    subtopic_id: null,
    ...partial,
  } as MonitoringRow;
}

export const FP_COVERAGE: MonitoringRow[] = [
  mon({
    id: "FP-MON-S039-HIT",
    scenario_id: "CASH2-S039",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "P-PAY001",
    object_type: "cash_transaction",
    subject_object_id: "P-PAY001",
    owner_org_id: "ORG-OV",
    status: "evaluated_hit",
    rule_evaluation_ids: ["EVAL-P-PAY001-APPROVAL"],
    risk_ids: ["R07"],
    rule_ids: ["CASH-R01", "CASH2-R039"],
  }),
  mon({
    id: "FP-MON-S039-OK",
    scenario_id: "CASH2-S039",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "P-FA001",
    object_type: "cash_transaction",
    subject_object_id: "P-FA001",
    owner_org_id: "ORG-A1",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S039-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R039"],
  }),
  mon({
    id: "FP-MON-S037-HIT",
    scenario_id: "CASH2-S037",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "P-FP-AUTH",
    object_type: "cash_transaction",
    subject_object_id: "P-FP-AUTH",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S037-HIT"],
    risk_ids: ["R-FP-037"],
    rule_ids: ["CASH2-R037"],
  }),
  mon({
    id: "FP-MON-S037-OK",
    scenario_id: "CASH2-S037",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "P-FP-AUTH-OK",
    object_type: "cash_transaction",
    subject_object_id: "P-FP-AUTH-OK",
    owner_org_id: "ORG-B",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S037-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R037"],
  }),
  mon({
    id: "FP-MON-S024-HIT",
    scenario_id: "CASH2-S024",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "P-FP-ACCCHG",
    object_type: "cash_transaction",
    subject_object_id: "P-FP-ACCCHG",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S024-HIT"],
    risk_ids: ["R-FP-024"],
    rule_ids: ["CASH2-R024"],
  }),
  mon({
    id: "FP-MON-S024-OK",
    scenario_id: "CASH2-S024",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "P-FP-ACCCHG-OK",
    object_type: "cash_transaction",
    subject_object_id: "P-FP-ACCCHG-OK",
    owner_org_id: "ORG-B",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S024-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R024"],
  }),
  mon({
    id: "FP-MON-S033-HIT",
    scenario_id: "CASH2-S033",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "OB-SME-01",
    object_type: "obligation",
    subject_object_id: "OB-SME-01",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S033-HIT"],
    risk_ids: ["R-FP-033"],
    rule_ids: ["CASH2-R033"],
  }),
  mon({
    id: "FP-MON-S033-MISS",
    scenario_id: "CASH2-S033",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "SME-02",
    object_type: "obligation",
    subject_object_id: "SME-02",
    owner_org_id: "ORG-B",
    status: "data_insufficient",
    required: true,
    missing_data: ["合同订立时企业规模"],
    rule_evaluation_ids: [],
    risk_ids: [],
    rule_ids: ["CASH2-R033"],
  }),
  mon({
    id: "FP-MON-S031-HIT",
    scenario_id: "CASH2-S031",
    domain: "CASH",
    topic_id: "CASH2-T-SPECIAL",
    monitoring_object_id: "P-FP-SPEC",
    object_type: "cash_transaction",
    subject_object_id: "P-FP-SPEC",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S031-HIT"],
    risk_ids: ["R-FP-031"],
    rule_ids: ["CASH2-R031"],
  }),
  mon({
    id: "FP-MON-S031-OK",
    scenario_id: "CASH2-S031",
    domain: "CASH",
    topic_id: "CASH2-T-SPECIAL",
    monitoring_object_id: "P-FP-SPEC-OK",
    object_type: "cash_transaction",
    subject_object_id: "P-FP-SPEC-OK",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S031-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R031"],
  }),
  mon({
    id: "FP-MON-S035-HIT",
    scenario_id: "CASH2-S035",
    domain: "CASH",
    topic_id: "CASH2-T-OPERATING",
    monitoring_object_id: "SEG-A-EPCI-2026Q2",
    object_type: "legal_entity",
    subject_object_id: "LE-A",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S035-HIT"],
    risk_ids: ["R-FP-035"],
    rule_ids: ["CASH2-R035"],
  }),
  mon({
    id: "FP-MON-S035-OK",
    scenario_id: "CASH2-S035",
    domain: "CASH",
    topic_id: "CASH2-T-OPERATING",
    monitoring_object_id: "SEG-B-FAB-2026Q2",
    object_type: "legal_entity",
    subject_object_id: "LE-B",
    owner_org_id: "ORG-B",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S035-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R035"],
  }),
  mon({
    id: "FP-MON-S006-HIT",
    scenario_id: "PTY2-S006",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-01",
    monitoring_object_id: "PTY-M007",
    object_type: "property_matter",
    subject_object_id: "PTY-M007",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S006-HIT"],
    risk_ids: ["R-FP-006"],
    rule_ids: ["PTY2-R006"],
  }),
  mon({
    id: "FP-MON-S035P-HIT",
    scenario_id: "PTY2-S035",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-03",
    monitoring_object_id: "PTY-M008",
    object_type: "property_matter",
    subject_object_id: "PTY-M008",
    owner_org_id: "ORG-B",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S035P-HIT"],
    risk_ids: ["R-FP-035P"],
    rule_ids: ["PTY2-R035"],
  }),
  mon({
    id: "FP-MON-S035P-OK",
    scenario_id: "PTY2-S035",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-03",
    monitoring_object_id: "PTY-M002",
    object_type: "property_matter",
    subject_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S035P-OK"],
    risk_ids: [],
    rule_ids: ["PTY2-R035"],
  }),
  mon({
    id: "FP-MON-S028-HIT",
    scenario_id: "PTY2-S028",
    domain: "RIGHTS",
    topic_id: "PTY2-T-REG",
    phase_id: "PR-REG-V12-03",
    monitoring_object_id: "PTY-M009",
    object_type: "property_matter",
    subject_object_id: "PTY-M009",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S028-HIT"],
    risk_ids: ["R-FP-028"],
    rule_ids: ["PTY2-R028"],
  }),
  mon({
    id: "FP-MON-S028-NA",
    scenario_id: "PTY2-S028",
    domain: "RIGHTS",
    topic_id: "PTY2-T-REG",
    monitoring_object_id: "PTY-M001",
    object_type: "property_matter",
    subject_object_id: "PTY-M001",
    owner_org_id: "ORG-A1",
    status: "not_applicable",
    required: false,
    rule_evaluation_ids: [],
    risk_ids: [],
    rule_ids: ["PTY2-R028"],
    note: "来源差异不构成应登记未办",
  }),
  mon({
    id: "FP-MON-S032-REV",
    scenario_id: "PTY2-S032",
    domain: "RIGHTS",
    topic_id: "PTY2-T-CONTROL",
    phase_id: "PR-CTRL-V16-02",
    monitoring_object_id: "LE-CTRL",
    object_type: "legal_entity",
    subject_object_id: "LE-CTRL",
    owner_org_id: "ORG-A",
    status: "reference_only",
    rule_evaluation_ids: [],
    risk_ids: ["R-FP-032"],
    rule_ids: ["PTY2-R032"],
    note: "专业核查：已有材料与待记录结论",
  }),
];

function evalRow(partial: Partial<RuleEvaluation>): RuleEvaluation {
  return {
    evaluated_at: "2026-06-30",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    window_start: "2026-01-01",
    window_end: "2026-06-30",
    data_nature: "simulated",
    hit_validity: "current",
    generic_formula: partial.formula ?? "",
    formula_role: "first_batch",
    input_snapshot_note: "样例输入",
    input_bindings: [],
    ...partial,
  } as RuleEvaluation;
}

export const FP_EVALS: RuleEvaluation[] = [
  evalRow({
    id: "FP-EVAL-S039-OK",
    rule_id: "CASH2-R039",
    subject_object_id: "P-FA001",
    result: "clear",
    rule_version: "FP-R2-1",
    inputs: { actual: 4200, approved: 4200 },
    formula: "实付4200 ≤ 批准4200",
    risk_ids: [],
    evidence_ids: [],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S037-HIT",
    rule_id: "CASH2-R037",
    subject_object_id: "P-FP-AUTH",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { approved: 500, limit: 300 },
    formula: "批准金额500 > 权限300",
    risk_ids: ["R-FP-037"],
    evidence_ids: ["EVID-FP-037"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S037-OK",
    rule_id: "CASH2-R037",
    subject_object_id: "P-FP-AUTH-OK",
    result: "clear",
    rule_version: "FP-R2-1",
    inputs: { approved: 200, limit: 500 },
    formula: "批准金额200 ≤ 权限500",
    risk_ids: [],
    evidence_ids: [],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S024-HIT",
    rule_id: "CASH2-R024",
    subject_object_id: "P-FP-ACCCHG",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { change: "2026-06-01", pay: "2026-06-08", review: null },
    formula: "变更后首次付款早于独立核验",
    risk_ids: ["R-FP-024"],
    evidence_ids: ["EVID-FP-024"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S024-OK",
    rule_id: "CASH2-R024",
    subject_object_id: "P-FP-ACCCHG-OK",
    result: "clear",
    rule_version: "FP-R2-1",
    inputs: { change: "2026-06-10", review: "2026-06-12", pay: "2026-06-20" },
    formula: "核验完成后再付款",
    risk_ids: [],
    evidence_ids: [],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S033-HIT",
    rule_id: "CASH2-R033",
    subject_object_id: "OB-SME-01",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { due: "2026-05-20", start: "2026-03-21", days: 60, unpaid: 90 },
    formula: "到期日=验收日+合同60日，无争议未付90>0",
    risk_ids: ["R-FP-033"],
    evidence_ids: ["EVID-FP-033"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S031-HIT",
    rule_id: "CASH2-R031",
    subject_object_id: "P-FP-SPEC",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { purpose: "业务招待", catalog: "培训/教材/实训设备" },
    formula: "用途不在批准目录且无调整批准",
    risk_ids: ["R-FP-031"],
    evidence_ids: ["EVID-FP-031"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S031-OK",
    rule_id: "CASH2-R031",
    subject_object_id: "P-FP-SPEC-OK",
    result: "clear",
    rule_version: "FP-R2-1",
    inputs: { purpose: "实训设备" },
    formula: "用途在批准目录内",
    risk_ids: [],
    evidence_ids: [],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S035-HIT",
    rule_id: "CASH2-R035",
    subject_object_id: "SEG-A-EPCI-2026Q2",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { n: 3, profits: [-120, -180, -210] },
    formula: "连续3个已关账可比期间经营利润<0",
    risk_ids: ["R-FP-035"],
    evidence_ids: ["EVID-FP-035"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S035-OK",
    rule_id: "CASH2-R035",
    subject_object_id: "SEG-B-FAB-2026Q2",
    result: "clear",
    rule_version: "FP-R2-1",
    inputs: { profits: [420, 510] },
    formula: "未达连续亏损条件",
    risk_ids: [],
    evidence_ids: [],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S006-HIT",
    rule_id: "PTY2-R006",
    subject_object_id: "PTY-M007",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { authorized_pp: 10, proposed_pp: 15 },
    formula: "拟转让15个百分点 > 授权10个百分点",
    risk_ids: ["R-FP-006"],
    evidence_ids: ["EVID-FP-006"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S035P-HIT",
    rule_id: "PTY2-R035",
    subject_object_id: "PTY-M008",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { valid_until: "2025-12-01", used_on: "2026-04-10" },
    formula: "使用时点晚于有效期",
    risk_ids: ["R-FP-035P"],
    evidence_ids: ["EVID-FP-035P"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S035P-OK",
    rule_id: "PTY2-R035",
    subject_object_id: "PTY-M002",
    result: "clear",
    rule_version: "FP-R2-1",
    inputs: { valid_until: "2027-02-01", used_on: "2026-03-15" },
    formula: "使用时点在有效期内",
    risk_ids: [],
    evidence_ids: [],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S028-HIT",
    rule_id: "PTY2-R028",
    subject_object_id: "PTY-M009",
    result: "hit",
    rule_version: "FP-R2-1",
    inputs: { effective: "2026-03-01", due: "2026-03-31", filed: null },
    formula: "应办期限届满仍未申报",
    risk_ids: ["R-FP-028"],
    evidence_ids: ["EVID-FP-028"],
    effective_result: "hit",
  }),
];
