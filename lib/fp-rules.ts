import { FP_CONTROLS_PAY, FP_EVENTS, FP_GOVERNANCE, FP_REPORTS, FP_SEGMENTS, FP_SME, FP_SPECIALS, FP_GUARANTEES, FP_LENDS } from "./fp-seed";
import { FP_ACCOUNT_OPENINGS, FP_NAME_LICENSES } from "./fp-history-seed";
import { cashS039ParamsForPublish, resolveCashS039ToleranceWan } from "./fp-tolerance";
import { liveRule } from "./live-config";
import { seed } from "./seed";
import type { CatalogRule } from "./config-catalog";
import type { RuleEvaluation } from "./types";

export type RuleTrialResult = {
  objectId: string;
  result: "hit" | "clear" | "not_applicable" | "data_insufficient";
  formula: string;
  inputs: Record<string, unknown>;
  missing?: string[];
};

export const FP_TRIAL_OBJECTS: Record<string, { id: string; name: string }[]> = {
  "CASH2-S039": [
    { id: "P-PAY001", name: "付款 P-PAY001" },
    { id: "P-FA001", name: "付款 P-FA001" },
  ],
  "CASH2-S037": [
    { id: "P-FP-AUTH", name: "付款 P-FP-AUTH" },
    { id: "P-PAY001", name: "付款 P-PAY001" },
  ],
  "CASH2-S024": [
    { id: "P-FP-ACCCHG", name: "付款 P-FP-ACCCHG" },
    { id: "P-FP-ACCCHG-OK", name: "付款 P-FP-ACCCHG-OK" },
  ],
  "CASH2-S033": [
    { id: "SME-01", name: "账款 SME-01" },
    { id: "SME-02", name: "账款 SME-02" },
  ],
  "CASH2-S031": [
    { id: "P-FP-SPEC", name: "专项支出 P-FP-SPEC" },
    { id: "P-FP-SPEC-OK", name: "专项支出 P-FP-SPEC-OK" },
  ],
  "CASH2-S035": [{ id: "SEG-A-EPCI-2026Q2", name: "海洋工程总承包" }],
  "CASH2-S040": [
    { id: "ACC-B", name: "账户 ACC-B" },
    { id: "ACC-A", name: "账户 ACC-A" },
    { id: "ACC-USD", name: "账户 ACC-USD" },
  ],
  "CASH2-S012": [
    { id: "GUAR-01", name: "担保 GUAR-01" },
    { id: "GUAR-OK", name: "担保 GUAR-OK" },
  ],
  "CASH2-S029": [
    { id: "LEND-01", name: "出借 LEND-01" },
    { id: "LEND-OK", name: "出借 LEND-OK" },
    { id: "LEND-INT-01", name: "出借 LEND-INT-01" },
  ],
  "PTY2-S006": [
    { id: "PTY-M007", name: "事项 PTY-M007" },
    { id: "PTY-M002", name: "事项 PTY-M002" },
  ],
  "PTY2-S035": [
    { id: "PTY-M008", name: "事项 PTY-M008" },
    { id: "PTY-M002", name: "事项 PTY-M002" },
  ],
  "PTY2-S028": [{ id: "PTY-M009", name: "事项 PTY-M009" }],
  "PTY2-S032": [{ id: "LE-CTRL", name: "法人 LE-CTRL" }],
  "PTY2-S025": [
    { id: "PTY-M011", name: "事项 PTY-M011" },
    { id: "PTY-M012", name: "事项 PTY-M012" },
  ],
};

function ruleParams(
  ruleOrSubId: string,
  override?: Record<string, string | number>,
): Record<string, string | number> {
  if (override) return override;
  const rule = liveRule(ruleOrSubId) ?? liveRule(ruleOrSubId.replace("-S", "-R"));
  return {
    ...(rule?.published?.parameters ?? {}),
    ...(rule?.draft_parameters ?? {}),
  };
}

