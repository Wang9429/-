/**
 * 业务详情展示映射。底层 ID、英文键、枚举与计算结果保持不变，仅界面转中文。
 */

import { draftsForRisk } from "./materials";
import { findObject, objectName } from "./objects";
import { statusLabel } from "./risks";
import { liveRule, liveSub } from "./live-config";
import { evidenceById, monitoringStatusLabel, scenarioName, seed } from "./seed";

export interface VerificationFact {
  label: string;
  value: string;
  note?: string;
}

export interface VerificationView {
  objectName: string;
  objectId: string;
  ruleName: string;
  ruleId: string;
  ruleVersion: string;
  window: string;
  requirement: string;
  facts: VerificationFact[];
  resultLabel: string;
  resultTone: "red" | "green" | "amber" | "neutral";
  formula: string;
  sourceSystem?: string;
  sourceDoc?: string;
  sourceDate?: string;
}

const DEV_NOTES = /首批路径评估|R3\.2\s*覆盖路径评估|R3\.2覆盖路径评估|覆盖样例输入|fp_first_batch|r32_coverage|formula_role|published_runtime/;

const INPUT_LABELS: Record<string, string> = {
  actual: "实际支付金额",
  amount_wan_cny: "实际支付金额",
  approved: "该笔有效批准金额",
  approved_amount: "该笔有效批准金额",
  limit: "业务授权上限",
  certified_payable_amount: "业务授权上限",
  over: "超出批准金额",
  overCert: "超出业务授权上限",
  amount_tolerance_wan: "货币精度容差",
  amount_tolerance_input: "输入容差",
  amount_tolerance_clamped: "容差是否按上限截取",
  amount_tolerance_unit: "容差单位",
  approval_change: "有效批准是否变更",
  direction: "收付方向",
  change: "收款账户变更日",
  pay: "付款日",
  review: "独立核验日",
  due: "到期日",
  due_date: "到期日",
  unpaid: "未收／未付金额",
  start: "起算日",
  days: "合同约定期限",
  purpose: "支出用途",
  catalog: "批准用途目录",
  n: "连续期数",
  profits: "已关账经营利润",
  authorized_pp: "授权持股变动上限",
  proposed_pp: "拟转让持股变动",
  used_on: "实际使用日",
  valid_until: "有效期至",
  extras: "银行确认未入台账账号",
  as_of: "基准日",
  bank: "银行确认账户",
  ledger: "企业台账账户",
  paid: "已核实支付／到账",
  claimable: "可报金额",
  voucher: "费用凭据",
  approval_on: "批准日",
  effective_on: "生效日",
  scope: "覆盖范围",
  gate_on: "前置节点日期",
  gate: "前置节点",
  behavior: "经济行为",
  count: "核对资产项数",
  suspect: "待人工确认差异项",
  person: "应回避人员",
  voted: "是否参与表决",
  attended: "是否出席",
  declared: "是否已申报回避",
  listed: "是否上市股份",
  due_wan: "应收价款",
  received_wan: "已核实到账",
  obligation_id: "价款义务",
  basis_wan: "评估／定价基准",
  deal_wan: "成交价款",
  floor_wan: "首次底价",
  charter_board_seats: "章程董事会席位",
  appointed_seats: "实际委派到任",
  should_appoint: "控股股东应派席位",
  blocked: "权利行使是否受阻",
  entity: "使用主体",
  auth_until: "授权截止日",
  exit_on: "退出／解约日",
  trade_name: "使用字号",
  permit: "许可证件",
};

const RELATION_LABELS: Record<string, string> = {
  transfer_proceeds: "转让价款收款",
  transfer_contract: "转让合同",
  transfer_obligation: "转让价款义务",
  guarantee_of: "对外担保",
  guarantee_contract: "担保合同",
  lending_to: "资金出借",
  recovery_of: "出借回收",
  settles: "价款结算",
  paid_under: "项目付款",
};

const DATA_NATURE_LABELS: Record<string, string> = {
  simulated: "合成样例",
  synthetic_statement: "合成报表",
  real_event: "真实事件日期",
};

const HIT_VALIDITY_LABELS: Record<string, string> = {
  current: "当前有效评估",
  retained_pending_or_confirmed: "历史命中仍有效，待核查或已确认",
  superseded: "已被后续版本替代",
  historical: "历史时点评估",
};

const ASSET_NAMES: Record<string, string> = {
  "FA-A-1101": "账簿在册生产设备",
  "FA-A-1102": "账簿在册配套设施",
  "FA-A-EXCL": "已合法剥离资产",
};

