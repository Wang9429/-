import type { DomainId } from "./types";

/** 资金六个专题、产权四个专题：业务页与配置共用 ID。 */

export const CASH_TOPICS = [
  { id: "CASH2-T-ACCOUNT", name: "账户管理", short: "账户管理" },
  { id: "CASH2-T-PAYMENT", name: "资金收付", short: "资金收付" },
  { id: "CASH2-T-FINANCE", name: "融资与担保", short: "融资与担保" },
  { id: "CASH2-T-OPERATION", name: "资金运作", short: "资金运作" },
  { id: "CASH2-T-SPECIAL", name: "专项资金", short: "专项资金" },
  { id: "CASH2-T-OPERATING", name: "经营风险", short: "经营风险" },
] as const;

export const RIGHTS_TOPICS = [
  { id: "PTY2-T-TRADE", name: "产权交易流转", short: "产权交易" },
  { id: "PTY2-T-REG", name: "产权登记", short: "产权登记" },
  { id: "PTY2-T-IDENTITY", name: "标识与名称资质", short: "标识名称" },
  { id: "PTY2-T-CONTROL", name: "股权与控制权", short: "股权控制" },
] as const;

export const CASH_TOPIC_NAME: Record<string, string> = Object.fromEntries(
  CASH_TOPICS.map((t) => [t.id, t.name]),
);
export const RIGHTS_TOPIC_NAME: Record<string, string> = Object.fromEntries(
  RIGHTS_TOPICS.map((t) => [t.id, t.name]),
);

export const TOPIC_BY_LABEL: Record<string, string> = {
  账户管理: "CASH2-T-ACCOUNT",
  资金收付: "CASH2-T-PAYMENT",
  "融资与担保": "CASH2-T-FINANCE",
  资金运作: "CASH2-T-OPERATION",
  专项资金: "CASH2-T-SPECIAL",
  经营风险: "CASH2-T-OPERATING",
  产权交易流转: "PTY2-T-TRADE",
  产权登记: "PTY2-T-REG",
  "标识与名称资质": "PTY2-T-IDENTITY",
  "股权与控制权": "PTY2-T-CONTROL",
};

export const FIRST_BATCH_SUBS = [
  "CASH2-S039",
  "CASH2-S037",
  "CASH2-S024",
  "CASH2-S033",
  "CASH2-S031",
  "CASH2-S035",
  "PTY2-S006",
  "PTY2-S035",
  "PTY2-S028",
  "PTY2-S032",
] as const;

export type RuntimeCapability =
  | "structured_executable"
  | "assisted_review"
  | "professional_review"
  | "definition_only";

export const RUNTIME_CAPABILITY_LABEL: Record<RuntimeCapability, string> = {
  structured_executable: "可结构化执行",
  assisted_review: "规则辅助人工",
  professional_review: "专业核查",
  definition_only: "仅维护定义",
};

export const FIRST_BATCH_RUNTIME: Record<string, RuntimeCapability> = {
  "CASH2-S039": "structured_executable",
  "CASH2-S037": "structured_executable",
  "CASH2-S024": "structured_executable",
  "CASH2-S033": "assisted_review",
  "CASH2-S031": "assisted_review",
  "CASH2-S035": "assisted_review",
  "PTY2-S006": "structured_executable",
  "PTY2-S035": "structured_executable",
  "PTY2-S028": "structured_executable",
  "PTY2-S032": "professional_review",
};

export const LEGACY_SCENARIO_MAP: Record<string, string> = {
  "CASH-S01": "CASH2-S039",
  "CASH-R01": "CASH2-S039",
  "PTY-S01": "PTY2-SOURCE-DIFF",
};

export const EXEC_MODE_FROM_ZH: Record<string, string> = {
  自动监测: "structured_automatic",
  规则辅助人工: "rule_ai_human",
  专业核查: "professional_review_support",
};

