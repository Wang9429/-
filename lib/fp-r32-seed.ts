/**
 * FP-20260917-R3.2 缺口样例：为 21 项一级场景补齐可执行对象、依据与评估。
 * 不改写 R07 / 1200-800-2000 / 7152-352 / 产权 60/60/55 既有事实。
 */

import type {
  CaseAction,
  CashTransaction,
  Evidence,
  MonitoringRow,
  PropertyMatter,
  RiskCase,
  RiskContextLink,
  RuleEvaluation,
} from "./types";

export interface BankConfirmation {
  id: string;
  legal_entity_id: string;
  owner_org_id: string;
  as_of: string;
  bank_account_nos: string[];
  ledger_account_nos: string[];
  closed_or_out_of_scope: string[];
  evidence_complete: boolean;
  note: string;
}

export const FP_BANK_CONFIRMATIONS: BankConfirmation[] = [
  {
    id: "BANK-LE-A",
    legal_entity_id: "LE-A",
    owner_org_id: "ORG-A",
    as_of: "2026-06-30",
    bank_account_nos: ["ACC-A"],
    ledger_account_nos: ["ACC-A"],
    closed_or_out_of_scope: [],
    evidence_complete: true,
    note: "银行确认清单与企业账户台账一致，未发现未登记存续账户。",
  },
  {
    id: "BANK-LE-B",
    legal_entity_id: "LE-B",
    owner_org_id: "ORG-B",
    as_of: "2026-06-30",
    bank_account_nos: ["ACC-B"],
    ledger_account_nos: ["ACC-B"],
    closed_or_out_of_scope: [],
    evidence_complete: true,
    note: "单位B银行确认账户已纳入台账。",
  },
];

export interface ExpenseVoucher {
  id: string;
  owner_org_id: string;
  voucher_no: string;
  claimable_wan: number;
  allocations: { payment_id: string; amount_wan: number; kind: "installment" | "split" | "duplicate" }[];
  reversals_wan: number;
  evidence_complete: boolean;
  note: string;
}

export const FP_VOUCHERS: ExpenseVoucher[] = [
  {
    id: "VCH-001",
    owner_org_id: "ORG-A",
    voucher_no: "FP-INV-2026-0418",
    claimable_wan: 80,
    allocations: [
      { payment_id: "P-VOUCH-A1", amount_wan: 50, kind: "split" },
      { payment_id: "P-VOUCH-A2", amount_wan: 30, kind: "split" },
    ],
    reversals_wan: 0,
    evidence_complete: true,
    note: "同一费用凭据合法分摊两笔，累计未超过可报金额。",
  },
];

export const FP_R32_TX: CashTransaction[] = [
  {
    id: "P-VOUCH-A1",
    project_id: "ENG-P001",
    contract_id: "CT-SME-01",
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 50,
    approved_amount: 50,
    date: "2026-04-20",
  },
  {
    id: "P-VOUCH-A2",
    project_id: "ENG-P001",
    contract_id: "CT-SME-01",
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 30,
    approved_amount: 30,
    date: "2026-05-18",
  },
  {
    id: "P-SAL-OK",
    project_id: null,
    contract_id: "CT-SAL-ADJ",
    account_id: "ACC-A",
    direction: "outflow",
    amount_wan_cny: 86,
    approved_amount: 86,
    date: "2026-04-15",
  },
];

export interface SalaryAdjustment {
  id: string;
  owner_org_id: string;
  legal_entity_id: string;
  scheme_id: string;
  effective_on: string;
  approval_on: string | null;
  covered_scope: string;
  staff_codes: string[];
  before_std_wan: number;
  after_std_wan: number;
  payroll_batch_id: string;
  evidence_complete: boolean;
  note: string;
}

