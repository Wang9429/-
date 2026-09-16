/**
 * 统一数据对象类型。名称仅用于展示，关联一律使用稳定 ID（见完整业需 V1.3 第 15 章）。
 */

export type DomainId = "FA" | "EQ" | "INTL" | "CASH" | "RIGHTS" | "ENG";

export type RiskStatus =
  | "pending_review"
  | "investigating"
  | "rectifying"
  | "pending_verification"
  | "excluded"
  | "closed";

export type Severity = "red" | "yellow";

export type ObjectType =
  | "fixed_asset_project"
  | "equity_project"
  | "engineering_project"
  | "asset"
  | "property_matter"
  | "cash_transaction"
  | "account"
  | "legal_entity"
  | "contract"
  | "obligation"
  | "risk_case";

export interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
  management_level: number;
  node_type: string;
  legal_entity_id: string;
  /** 纳管单位分类；总部部门/项目部不计入单位数 */
  unit_category?: "headquarters" | "company" | "branch" | "business_unit" | "department" | "project_department";
  data_source?: string;
}

export interface LegalEntity {
  id: string;
  name: string;
  country: string;
  role: string;
}

export interface FixedAssetProject {
  id: string;
  name: string;
  owner_org_id: string;
  legal_entity_id: string;
  phase: string;
  project_type: string;
  currency: string;
  amount_unit: string;
  tax_basis?: string;
  feasibility_approved_estimate?: number;
  original_approved_budget?: number;
  effective_approved_budget: number;
  annual_plan?: number;
  forecast_annual_investment?: number;
  ytd_plan?: number;
  ytd_completed_investment?: number;
  cumulative_completed_investment?: number;
  eac?: number;
  eac_complete?: boolean;
  planned_progress_pct?: number;
  actual_progress_pct?: number;
  funds_plan_ytd?: number;
  cash_paid_ytd?: number;
  approved_completion?: string;
  forecast_completion?: string;
  final_investment?: number;
  acceptance_date?: string;
  ready_for_use_date?: string;
  capitalization_date?: string;
  post_evaluation_due?: string;
  asset_ids?: string[];
  primary_phase_id: string;
  active_phase_ids: string[];
  managed_start?: string;
  managed_end?: string | null;
  status?: string;
  data_source?: string;
  domain_ids?: DomainId[];
}

export interface UtilizationPoint {
  period: string;
  actual_pct: number;
  data_nature?: string;
}

export interface Asset {
  id: string;
  name: string;
  owner_org_id: string;
  legal_entity_id: string;
  source_project_id: string;
  asset_type: string;
  functional_class: string;
  is_major: boolean;
  gross_value: number;
  accumulated_depreciation: number;
  impairment_allowance: number;
  net_book_value: number;
  status: string;
  planned_available_hours: number;
  productive_hours: number;
  utilization_threshold_pct: number;
  utilization_history: UtilizationPoint[];
  quarterly_utilization_history: UtilizationPoint[];
  low_utilization_confirmed: boolean;
  confirmation_date?: string;
  formally_idle: boolean;
  registration_required: boolean;
  monitoring_frequency: string;
  threshold_nature?: string;
  monthly_trend_note?: string;
}

export interface EquityProject {
  id: string;
  name: string;
  owner_org_id: string;
  legal_entity_id: string;
  investee_id: string;
  phase: string;
  investment_type: string;
  holding_pct: number;
  approved_total_investment: number;
  annual_investment_plan: number;
  ytd_contribution: number;
  cumulative_contribution: number;
  contribution_due_to_date: number;
  contribution_due_date: string;
  opening_book_balance: number;
  closing_book_balance_before_impairment: number;
  impairment_allowance: number;
  accounting_method_demo: string;
  accounting_investment_income_ytd: number;
  accounting_income_includes_declared_dividends: boolean;
  dividend_due: number;
  cash_dividend_received: number;
  cash_return_target_ytd: number;
  dividend_due_date: string;
  predicted_revenue_ytd: number;
  actual_revenue_ytd: number;
  industry: string;
  major_risk_events: string[];
  primary_phase_id: string;
  active_phase_ids: string[];
  managed_start?: string;
  managed_end?: string | null;
  status?: string;
  data_source?: string;
  domain_ids?: DomainId[];
}

