import type { ConfigUser } from "./config";
import type { CatalogGroup, CatalogIndicator, CatalogRule, CatalogSubscenario } from "./config-catalog";
import { isExecutableCapability } from "./fp-topics";
import { coverageRows, seed } from "./seed";
import { isOpen } from "./risks";
import type { RiskCase } from "./types";

function ruleIsExecutableNow(rule: CatalogRule, sub?: CatalogSubscenario): boolean {
  if (rule.enabled === false || rule.status === "disabled" || rule.status === "retired" || rule.status === "draft") return false;
  if (!rule.published) return false;
  const cap = rule.runtime_capability ?? sub?.runtime_capability;
  return isExecutableCapability(cap);
}

function remainingExecutableAfterDisable(
  catalog: { subscenarios: CatalogSubscenario[]; rules: CatalogRule[] },
  primaryId: string,
  disable: { kind: "rule" | "sub"; id: string },
): number {
  const children = catalog.subscenarios.filter((s) => s.parent_id === primaryId);
  let n = 0;
  for (const sub of children) {
    if (disable.kind === "sub" && sub.id === disable.id) continue;
    if (sub.enabled === false || sub.status === "disabled" || sub.status === "retired") continue;
    const rules = catalog.rules.filter((r) => r.primary_subscenario_id === sub.id);
    const keep = rules.filter((r) => {
      if (disable.kind === "rule" && r.id === disable.id) return false;
      return ruleIsExecutableNow(r, sub);
    });
    if (keep.length > 0 && isExecutableCapability(sub.runtime_capability)) n += 1;
  }
  return n;
}

export function lastExecutableCoverageNote(
  catalog: { groups: CatalogGroup[]; subscenarios: CatalogSubscenario[]; rules: CatalogRule[] },
  disable: { kind: "rule" | "sub"; id: string },
): string | null {
  const sub =
    disable.kind === "sub"
      ? catalog.subscenarios.find((s) => s.id === disable.id)
      : catalog.subscenarios.find((s) => s.id === catalog.rules.find((r) => r.id === disable.id)?.primary_subscenario_id);
  if (!sub) return null;
  const group = catalog.groups.find((g) => g.id === sub.parent_id);
  if (!group) return null;
  if (remainingExecutableAfterDisable(catalog, group.id, disable) > 0) return null;
  return `该一级场景「${group.name}」将不再开展后续监测。`;
}

export interface DisableImpact {
  title: string;
  detail: string;
  blocking?: string;
}

export function userDisableImpact(user: ConfigUser, all: ConfigUser[], actorId?: string): DisableImpact {
  if (user.id === actorId) {
    return { title: "不能停用", detail: "不能停用当前正在使用的账号。", blocking: "请先切换其他身份再停用。" };
  }
  const admins = all.filter(
    (u) => u.status !== "disabled" && u.status !== "retired" && u.role_ids.includes("ROLE-SYSTEM-ADMIN"),
  );
  if (user.role_ids.includes("ROLE-SYSTEM-ADMIN") && admins.length <= 1 && user.status !== "disabled") {
    return {
      title: "不能停用",
      detail: "这是最后一位启用中的系统配置管理员。",
      blocking: "请先启用或新增其他配置管理员。",
    };
  }
  return {
    title: "停用用户",
    detail: `停用「${user.name}」后，该身份立即失去页面与写操作权限。历史办理记录仍保留承办人姓名。`,
  };
}

export function subDisableImpact(
  sub: CatalogSubscenario,
  risks: RiskCase[],
  catalog?: { groups: CatalogGroup[]; subscenarios: CatalogSubscenario[]; rules: CatalogRule[] },
): DisableImpact {
  const rows = coverageRows.filter((r) => r.scenario_id === sub.id);
  const open = risks.filter((r) => r.scenario_ids.includes(sub.id) && isOpen(r));
  const coverage = catalog ? lastExecutableCoverageNote(catalog, { kind: "sub", id: sub.id }) : null;
  return {
    title: "停用监管子场景",
    detail: `停用「${sub.name}」后，后续监测停止（当前覆盖 ${rows.length} 条）。未关闭事项 ${open.length} 件仍出现在工作台、对象档案及总览，历史评估与来源版本可从事项查看。${coverage ? ` ${coverage}` : ""}`,
  };
}

export function groupDisableImpact(group: CatalogGroup, subs: CatalogSubscenario[], risks: RiskCase[]): DisableImpact {
  const children = subs.filter((s) => s.parent_id === group.id);
  const childIds = new Set(children.map((s) => s.id));
  const rows = coverageRows.filter((r) => childIds.has(r.scenario_id));
  const open = risks.filter((r) => r.scenario_ids.some((id) => childIds.has(id)) && isOpen(r));
  return {
    title: "停用一级监管场景",
    detail: `停用「${group.name}」后，其下 ${children.length} 个子场景停止后续监测（覆盖 ${rows.length} 条）。未关闭事项 ${open.length} 件仍出现在工作台、对象档案及总览。`,
  };
}

export function ruleDisableImpact(
  rule: CatalogRule,
  risks: RiskCase[],
  catalog?: { groups: CatalogGroup[]; subscenarios: CatalogSubscenario[]; rules: CatalogRule[] },
): DisableImpact {
  const evals = seed.rule_evaluations.filter((e) => e.rule_id === rule.id);
  const open = risks.filter((r) => r.rule_id === rule.id && isOpen(r));
  const coverage = catalog ? lastExecutableCoverageNote(catalog, { kind: "rule", id: rule.id }) : null;
  return {
    title: "停用监测规则",
    detail: `停用「${rule.name}」后，后续监测停止。历史评估 ${evals.length} 条、未关闭事项 ${open.length} 件仍可查看并办理，原版本与参数可从事项依据中查看，不会被覆盖或关闭。${coverage ? ` ${coverage}` : ""}`,
  };
}

export function indicatorDisableImpact(ind: CatalogIndicator): DisableImpact {
  const onHome = ind.display_position === "homepage";
  return {
    title: "停用指标",
    detail: onHome
      ? `停用「${ind.name}」后，综合总览与领域首页不再展示该指标卡。历史事项与已计算口径记录保留。`
      : `停用「${ind.name}」后，指标目录与相关展示入口不再提供该指标。历史记录保留。`,
  };
}