export const FP_SALARY_ADJS: SalaryAdjustment[] = [
  {
    id: "SAL-ADJ-OK",
    owner_org_id: "ORG-A",
    legal_entity_id: "LE-A",
    scheme_id: "薪调〔2026〕4号",
    effective_on: "2026-04-01",
    approval_on: "2026-03-18",
    covered_scope: "脱敏岗位 P-ENG-01～P-ENG-12",
    staff_codes: ["P-ENG-01", "P-ENG-07"],
    before_std_wan: 2.4,
    after_std_wan: 2.6,
    payroll_batch_id: "P-SAL-OK",
    evidence_complete: true,
    note: "批准早于生效日，覆盖主体与人员范围一致。",
  },
];

export interface DecisionTimeline {
  matter_id: string;
  behavior_id: string;
  resolution_on: string;
  approval_on: string;
  gate_node: string;
  gate_on: string;
  pre_disclosure_allowed: boolean;
  note: string;
}

export const FP_DECISION_TIMES: DecisionTimeline[] = [
  {
    matter_id: "PTY-M002",
    behavior_id: "nonlisted_transfer",
    resolution_on: "2026-01-20",
    approval_on: "2026-01-28",
    gate_node: "合同签署",
    gate_on: "2026-03-01",
    pre_disclosure_allowed: true,
    note: "决策与批准均早于该模板要求前置的合同签署节点。",
  },
  {
    matter_id: "PTY-M003",
    behavior_id: "free_transfer",
    resolution_on: "2026-02-01",
    approval_on: "2026-02-10",
    gate_node: "划转实施",
    gate_on: "2026-03-15",
    pre_disclosure_allowed: true,
    note: "无偿划转批准早于实施节点。",
  },
];

export interface AssetScopeItem {
  id: string;
  matter_id: string;
  asset_code: string;
  in_books: boolean;
  in_valuation_list: boolean;
  excluded_with_basis: boolean;
  note: string;
}

export const FP_ASSET_SCOPE: AssetScopeItem[] = [
  { id: "AS-M002-1", matter_id: "PTY-M002", asset_code: "FA-A-1101", in_books: true, in_valuation_list: true, excluded_with_basis: false, note: "账簿与评估清单一致" },
  { id: "AS-M002-2", matter_id: "PTY-M002", asset_code: "FA-A-1102", in_books: true, in_valuation_list: true, excluded_with_basis: false, note: "账簿与评估清单一致" },
  { id: "AS-M002-3", matter_id: "PTY-M002", asset_code: "FA-A-EXCL", in_books: true, in_valuation_list: false, excluded_with_basis: true, note: "合法剥离，评估范围调整〔2026〕2号" },
];

export interface RecusalRecord {
  matter_id: string;
  rule_basis: string;
  related_person_code: string;
  relation: string;
  declared: boolean;
  attended: boolean;
  voted: boolean;
  minutes_id: string;
  note: string;
}

export const FP_RECUSALS: RecusalRecord[] = [
  {
    matter_id: "PTY-M002",
    rule_basis: "回避制度〔2024〕7号",
    related_person_code: "DIR-A-03",
    relation: "受让方董事（已核实）",
    declared: true,
    attended: false,
    voted: false,
    minutes_id: "纪要〔2026〕1号",
    note: "应回避人员已申报并回避表决。",
  },
];

export interface PricingRecord {
  matter_id: string;
  behavior_id: string;
  listed: boolean;
  basis_kind: string;
  basis_wan: number;
  floor_wan: number;
  deal_wan: number;
  special_approval: string | null;
  note: string;
}

export const FP_PRICING: PricingRecord[] = [
  {
    matter_id: "PTY-M002",
    behavior_id: "nonlisted_transfer",
    listed: false,
    basis_kind: "备案评估结果",
    basis_wan: 800,
    floor_wan: 800,
    deal_wan: 800,
    special_approval: null,
    note: "成交价格等于已确认评估基准，未偏离该类行为定价约束。",
  },
];

export interface TransferProceed {
  matter_id: string;
  behavior_id: string;
  price_applicable: boolean;
  obligation_id: string;
  due_wan: number;
  received_wan: number;
  due_date: string;
  as_of: string;
  note: string;
}