export interface EngineeringProject {
  id: string;
  name: string;
  owner_org_id: string;
  legal_entity_id: string;
  country: string;
  data_nature: string;
  customer_id: string;
  phase: string;
  parallel_work: string[];
  contract_id: string;
  contract_revenue_ex_vat: number;
  forecast_completion_cost: number;
  target_margin_pct: number;
  approved_cost_target: number;
  cost_forecast_complete: boolean;
  cash_paid_ytd: number;
  cash_received_ytd: number;
  receivable_due: number;
  receivable_not_yet_due: number;
  route_ids: string[];
  primary_phase_id: string;
  active_phase_ids: string[];
  preparing_phase_ids?: string[];
  managed_start?: string;
  managed_end?: string | null;
  completed_at?: string | null;
  status?: string;
  data_source?: string;
  domain_ids?: DomainId[];
}

export interface CostItem {
  id: string;
  project_id: string;
  category: string;
  amount: number;
  source_record_id: string;
  excluded_from_remaining_contract_amount?: boolean;
  excludes_accruals?: boolean;
  not_yet_implemented?: boolean;
  not_in_signed_contracts?: boolean;
  not_in_other_cost_items?: boolean;
  included_unpriced_steel_cost?: number;
  included_unpriced_freight_cost?: number;
}

export interface Contract {
  id: string;
  project_id: string | null;
  counterparty_id?: string;
  kind: string;
  effective_amount_ex_vat: number;
  certified_payable_amount?: number;
}

export interface Obligation {
  id: string;
  project_id: string;
  contract_id?: string;
  kind: string;
  cumulative_due?: number;
  cumulative_fulfilled?: number;
  current_year_due?: number;
  current_year_fulfilled?: number;
  amount_due?: number;
  amount_received?: number;
  due_date: string;
}

export interface CashTransaction {
  id: string;
  project_id: string | null;
  contract_id?: string;
  obligation_id?: string;
  account_id: string;
  direction: "inflow" | "outflow";
  amount_wan_cny: number;
  approved_amount?: number;
  certified_payable_amount?: number;
  date: string;
  archived?: boolean;
}

export interface Account {
  id: string;
  owner_org_id: string;
  legal_entity_id: string;
  name: string;
  currency: string;
  opening_balance_native: number;
  closing_balance_native: number;
  restricted_balance_native: number;
  fx_to_cny: number;
  fx_nature?: string;
  native_amount_unit: string;
  balance_as_of: string;
  opening_balance_date: string;
  restriction_basis?: string;
}

export interface OwnershipSnapshot {
  id: string;
  investor_id: string;
  investee_id: string;
  source_type: string;
  pct: number;
  effective_date: string;
  snapshot_date: string;
}

export interface PropertyMatter {
  id: string;
  name: string;
  matter_type: string;
  owner_org_id: string;
  investor_id: string;
  investee_id: string;
  related_project_id: string;
  template_id: string;
  current_phase_id: string;
  snapshot_ids: string[];
  risk_ids: string[];
  note: string;
  data_nature: string;
}

export interface InternationalEvent {
  id: string;
  title: string;
  event_date: string;
  reported_at?: string;
  latest_verified_at?: string;
  data_nature: string;
  market_data_nature?: string;
  event_type?: string;
  status: string;
  route_ids?: string[];
  affected_project_ids?: string[];
  source_name?: string;
  source_url?: string;
  source_section?: string;
  summary?: string;
}

export interface Exposure {
  id: string;
  project_id: string;
  event_id: string;
  category: "steel" | "freight";
  specification?: string;
  route_id?: string;
  ship_type?: string;
  quantity_tonnes?: number;
  base_price_yuan_per_tonne?: number;
  unpriced_base_cost_wan?: number;
  unpriced_share?: number;
  confirmed_pass_through_share: number;
  default_shock_pct: number;
  included_in_base_eac: boolean;
}

export interface RectificationPlan {
  measure: string;
  responsible_display_name: string;
  due_date: string | null;
  progress_note?: string;
}

export interface RiskCase {
  id: string;
  title: string;
  primary_domain: DomainId;
  domains: DomainId[];
  primary_object_id: string;
  owner_org_id: string;
  severity: Severity;
  status: RiskStatus;
  current_task_due_date: string | null;
  first_seen_at: string;
  last_seen_at: string;
  rule_id: string;
  scenario_ids: string[];
  evidence_ids: string[];
  data_nature: string;
  responsible_role: string;
  assignee_display_name: string | null;
  current_task_type: "investigation" | "rectification" | "verification";
  rectification_plan?: RectificationPlan;
  exclusion_reason?: string;
  /** 以下为本地演示办理写入字段 */
  closed_at?: string | null;
  close_reason?: "rectified" | "excluded" | null;
  verified_at?: string | null;
  verified_closed_at?: string | null;
  verification_result?: "passed" | "returned" | null;
  investigation_conclusion?: string;
  rectification_completion_note?: string;
  reopened_count?: number;
  last_handler_user_id?: string | null;
}

