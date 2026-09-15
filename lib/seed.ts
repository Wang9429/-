import seedJson from "@/data/demo_seed.json";
import catalogJson from "@/data/investment_catalog.json";
import type {
  DemoSeed,
  DomainId,
  InvestmentCatalog,
  LifecycleTemplate,
  MonitoringRow,
} from "./types";
import { liveScenarioName } from "./scenario-names-live";

/**
 * 全平台唯一的种子读取入口。页面与计算模块都从这里取数，
 * 不在各领域另造 mock 数组（AGENTS.md “统一数据与关联”）。
 */
export const seed = seedJson as unknown as DemoSeed;
export const catalog = catalogJson as unknown as InvestmentCatalog;

export const AS_OF = seed.as_of; // 2026-06-30，业务截至日固定，不随电脑日期改变
export const DEFAULT_PERIOD = { start: "2026-01-01", end: AS_OF };

export const DOMAIN_META: Record<
  DomainId,
  { id: DomainId; pageId: string; label: string; route: string; short: string }
> = {
  FA: { id: "FA", pageId: "P20", label: "固定资产投资管理", route: "/fixed-asset-investment", short: "固定资产" },
  EQ: { id: "EQ", pageId: "P10", label: "股权投资管理", route: "/equity-investment", short: "股权" },
  INTL: { id: "INTL", pageId: "P30", label: "国际化业务", route: "/international-business", short: "国际化" },
  CASH: { id: "CASH", pageId: "P40", label: "资金管理", route: "/funds", short: "资金" },
  RIGHTS: { id: "RIGHTS", pageId: "P50", label: "产权管理", route: "/property-rights", short: "产权" },
  ENG: { id: "ENG", pageId: "P60", label: "工程项目管理", route: "/engineering-projects", short: "工程" },
};

/** 一级导航顺序固定：综合总览、固定资产、股权、国际化、资金、产权、工程 */
export const NAV_ITEMS = [
  { id: "P00", label: "综合总览", route: "/overview", domain: null as DomainId | null },
  { id: "P20", label: "固定资产投资管理", route: "/fixed-asset-investment", domain: "FA" as DomainId },
  { id: "P10", label: "股权投资管理", route: "/equity-investment", domain: "EQ" as DomainId },
  { id: "P30", label: "国际化业务", route: "/international-business", domain: "INTL" as DomainId },
  { id: "P40", label: "资金管理", route: "/funds", domain: "CASH" as DomainId },
  { id: "P50", label: "产权管理", route: "/property-rights", domain: "RIGHTS" as DomainId },
  { id: "P60", label: "工程项目管理", route: "/engineering-projects", domain: "ENG" as DomainId },
];

export const templatesByDomain = (domain: DomainId): LifecycleTemplate[] =>
  seed.lifecycle_templates.filter((t) => t.domain === domain);

export const templateById = (id: string): LifecycleTemplate | undefined =>
  seed.lifecycle_templates.find((t) => t.id === id);

export const phaseName = (phaseId: string | null | undefined): string => {
  if (!phaseId) return "—";
  for (const t of seed.lifecycle_templates) {
    const node = t.phase_nodes.find((n) => n.id === phaseId);
    if (node) return node.name;
  }
  return phaseId;
};

export const topicName = (topicId: string | null | undefined): string => {
  if (!topicId) return "—";
  for (const d of seed.domain_topics) {
    const t = d.topics.find((x) => x.id === topicId);
    if (t) return t.name;
  }
  return topicId;
};

/**
 * scenario_monitoring_coverage 是 389 条覆盖候选，已包含 31 条实际监测关联。
 * 统一以覆盖表为单一来源，按 status 区分“已完成监测”与“覆盖候选”，
 * 不把两份数组拼接后计数（完整业需 15.1.1）。
 */
export const coverageRows: MonitoringRow[] = seed.scenario_monitoring_coverage;

export const SCENARIO_NAMES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const s of catalog.scenarios) map[s.id] = s.name;
  for (const s of seed.supplemental_scenarios) map[s.id] = s.scenario_name ?? s.name;
  return map;
})();

export const scenarioName = (id: string) => liveScenarioName(id) ?? SCENARIO_NAMES[id] ?? id;

/** 场景的纳入方式标签：结构化监测 / 线索核查 / 核查依据 / 补充监管场景 */
export const SUPPLEMENTAL_SCENARIO_LABEL = "补充监管场景";

export const scenarioAdoption = (id: string): string => {
  const c = catalog.scenarios.find((s) => s.id === id);
  if (c) return c.adoption_mode;
  return SUPPLEMENTAL_SCENARIO_LABEL;
};

export const scenarioSourceLabel = (id: string): string => {
  const c = catalog.scenarios.find((s) => s.id === id);
  if (c) return "投资监管子场景目录";
  return SUPPLEMENTAL_SCENARIO_LABEL;
};

/** 研发审计用，仅配置页展示，不进入业务字段标签 */
export const scenarioAuditSource = (id: string): string => {
  const c = catalog.scenarios.find((s) => s.id === id);
  if (c) return `${c.source_sheet} ${c.source_range}`;
  return SUPPLEMENTAL_SCENARIO_LABEL;
};

export const objectTypeLabel: Record<string, string> = {
  fixed_asset_project: "固定资产投资项目",
  equity_project: "股权投资项目",
  engineering_project: "工程项目",
  asset: "资产",
  property_matter: "产权事项",
  cash_transaction: "资金交易",
  account: "银行账户",
  legal_entity: "法律主体",
  contract: "合同",
  obligation: "义务",
  risk_case: "监管事项",
};

export const monitoringStatusLabel: Record<string, string> = {
  evaluated_hit: "发现关注事项",
  evaluated_clear: "本次监测未发现异常",
  data_insufficient: "覆盖规划候选（待确认适用）",
  not_due: "尚未到核查时点",
  not_applicable: "当前范围无此类事项",
  reference_only: "待专业核查",
};

export const riskStatusLabel: Record<string, string> = seed.status_labels as Record<string, string>;

export const evidenceById = (id: string) => seed.evidence.find((e) => e.id === id);
export const sourceRecordById = (id: string) => seed.source_records.find((r) => r.id === id);
