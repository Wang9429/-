import type { ConfigUser } from "./config";
import type { CatalogGroup, CatalogIndicator, CatalogRule, CatalogSubscenario } from "./config-catalog";
import { coverageRows, seed } from "./seed";
import { isOpen } from "./risks";
import type { RiskCase } from "./types";

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

export function subDisableImpact(sub: CatalogSubscenario, risks: RiskCase[]): DisableImpact {
  const rows = coverageRows.filter((r) => r.scenario_id === sub.id);
  const open = risks.filter((r) => r.scenario_ids.includes(sub.id) && isOpen(r));
  return {
    title: "停用监管子场景",
    detail: `停用「${sub.name}」后，业务清单不再展示该子场景（当前覆盖 ${rows.length} 条）。未关闭事项 ${open.length} 件及历史评估仍保留原引用，不会被删除或改写。`,
  };
}

export function groupDisableImpact(group: CatalogGroup, subs: CatalogSubscenario[], risks: RiskCase[]): DisableImpact {
  const children = subs.filter((s) => s.parent_id === group.id);
  const childIds = new Set(children.map((s) => s.id));
  const rows = coverageRows.filter((r) => childIds.has(r.scenario_id));
  const open = risks.filter((r) => r.scenario_ids.some((id) => childIds.has(id)) && isOpen(r));
  return {
    title: "停用一级监管场景",
    detail: `停用「${group.name}」后，其下 ${children.length} 个子场景不再进入业务入口（覆盖 ${rows.length} 条）。未关闭事项 ${open.length} 件仍保留历史引用。`,
  };
}

export function ruleDisableImpact(rule: CatalogRule, risks: RiskCase[]): DisableImpact {
  const evals = seed.rule_evaluations.filter((e) => e.rule_id === rule.id);
  const open = risks.filter((r) => r.rule_id === rule.id && isOpen(r));
  return {
    title: "停用监测规则",
    detail: `停用「${rule.name}」后，后续评估不再采用其已发布版本。历史评估 ${evals.length} 条、未关闭事项 ${open.length} 件保留原参数与结论，不会被覆盖。`,
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
