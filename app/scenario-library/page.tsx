"use client";

import React, { useMemo, useState } from "react";
import ScenarioDrawer from "@/components/ScenarioDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import { Button, Card, DataTable, DescList, Notice, Tabs, Tag, inputClass, selectClass } from "@/components/ui";
import { DOMAIN_META, catalog, coverageRows, phaseName, scenarioName, seed } from "@/lib/seed";
import { downloadCsv } from "@/lib/export";
import type { CatalogScenario, MonitoringRuleDefinition } from "@/lib/types";

/**
 * 场景规则库：53 项投资子场景与 38 项原 KRI 保留附件工作表与行号，
 * 本业需补充场景单独标注来源，不伪装为投资底稿原始场景。
 */

export default function ScenarioLibraryPage() {
  const [tab, setTab] = useState("scenarios");
  const [q, setQ] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [adoptionFilter, setAdoptionFilter] = useState("all");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);

  const supplemental = seed.supplemental_scenarios;

  const catalogRows = useMemo(
    () =>
      catalog.scenarios.filter((s) => {
        if (domainFilter !== "all" && s.domain !== domainFilter) return false;
        if (adoptionFilter !== "all" && s.adoption_mode !== adoptionFilter) return false;
        if (q.trim()) {
          const k = q.trim().toLowerCase();
          return `${s.id}${s.name}${s.original_scene}`.toLowerCase().includes(k);
        }
        return true;
      }),
    [domainFilter, adoptionFilter, q],
  );

  const suppRows = useMemo(
    () =>
      supplemental.filter((s) => {
        if (domainFilter !== "all" && s.domain !== domainFilter) return false;
        if (adoptionFilter !== "all" && adoptionFilter !== "本业需补充场景") return false;
        if (q.trim()) {
          const k = q.trim().toLowerCase();
          return `${s.id}${s.name}`.toLowerCase().includes(k);
        }
        return true;
      }),
    [supplemental, domainFilter, adoptionFilter, q],
  );

  const rules = seed.monitoring_rule_definitions;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-semibold text-textmain leading-[34px]">场景规则库</h1>
          <p className="text-[13px] text-textsub mt-1 max-w-4xl leading-5">
            投资底稿目录的 {catalog.counts.source_scenarios} 项监管子场景、{catalog.counts.unique_indicators} 项原监管指标
            与当前启用的监测规则定义。场景展示一级监管场景、监管子场景，工作表与行号见来源依据；
            本系统补充场景单独标注来源，不声称来自投资底稿或未经核实的制度条款。
          </p>
        </div>
        <Tag tone="neutral">
          场景目录版本 {catalog.version}｜{catalog.document_date}
        </Tag>
      </div>

      <Tabs
        tabs={[
          { id: "scenarios", label: `投资子场景（${catalog.counts.source_scenarios}）` },
          { id: "supplemental", label: `本业需补充场景（${supplemental.length}）` },
          { id: "indicators", label: `原 KRI 指标（${catalog.counts.unique_indicators}）` },
          { id: "rules", label: `监测规则（${rules.length}）` },
          { id: "params", label: "规则参数与边界" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {(tab === "scenarios" || tab === "supplemental") && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputClass} w-[240px]`} placeholder="搜索场景ID、名称或原文" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${selectClass} w-[160px]`} value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            <option value="all">全部领域</option>
            {Object.values(DOMAIN_META).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {tab === "scenarios" && (
            <select className={`${selectClass} w-[150px]`} value={adoptionFilter} onChange={(e) => setAdoptionFilter(e.target.value)}>
              <option value="all">全部纳入方式</option>
              <option value="结构化监测">结构化监测</option>
              <option value="线索核查">线索核查</option>
              <option value="核查依据">核查依据</option>
            </select>
          )}
          <Button
            onClick={() =>
              downloadCsv(
                "监管场景清单.csv",
                ["场景ID", "领域", "监管子场景", "一级监管场景", "纳入方式", "主归属阶段", "来源工作表", "来源行号", "关联指标"],
                (tab === "scenarios" ? catalogRows : []).map((s) => [
                  s.id,
                  DOMAIN_META[s.domain].label,
                  s.name,
                  s.original_scene,
                  s.adoption_mode,
                  phaseName(s.primary_phase_id),
                  s.source_sheet,
                  s.source_row,
                  s.indicator_ids.join("/"),
                ]),
                { title: "投资监管场景清单", scopeLines: [`版本 ${catalog.version}`, `来源文件 ${catalog.source.filename}`] },
              )
            }
          >
            导出当前筛选
          </Button>
          <span className="text-[12px] text-textsub ml-auto">
            纳入方式分布：结构化监测 {catalog.counts.adoption_modes["结构化监测"]}、线索核查{" "}
            {catalog.counts.adoption_modes["线索核查"]}、核查依据 {catalog.counts.adoption_modes["核查依据"]}
            （按场景×指标出现次数统计）
          </span>
        </div>
      )}

      {tab === "scenarios" && (
        <Card title="投资子场景" subtitle="点击行打开场景详情；可定位到来源工作表与行号">
          <DataTable<CatalogScenario>
            rows={catalogRows}
            rowKey={(s) => s.id}
            onRowClick={(s) => setScenarioId(s.id)}
            empty="当前筛选条件下没有匹配场景。"
            columns={[
              { key: "id", title: "场景ID", width: "96px", render: (s) => <span className="num">{s.id}</span> },
              { key: "domain", title: "领域", width: "110px", render: (s) => DOMAIN_META[s.domain].label },
              { key: "name", title: "监管子场景", render: (s) => s.name },
              {
                key: "origin",
                title: "一级监管场景",
                render: (s) => <span className="text-[13px] text-textsub">{s.original_scene}</span>,
              },
              {
                key: "adoption",
                title: "纳入方式",
                width: "116px",
                render: (s) => (
                  <Tag tone={s.adoption_mode === "结构化监测" ? "brand" : s.adoption_mode === "线索核查" ? "amber" : "neutral"}>
                    {s.adoption_mode}
                  </Tag>
                ),
              },
              { key: "phase", title: "主归属阶段", width: "120px", render: (s) => phaseName(s.primary_phase_id) },
              {
                key: "src",
                title: "来源依据",
                width: "180px",
                render: (s) => (
                  <span className="num text-[12px] text-textsub">
                    {s.source_sheet} {s.source_range}（第{s.source_row}行）
                  </span>
                ),
              },
              {
                key: "kri",
                title: "关联指标",
                width: "120px",
                render: (s) => (s.indicator_ids.length ? s.indicator_ids.join("、") : <span className="text-textsub">无</span>),
              },
            ]}
          />
        </Card>
      )}

      {tab === "supplemental" && (
        <Card title="本业需补充场景" subtitle="为满足资产运营、验收转固、工程、资金、产权与国际化链条补充设计，不是投资底稿原始场景">
          <DataTable
            rows={suppRows}
            rowKey={(s) => s.id}
            onRowClick={(s) => setScenarioId(s.id)}
            empty="当前筛选条件下没有匹配场景。"
            columns={[
              { key: "id", title: "场景ID", width: "110px", render: (s) => <span className="num">{s.id}</span> },
              { key: "domain", title: "领域", width: "120px", render: (s) => (s.domain ? DOMAIN_META[s.domain].label : "—") },
              { key: "name", title: "场景名称", render: (s) => s.scenario_name ?? s.name },
              { key: "rule", title: "对应规则", width: "120px", render: (s) => <span className="num">{s.rule_id ?? "—"}</span> },
              {
                key: "phase",
                title: "主归属阶段",
                width: "130px",
                render: (s) => (s.primary_phase_id ? phaseName(s.primary_phase_id) : "—"),
              },
              {
                key: "assoc",
                title: "关联阶段",
                render: (s) => s.associated_phase_ids?.map((p) => phaseName(p)).join("、") || "—",
              },
              { key: "src", title: "来源标注", width: "200px", render: () => <Tag tone="amber">本业需补充设计</Tag> },
            ]}
          />
        </Card>
      )}

      {tab === "indicators" && (
        <Card
          title="原 KRI 指标"
          subtitle="保留底稿指标定义、计算与监控规则原文；参数状态标明是否需要业务确认"
        >
          <DataTable
            rows={catalog.indicators}
            rowKey={(i) => i.id}
            columns={[
              { key: "id", title: "指标ID", width: "96px", render: (i) => <span className="num">{i.id}</span> },
              { key: "domain", title: "领域", width: "110px", render: (i) => DOMAIN_META[i.domain].label },
              { key: "name", title: "指标名称", width: "220px", render: (i) => i.name },
              { key: "role", title: "展示角色", width: "110px", render: (i) => i.display_role },
              {
                key: "note",
                title: "落地口径说明",
                render: (i) => <span className="text-[13px] text-textsub">{i.implementation_note}</span>,
              },
              {
                key: "param",
                title: "参数状态",
                width: "190px",
                render: (i) => <Tag tone="amber">{i.parameter_status}</Tag>,
              },
              {
                key: "src",
                title: "来源引用",
                width: "230px",
                render: (i) => <span className="num text-[12px] text-textsub">{i.source_references.join("；")}</span>,
              },
            ]}
          />
        </Card>
      )}

      {tab === "rules" && (
        <Card title="监测规则定义" subtitle="草稿或失效规则不参与评估；启用规则采用明确的配置版本，不暗示已完成企业制度审批">
          <DataTable<MonitoringRuleDefinition>
            rows={rules}
            rowKey={(r) => r.id}
            columns={[
              { key: "id", title: "规则ID", width: "116px", render: (r) => <span className="num">{r.id}</span> },
              { key: "name", title: "规则名称", width: "220px", render: (r) => r.name },
              {
                key: "formula",
                title: "通用计算式",
                render: (r) => <span className="text-[13px] text-textsub">{r.generic_formula}</span>,
              },
              {
                key: "example",
                title: "计算示例",
                render: (r) => <span className="text-[13px] text-textsub">{r.example_formula}</span>,
              },
              {
                key: "scenes",
                title: "关联场景",
                width: "150px",
                render: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.scenario_ids.map((s) => (
                      <button key={s} className="num text-brand hover:underline" onClick={() => setScenarioId(s)}>
                        {s}
                      </button>
                    ))}
                  </span>
                ),
              },
              {
                key: "missing",
                title: "数据缺失处理",
                width: "200px",
                render: (r) => <span className="text-[12px] text-textsub">{r.data_missing_behavior}</span>,
              },
              {
                key: "source",
                title: "规则来源",
                width: "170px",
                render: (r) => <Tag tone={r.rule_source.includes("补充") ? "amber" : "neutral"}>{r.rule_source}</Tag>,
              },
              {
                key: "active",
                title: "当前启用",
                width: "100px",
                render: (r) => (r.active_demo ? <Tag tone="green">已启用</Tag> : <Tag tone="neutral">未启用</Tag>),
              },
            ]}
          />
        </Card>
      )}

      {tab === "params" && (
        <div className="space-y-4">
          <Card title="规则参数" subtitle="原底稿参数与配置补充参数分别标注；正式启用前需业务确认">
            <DataTable
              rows={Object.entries(seed.demo_rule_parameters).filter(([, v]) => typeof v === "object" && v !== null)}
              rowKey={([k]) => k}
              columns={[
                { key: "rule", title: "规则", width: "150px", render: ([k]) => <span className="num">{k}</span> },
                {
                  key: "params",
                  title: "参数",
                  render: ([, v]) => (
                    <span className="text-[13px]">
                      {Object.entries(v as Record<string, unknown>)
                        .filter(([pk]) => pk !== "source" && pk !== "note")
                        .map(([pk, pv]) => `${pk} = ${String(pv)}`)
                        .join("；")}
                    </span>
                  ),
                },
                {
                  key: "source",
                  title: "来源与说明",
                  render: ([, v]) => {
                    const o = v as Record<string, unknown>;
                    const text = [o.source, o.note].filter(Boolean).join("；");
                    return <span className="text-[13px] text-textsub">{text || "—"}</span>;
                  },
                },
              ]}
            />
            <div className="mt-3">
              <Notice tone="neutral" title="缺数处理">
                {String(seed.demo_rule_parameters.default_missing_data_behavior)}；
                {String(seed.demo_rule_parameters.default_seed_evaluation_scope)}。
              </Notice>
            </div>
          </Card>

          <Card title="参数边界与特殊值" subtitle="完整业需 14.3">
            <DescList
              cols={1}
              items={[
                {
                  label: "预计完工投资",
                  value: "达到概算 95% 为关注，超过 100% 为高风险；等于 100% 按底稿只属于关注。",
                },
                {
                  label: "进度与关键路径",
                  value: "总体进度落后 10 个百分点按“达到”触发；关键路径延期按达到 60 天，边界不一致处列为待确认参数。",
                },
                {
                  label: "投资计划偏差",
                  value: "预计全年投资偏差小于 −5% 或大于 5% 触发，等于 ±5% 不触发本项。",
                },
                {
                  label: "单位与零值",
                  value:
                    "收益率差值单位为百分点，收益金额偏差单位为百分比；计划为 0 但发生投资或支付时不做除法，直接形成计划外核查线索。",
                },
                {
                  label: "工作日历",
                  value: "Demo 使用标记为模拟的周一至周五日历，不宣称已包含实际法定节假日与调休。",
                },
              ]}
            />
          </Card>

          <Card title="场景覆盖候选统计" subtitle="覆盖表为单一来源，按状态区分“已完成监测”与“覆盖候选”，不拼接数组重复计数">
            <DescList
              cols={4}
              items={[
                { label: "覆盖候选行数", value: <span className="num">{coverageRows.length}</span> },
                {
                  label: "已完成监测行数",
                  value: (
                    <span className="num">
                      {coverageRows.filter((r) => r.status === "evaluated_hit" || r.status === "evaluated_clear").length}
                    </span>
                  ),
                },
                {
                  label: "有效命中行数",
                  value: <span className="num">{coverageRows.filter((r) => r.status === "evaluated_hit").length}</span>,
                },
                {
                  label: "涉及场景数",
                  value: <span className="num">{new Set(coverageRows.map((r) => r.scenario_id)).size}</span>,
                },
              ]}
            />
          </Card>
        </div>
      )}

      <ScenarioDrawer
        scenarioId={scenarioId}
        onClose={() => setScenarioId(null)}
        onOpenRisk={(id) => {
          setScenarioId(null);
          setRiskId(id);
        }}
      />
      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel={`场景规则库${scenarioId ? `·${scenarioName(scenarioId)}` : ""}`} />
    </div>
  );
}