export interface Evidence {
  id: string;
  title: string;
  data_nature: string;
  source_type: string;
  recorded_at: string;
  body: string;
}

export interface CaseAction {
  id: string;
  risk_id: string;
  action: string;
  date: string;
  actor: string;
  from_status?: RiskStatus;
  to_status?: RiskStatus;
  note: string;
  evidence_ids?: string[];
  effective_date: string;
  sequence: number;
  recorded_at: string;
  recorded_at_nature?: string;
  local?: boolean;
}

export interface PhaseNode {
  id: string;
  name: string;
  display_order: number;
}

export interface LifecycleTemplate {
  id: string;
  domain: DomainId;
  matter_type?: string;
  matter_type_name?: string;
  phase_nodes: PhaseNode[];
  default_object_type: string;
  execution_note: string;
  subviews?: Record<string, string[]>;
  parallel_phase_ids?: string[];
  continuous_phase_ids?: string[];
}

export interface LifecycleInstance {
  id: string;
  object_id: string;
  template_id: string;
  phase_id: string;
  business_status: "not_started" | "preparing" | "in_progress" | "completed" | "not_applicable";
  approved_plan_start: string | null;
  approved_plan_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  forecast_end: string | null;
  plan_version: string;
  evidence_ids: string[];
  data_nature: string;
}

export type MonitoringStatus =
  | "evaluated_hit"
  | "evaluated_clear"
  | "data_insufficient"
  | "not_due"
  | "not_applicable"
  | "reference_only";

export interface MonitoringRow {
  id: string;
  scenario_id: string;
  domain: DomainId;
  phase_id: string | null;
  subtopic_id: string | null;
  topic_id: string | null;
  monitoring_object_id: string;
  object_type: ObjectType;
  subject_object_id: string;
  owner_org_id: string;
  period_start: string;
  period_end: string;
  snapshot_date: string;
  window_start: string;
  window_end: string;
  status: MonitoringStatus;
  required: boolean;
  rule_evaluation_ids: string[];
  risk_ids: string[];
  missing_data: string[];
  note: string;
  data_nature: string;
  rule_ids: string[];
  rule_coverage: string;
  stage_instance_id: string | null;
  scope_evidence_ids: string[];
  scope_basis: string;
}

export interface RuleEvaluation {
  id: string;
  rule_id: string;
  subject_object_id: string;
  evaluated_at: string;
  period_start: string;
  period_end: string;
  window_start: string;
  window_end: string;
  result: "hit" | "clear";
  rule_version: string;
  inputs: Record<string, unknown>;
  formula: string;
  risk_ids: string[];
  evidence_ids: string[];
  data_nature: string;
  effective_result: "hit" | "clear" | "excluded";
  hit_validity: string;
  generic_formula: string;
  formula_role: string;
  input_snapshot_note: string;
  input_bindings: { input_field: string; source_json_pointers: string[]; transform: string }[];
  original_trigger_window?: UtilizationPoint[];
  original_confirmation_date?: string;
  baseline_current_reevaluation?: string;
  reference_data_window?: { start: string; end: string; purpose: string };
}

export interface RiskContextLink {
  risk_id: string;
  domain: DomainId;
  primary_phase_id: string | null;
  topic_id: string | null;
  associated_phase_ids?: string[];
  subtopic_id?: string | null;
  phase_ids: string[];
}

export interface SourceRecord {
  id: string;
  name: string;
  record_type: string;
  amount: number;
  currency: string;
  amount_unit: string;
  business_date: string;
  updated_at: string;
  source_system_label: string;
  data_nature: string;
  evidence_ids: string[];
  component_record_ids?: string[];
}

export interface BusinessLink {
  id: string;
  from_id: string;
  to_id: string;
  relation_type: string;
  domains: DomainId[];
  as_of: string;
  data_nature: string;
  evidence_ids?: string[];
}

export interface DataTrace {
  id: string;
  name: string;
  object_id: string;
  indicator_id?: string;
  rule_id?: string;
  risk_id: string;
  as_of: string;
  data_nature: string;
  calculation: {
    formula: string;
    inputs: { field: string; value: number; unit: string }[];
    expected_display_pct?: number;
    expected_display_amount?: number;
  };
  component_object_ids: string[];
  source_record_ids: string[];
  detail_note: string;
}