export const FP_TRANSFER_PROCEEDS: TransferProceed[] = [
  {
    matter_id: "PTY-M002",
    behavior_id: "nonlisted_transfer",
    price_applicable: true,
    obligation_id: "OB-PTY-XFER",
    due_wan: 800,
    received_wan: 480,
    due_date: "2026-06-30",
    as_of: "2026-06-30",
    note: "同一转让合同价款 800 万元，已核实到账 480 万元，到期日应收未收 320 万元。",
  },
  {
    matter_id: "PTY-M003",
    behavior_id: "free_transfer",
    price_applicable: false,
    obligation_id: "",
    due_wan: 0,
    received_wan: 0,
    due_date: "",
    as_of: "2026-06-30",
    note: "无偿划转无价款，不适用到期价款核验。",
  },
];

export interface PermitRecord {
  id: string;
  matter_id: string;
  entity_id: string;
  owner_org_id: string;
  permit_no: string;
  kind: string;
  valid_from: string;
  valid_until: string;
  used_on: string;
  official_status: "valid" | "expired" | "unknown";
  renewal_on: string | null;
  note: string;
}

export const FP_PERMITS: PermitRecord[] = [
  {
    id: "PERM-A-OK",
    matter_id: "PTY-M012",
    entity_id: "LE-A",
    owner_org_id: "ORG-A",
    permit_no: "海工许〔2025〕18号",
    kind: "特种设备安装改造维修许可证",
    valid_from: "2025-01-01",
    valid_until: "2027-12-31",
    used_on: "2026-06-12",
    official_status: "valid",
    renewal_on: null,
    note: "权威核验有效，使用日在有效期内。",
  },
];

export const FP_R32_MATTERS: PropertyMatter[] = [];

function mon(partial: Partial<MonitoringRow>): MonitoringRow {
  return {
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    snapshot_date: "2026-06-30",
    window_start: "2026-01-01",
    window_end: "2026-06-30",
    required: true,
    missing_data: [],
    note: "R3.2 覆盖路径评估",
    data_nature: "simulated",
    rule_coverage: "fp_r32_coverage",
    stage_instance_id: null,
    scope_evidence_ids: [],
    scope_basis: "样例对象与规则评估证据明确关联",
    phase_id: null,
    subtopic_id: null,
    ...partial,
  } as MonitoringRow;
}

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
    formula_role: "r32_coverage",
    input_snapshot_note: "R3.2 覆盖样例输入",
    input_bindings: [],
    ...partial,
  } as RuleEvaluation;
}

