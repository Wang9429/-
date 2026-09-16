import { getLiveConfig } from "./live-config";
import { seed } from "./seed";
import type { RuleEvaluation } from "./types";

/** 种子历史评估 + 发布后新增评估。后者只追加，不改写原记录。 */
export function allRuleEvaluations(): RuleEvaluation[] {
  const extra = getLiveConfig().runtimeEvaluations ?? [];
  if (!extra.length) return seed.rule_evaluations;
  const seen = new Set(seed.rule_evaluations.map((e) => e.id));
  return [...seed.rule_evaluations, ...extra.filter((e) => !seen.has(e.id))];
}