export interface PriceSeries {
  id: string;
  name: string;
  unit: string;
  frequency: string;
  data_nature: string;
  source_name: string;
  annualization_factor: number;
}

export interface PriceObservation {
  series_id: string;
  date: string;
  value: number;
}

export interface SupplementalScenario {
  id: string;
  name: string;
  scenario_id?: string;
  scenario_name?: string;
  rule_id?: string;
  domain?: DomainId;
  primary_phase_id?: string;
  associated_phase_ids?: string[];
  source?: string;
}

export interface CatalogScenario {
  id: string;
  domain: "FA" | "EQ";
  source_sheet: string;
  source_row: number;
  source_range: string;
  original_scene: string;
  name: string;
  primary_phase: string;
  adoption_mode: "结构化监测" | "线索核查" | "核查依据";
  platform_behavior: string;
  excluded_operations: string;
  implementation_note: string;
  indicator_ids: string[];
  original_columns: Record<string, string>;
  primary_phase_id: string;
  associated_phase_ids: string[];
  subtopic_id: string | null;
  phase_mapping_version: string;
  phase_mapping_note: string;
}

export interface CatalogIndicator {
  id: string;
  domain: "FA" | "EQ";
  name: string;
  source_references: string[];
  source_blocks: string[];
  implementation_note: string;
  parameter_status: string;
  display_role: string;
  aliases?: string[];
}

export interface MonitoringRuleDefinition {
  id: string;
  name: string;
  generic_formula: string;
  example_formula: string;
  required_fields: string[];
  scenario_ids: string[];
  evaluation_mode: string;
  data_missing_behavior: string;
  rule_source: string;
  parameters: Record<string, unknown>;
  active_demo: boolean;
}

export interface DemoSeed {
  version: string;
  as_of: string;
  data_nature: string;
  money_default: string;
  display_notice: string;
  organizations: Organization[];
  legal_entities: LegalEntity[];
  fixed_asset_projects: FixedAssetProject[];
  assets: Asset[];
  equity_projects: EquityProject[];
  engineering_projects: EngineeringProject[];
  cost_items: CostItem[];
  contracts: Contract[];
  obligations: Obligation[];
  cash_transactions: CashTransaction[];
  accounts: Account[];
  ownership_snapshots: OwnershipSnapshot[];
  international_events: InternationalEvent[];
  exposures: Exposure[];
  risk_cases: RiskCase[];
  evidence: Evidence[];
  price_series: PriceSeries[];
  price_observations: PriceObservation[];
  expected_results: Record<string, unknown>;
  supplemental_scenarios: SupplementalScenario[];
  lifecycle_templates: LifecycleTemplate[];
  lifecycle_instances: LifecycleInstance[];
  property_matters: PropertyMatter[];
  domain_topics: { domain: DomainId; topics: { id: string; name: string }[] }[];
  risk_context_links: RiskContextLink[];
  status_labels: Record<string, string>;
  demo_rule_parameters: Record<string, unknown>;
  case_actions: CaseAction[];
  navigation: {
    id: string;
    domain?: DomainId;
    label: string;
    route: string;
    order: number;
    tabs?: string[];
  }[];
  shared_views: Record<string, unknown>[];
  source_records: SourceRecord[];
  data_traces: DataTrace[];
  business_links: BusinessLink[];
  supplemental_display_notes: Record<string, string>;
  supplemental_phase_mappings: Record<string, unknown>[];
  interaction_contract_v1_2: Record<string, unknown>;
  rule_evaluations: RuleEvaluation[];
  monitoring_rule_definitions: MonitoringRuleDefinition[];
  scenario_monitoring_coverage: MonitoringRow[];
  scenario_monitoring_records: MonitoringRow[];
  monitoring_count_contract: Record<string, unknown>;
  demo_state_presets: Record<string, unknown>[];
  demo_business_clock: Record<string, unknown>;
  expected_stage_results_v1_2: {
    open_case_count_by_phase: Record<string, number>;
    [k: string]: unknown;
  };
}

export interface InvestmentCatalog {
  version: string;
  document_date: string;
  source: { filename: string; sha256: string; read_scope: string };
  scenarios: CatalogScenario[];
  indicators: CatalogIndicator[];
  counts: {
    source_scenarios: number;
    source_indicator_occurrences: number;
    unique_indicators: number;
    adoption_modes: Record<string, number>;
  };
}