export const FP_R32_EVIDENCE: Evidence[] = [
  { id: "EVID-FP-006C", title: "LE-A 银行确认账户清单", data_nature: "simulated", source_type: "银行确认", recorded_at: "2026-06-30", body: "基准日 2026-06-30，银行确认存续账号 ACC-A，与企业账户台账一致。销户及管理边界已排除。" },
  { id: "EVID-FP-017", title: "费用凭据 FP-INV-2026-0418 分摊与付款", data_nature: "simulated", source_type: "费用凭据", recorded_at: "2026-05-18", body: "可报 80 万元；分摊付款 50+30 万元，无红冲。累计未超过可报金额，不等于重复报销。" },
  { id: "EVID-FP-020", title: "薪酬标准调整批准", data_nature: "simulated", source_type: "人力资源批准", recorded_at: "2026-03-18", body: "薪调〔2026〕4号，批准 2026-03-18，生效 2026-04-01，覆盖脱敏岗位 P-ENG-01～12。调整后发放批次 P-SAL-OK。" },
  { id: "EVID-FP-003", title: "PTY-M002 决策批准与实施节点时间线", data_nature: "simulated", source_type: "决议及批准", recorded_at: "2026-03-01", body: "决议 2026-01-20，批准 2026-01-28，合同签署 2026-03-01。该模板要求合同签署前置决策审批；预披露依法可先行。" },
  { id: "EVID-FP-011", title: "PTY-M002 审计评估范围清单", data_nature: "simulated", source_type: "评估范围", recorded_at: "2026-03-12", body: "账簿资产 FA-A-1101/1102 均在评估清单；FA-A-EXCL 有合法剥离依据〔2026〕2号。差异须人工确认，不自动认定隐匿。" },
  { id: "EVID-FP-014", title: "PTY-M002 回避申报与表决记录", data_nature: "simulated", source_type: "会议纪要", recorded_at: "2026-01-20", body: "DIR-A-03 为已核实关联董事，已申报回避，签到未到、未参与表决。纪要〔2026〕1号。" },
  { id: "EVID-FP-016", title: "PTY-M002 非上市定价依据", data_nature: "simulated", source_type: "评估备案", recorded_at: "2026-03-15", body: "备案评估 800 万元，首次底价 800 万元，成交 800 万元。适用非上市产权转让定价条款，不套上市股份折价。" },
  { id: "EVID-FP-037P", title: "PTY-M002 转让价款到账", data_nature: "simulated", source_type: "资金到账", recorded_at: "2026-06-05", body: "合同 CT-PTY-XFER / 义务 OB-PTY-XFER：应收 800 万元，已核实到账 R-PTY-XFER 480 万元，到期日 2026-06-30 未收 320 万元。与资金域同一事项，不另造整改。" },
  { id: "EVID-FP-038", title: "LE-A 许可证件核验", data_nature: "simulated", source_type: "许可证件", recorded_at: "2026-06-12", body: "海工许〔2025〕18号特种设备许可，有效期至 2027-12-31。使用日 2026-06-12，官方核验有效。" },
];