const PERSON_NAMES: Record<string, string> = {
  "DIR-A-03": "已核实关联董事（受让方）",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  有效批准方案: "有效批准方案",
  工商登记快照: "工商登记",
  产权台账快照: "产权台账",
  工商登记模拟快照: "工商登记",
  产权台账模拟快照: "产权台账",
  批准及登记一致: "批准及登记一致",
};

export function entityName(id: string): string {
  return seed.legal_entities.find((e) => e.id === id)?.name ?? objectName(id);
}

export function objectTitle(id: string): string {
  const obj = findObject(id);
  if (!obj) return id;
  if (obj.name.includes(id) && obj.type === "legal_entity") return entityName(id);
  if (obj.name.startsWith("治理权利 ")) return entityName(id.replace(/^GOV-/, "LE-")) || entityName("LE-CTRL");
  if (/银行确认清单$/.test(obj.name)) {
    const le = obj.name.replace(/\s*银行确认清单$/, "");
    return `${entityName(le)}银行确认清单`;
  }
  return obj.name;
}

export function secondaryId(kind: "场景" | "规则" | "事项" | "对象" | "评估", id: string): string {
  return `${kind}编号 ${id}`;
}

export function dataNatureLabel(v?: string | null): string {
  if (!v) return "—";
  return DATA_NATURE_LABELS[v] ?? (v === "simulated" ? "合成样例" : v);
}

export function hitValidityLabel(v?: string | null): string {
  if (!v) return "—";
  return HIT_VALIDITY_LABELS[v] ?? "当前有效评估";
}

export function relationTypeLabel(v?: string | null): string {
  if (!v) return "—";
  return RELATION_LABELS[v] ?? v;
}

export function sourceTypeLabel(v?: string | null): string {
  if (!v) return "—";
  return SOURCE_TYPE_LABELS[v] ?? v;
}

export function inputFieldLabel(key: string): string {
  return INPUT_LABELS[key] ?? key;
}

export function boolLabel(v: unknown): string {
  if (v === true) return "是";
  if (v === false) return "否";
  if (v == null || v === "") return "无";
  return String(v);
}

export function formatInputValue(key: string, value: unknown): string {
  if (value == null || value === "") return "无";
  if (typeof value === "boolean") return boolLabel(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "无";
    return value.map((x) => namedCode(String(x))).join("、");
  }
  if (key === "direction") return value === "outflow" ? "支出" : value === "inflow" ? "收入" : String(value);
  if (
    [
      "actual",
      "approved",
      "limit",
      "over",
      "overCert",
      "amount_wan_cny",
      "approved_amount",
      "certified_payable_amount",
      "unpaid",
      "due_wan",
      "received_wan",
      "paid",
      "claimable",
      "basis_wan",
      "deal_wan",
      "floor_wan",
      "amount_tolerance_wan",
      "amount_tolerance_input",
    ].includes(key) &&
    typeof value === "number"
  ) {
    return `${value}万元`;
  }
  if (key === "days" && typeof value === "number") return `${value}日`;
  if (typeof value === "number") return String(value);
  return namedCode(String(value));
}

export function namedCode(raw: string): string {
  if (ASSET_NAMES[raw]) return ASSET_NAMES[raw];
  if (PERSON_NAMES[raw]) return PERSON_NAMES[raw];
  const obj = findObject(raw);
  if (obj) return obj.name;
  const le = seed.legal_entities.find((e) => e.id === raw);
  if (le) return le.name;
  return raw;
}

export function assetDisplay(code: string): { name: string; code: string } {
  return { name: ASSET_NAMES[code] ?? "核对资产", code };
}

export function personDisplay(code: string): { name: string; code: string } {
  return { name: PERSON_NAMES[code] ?? "相关人员", code };
}

export function monitoringNoteLabel(note?: string | null, status?: string): string {
  if (note && !DEV_NOTES.test(note)) return note;
  if (status && monitoringStatusLabel[status]) return monitoringStatusLabel[status];
  return "已完成核验";
}

export function ruleDisplayName(id: string): string {
  const r = liveRule(id);
  if (r?.name) return r.name;
  const subId = id.replace("-R", "-S");
  const name = scenarioName(subId);
  return name === subId ? id : `${name}监测规则`;
}

