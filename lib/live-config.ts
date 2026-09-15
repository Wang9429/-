import type { CatalogPersist, CatalogSubscenario, CatalogRule } from "./config-catalog";
import { extractCatalog, ruleRuntimeKind } from "./config-catalog";
import { config } from "./config";
import { setLiveScenarioNames } from "./scenario-names-live";

export interface LiveExtraScenario {
  id: string;
  domain: string;
  name: string;
  primary_phase_id: string;
  applicability: "pending" | "confirmed";
  required_fields: string[];
  object_types: string[];
  execution_mode: string;
  enabled: boolean;
}

export interface LiveWatchRule {
  ruleId: string;
  version: string;
  pct: number;
  scope: string;
  effective_date: string;
}

export interface LiveIndicatorMeta {
  id: string;
  enabled: boolean;
  status: string;
  display_position: string;
  name: string;
  domain: string;
}

interface LiveState {
  disabledScenarioIds: Set<string>;
  extraScenarios: LiveExtraScenario[];
  scenarioNames: Map<string, string>;
  subs: Map<string, CatalogSubscenario>;
  indicators: Map<string, LiveIndicatorMeta>;
  publishedWatch: LiveWatchRule | null;
  rules: CatalogRule[];
  aiEnabled: boolean;
  aiTasks: Set<string>;
  aiDomains: Set<string>;
  aiExternalConnected: boolean;
  aiModeDisplay: string;
}

const seedIds = new Set(extractCatalog().subscenarios.map((s) => s.id));

function emptyLive(): LiveState {
  return {
    disabledScenarioIds: new Set(),
    extraScenarios: [],
    scenarioNames: new Map(),
    subs: new Map(),
    indicators: new Map(),
    publishedWatch: null,
    rules: [],
    aiEnabled: true,
    aiTasks: new Set(config.ai.tasks.map((t) => t.id)),
    aiDomains: new Set(["FA", "EQ", "INTL", "CASH", "RIGHTS", "ENG"]),
    aiExternalConnected: false,
    aiModeDisplay: config.ai.mode_display,
  };
}

let current: LiveState = emptyLive();

function isSubActive(s: CatalogSubscenario, parentDisabled: boolean): boolean {
  if (parentDisabled) return false;
  if (s.enabled === false) return false;
  return s.status !== "disabled" && s.status !== "retired";
}

export function syncLiveFromCatalog(catalog: CatalogPersist | null | undefined): void {
  if (!catalog) {
    current = emptyLive();
    setLiveScenarioNames(current.scenarioNames);
    return;
  }
  const disabledGroups = new Set(
    catalog.groups.filter((g) => g.status === "disabled" || g.status === "retired").map((g) => g.id),
  );
  const disabledScenarioIds = new Set<string>();
  const extraScenarios: LiveExtraScenario[] = [];
  const scenarioNames = new Map<string, string>();
  for (const g of catalog.groups) scenarioNames.set(g.id, g.name);
  for (const s of catalog.subscenarios) {
    scenarioNames.set(s.id, s.name);
    const parentDisabled = disabledGroups.has(s.parent_id);
    if (!isSubActive(s, parentDisabled)) disabledScenarioIds.add(s.id);
    if (!seedIds.has(s.id)) {
      extraScenarios.push({
        id: s.id,
        domain: s.domain,
        name: s.name,
        primary_phase_id: s.primary_phase_id,
        applicability: s.applicability,
        required_fields: s.required_fields ?? [],
        object_types: s.object_types ?? [],
        execution_mode: s.execution_mode,
        enabled: isSubActive(s, parentDisabled),
      });
    }
  }
  const indicators = new Map<string, LiveIndicatorMeta>();
  for (const i of catalog.indicators) {
    indicators.set(i.id, {
      id: i.id,
      enabled: i.enabled !== false && i.status !== "disabled" && i.status !== "retired",
      status: i.status,
      display_position: i.display_position,
      name: i.name,
      domain: i.domain,
    });
  }
  const subs = new Map(catalog.subscenarios.map((s) => [s.id, s]));
  let publishedWatch: LiveWatchRule | null = null;
  for (const r of catalog.rules) {
    if (!r.published || r.status !== "published" || r.enabled === false) continue;
    const kind = ruleRuntimeKind(r, subs.get(r.primary_subscenario_id));
    if (kind !== "executable") continue;
    const n = r.published.parameters.deviation_gt_pct;
    if (typeof n !== "number") continue;
    if (!publishedWatch || r.published.effective_date >= publishedWatch.effective_date) {
      publishedWatch = {
        ruleId: r.id,
        version: r.published.version,
        pct: n,
        scope: r.published.scope,
        effective_date: r.published.effective_date,
      };
    }
  }
  current = {
    disabledScenarioIds,
    extraScenarios,
    scenarioNames,
    subs,
    indicators,
    publishedWatch,
    rules: catalog.rules,
    aiEnabled: catalog.ai.enabled !== false,
    aiTasks: new Set(catalog.ai.tasks.filter((t) => t.enabled !== false).map((t) => t.id)),
    aiDomains: new Set(catalog.ai.allowed_domains),
    aiExternalConnected: Boolean(catalog.ai.external_model_connected),
    aiModeDisplay: catalog.ai.mode_display,
  };
  setLiveScenarioNames(scenarioNames);
}

export function getLiveConfig(): LiveState {
  return current;
}

export function isScenarioMonitoringActive(id: string): boolean {
  return !current.disabledScenarioIds.has(id);
}

export function liveSub(id: string): CatalogSubscenario | undefined {
  return current.subs.get(id);
}

export function publishedWatchRule(): LiveWatchRule | null {
  return current.publishedWatch;
}

export function liveRules(): CatalogRule[] {
  return current.rules;
}

export function liveRule(id: string): CatalogRule | undefined {
  return current.rules.find((r) => r.id === id);
}

export function liveRuleLabel(id: string): string {
  const r = liveRule(id);
  return r ? `${r.id} ${r.name}` : id;
}

export function catalogIndicatorVisible(id: string): boolean {
  const meta = current.indicators.get(id);
  if (!meta) return true;
  return meta.enabled;
}

export function catalogIndicatorOnHomepage(id: string): boolean {
  const meta = current.indicators.get(id);
  if (!meta) return true;
  return meta.enabled && meta.display_position === "homepage";
}

export function homepageCatalogIndicatorIds(domain?: string): string[] {
  return [...current.indicators.values()]
    .filter((m) => m.enabled && m.display_position === "homepage" && (!domain || m.domain === domain))
    .map((m) => m.id);
}

export function publishedDeviationPct(): number | null {
  return current.publishedWatch?.pct ?? null;
}

export function liveAi() {
  return {
    enabled: current.aiEnabled,
    tasks: current.aiTasks,
    domains: current.aiDomains,
    externalConnected: current.aiExternalConnected,
    modeDisplay: current.aiModeDisplay,
  };
}

syncLiveFromCatalog(extractCatalog());