export const FP_R32_RISKS: RiskCase[] = [
  {
    id: "R-FP-037P",
    title: "到期转让价款尚未足额收取（PTY-M002）",
    primary_domain: "RIGHTS",
    domains: ["RIGHTS", "CASH"],
    primary_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-18",
    first_seen_at: "2026-06-30",
    last_seen_at: "2026-06-30",
    rule_id: "PTY2-R037",
    scenario_ids: ["PTY2-S037"],
    evidence_ids: ["EVID-FP-037P"],
    data_nature: "simulated",
    responsible_role: "产权监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  },
  {
    id: "R-FP-011",
    title: "应纳入审计评估的资产范围待专业核查",
    primary_domain: "RIGHTS",
    domains: ["RIGHTS"],
    primary_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    severity: "yellow",
    status: "pending_review",
    current_task_due_date: "2026-07-22",
    first_seen_at: "2026-03-12",
    last_seen_at: "2026-06-30",
    rule_id: "PTY2-R011",
    scenario_ids: ["PTY2-S011"],
    evidence_ids: ["EVID-FP-011"],
    data_nature: "simulated",
    responsible_role: "产权监管人员",
    assignee_display_name: null,
    current_task_type: "investigation",
  },
];

export const FP_R32_LINKS: RiskContextLink[] = [
  { risk_id: "R-FP-037P", domain: "RIGHTS", primary_phase_id: "PR-TRANSFER-V12-05", topic_id: "PTY2-T-TRADE", phase_ids: ["PR-TRANSFER-V12-05"] },
  { risk_id: "R-FP-011", domain: "RIGHTS", primary_phase_id: "PR-TRANSFER-V12-03", topic_id: "PTY2-T-TRADE", phase_ids: ["PR-TRANSFER-V12-03"] },
];

export const FP_R32_ACTIONS: CaseAction[] = [];

export const FP_R32_COVERAGE: MonitoringRow[] = [
  mon({
    id: "FP-MON-S006C-OK",
    scenario_id: "CASH2-S006",
    domain: "CASH",
    topic_id: "CASH2-T-ACCOUNT",
    monitoring_object_id: "BANK-LE-A",
    object_type: "account",
    subject_object_id: "BANK-LE-A",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S006C-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R006"],
  }),
  mon({
    id: "FP-MON-S006C-B",
    scenario_id: "CASH2-S006",
    domain: "CASH",
    topic_id: "CASH2-T-ACCOUNT",
    monitoring_object_id: "BANK-LE-B",
    object_type: "account",
    subject_object_id: "BANK-LE-B",
    owner_org_id: "ORG-B",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S006C-B"],
    risk_ids: [],
    rule_ids: ["CASH2-R006"],
  }),
  mon({
    id: "FP-MON-S017-OK",
    scenario_id: "CASH2-S017",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "VCH-001",
    object_type: "cash_transaction",
    subject_object_id: "VCH-001",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S017-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R017"],
  }),
  mon({
    id: "FP-MON-S020-OK",
    scenario_id: "CASH2-S020",
    domain: "CASH",
    topic_id: "CASH2-T-PAYMENT",
    monitoring_object_id: "SAL-ADJ-OK",
    object_type: "cash_transaction",
    subject_object_id: "SAL-ADJ-OK",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S020-OK"],
    risk_ids: [],
    rule_ids: ["CASH2-R020"],
  }),
  mon({
    id: "FP-MON-S003-OK",
    scenario_id: "PTY2-S003",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-02",
    monitoring_object_id: "PTY-M002",
    object_type: "property_matter",
    subject_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S003-OK"],
    risk_ids: [],
    rule_ids: ["PTY2-R003"],
  }),
  mon({
    id: "FP-MON-S003-FREE",
    scenario_id: "PTY2-S003",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-FREE-V12-01",
    monitoring_object_id: "PTY-M003",
    object_type: "property_matter",
    subject_object_id: "PTY-M003",
    owner_org_id: "ORG-B",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S003-FREE"],
    risk_ids: [],
    rule_ids: ["PTY2-R003"],
  }),
  mon({
    id: "FP-MON-S011-REV",
    scenario_id: "PTY2-S011",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-03",
    monitoring_object_id: "PTY-M002",
    object_type: "property_matter",
    subject_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    status: "reference_only",
    rule_evaluation_ids: [],
    risk_ids: ["R-FP-011"],
    rule_ids: ["PTY2-R011"],
    note: "专业核查：已有资产范围材料与待记录结论",
  }),
  mon({
    id: "FP-MON-S014-OK",
    scenario_id: "PTY2-S014",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-02",
    monitoring_object_id: "PTY-M002",
    object_type: "property_matter",
    subject_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S014-OK"],
    risk_ids: [],
    rule_ids: ["PTY2-R014"],
  }),
  mon({
    id: "FP-MON-S016-OK",
    scenario_id: "PTY2-S016",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-04",
    monitoring_object_id: "PTY-M002",
    object_type: "property_matter",
    subject_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S016-OK"],
    risk_ids: [],
    rule_ids: ["PTY2-R016"],
  }),
  mon({
    id: "FP-MON-S037P-HIT",
    scenario_id: "PTY2-S037",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-TRANSFER-V12-05",
    monitoring_object_id: "PTY-M002",
    object_type: "property_matter",
    subject_object_id: "PTY-M002",
    owner_org_id: "ORG-A",
    status: "evaluated_hit",
    rule_evaluation_ids: ["FP-EVAL-S037P-HIT"],
    risk_ids: ["R-FP-037P"],
    rule_ids: ["PTY2-R037"],
  }),
  mon({
    id: "FP-MON-S037P-NA",
    scenario_id: "PTY2-S037",
    domain: "RIGHTS",
    topic_id: "PTY2-T-TRADE",
    phase_id: "PR-FREE-V12-05",
    monitoring_object_id: "PTY-M003",
    object_type: "property_matter",
    subject_object_id: "PTY-M003",
    owner_org_id: "ORG-B",
    status: "not_applicable",
    required: false,
    rule_evaluation_ids: [],
    risk_ids: [],
    rule_ids: ["PTY2-R037"],
    note: "无偿划转无价款，不适用",
  }),
  mon({
    id: "FP-MON-S038-OK",
    scenario_id: "PTY2-S038",
    domain: "RIGHTS",
    topic_id: "PTY2-T-IDENTITY",
    monitoring_object_id: "PTY-M012",
    object_type: "property_matter",
    subject_object_id: "PTY-M012",
    owner_org_id: "ORG-A",
    status: "evaluated_clear",
    rule_evaluation_ids: ["FP-EVAL-S038-OK"],
    risk_ids: [],
    rule_ids: ["PTY2-R038"],
  }),
];

export const FP_R32_EVALS: RuleEvaluation[] = [
  evalRow({
    id: "FP-EVAL-S006C-OK",
    rule_id: "CASH2-R006",
    subject_object_id: "BANK-LE-A",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { bank: ["ACC-A"], ledger: ["ACC-A"] },
    formula: "同主体同基准日银行确认账户与台账一致",
    risk_ids: [],
    evidence_ids: ["EVID-FP-006C"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S006C-B",
    rule_id: "CASH2-R006",
    subject_object_id: "BANK-LE-B",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { bank: ["ACC-B"], ledger: ["ACC-B"] },
    formula: "单位B银行确认账户已纳入台账",
    risk_ids: [],
    evidence_ids: ["EVID-FP-006C"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S017-OK",
    rule_id: "CASH2-R017",
    subject_object_id: "VCH-001",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { claimable: 80, paid: 80 },
    formula: "同一凭据有效累计报支 80 ≤ 可报 80，合法分摊",
    risk_ids: [],
    evidence_ids: ["EVID-FP-017"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S020-OK",
    rule_id: "CASH2-R020",
    subject_object_id: "SAL-ADJ-OK",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { approval_on: "2026-03-18", effective_on: "2026-04-01" },
    formula: "批准2026-03-18早于生效2026-04-01，范围覆盖",
    risk_ids: [],
    evidence_ids: ["EVID-FP-020"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S003-OK",
    rule_id: "PTY2-R003",
    subject_object_id: "PTY-M002",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { approval_on: "2026-01-28", gate_on: "2026-03-01" },
    formula: "批准早于合同签署实施节点",
    risk_ids: [],
    evidence_ids: ["EVID-FP-003"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S003-FREE",
    rule_id: "PTY2-R003",
    subject_object_id: "PTY-M003",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { approval_on: "2026-02-10", gate_on: "2026-03-15" },
    formula: "无偿划转批准早于实施节点",
    risk_ids: [],
    evidence_ids: ["EVID-FP-003"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S014-OK",
    rule_id: "PTY2-R014",
    subject_object_id: "PTY-M002",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { person: "DIR-A-03", voted: false },
    formula: "应回避人员已申报且未参与表决",
    risk_ids: [],
    evidence_ids: ["EVID-FP-014"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S016-OK",
    rule_id: "PTY2-R016",
    subject_object_id: "PTY-M002",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { basis_wan: 800, deal_wan: 800 },
    formula: "成交800等于已确认评估基准800",
    risk_ids: [],
    evidence_ids: ["EVID-FP-016"],
    effective_result: "clear",
  }),
  evalRow({
    id: "FP-EVAL-S037P-HIT",
    rule_id: "PTY2-R037",
    subject_object_id: "PTY-M002",
    result: "hit",
    rule_version: "FP-R32-1",
    inputs: { due_wan: 800, received_wan: 480, unpaid: 320, due_date: "2026-06-30" },
    formula: "到期日应收800−已核实到账480=未收320",
    risk_ids: ["R-FP-037P"],
    evidence_ids: ["EVID-FP-037P"],
    effective_result: "hit",
  }),
  evalRow({
    id: "FP-EVAL-S038-OK",
    rule_id: "PTY2-R038",
    subject_object_id: "PTY-M012",
    result: "clear",
    rule_version: "FP-R32-1",
    inputs: { used_on: "2026-06-12", valid_until: "2027-12-31" },
    formula: "使用日在许可有效期内",
    risk_ids: [],
    evidence_ids: ["EVID-FP-038"],
    effective_result: "clear",
  }),
];