export function scenarioRequirement(scenarioId: string): { name: string; requirement: string; caliber: string } {
  const live = liveSub(scenarioId);
  const name = scenarioName(scenarioId);
  const requirement = (live?.description ?? "").trim() || name;
  const caliber = (live?.rule_text ?? "").trim();
  return { name, requirement, caliber };
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function money(v: number | null): string {
  return v == null ? "—" : `${v}万元`;
}

function resultOf(
  effective: string,
  statusHint?: string,
  professional?: boolean,
): { label: string; tone: VerificationView["resultTone"] } {
  if (professional && (effective === "data_insufficient" || effective === "not_applicable")) {
    return { label: "待专业核查，结论须人工记录，不能视为已确认违规", tone: "amber" };
  }
  if (effective === "hit") {
    if (statusHint === "pending_review" || !statusHint) return { label: "命中，待核查", tone: "red" };
    if (statusHint === "investigating") return { label: "命中，核查中", tone: "red" };
    if (statusHint === "rectifying") return { label: "命中，整改中", tone: "red" };
    return { label: `命中，${statusLabel[statusHint as keyof typeof statusLabel] ?? statusHint}`, tone: "red" };
  }
  if (effective === "excluded") return { label: "已排除", tone: "neutral" };
  if (effective === "data_insufficient") return { label: "资料待补，未完成核验", tone: "amber" };
  if (effective === "not_applicable") return { label: "不适用", tone: "neutral" };
  return { label: "未命中，本次监测未发现异常", tone: "green" };
}

function factsForS039(inputs: Record<string, unknown>): VerificationFact[] {
  const actual = asNumber(inputs.actual ?? inputs.amount_wan_cny);
  const approved = asNumber(inputs.approved ?? inputs.approved_amount);
  const limit = asNumber(inputs.limit ?? inputs.certified_payable_amount);
  const over =
    asNumber(inputs.over) ?? (actual != null && approved != null ? actual - approved : null);
  const tol = asNumber(inputs.amount_tolerance_wan) ?? 0;
  const facts: VerificationFact[] = [
    { label: "该笔有效批准金额", value: money(approved), note: "付款执行时对该笔事项有效的批准额度" },
    { label: "实际支付金额", value: money(actual), note: "银行实际执行金额" },
    { label: "超出批准金额", value: money(over), note: "实际支付金额 − 该笔有效批准金额" },
  ];
  if (limit != null) {
    facts.push({
      label: "业务授权上限",
      value: money(limit),
      note: "合同可支付／业务授权上限，不得与该笔有效批准金额混淆",
    });
  }
  facts.push({ label: "货币精度容差", value: money(tol), note: "精度容差，不是业务差额阈值" });
  if (inputs.approval_change !== undefined) {
    facts.push({ label: "有效批准是否变更", value: boolLabel(inputs.approval_change) });
  }
  return facts;
}

function factsForPtyS037(inputs: Record<string, unknown>): VerificationFact[] {
  const due = asNumber(inputs.due_wan);
  const received = asNumber(inputs.received_wan);
  const unpaid = asNumber(inputs.unpaid) ?? (due != null && received != null ? due - received : null);
  return [
    { label: "应收价款", value: money(due), note: "已生效转让合同到期应收" },
    { label: "已核实到账", value: money(received), note: "资金到账核验金额" },
    { label: "到期未收", value: money(unpaid), note: "应收价款 − 已核实到账" },
    { label: "到期日", value: String(inputs.due_date ?? "—") },
  ];
}

function genericFacts(inputs: Record<string, unknown>): VerificationFact[] {
  const skip = new Set(["amount_tolerance_clamped", "amount_tolerance_unit", "amount_tolerance_input"]);
  return Object.entries(inputs)
    .filter(([k, v]) => !skip.has(k) && v !== undefined)
    .map(([k, v]) => ({
      label: inputFieldLabel(k),
      value: formatInputValue(k, v),
    }));
}

function isS039(ruleId: string): boolean {
  return ruleId === "CASH2-R039" || ruleId === "CASH-R01" || ruleId === "CASH2-S039";
}

function isPtyS037(ruleId: string): boolean {
  return ruleId === "PTY2-R037" || ruleId === "PTY2-S037";
}

function isProfessional(ruleId: string, scenarioIds?: string[]): boolean {
  const ids = [ruleId, ...(scenarioIds ?? [])];
  return ids.some((id) => id.includes("S011") || id.includes("R011") || id.includes("S032") || id.includes("R032"));
}

export function verificationRequirement(ruleId: string): string {
  if (isS039(ruleId)) {
    return "实际支付金额不得超过该笔付款在执行时有效的批准金额。业务授权上限另行核验，不能因为未超过合同可支付上限而判定该笔付款正常。";
  }
  if (isPtyS037(ruleId)) {
    return "对已生效且适用价款的转让合同，核对应收价款与已核实到账；到期仍未足额收取的形成关注事项。无偿划转无价款，不适用本规则。";
  }
  if (ruleId.includes("R011") || ruleId.includes("S011")) {
    return "将账簿资产、权属资料与审计评估清单核对。范围疑似漏列须专业核查确认，不能把资产数量差自动认定为隐匿。";
  }
  if (ruleId.includes("R032") || ruleId.includes("S032")) {
    return "对拥有治理权利的企业，核验章程约定席位、控股应派席位与实际到任情况。不能仅凭持股比例认定已控权或控制失效。";
  }
  const live = liveRule(ruleId) ?? liveRule(ruleId.replace("-S", "-R"));
  const sub = liveSub(live?.primary_subscenario_id ?? ruleId.replace("-R", "-S"));
  return (sub?.description ?? live?.condition_description ?? "按已发布规则核验对象事实。").trim();
}

export function verificationFromEval(
  e: {
    rule_id: string;
    subject_object_id: string;
    inputs: Record<string, unknown>;
    formula: string;
    effective_result?: string;
    result?: string;
    rule_version: string;
    window_start: string;
    window_end: string;
    evidence_ids?: string[];
    risk_ids?: string[];
    missing?: string[];
  },
  opts?: { riskStatus?: string; scenarioIds?: string[] },
): VerificationView {
  const professional = isProfessional(e.rule_id, opts?.scenarioIds);
  const effective = professional && e.missing?.includes("专业核查结论")
    ? "data_insufficient"
    : e.effective_result ?? e.result ?? "data_insufficient";
  const res = resultOf(effective, professional ? "pending" : opts?.riskStatus, professional);
  const facts = isS039(e.rule_id)
    ? factsForS039(e.inputs ?? {})
    : isPtyS037(e.rule_id)
      ? factsForPtyS037(e.inputs ?? {})
      : genericFacts(e.inputs ?? {});
  const evid = (e.evidence_ids ?? []).map((id) => evidenceById(id)).find(Boolean);
  return {
    objectName: objectTitle(e.subject_object_id),
    objectId: e.subject_object_id,
    ruleName: ruleDisplayName(e.rule_id),
    ruleId: e.rule_id,
    ruleVersion: e.rule_version,
    window: `${e.window_start} ~ ${e.window_end}`,
    requirement: verificationRequirement(e.rule_id),
    facts,
    resultLabel: res.label,
    resultTone: res.tone,
    formula: e.formula,
    sourceSystem: evid?.source_type,
    sourceDoc: evid?.title,
    sourceDate: evid?.recorded_at,
  };
}

export interface HoldingRow {
  id: string;
  investorId: string;
  investorName: string;
  investeeId: string;
  investeeName: string;
  pct: number;
  source: string;
  effectiveDate: string;
  asOf: string;
}

export function holdingRowsFor(investeeId?: string, investorId?: string): HoldingRow[] {
  return seed.ownership_snapshots
    .filter((s) => (!investeeId || s.investee_id === investeeId) && (!investorId || s.investor_id === investorId))
    .map((s) => ({
      id: s.id,
      investorId: s.investor_id,
      investorName: entityName(s.investor_id),
      investeeId: s.investee_id,
      investeeName: entityName(s.investee_id),
      pct: s.pct,
      source: sourceTypeLabel(s.source_type),
      effectiveDate: s.effective_date,
      asOf: s.snapshot_date,
    }));
}

export function holdingDiffNote(rows: HoldingRow[]): string | null {
  if (rows.length < 2) return null;
  const pcts = rows.map((r) => r.pct);
  const diff = Math.max(...pcts) - Math.min(...pcts);
  if (diff <= 0) return null;
  return `各来源持股相差 ${diff} 个百分点，差异待核实，不直接计为登记违规或权益流失`;
}

export function evidenceTitle(id: string): string {
  return evidenceById(id)?.title ?? id;
}

export function riskTitleOf(id: string): string {
  return seed.risk_cases.find((r) => r.id === id)?.title ?? id;
}

export function professionalReviewCopy(scenarioId: string): {
  points: string;
  materialsHint: string;
} {
  if (scenarioId === "PTY2-S011") {
    return {
      points: "核对账簿在册资产是否列入评估清单；合法剥离须有书面依据；不得把资产数量差自动认定为隐匿。",
      materialsHint: "打开资产账簿、权属及评估范围材料后记录结论。",
    };
  }
  return {
    points: "核验章程董事会席位、控股股东应派席位与实际到任；重大事项表决是否受阻。不能仅凭持股比例认定已控权。",
    materialsHint: "打开章程、任免与到任材料后记录结论。",
  };
}

export function professionalMaterials(riskId: string) {
  return draftsForRisk(riskId);
}
