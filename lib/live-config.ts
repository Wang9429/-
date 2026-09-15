import type { CatalogPersist, CatalogSubscenario } from "./config-catalog";
import { extractCatalog } from "./config-catalog";
import { config } from "./config";

export interface LiveExtraScenario {
  id: string;
  domain: string;
  name: string;
  primary_phase_id: string;
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
  indicators: Map<string, LiveIndicatorMeta>;
  publishedDeviationPct: number | null;
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
    indicators: new Map(),
    publishedDeviationPct: null,
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
    if (!seedIds.has(s.id) && isSubActive(s, parentDisabled)) {
      extraScenarios.push({
        id: s.id,
        domain: s.domain,
        name: s.name,
        primary_phase_id: s.primary_phase_id,
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
  const trialId = config.rule_editor.new_rule_example.id;
  const trial = catalog.rules.find((r) => r.id === trialId);
  let publishedDeviationPct: number | null = null;
  if (trial?.published && trial.status === "published" && trial.enabled !== false) {
    const n = trial.published.parameters.deviation_gt_pct;
    if (typeof n === "number") publishedDeviationPct = n;
  }
  current = {
    disabledScenarioIds,
    extraScenarios,
    scenarioNames,
    indicators,
    publishedDeviationPct,
    aiEnabled: catalog.ai.enabled !== false,
    aiTasks: new Set(catalog.ai.tasks.filter((t) => t.enabled !== false).map((t) => t.id)),
    aiDomains: new Set(catalog.ai.allowed_domains),
    aiExternalConnected: Boolean(catalog.ai.external_model_connected),
    aiModeDisplay: catalog.ai.mode_display,
  };
}

export function getLiveConfig(): LiveState {
  return current;
}

export function liveScenarioName(id: string): string | undefined {
  return current.scenarioNames.get(id);
}

export function isScenarioConfiguredVisible(id: string): boolean {
  return !current.disabledScenarioIds.has(id);
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
  return current.publishedDeviationPct;
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
