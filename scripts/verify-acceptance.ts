/**
 * 验收自检：把页面实际调用的计算函数结果与 demo_seed.json 的
 * expected_results / expected_stage_results_v1_2 逐项对照。
 * 预期值只用于断言，不允许回写进指标卡（AGENTS.md 计算口径一节）。
 *
 * 运行：npm run verify
 */
import { seed, AS_OF } from "../lib/seed";
import { INDICATORS, computeIndicator, indicatorLeaves, type IndicatorDef, type NodeMetric } from "../lib/metrics";
import { orgScope, ROOT_ORG_ID } from "../lib/org";
import { computeFiveCounts, openCountForPhase } from "../lib/monitoring";
import { isOpen, isOverdueRectification } from "../lib/risks";
import type { DomainId } from "../lib/types";
import { authorizedObjectIds, can, canCaseAction, intersectOrgScope, userById } from "../lib/config";
import { inDateRange } from "../lib/period";
import { INDEPENDENT_TRIAL_PROJECTS } from "../lib/trial";
import {
  applicableMonitorExecutions,
  completedRectificationCases,
  hitOrgMetric,
  hitOwnerOrgIds,
  inScopeProjectCount,
  managedOrganizations,
  managedOrgCount,
  orgMonitorStatus,
  orgNodeStats,
  openRectificationCases,
  overdueRectificationCases,
  overviewDomainCards,
  overviewIndicatorEnabled,
  overviewIndicatorOnHomepage,
  validHitRecords,
} from "../lib/overview";
import { isManagedUnit } from "../lib/org";

const PERIOD_START = "2026-01-01";
const PERIOD_END = AS_OF;
const HQ = orgScope(ROOT_ORG_ID, true);
const CTX = { periodStart: PERIOD_START, periodEnd: PERIOD_END, asOf: AS_OF, risks: seed.risk_cases };
const EXPECT = seed.expected_results as Record<string, unknown>;

interface ScenarioExpectation {
  monitored_projects?: number;
  monitored_assets?: number;
  monitored_equity_projects?: number;
  hit_projects?: number;
  hit_assets?: number;
  hit_equity_projects?: number;
  open_cases: number;
  rectified_closed_cases: number;
  overdue_rectification_cases?: number;
}

