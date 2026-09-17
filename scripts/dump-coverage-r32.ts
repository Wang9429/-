/**
 * 从现工程执行器、目录与样例评估导出 21 项一级场景实际覆盖明细。
 * 覆盖计划 JSON 仅作对照，不作为本表数据源。
 * 运行：npx tsx scripts/dump-coverage-r32.ts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { seed } from "../lib/seed";
import { extractCatalog } from "../lib/config-catalog";
import { coveragePrimaries } from "../lib/fp-directory";
import { FP_TRIAL_OBJECTS, trialRule } from "../lib/fp-rules";
import { hasEffectiveExecutableRule, syncLiveFromCatalog } from "../lib/live-config";
import {
  COVERAGE_REPRESENTATIVE,
  FIRST_BATCH_RUNTIME,
  RUNTIME_CAPABILITY_LABEL,
} from "../lib/fp-topics";

const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
const RESULT_ZH: Record<string, string> = {
  hit: "命中",
  clear: "已完成核验、未命中",
  data_insufficient: "材料不足或待专业核查（不记已评估0命中）",
  not_applicable: "不适用",
};

const PROFESSIONAL_TASK: Record<string, string> = {
  "PTY2-S011": "打开资产范围与评估清单材料，认领专业核查并记录结论（不自动认定隐匿）",
  "PTY2-S032": "打开章程、任免与到任材料，认领专业核查并记录结论（不自动判定控制失效）",
};

const catalog = extractCatalog();
syncLiveFromCatalog(catalog);

const rows = [];
for (const domain of ["CASH", "RIGHTS"] as const) {
  for (const primary of coveragePrimaries(domain === "CASH" ? "CASH" : "RIGHTS")) {
    const subId = COVERAGE_REPRESENTATIVE[primary.primary_id];
    const sub = catalog.subscenarios.find((s) => s.id === subId);
    const rule = catalog.rules.find((r) => r.primary_subscenario_id === subId);
    const objects = FP_TRIAL_OBJECTS[subId] ?? [];
    const object = objects[0];
    if (!object) {
      rows.push({
        domain: domain === "CASH" ? "资金" : "产权",
        primary_id: primary.primary_id,
        primary_name: primary.primary_name,
        sub_id: subId,
        executable: false,
        gap: "无样例对象",
      });
      continue;
    }
    const trial = trialRule(subId, object.id);
    const evals = seed.rule_evaluations.filter(
      (e) => e.rule_id === rule?.id && e.subject_object_id === object.id,
    );
    const evalRow = evals[0];
    const mon = seed.scenario_monitoring_coverage.find(
      (m) => m.scenario_id === subId && m.monitoring_object_id === object.id,
    );
    const cap = FIRST_BATCH_RUNTIME[subId] ?? sub?.runtime_capability ?? "definition_only";
    const evidenceIds = evalRow?.evidence_ids ?? [];
    const evidenceNames = evidenceIds
      .map((id) => seed.evidence.find((e) => e.id === id)?.title ?? id)
      .filter(Boolean);
    rows.push({
      domain: domain === "CASH" ? "资金" : "产权",
      primary_id: primary.primary_id,
      primary_name: primary.primary_name,
      sub_id: subId,
      sub_name: sub?.name ?? "",
      rule_id: rule?.id ?? "",
      effective_version: evalRow?.rule_version ?? rule?.published?.version ?? rule?.version_id ?? "",
      execution_mode: RUNTIME_CAPABILITY_LABEL[cap] ?? cap,
      published: Boolean(rule?.published && rule.status === "published" && rule.enabled),
      executable: hasEffectiveExecutableRule(subId),
      object_id: object.id,
      object_name: object.name,
      basis: trial.formula,
      evidence: evidenceNames.length ? evidenceNames.join("；") : evidenceIds.join("；") || "执行器输入与样例材料",
      result_code: trial.result,
      result: RESULT_ZH[trial.result] ?? trial.result,
      monitoring_status: mon?.status ?? (cap === "professional_review" ? "reference_only" : ""),
      professional_task: PROFESSIONAL_TASK[subId] ?? "",
      inputs: trial.inputs,
    });
  }
}

const complete = rows.filter((r) => r.executable && r.object_id && r.rule_id && r.result_code !== undefined);
const payload = {
  version: "FP-20260917-R3.2",
  commit: COMMIT,
  generated_from: "live catalog + trialRule + seed evaluations",
  coverage_plan_json_not_imported: true,
  funds: `${rows.filter((r) => r.domain === "资金" && r.executable).length}/11`,
  property: `${rows.filter((r) => r.domain === "产权" && r.executable).length}/10`,
  complete: complete.length === 21,
  enabled_official_count: catalog.subscenarios.filter(
    (s) => s.enabled && /^(CASH2|PTY2)-S\d{3}$/.test(s.id) && !s.id.startsWith("CASH2-S9"),
  ).length,
  records: rows,
};

const outDir = path.join("/workspace", "public", "deliverables");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "coverage-r32.json"), JSON.stringify(payload, null, 2));
fs.writeFileSync(
  path.join(outDir, "r32-build.json"),
  JSON.stringify({ version: "FP-20260917-R3.2", commit: COMMIT, stamped_at: "dump-coverage-r32" }, null, 2),
);

const md = [
  "# R3.2 21 项一级场景实际可执行覆盖",
  "",
  `提交 \`${COMMIT}\`。本表由执行器试算、已发布规则与样例评估生成，不是覆盖计划 JSON 导入结果。已启用官方子场景 ${payload.enabled_official_count} 条（未批量启用 80 条）。`,
  "",
  "| 领域 | 一级ID | 一级名称 | 子场景 | 规则 | 有效版本 | 方式 | 对象 | 依据 | 结果或核查任务 |",
  "|---|---|---|---|---|---|---|---|---|---|",
];
for (const r of rows) {
  const task = r.professional_task ? `；${r.professional_task}` : "";
  md.push(
    `| ${r.domain} | ${r.primary_id} | ${r.primary_name} | ${r.sub_id} ${r.sub_name} | ${r.rule_id} | ${r.effective_version} | ${r.execution_mode} | ${r.object_id} ${r.object_name} | ${String(r.basis).replace(/\|/g, "\\|")} | ${r.result}${task} |`,
  );
}
md.push("");
md.push(complete.length === 21 ? "21/21 均具备有效可执行规则、对象、依据及结果或核查任务。" : `未完成 ${21 - complete.length} 项。`);
fs.writeFileSync(path.join(outDir, "coverage-r32.md"), md.join("\n"));
fs.writeFileSync(path.join("/workspace", "docs", "FP-20260917-R3.2", "21项实际覆盖明细.md"), md.join("\n"));

console.log(`覆盖明细 ${complete.length}/21，已启用官方子场景 ${payload.enabled_official_count}，提交 ${COMMIT}`);
for (const r of rows) {
  console.log(
    `${r.executable ? "✓" : "✗"} ${r.primary_id} ${r.sub_id} ${r.rule_id} ${r.object_id} ${r.result_code} ${r.effective_version}`,
  );
}
if (complete.length !== 21) process.exit(1);