export function topicIdForLabel(label: string | undefined, domain: DomainId): string {
  if (!label) return domain === "CASH" ? "CASH2-T-PAYMENT" : "PTY2-T-TRADE";
  if (label.startsWith("日常专题·")) {
    const rest = label.replace("日常专题·", "");
    return TOPIC_BY_LABEL[rest] ?? (domain === "RIGHTS" ? "PTY2-T-REG" : "CASH2-T-PAYMENT");
  }
  return TOPIC_BY_LABEL[label] ?? (domain === "CASH" ? "CASH2-T-PAYMENT" : "PTY2-T-TRADE");
}

export const RIGHTS_STAGE_TEMPLATE = [
  { id: "PTY2-ST-SCHEME", name: "方案及权限核验", order: 1 },
  { id: "PTY2-ST-DECISION", name: "决策审批", order: 2 },
  { id: "PTY2-ST-AUDIT", name: "审计评估", order: 3 },
  { id: "PTY2-ST-TRADE", name: "交易实施", order: 4 },
  { id: "PTY2-ST-SETTLE", name: "签约结算与交割", order: 5 },
  { id: "PTY2-ST-REG", name: "登记变更及归档", order: 6 },
] as const;

export const STAGE_LABEL_TO_ID: Record<string, string> = {
  方案及权限核验: "PTY2-ST-SCHEME",
  方案论证: "PTY2-ST-SCHEME",
  决策审批: "PTY2-ST-DECISION",
  决策批准: "PTY2-ST-DECISION",
  审计评估: "PTY2-ST-AUDIT",
  交易实施: "PTY2-ST-TRADE",
  交易组织: "PTY2-ST-TRADE",
  签约结算与交割: "PTY2-ST-SETTLE",
  协议签署: "PTY2-ST-SETTLE",
  价款履行: "PTY2-ST-SETTLE",
  登记变更及归档: "PTY2-ST-REG",
  交割变更: "PTY2-ST-REG",
  归档跟踪: "PTY2-ST-REG",
};

export function canonicalRightsStage(phaseIdOrName: string | null | undefined): string | null {
  if (!phaseIdOrName) return null;
  if (phaseIdOrName.startsWith("PTY2-ST-")) return phaseIdOrName;
  return STAGE_LABEL_TO_ID[phaseIdOrName] ?? null;
}

export const ECONOMIC_BEHAVIORS = [
  {
    id: "nonlisted_transfer",
    label: "非上市企业产权转让",
    templateId: "PR-TRANSFER-TEMPLATE-V12",
    topicId: "PTY2-T-TRADE",
    priceApplicable: true,
    listed: false,
  },
  {
    id: "free_transfer",
    label: "无偿划转",
    templateId: "PR-FREE-TEMPLATE-V12",
    topicId: "PTY2-T-TRADE",
    priceApplicable: false,
    listed: false,
  },
  {
    id: "capital_increase",
    label: "企业增资",
    templateId: "PR-CAPITAL-TEMPLATE-V12",
    topicId: "PTY2-T-TRADE",
    priceApplicable: false,
    listed: false,
  },
  {
    id: "asset_transfer",
    label: "资产转让",
    templateId: "PR-ASSET-TEMPLATE-V16",
    topicId: "PTY2-T-TRADE",
    priceApplicable: true,
    listed: false,
  },
  {
    id: "listed_shares",
    label: "上市公司股份",
    templateId: "PR-LISTED-TEMPLATE-V16",
    topicId: "PTY2-T-TRADE",
    priceApplicable: true,
    listed: true,
  },
] as const;

export const CASH2_FINANCE_HOMEPAGE_IDS = [
  "CASH2-I01",
  "CASH2-I02",
  "CASH2-I03",
  "CASH2-I04",
  "CASH2-I05",
  "CASH2-I06",
  "CASH2-I09",
  "CASH-I02",
  "CASH-I07",
] as const;

export const CASH2_PROFIT_IDS = ["CASH2-I01", "CASH2-I02", "CASH2-I03"] as const;
export const CASH2_BS_IDS = ["CASH2-I04", "CASH2-I05", "CASH2-I06"] as const;
export const CASH2_LIQ_IDS = ["CASH2-I09", "CASH-I02", "CASH-I07"] as const;