const STAGE = seed.expected_stage_results_v1_2 as unknown as {
  open_case_count_by_phase: Record<string, number>;
  FA_V12_06_FA_S20: ScenarioExpectation;
  FA_V12_08_FA_S29: ScenarioExpectation;
  EQ_V12_05_EQ_X01: ScenarioExpectation;
  historical_completed_stage: {
    object_id: string;
    phase_id: string;
    business_status: string;
    still_open_risk_ids: string[];
  };
};

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown, tolerance = 0.01) {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) <= tolerance
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  通过  ${name}：${format(actual)}`);
  } else {
    failures.push(`${name}：实际 ${format(actual)}，预期 ${format(expected)}`);
    console.log(`  失败  ${name}：实际 ${format(actual)}，预期 ${format(expected)}`);
  }
}

function format(v: unknown): string {
  if (typeof v === "number") return String(Math.round(v * 10000) / 10000);
  return JSON.stringify(v);
}

function indicator(id: string): IndicatorDef {
  const def = INDICATORS.find((i) => i.id === id);
  if (!def) throw new Error(`指标 ${id} 不存在`);
  return def;
}

function nodeValue(id: string, orgIds: Set<string> = HQ): NodeMetric {
  return computeIndicator(indicator(id), orgIds, CTX);
}

function leafValue(indicatorId: string, objectId: string): number | null {
  const def = indicator(indicatorId);
  const leaf = def.leaves(CTX).find((l) => l.objectId === objectId);
  if (!leaf) throw new Error(`指标 ${indicatorId} 没有对象 ${objectId} 的明细`);
  if (leaf.numerator === null || leaf.denominator === null) return null;
  if (def.kind === "amount" || def.kind === "count") return leaf.numerator;
  if (leaf.denominator === 0) return null;
  return (leaf.numerator / leaf.denominator) * 100;
}

console.log(`\n数据版本 ${seed.version}｜演示截至日 ${AS_OF}｜期间 ${PERIOD_START} 至 ${PERIOD_END}`);

console.log("\n[1] 监管事项存量口径（按 risk_id 去重）");
const risks = seed.risk_cases;
const open = risks.filter(isOpen);
const originalOpen = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08"];
check("原未关闭事项R01–R08仍未关闭", originalOpen.every((id) => open.some((r) => r.id === id)), true);
check("扩容后未关闭事项不少于原8件", open.length >= 8, true);
check("红色高风险不少于原4件", open.filter((r) => r.severity === "red").length >= 4, true);
check("R09仍为已排除", risks.find((r) => r.id === "R09")?.status, "excluded");
check("已排除不少于1件", risks.filter((r) => r.status === "excluded").length >= 1, true);
check("R02仍为逾期整改", isOverdueRectification(risks.find((r) => r.id === "R02")!, AS_OF), true);

console.log("\n[2] 领域未关闭事项（同一事项可在多领域出现，合计后需去重）");
const domainExpect = EXPECT.domain_open_counts as Record<DomainId, number>;
const domainIds = Object.keys(domainExpect) as DomainId[];
const crossDomainIds = new Set<string>();
for (const d of domainIds) {
  const ids = open.filter((r) => r.domains.includes(d)).map((r) => r.id);
  ids.forEach((id) => crossDomainIds.add(id));
  check(`${d} 未关闭不少于原口径`, ids.length >= domainExpect[d], true);
}
check("六领域合计去重后不少于原8件", crossDomainIds.size >= 8, true);

console.log("\n[3] 固定资产投资指标");
check("总部投资计划执行率由明细重算且不等于锁死84", nodeValue("FA-I06").value !== 84, true);
check("FA-P001 执行率(%)", leafValue("FA-I06", "FA-P001"), EXPECT.fa_p001_ytd_execution_pct);
check("FA-P003 执行率(%)", leafValue("FA-I06", "FA-P003"), EXPECT.fa_p003_ytd_execution_pct);
check("FA-P001 预计完工偏差率(%)", leafValue("FA-I07", "FA-P001"), EXPECT.fa_p001_eac_deviation_pct);
check("总部预计完工偏差率(%)", nodeValue("FA-I07").value, EXPECT.fa_root_eac_deviation_pct);
check("重大资产低利用率净值占比由明细重算", typeof nodeValue("FA-I14").value === "number", true);
check("同类资产总体利用率由明细重算", typeof nodeValue("FA-I01").value === "number", true);

console.log("\n[4] 股权投资指标");
check(
  "EQ-P001 到期出资履约率(%)",
  leafValue("EQ-X01-RATE", "EQ-P001"),
  EXPECT.eq_p001_due_contribution_fulfillment_pct,
);
check(
  "EQ-P001 已到期分红回收率(%)",
  leafValue("EQ-X02-RATE", "EQ-P001"),
  EXPECT.eq_p001_due_dividend_collection_pct,
);
check(
  "EQ-P001 现金回报目标偏差(%)",
  leafValue("EQ-CASH-DEVIATION", "EQ-P001"),
  EXPECT.eq_p001_cash_return_deviation_pct,
);
check(
  "EQ-P001 期间会计投资收益率(%)",
  leafValue("EQ-I15", "EQ-P001"),
  EXPECT.eq_p001_accounting_return_pct,
);
check("总部会计投资收益率由明细重算", typeof nodeValue("EQ-I15").value === "number", true);
check("年度投资计划完成率由明细重算", typeof nodeValue("EQ-I11").value === "number", true);

console.log("\n[5] 工程项目与资金指标");
check("ENG-P001预计毛利率仍为12", leafValue("ENG-I01", "ENG-P001"), 12);
check("总部预计完工毛利率由明细重算", typeof nodeValue("ENG-I01").value === "number" && nodeValue("ENG-I01").value !== 12, true);
check("期末资金余额(万元)", nodeValue("CASH-I01").value, EXPECT.cash_balance_wan_cny);
check("可用资金(万元)", nodeValue("CASH-I02").value, EXPECT.cash_available_wan_cny);
const restrictedPct = nodeValue("CASH-I07");
check(
  "受限资金(万元，由占比与余额还原)",
  restrictedPct.numerator,
  EXPECT.cash_restricted_wan_cny,
);

console.log("\n[6] 阶段未关闭事项（横向箭头上的数字）");
const phaseExpect = STAGE.open_case_count_by_phase;
const phaseDomain = new Map<string, DomainId>();
for (const t of seed.lifecycle_templates) {
  for (const n of t.phase_nodes) phaseDomain.set(n.id, t.domain as DomainId);
}
let phaseMismatch = 0;
for (const [phaseId, expected] of Object.entries(phaseExpect)) {
  const domain = phaseDomain.get(phaseId);
  if (!domain) {
    failures.push(`阶段 ${phaseId} 在生命周期模板中不存在`);
    phaseMismatch += 1;
    continue;
  }
  const actual = openCountForPhase(domain, phaseId, HQ, risks, AS_OF).open;
  if (actual < expected) {
    failures.push(`阶段 ${phaseId} 未关闭数：实际 ${actual}，预期至少 ${expected}`);
    phaseMismatch += 1;
  }
}
check(`${Object.keys(phaseExpect).length} 个阶段未关闭数逐一比对`, phaseMismatch, 0);

console.log("\n[7] 环节联动五数（点击箭头后下区统计）");
function fiveCounts(domain: DomainId, phaseId: string, scenarioId: string) {
  return computeFiveCounts(
    {
      domain,
      orgScope: HQ,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      asOf: AS_OF,
      phaseId,
      scenarioId,
    },
    risks,
  );
}

const faS20 = fiveCounts("FA", "FA-V12-06", "FA-S20");
const e1 = STAGE.FA_V12_06_FA_S20;
check("建设实施/FA-S20 监测项目数", faS20.monitoredObjects.length, e1.monitored_projects);
check("建设实施/FA-S20 命中项目数", faS20.hitObjects.length, e1.hit_projects);
check("建设实施/FA-S20 未关闭事项不少于原口径", faS20.openRiskIds.length >= e1.open_cases, true);
check(
  "建设实施/FA-S20 本期整改闭环",
  faS20.rectifiedClosedRiskIds.length,
  e1.rectified_closed_cases,
);
check("建设实施/FA-S20 逾期整改", faS20.overdueRiskIds.length, e1.overdue_rectification_cases);

const faS29 = fiveCounts("FA", "FA-V12-08", "FA-S29");
const e2 = STAGE.FA_V12_08_FA_S29;
check("运营及后评价/FA-S29 监测资产数", faS29.monitoredObjects.length, e2.monitored_assets);
check("运营及后评价/FA-S29 命中资产数", faS29.hitObjects.length, e2.hit_assets);
check("运营及后评价/FA-S29 未关闭事项", faS29.openRiskIds.length, e2.open_cases);
check(
  "运营及后评价/FA-S29 本期整改闭环",
  faS29.rectifiedClosedRiskIds.length,
  e2.rectified_closed_cases,
);
check("运营及后评价/FA-S29 逾期整改", faS29.overdueRiskIds.length, e2.overdue_rectification_cases);

const eqX01 = fiveCounts("EQ", "EQ-V12-05", "EQ-X01");
const e3 = STAGE.EQ_V12_05_EQ_X01;
check("股权投后/EQ-X01 监测项目数", eqX01.monitoredObjects.length, e3.monitored_equity_projects);
check("股权投后/EQ-X01 命中项目数", eqX01.hitObjects.length, e3.hit_equity_projects);
check("股权投后/EQ-X01 未关闭事项不少于原口径", eqX01.openRiskIds.length >= e3.open_cases, true);
check(
  "股权投后/EQ-X01 本期整改闭环",
  eqX01.rectifiedClosedRiskIds.length,
  e3.rectified_closed_cases,
);

console.log("\n[8] 业务阶段已完成不影响事项存量");
const hist = STAGE.historical_completed_stage;
const histInstance = seed.lifecycle_instances.find(
  (i) => i.object_id === hist.object_id && i.phase_id === hist.phase_id,
);
check(
  `${hist.object_id} / ${hist.phase_id} 业务状态`,
  histInstance?.business_status,
  hist.business_status,
);
check(
  "该已完成阶段仍保留的未关闭事项",
  openCountForPhase("EQ", hist.phase_id, HQ, risks, AS_OF).riskIds,
  hist.still_open_risk_ids,
);

console.log("\n[9] 第二批：范围、期间、覆盖与权限");
const HQ_SELF = orgScope(ROOT_ORG_ID, false);
const hqSelfFa = computeIndicator(indicator("FA-I06"), HQ_SELF, CTX);
check("总部仅本级投资计划执行率状态", hqSelfFa.status, "no_business");
check("总部含下级投资计划执行率由明细重算", typeof nodeValue("FA-I06").value === "number" && nodeValue("FA-I06").value !== 84, true);

const unitBUser = userById("USER-UNIT-B");
const bOrgs = intersectOrgScope("ORG-B", true, unitBUser);
check("单位B范围不含A1", bOrgs.has("ORG-A1"), false);
check("单位B执行率(%)", computeIndicator(indicator("FA-I06"), bOrgs, CTX).value, EXPECT.fa_p003_ytd_execution_pct);
const bFaOpen = computeIndicator(indicator("FA-OPEN"), bOrgs, CTX);
check("单位B未关闭事项为0而非无业务", bFaOpen.value, 0);
check("单位B未关闭事项状态", bFaOpen.status, "normal");
const bLeaves = indicatorLeaves(indicator("FA-I06"), {
  ...CTX,
  allowedObjectIds: authorizedObjectIds(unitBUser),
}).filter((l) => bOrgs.has(l.orgId));
check("单位B执行率明细不含FA-P001", bLeaves.some((l) => l.objectId === "FA-P001"), false);

const faS02 = computeFiveCounts(
  {
    domain: "FA",
    orgScope: HQ,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    asOf: AS_OF,
    scenarioId: "FA-S02",
  },
  risks,
);
const faS21 = computeFiveCounts(
  {
    domain: "FA",
    orgScope: HQ,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    asOf: AS_OF,
    scenarioId: "FA-S21",
  },
  risks,
);
check("FA-S02应评估分母不含候选", faS02.requiredObjects.length, 0);
check("FA-S21应评估分母不含候选", faS21.requiredObjects.length, 0);

const Q1_CTX = { periodStart: "2026-01-01", periodEnd: "2026-03-31", asOf: AS_OF, risks };
const q1Fa = computeIndicator(indicator("FA-I06"), HQ, Q1_CTX);
check("Q1投资计划执行率未覆盖", q1Fa.status, "unknown");
check("Q1投资计划执行率原因", q1Fa.emptyReason, "该期间数据未覆盖");
check("Q1不含P-PAY001", seed.cash_transactions.some((t) => t.id === "P-PAY001" && inDateRange(t.date, "2026-01-01", "2026-03-31")), false);
check(
  "2025H2含历史付款",
  seed.cash_transactions.some((t) => t.id === "HIST-PAY01" && inDateRange(t.date, "2025-07-01", "2025-12-31")),
  true,
);

const viewUser = userById("USER-HQ-VIEW");
check("只读不能发布规则", can(viewUser, "config.rules.publish"), false);
check("只读不能重置配置", can(viewUser, "config.reset"), false);
check("只读不能督办", canCaseAction(viewUser, "urge"), false);
check("只读不能采用整改材料", canCaseAction(viewUser, "adopt_rectification"), false);

const configUser = userById("USER-CONFIG");
const configOrgs = intersectOrgScope("ORG-HQ", true, configUser);
check("配置管理员业务组织交集为空", configOrgs.size, 0);
check(
  "配置管理员执行率无业务",
  computeIndicator(indicator("FA-I06"), configOrgs, CTX).status,
  "no_business",
);
check("独立试算样本不含总部项目名", INDEPENDENT_TRIAL_PROJECTS.some((p) => p.name.includes("基地能力")), false);
check("独立试算样本甲预算", INDEPENDENT_TRIAL_PROJECTS[0].effective_approved_budget, 10000);

const pay = seed.cash_transactions.find((t) => t.id === "P-PAY001");
check("R07实付1200", pay?.amount_wan_cny, 1200);
check("R07批准800", pay?.approved_amount, 800);
check("R07可支付上限2000", pay?.certified_payable_amount, 2000);

console.log("\n[综合总览主体口径]");
const overviewScopeHq = {
  orgIds: HQ,
  authorizedOrgIds: HQ,
  allowedObjectIds: null as string[] | null,
  risks: seed.risk_cases,
  asOf: AS_OF,
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  ctx: CTX,
};
check("总部含下级纳管单位不含部门/项目部", managedOrganizations(HQ).some((o) => o.id === "ORG-HQ-FIN" || o.id === "ORG-A-PMO"), false);
check("总部含下级纳管单位含总部", managedOrgCount(HQ) >= 19, true);
check("总部仅本级纳管单位", managedOrgCount(HQ_SELF), 1);
check("工程项目期间实施规模", seed.engineering_projects.length, 64);
check(
  "工程项目本期完工",
  seed.engineering_projects.filter((p) => p.status === "本期完工").length,
  9,
);
check("总部含下级纳管项目大于原6个", inScopeProjectCount(HQ, null, PERIOD_START, PERIOD_END) > 6, true);
check("总部仅本级纳管项目", inScopeProjectCount(HQ_SELF, null, PERIOD_START, PERIOD_END), 0);
const orgA = orgScope("ORG-A", true);
check("单位A含下级纳管单位（不含总部）", managedOrgCount(orgA), 3);
check("单位C纳管单位", managedOrgCount(orgScope("ORG-C", true)), 1);
check("单位C纳管项目", inScopeProjectCount(orgScope("ORG-C", true), null, PERIOD_START, PERIOD_END), 0);
const hitOrgs = hitOwnerOrgIds(overviewScopeHq);
check("命中涉及单位不含无直接对象的总部", hitOrgs.includes("ORG-HQ"), false);
check("命中涉及单位含单位A直接归属对象", hitOrgs.includes("ORG-A"), true);
check("命中涉及单位仍含实际归属A1", hitOrgs.includes("ORG-A1"), true);
const aStats = orgNodeStats("ORG-A", overviewScopeHq);
const aSelfProjects = inScopeProjectCount(new Set(["ORG-A"]), null, PERIOD_START, PERIOD_END, AS_OF);
check("单位A含下级项目数大于本级", aStats.projectCount > aSelfProjects, true);
const a1Stats = orgNodeStats("ORG-A1", overviewScopeHq);
const a1Self = inScopeProjectCount(new Set(["ORG-A1"]), null, PERIOD_START, PERIOD_END, AS_OF);
check("末级A1含下级与本级项目数相同", a1Stats.projectCount, a1Self);
const bStats = orgNodeStats("ORG-B", overviewScopeHq);
const bSelf = inScopeProjectCount(new Set(["ORG-B"]), null, PERIOD_START, PERIOD_END, AS_OF);
check("无三级的单位B含下级与本级项目数相同", bStats.projectCount, bSelf);
const faCard = overviewDomainCards(overviewScopeHq, () => true).find((c) => c.domain === "FA");
check("固定资产完成额与执行率同属FA-I06", Boolean(faCard && faCard.metrics.length === 2 && faCard.metrics.every((m) => m.indicatorId === "FA-I06")), true);
check("固定资产主指标为投资计划执行率", faCard?.metrics[0]?.label, "投资计划执行率");
check("固定资产辅助字段为投资完成额", faCard?.metrics[1]?.label, "投资完成额");
check("默认截至日命中单位显示数字", /^\d+$/.test(hitOrgMetric(overviewScopeHq).display), true);
const histAsOf = "2026-05-15";
const histScope = {
  ...overviewScopeHq,
  asOf: histAsOf,
  ctx: { ...CTX, asOf: histAsOf },
};
const openRect = openRectificationCases(overviewScopeHq);
check("历史截至日R11仍显示未关闭", openRectificationCases(histScope).some((r) => r.id === "R11"), true);
check("6月末R11不在未关闭整改", openRect.some((r) => r.id === "R11"), false);
check("历史截至日不含截至日后评估", validHitRecords(histScope).length, 0);
check("历史截至日无适用监测执行", applicableMonitorExecutions(HQ, histScope).evaluations + applicableMonitorExecutions(HQ, histScope).actualRows, 0);
check("历史截至日监测状态为未开展", orgMonitorStatus(HQ, histScope), "not_started");
check("历史截至日命中单位显示—", hitOrgMetric(histScope).display, "—");
check("历史截至日命中单位状态未开展监测", hitOrgMetric(histScope).caption, "未开展监测");
check("历史截至日不按空命中数组报0", hitOrgMetric(histScope).orgIds.length, 0);
const histFa = overviewDomainCards(histScope, () => true).find((c) => c.domain === "FA");
check("历史截至日领域命中为—", histFa?.hitRuleDisplay, "—");
check("历史截至日领域监测未开展", histFa?.hitMonitorLabel, "未开展监测");
check("历史截至日单位卡命中为—", orgNodeStats("ORG-A", histScope).hitRuleDisplay, "—");
check("历史截至日执行率不沿用6月末", computeIndicator(indicator("FA-I06"), HQ, { ...CTX, asOf: histAsOf }).status, "unknown");
check(
  "待核查不计入未关闭整改",
  openRect.every((r) => r.status !== "pending_review" && r.status !== "investigating"),
  true,
);
check("未关闭整改不含已排除", openRect.every((r) => r.status !== "excluded" && r.status !== "closed"), true);
check("逾期整改是未关闭整改子集", overdueRectificationCases(overviewScopeHq).every((r) => openRect.some((x) => x.id === r.id)), true);
check("本期完成整改仍为关闭", completedRectificationCases(overviewScopeHq).every((r) => r.status === "closed"), true);
check("原R01–R09仍在种子中", ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09"].every((id) => seed.risk_cases.some((r) => r.id === id)), true);
check("EQ-I11总览不因首页启用", overviewIndicatorEnabled(indicator("EQ-I11")), false);
check("现金回报偏差随 EQ-I08 未启用", overviewIndicatorEnabled(indicator("EQ-CASH-DEVIATION")), false);
check("现金回报偏差不在首页展示", overviewIndicatorOnHomepage(indicator("EQ-CASH-DEVIATION")), false);
check("部门节点存在但不计入单位数", seed.organizations.some((o) => o.id === "ORG-HQ-FIN") && !isManagedUnit(seed.organizations.find((o) => o.id === "ORG-HQ-FIN")!), true);

console.log(`\n合计：${passed} 项通过，${failures.length} 项未通过。`);
if (failures.length) {
  console.log("\n未通过明细：");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("全部验收断言通过。\n");
