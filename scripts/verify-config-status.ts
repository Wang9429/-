/**
 * 配置状态与相关统计校准自检。
 * 运行：npx tsx scripts/verify-config-status.ts
 */
import {
  extractCatalog,
  ruleRuntimeKind,
  RULE_RUNTIME_LABEL,
  blankSub,
  type CatalogPersist,
  type CatalogSubscenario,
} from "../lib/config-catalog";
import { isScenarioMonitoringActive, publishedWatchRule, syncLiveFromCatalog } from "../lib/live-config";
import { computeFiveCounts, scenarioRuntimeStatus, selectRows } from "../lib/monitoring";
import { computeIndicator, indicatorById } from "../lib/metrics";
import { AS_OF, seed } from "../lib/seed";
import { orgScope, ROOT_ORG_ID } from "../lib/org";
import { isOpen } from "../lib/risks";
import type { DomainId } from "../lib/types";

const PERIOD_START = "2026-01-01";
const HQ = orgScope(ROOT_ORG_ID, true);
const ORG_C = orgScope("ORG-C", false);
const CTX = { periodStart: PERIOD_START, periodEnd: AS_OF, asOf: AS_OF, risks: seed.risk_cases };

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  通过  ${name}：${JSON.stringify(actual)}`);
  } else {
    failures.push(`${name}：实际 ${JSON.stringify(actual)}，预期 ${JSON.stringify(expected)}`);
    console.log(`  失败  ${name}：实际 ${JSON.stringify(actual)}，预期 ${JSON.stringify(expected)}`);
  }
}

function faGroup(cat: CatalogPersist) {
  return cat.groups.find((g) => g.domain === "FA")!;
}

function extraSub(overrides: Partial<CatalogSubscenario>): CatalogPersist {
  const cat = extractCatalog();
  const parent = faGroup(cat);
  cat.subscenarios.push({
    ...blankSub("FA-S99-TEST", parent),
    name: "校准测试子场景",
    enabled: true,
    status: "published",
    object_types: ["fixed_asset_project"],
    ...overrides,
  });
  syncLiveFromCatalog(cat);
  return cat;
}

function publishWatch(pct: number): CatalogPersist {
  const cat = extractCatalog();
  const rule = cat.rules.find((r) => r.id === "NEW-FA-RULE-001");
  if (!rule) throw new Error("缺少 NEW-FA-RULE-001");
  const version = {
    version: `V-TEST-${pct}`,
    at: "2026-06-30T00:00:00.000Z",
    operator: "校准",
    scope: "授权范围内适用对象",
    effective_date: AS_OF,
    parameters: { deviation_gt_pct: pct },
  };
  rule.status = "published";
  rule.enabled = true;
  rule.draft_parameters = { deviation_gt_pct: pct };
  rule.published = version;
  rule.versions = [...rule.versions, version];
  syncLiveFromCatalog(cat);
  return cat;
}

function disableScenario(id: string): CatalogPersist {
  const cat = extractCatalog();
  cat.subscenarios = cat.subscenarios.map((s) =>
    s.id === id ? { ...s, enabled: false, status: "disabled" } : s,
  );
  syncLiveFromCatalog(cat);
  return cat;
}

function statusOf(id: string, domain: DomainId, orgIds: Set<string>) {
  const rows = selectRows({
    domain,
    orgScope: orgIds,
    periodStart: PERIOD_START,
    periodEnd: AS_OF,
    asOf: AS_OF,
    scenarioId: id,
  });
  return scenarioRuntimeStatus(id, rows, { domain, orgScope: orgIds });
}

function metric(id: string, orgIds = HQ) {
  const def = indicatorById(id);
  if (!def) throw new Error(`缺少指标 ${id}`);
  return computeIndicator(def, orgIds, CTX);
}

console.log("\n== 1. 新增子场景状态 ==");
extraSub({ applicability: "pending", required_fields: [] });
check("适用范围未确定 → 待确认适用性", statusOf("FA-S99-TEST", "FA", HQ).label, "待确认适用性");

extraSub({ applicability: "confirmed", required_fields: [] });
check("已确定适用且总部有对象、尚未运行 → 待评估", statusOf("FA-S99-TEST", "FA", HQ).label, "待评估");

extraSub({ applicability: "confirmed", required_fields: ["完工预计投资构成"] });
check(
  "缺少必要字段 → 未评估并列明缺失",
  statusOf("FA-S99-TEST", "FA", HQ).label,
  "未评估（缺 完工预计投资构成）",
);

extraSub({ applicability: "confirmed", required_fields: [] });
check("ORG-C 范围内无对象 → 无业务", statusOf("FA-S99-TEST", "FA", ORG_C).label, "无业务");

syncLiveFromCatalog(extractCatalog());
check("CASH-S05 已监测无命中 → 命中数为0", statusOf("CASH-S05", "CASH", HQ).label, "命中数为0");

const faS20 = statusOf("FA-S20", "FA", HQ);
check("FA-S20 种子有命中，不显示无业务", faS20.label.includes("无业务"), false);
check("FA-S20 状态含命中", faS20.label.includes("命中"), true);

console.log("\n== 2. 预计超概 vs 关注规则命中 ==");
syncLiveFromCatalog(extractCatalog());
const p001 = seed.fixed_asset_projects.find((p) => p.id === "FA-P001")!;
check("FA-P001 EAC", p001.eac, 11800);
check("FA-P001 有效概算", p001.effective_approved_budget, 10000);
check("FA-P001 预计偏差 18%", ((p001.eac as number) - p001.effective_approved_budget) / p001.effective_approved_budget, 0.18);
check("未发布关注规则", publishedWatchRule(), null);

const over0 = metric("FA-CNT-OVERBUDGET");
const watch0 = metric("FA-CNT-WATCH-HIT");
check("未发布时预计超概项目数", over0.value, 1);
check("未发布时关注命中不是 0", watch0.value, null);
check("未发布时关注命中状态 unknown", watch0.status, "unknown");
check("未发布文案", watch0.emptyReason, "关注规则未发布，未执行");
check("预计超概指标名称", indicatorById("FA-CNT-OVERBUDGET")?.name, "预计超概项目数");
check("关注命中指标名称", indicatorById("FA-CNT-WATCH-HIT")?.name, "超概关注规则命中项目数");

publishWatch(10);
check("阈值 10% 已发布", publishedWatchRule()?.pct, 10);
check("阈值 10% 关注命中", metric("FA-CNT-WATCH-HIT").value, 1);
check("阈值 10% 预计超概仍为 1", metric("FA-CNT-OVERBUDGET").value, 1);

publishWatch(25);
check("阈值 25% 已发布", publishedWatchRule()?.pct, 25);
check("阈值 25% 关注命中为 0", metric("FA-CNT-WATCH-HIT").value, 0);
check("阈值 25% 预计超概仍为 1", metric("FA-CNT-OVERBUDGET").value, 1);
check("阈值变化后 FA-P001 金额不变", seed.fixed_asset_projects.find((p) => p.id === "FA-P001")?.eac, 11800);

const r01Eval = seed.rule_evaluations.find((e) => e.risk_ids.includes("R01"));
check("历史评估版本未改写", r01Eval?.rule_version, "DEMO-RULES-V1.2");
check("历史评估仍命中", r01Eval?.effective_result, "hit");
check("R01 仍未关闭", isOpen(seed.risk_cases.find((r) => r.id === "R01")!), true);

console.log("\n== 3. 规则执行能力 ==");
syncLiveFromCatalog(extractCatalog());
const catalog = extractCatalog();
const byKind = { executable: [] as string[], manual_review: [] as string[], definition_only: [] as string[] };
for (const r of catalog.rules) {
  const sub = catalog.subscenarios.find((s) => s.id === r.primary_subscenario_id);
  byKind[ruleRuntimeKind(r, sub)].push(`${r.id} ${r.name}`);
}
check("可执行规则含 NEW-FA-RULE-001", byKind.executable.some((s) => s.startsWith("NEW-FA-RULE-001")), true);
check("可执行规则数量", byKind.executable.length, 1);
const reviewSubs = catalog.subscenarios.filter((s) => s.execution_mode === "professional_review_support");
check("专业核查子场景不少于 1", reviewSubs.length > 0, true);
check("专业核查规则当前为 0（无绑定自动阈值）", byKind.manual_review.length, 0);
check("尚未具备运行条件的规则多于 0", byKind.definition_only.length > 0, true);

publishWatch(10);
const watch = publishedWatchRule();
check("发布后后续评估读取该版本", watch?.version, "V-TEST-10");
check("发布后阈值进入后续评估", watch?.pct, 10);
check("发布新阈值不关闭 R01", isOpen(seed.risk_cases.find((r) => r.id === "R01")!), true);
check("发布新阈值不改历史评估版本", r01Eval?.rule_version, "DEMO-RULES-V1.2");

const catalogInd = catalog.indicators.filter((i) => !indicatorById(i.id));
check("目录中存在无计算器指标", catalogInd.length > 0, true);

console.log("\n== 4. 停用后未关闭事项仍可见 ==");
disableScenario("FA-S20");
check("FA-S20 后续监测已停止", isScenarioMonitoringActive("FA-S20"), false);
const five = computeFiveCounts(
  {
    domain: "FA",
    orgScope: HQ,
    periodStart: PERIOD_START,
    periodEnd: AS_OF,
    asOf: AS_OF,
    scenarioId: "FA-S20",
  },
  seed.risk_cases,
);
check("停用后 FA-S20 未关闭仍含 R01", five.openRiskIds.includes("R01"), true);
const faOpen = computeFiveCounts(
  { domain: "FA", orgScope: HQ, periodStart: PERIOD_START, periodEnd: AS_OF, asOf: AS_OF },
  seed.risk_cases,
);
check("停用后固定资产总览未关闭仍含 R01", faOpen.openRiskIds.includes("R01"), true);
check("停用后 R01 仍可办理", isOpen(seed.risk_cases.find((r) => r.id === "R01")!), true);
check("停用后历史评估仍可查", Boolean(r01Eval && r01Eval.rule_id === "FA-R20-01"), true);

syncLiveFromCatalog(extractCatalog());

console.log("\n== 规则执行能力清单 ==");
console.log(`可执行（${RULE_RUNTIME_LABEL.executable}） ${byKind.executable.length}：`);
byKind.executable.forEach((s) => console.log(`  - ${s}`));
console.log(`专业核查子场景 ${reviewSubs.length}：`);
reviewSubs.forEach((s) => console.log(`  - ${s.id} ${s.name}`));
console.log(`专业核查规则（${RULE_RUNTIME_LABEL.manual_review}） ${byKind.manual_review.length}：`);
byKind.manual_review.forEach((s) => console.log(`  - ${s}`));
console.log(`尚未具备运行条件（${RULE_RUNTIME_LABEL.definition_only}） ${byKind.definition_only.length}：`);
byKind.definition_only.forEach((s) => console.log(`  - ${s}`));
console.log(`仅目录、无计算器指标 ${catalogInd.length}：`);
catalogInd.forEach((i) => console.log(`  - ${i.id} ${i.name}`));

console.log(`\n合计 ${passed + failures.length} 项，失败 ${failures.length} 项`);
if (failures.length) {
  failures.forEach((f) => console.log(`  × ${f}`));
  process.exit(1);
}