export function trialCashS039(objectId: string, params?: Record<string, string | number>): RuleTrialResult {
  const tx = seed.cash_transactions.find((t) => t.id === objectId);
  if (!tx) return { objectId, result: "not_applicable", formula: "对象不是付款", inputs: {} };
  if (tx.direction !== "outflow" || tx.approved_amount === undefined) {
    return { objectId, result: "not_applicable", formula: "非支付核查对象", inputs: { direction: tx.direction } };
  }
  const p = ruleParams("CASH2-R039", params);
  const tolInfo = resolveCashS039ToleranceWan(p.amount_tolerance_wan);
  const tol = tolInfo.applied;
  const hasApprovalChange = false;
  const over = tx.amount_wan_cny - tx.approved_amount;
  const overCert = tx.certified_payable_amount !== undefined ? tx.amount_wan_cny - tx.certified_payable_amount : null;
  const clampNote = tolInfo.clamped
    ? `输入容差${tolInfo.input}万元超出货币精度上限${tol}万元，已按上限执行`
    : `货币精度容差${tol}万元`;
  const changeNote = "无有效批准变更";
  if (!hasApprovalChange && over > tol) {
    return {
      objectId,
      result: "hit",
      formula: `实付${tx.amount_wan_cny} − 该笔有效批准${tx.approved_amount} = ${over}；${clampNote}；${changeNote}；业务上限${tx.certified_payable_amount ?? "—"}`,
      inputs: {
        actual: tx.amount_wan_cny,
        approved: tx.approved_amount,
        limit: tx.certified_payable_amount,
        over,
        overCert,
        amount_tolerance_wan: tol,
        amount_tolerance_input: tolInfo.input,
        amount_tolerance_clamped: tolInfo.clamped,
        amount_tolerance_unit: tolInfo.unit,
        approval_change: false,
      },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `实付${tx.amount_wan_cny} − 批准${tx.approved_amount} = ${over} ≤ ${clampNote}；${changeNote}`,
    inputs: {
      actual: tx.amount_wan_cny,
      approved: tx.approved_amount,
      amount_tolerance_wan: tol,
      amount_tolerance_input: tolInfo.input,
      amount_tolerance_clamped: tolInfo.clamped,
      amount_tolerance_unit: tolInfo.unit,
      approval_change: hasApprovalChange,
    },
  };
}

export function trialCashS037(objectId: string): RuleTrialResult {
  const tx = seed.cash_transactions.find((t) => t.id === objectId);
  const ctl = FP_CONTROLS_PAY.find((c) => c.transaction_id === objectId);
  if (!tx || tx.approved_amount === undefined) {
    return { objectId, result: "data_insufficient", formula: "缺批准金额", inputs: {}, missing: ["有效批准金额"] };
  }
  if (!ctl) {
    return { objectId, result: "data_insufficient", formula: "缺授权版本", inputs: {}, missing: ["批准人有效权限"] };
  }
  if (tx.approved_amount > ctl.approver_limit_wan) {
    return {
      objectId,
      result: "hit",
      formula: `批准金额${tx.approved_amount} > 权限${ctl.approver_limit_wan}`,
      inputs: { approved: tx.approved_amount, limit: ctl.approver_limit_wan },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `批准金额${tx.approved_amount} ≤ 权限${ctl.approver_limit_wan}`,
    inputs: { approved: tx.approved_amount, limit: ctl.approver_limit_wan },
  };
}

export function trialCashS024(objectId: string): RuleTrialResult {
  const tx = seed.cash_transactions.find((t) => t.id === objectId);
  const ctl = FP_CONTROLS_PAY.find((c) => c.transaction_id === objectId);
  if (!tx) return { objectId, result: "not_applicable", formula: "无付款", inputs: {} };
  if (!ctl?.change_date) return { objectId, result: "not_applicable", formula: "无收款账户变更", inputs: {} };
  if (!ctl.independent_review_at || ctl.independent_review_at > tx.date) {
    return {
      objectId,
      result: "hit",
      formula: `变更${ctl.change_date}后首次付款${tx.date}，独立核验${ctl.independent_review_at ?? "缺失"}`,
      inputs: { change: ctl.change_date, pay: tx.date, review: ctl.independent_review_at },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `核验${ctl.independent_review_at}早于付款${tx.date}`,
    inputs: { change: ctl.change_date, pay: tx.date, review: ctl.independent_review_at },
  };
}

export function trialCashS033(objectId: string): RuleTrialResult {
  const row = FP_SME.find((s) => s.id === objectId || s.contract_id === objectId);
  if (!row) return { objectId, result: "not_applicable", formula: "无该账款义务", inputs: {} };
  if (row.sme_at_contract === null) {
    return { objectId, result: "data_insufficient", formula: "缺合同订立时企业规模，不能用发票日+60日替代", inputs: {}, missing: ["合同订立时企业规模"] };
  }
  if (!row.sme_at_contract) return { objectId, result: "not_applicable", formula: "订立时非中小企业", inputs: {} };
  const unpaid = row.undisputed_wan - row.paid_wan;
  const due = row.due_date <= "2026-06-30" && unpaid > 0;
  return {
    objectId,
    result: due ? "hit" : "clear",
    formula: `起算${row.start_event} ${row.start_date} + 合同${row.contracted_days}日 → 到期${row.due_date}；无争议未付${unpaid}`,
    inputs: { due: row.due_date, unpaid, start: row.start_date, days: row.contracted_days },
  };
}

export function trialCashS031(objectId: string): RuleTrialResult {
  const spec = FP_SPECIALS[0];
  const tx = seed.cash_transactions.find((t) => t.id === objectId);
  if (!tx || tx.account_id !== spec.designated_account_id) {
    return { objectId, result: "not_applicable", formula: "非该专项支出", inputs: {} };
  }
  const purpose = objectId === "P-FP-SPEC" ? "业务招待" : "实训设备";
  const ok = spec.purpose_catalog.includes(purpose);
  return {
    objectId,
    result: ok ? "clear" : "hit",
    formula: ok ? "用途在批准目录内" : `用途「${purpose}」不在 ${spec.purpose_catalog.join("/")} 且无调整批准`,
    inputs: { purpose, catalog: spec.purpose_catalog },
  };
}

export function trialCashS035(objectId: string): RuleTrialResult {
  const rows = FP_SEGMENTS.filter((s) => s.id === objectId || s.org_id === objectId || s.name === objectId);
  const list = (rows.length ? rows : FP_SEGMENTS.filter((s) => s.org_id === "ORG-A")).filter((s) => s.closed && s.comparable);
  const byName = new Map<string, typeof list>();
  for (const r of list) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  for (const [name, items] of byName) {
    const sorted = items.sort((a, b) => a.period_end.localeCompare(b.period_end));
    const tail = sorted.slice(-3);
    if (tail.length === 3 && tail.every((x) => x.operating_profit < 0)) {
      return {
        objectId,
        result: "hit",
        formula: `${name} 连续3期已关账利润 ${tail.map((x) => x.operating_profit).join("、")}`,
        inputs: { n: 3, profits: tail.map((x) => x.operating_profit) },
      };
    }
  }
  return { objectId, result: "clear", formula: "未达连续亏损条件", inputs: {} };
}

export function trialPtyS006(objectId: string): RuleTrialResult {
  if (objectId === "PTY-M007") {
    return { objectId, result: "hit", formula: "拟转让15个百分点 > 授权10个百分点，无上收审批", inputs: { authorized_pp: 10, proposed_pp: 15 } };
  }
  return { objectId, result: "clear", formula: "未超出授权边界", inputs: {} };
}

export function trialPtyS035(objectId: string): RuleTrialResult {
  const r = FP_REPORTS.find((x) => x.matter_id === objectId);
  if (!r) return { objectId, result: "not_applicable", formula: "无适用有效期报告", inputs: {} };
  if (r.used_on > r.valid_until) {
    return { objectId, result: "hit", formula: `使用${r.used_on} > 有效至${r.valid_until}`, inputs: { used_on: r.used_on, valid_until: r.valid_until } };
  }
  return { objectId, result: "clear", formula: `使用${r.used_on} 在有效期内`, inputs: { used_on: r.used_on, valid_until: r.valid_until } };
}

export function trialPtyS028(objectId: string): RuleTrialResult {
  const ev = FP_EVENTS.find((e) => e.matter_id === objectId);
  if (!ev) return { objectId, result: "not_applicable", formula: "无变动事件", inputs: {} };
  if (!ev.registration_applicable) {
    return { objectId, result: "not_applicable", formula: "未确认登记适用；来源差异不构成未登记", inputs: {} };
  }
  if (ev.filing_due && !ev.filed_on && ev.filing_due < "2026-06-30") {
    return { objectId, result: "hit", formula: `应办至${ev.filing_due}仍未申报`, inputs: { due: ev.filing_due, filed: ev.filed_on } };
  }
  return { objectId, result: "clear", formula: "已申报或未到期", inputs: { due: ev.filing_due, filed: ev.filed_on } };
}

export function trialCashS040(objectId: string): RuleTrialResult {
  const rec = FP_ACCOUNT_OPENINGS.find((x) => x.account_id === objectId);
  if (!rec) return { objectId, result: "not_applicable", formula: "无该账户开立记录", inputs: {} };
  if (!rec.approval_required) {
    return { objectId, result: "not_applicable", formula: "制度不要求事前审批", inputs: { opened_on: rec.opened_on } };
  }
  if (!rec.evidence_complete) {
    return {
      objectId,
      result: "data_insufficient",
      formula: rec.search_note,
      inputs: { opened_on: rec.opened_on, evidence_complete: false },
      missing: ["开户日有效制度", "完整审批检索结果"],
    };
  }
  if (!rec.approval_on || rec.approval_on > rec.opened_on) {
    return {
      objectId,
      result: "hit",
      formula: `需事前审批且检索完整；开户${rec.opened_on}，有效批准${rec.approval_on ?? "缺失"}`,
      inputs: { opened_on: rec.opened_on, approval_on: rec.approval_on },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `批准${rec.approval_on}早于开户${rec.opened_on}`,
    inputs: { opened_on: rec.opened_on, approval_on: rec.approval_on },
  };
}

export function trialCashS012(objectId: string): RuleTrialResult {
  const g = FP_GUARANTEES.find((x) => x.id === objectId);
  if (!g || g.released) return { objectId, result: "not_applicable", formula: "非有效担保占用对象", inputs: {} };
  const same = FP_GUARANTEES.filter(
    (x) => x.guarantor_id === g.guarantor_id && x.beneficiary_id === g.beneficiary_id && !x.released,
  );
  const occupancy = same.reduce((s, x) => s + x.amount_wan, 0);
  const limit = g.approved_limit_wan;
  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      objectId,
      result: "data_insufficient",
      formula: "额度口径不清，未评估；不混比名义金额与净责任额",
      inputs: { occupancy, limit },
      missing: ["有效批准额度"],
    };
  }
  if (occupancy > limit) {
    return {
      objectId,
      result: "hit",
      formula: `被担保对象${g.beneficiary_id}有效占用${occupancy} > 批准额度${limit}（${g.occupancy_basis}）`,
      inputs: { occupancy, limit, beneficiary: g.beneficiary_id },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `有效占用${occupancy} ≤ 批准额度${limit}`,
    inputs: { occupancy, limit, beneficiary: g.beneficiary_id },
  };
}

export function trialCashS029(objectId: string): RuleTrialResult {
  const l = FP_LENDS.find((x) => x.id === objectId);
  if (!l) return { objectId, result: "not_applicable", formula: "非出借合同", inputs: {} };
  const overdue = l.due_date <= "2026-06-30" ? Math.max(0, l.outstanding_wan - l.recovered_wan) : 0;
  if (l.due_date > "2026-06-30") {
    return {
      objectId,
      result: "clear",
      formula: `未到期（${l.due_date}），不计入逾期应收`,
      inputs: { due: l.due_date, outstanding: l.outstanding_wan, recovered: l.recovered_wan },
    };
  }
  if (overdue > 0) {
    return {
      objectId,
      result: "hit",
      formula: `到期${l.due_date}未收回本金${overdue}万元（本金${l.outstanding_wan}−回收${l.recovered_wan}）`,
      inputs: { due: l.due_date, outstanding: l.outstanding_wan, recovered: l.recovered_wan, overdue, borrower: l.borrower_id },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `到期义务已收回（回收${l.recovered_wan}）`,
    inputs: { due: l.due_date, recovered: l.recovered_wan, borrower: l.borrower_id },
  };
}

export function trialPtyS025(objectId: string): RuleTrialResult {
  const rec = FP_NAME_LICENSES.find((x) => x.matter_id === objectId);
  if (!rec) return { objectId, result: "not_applicable", formula: "无名称字号授权对象", inputs: {} };
  if (!rec.auth_file || !rec.auth_until) {
    return {
      objectId,
      result: "data_insufficient",
      formula: "缺授权文件或期限，未评估",
      inputs: { entity: rec.entity_id },
      missing: ["授权文件", "使用期限"],
    };
  }
  if (rec.exit_event_on && rec.exit_event_on > rec.auth_until) {
    return {
      objectId,
      result: "hit",
      formula: `授权至${rec.auth_until}，退出/解约${rec.exit_event_on}后仍使用字号「${rec.trade_name}」`,
      inputs: { auth_until: rec.auth_until, exit_on: rec.exit_event_on, trade_name: rec.trade_name },
    };
  }
  return {
    objectId,
    result: "clear",
    formula: `授权${rec.auth_file}有效至${rec.auth_until}，使用主体一致`,
    inputs: { auth_until: rec.auth_until, entity: rec.entity_id },
  };
}

export function trialPtyS032(objectId: string): RuleTrialResult {
  if (objectId !== "LE-CTRL" && objectId !== "PTY-M010" && objectId !== "GOV-CTRL") {
    return { objectId, result: "not_applicable", formula: "非该治理对象", inputs: {} };
  }
  const gov = FP_GOVERNANCE.find((g) => g.legal_entity_id === "LE-CTRL") ?? FP_GOVERNANCE[0];
  return {
    objectId,
    result: "data_insufficient",
    formula: `专业核查：章程董事会${gov.charter_board_seats}席、控股应派3席、实际到任${gov.appointed_seats}席；不自动判定为控制失效或已控权`,
    inputs: { charter_board_seats: gov.charter_board_seats, appointed_seats: gov.appointed_seats, should_appoint: 3, blocked: gov.blocked },
    missing: ["专业核查结论"],
  };
}

export function trialRule(
  ruleOrSubId: string,
  objectId: string,
  params?: Record<string, string | number>,
): RuleTrialResult {
  const id = ruleOrSubId.replace("-R", "-S");
  switch (id) {
    case "CASH2-S039":
    case "CASH-S01":
      return trialCashS039(objectId, params);
    case "CASH2-S037":
      return trialCashS037(objectId);
    case "CASH2-S024":
      return trialCashS024(objectId);
    case "CASH2-S033":
      return trialCashS033(objectId);
    case "CASH2-S031":
      return trialCashS031(objectId);
    case "CASH2-S035":
      return trialCashS035(objectId);
    case "CASH2-S040":
      return trialCashS040(objectId);
    case "CASH2-S012":
      return trialCashS012(objectId);
    case "CASH2-S029":
      return trialCashS029(objectId);
    case "PTY2-S006":
      return trialPtyS006(objectId);
    case "PTY2-S035":
      return trialPtyS035(objectId);
    case "PTY2-S028":
      return trialPtyS028(objectId);
    case "PTY2-S032":
      return trialPtyS032(objectId);
    case "PTY2-S025":
      return trialPtyS025(objectId);
    default:
      return { objectId, result: "data_insufficient", formula: "仅维护定义，无执行器", inputs: {}, missing: ["执行器"] };
  }
}

/** 发布后追加新评估，不改写种子历史评估 ID。 */
export function evaluationsForPublish(rule: CatalogRule, asOf: string): RuleEvaluation[] {
  const subId = rule.primary_subscenario_id;
  const objects = FP_TRIAL_OBJECTS[subId] ?? [];
  const raw = { ...(rule.published?.parameters ?? rule.draft_parameters) };
  const params = subId === "CASH2-S039" ? cashS039ParamsForPublish(raw) : raw;
  const version = rule.published?.version ?? rule.version_id;
  const out: RuleEvaluation[] = [];
  for (const o of objects) {
    const t = trialRule(subId, o.id, params);
    if (t.result !== "hit" && t.result !== "clear") continue;
    out.push({
      id: `LIVE-EVAL-${rule.id}-${o.id}-${version}`,
      rule_id: rule.id,
      subject_object_id: o.id,
      evaluated_at: asOf,
      period_start: "2026-01-01",
      period_end: "2026-06-30",
      window_start: "2026-01-01",
      window_end: "2026-06-30",
      result: t.result,
      rule_version: version,
      inputs: t.inputs,
      formula: t.formula,
      risk_ids: t.result === "hit" && o.id === "P-PAY001" ? ["R07"] : [],
      evidence_ids: [],
      data_nature: "simulated",
      effective_result: t.result,
      hit_validity: "current",
      generic_formula: t.formula,
      formula_role: "published_runtime",
      input_snapshot_note: `发布版本 ${version} 追加，不覆盖历史评估`,
      input_bindings: [],
    });
  }
  return out;
}
