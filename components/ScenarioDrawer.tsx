"use client";

import React, { useMemo } from "react";
import { DataTable, DescList, Drawer, EmptyState, Notice, SimulatedBadge, SourceEvidence, Tag } from "@/components/ui";
import {
  catalog,
  monitoringStatusLabel,
  objectTypeLabel,
  phaseName,
  scenarioAdoption,
  scenarioName,
  scenarioSourceLabel,
  seed,
} from "@/lib/seed";
import { objectName } from "@/lib/objects";
import { orgName } from "@/lib/org";

/**
 * 监管场景详情：业务名称用一级监管场景 / 监管子场景；
 * 工作表、行号与映射说明放在来源依据。
 */
export default function ScenarioDrawer({
  scenarioId,
  onClose,
  onOpenRisk,
  onOpenObject,
}: {
  scenarioId: string | null;
  onClose: () => void;
  onOpenRisk?: (id: string) => void;
  onOpenObject?: (id: string) => void;
}) {
  const detail = useMemo(() => {
    if (!scenarioId) return null;
    const cat = catalog.scenarios.find((s) => s.id === scenarioId);
    const supp = seed.supplemental_scenarios.find((s) => s.id === scenarioId);
    const rows = seed.scenario_monitoring_coverage.filter((r) => r.scenario_id === scenarioId);
    const ruleIds = [...new Set(rows.flatMap((r) => r.rule_ids))];
    const evals = seed.rule_evaluations.filter((e) => ruleIds.includes(e.rule_id));
    const riskIds = [...new Set(rows.flatMap((r) => r.risk_ids))];
    return { cat, supp, rows, ruleIds, evals, riskIds };
  }, [scenarioId]);

  if (!scenarioId || !detail) return null;

  const { cat, supp, rows, ruleIds, evals, riskIds } = detail;
  const hitTypes = new Set(evals.filter((e) => e.effective_result === "hit").map((e) => e.rule_id));

  return (
    <Drawer
      open
      onClose={onClose}
      width="66vw"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="num text-textsub text-[14px]">{scenarioId}</span>
          {scenarioName(scenarioId)}
          <Tag tone={scenarioAdoption(scenarioId) === "结构化监测" ? "brand" : "neutral"}>
            {scenarioAdoption(scenarioId)}
          </Tag>
        </span>
      }
      subtitle={<span>来源：{scenarioSourceLabel(scenarioId)}</span>}
    >
      <div className="h-full overflow-auto px-6 py-4 space-y-5">
        {cat ? (
          <>
            <DescList
              cols={2}
              items={[
                { label: "一级监管场景", value: cat.original_scene },
                { label: "监管子场景", value: cat.name },
                { label: "主归属阶段", value: phaseName(cat.primary_phase_id) },
                {
                  label: "关联阶段",
                  value:
                    cat.associated_phase_ids.length > 0
                      ? cat.associated_phase_ids.map((p) => phaseName(p)).join("、")
                      : "无",
                },
                { label: "平台行为", value: cat.platform_behavior },
                { label: "明确排除的操作", value: cat.excluded_operations || "—" },
                { label: "关联监管指标", value: cat.indicator_ids.join("、") || "本场景无对应监管指标" },
              ]}
            />
            <SourceEvidence>
              <DescList
                cols={2}
                items={[
                  { label: "目录来源", value: scenarioSourceLabel(scenarioId) },
                  { label: "工作表", value: cat.source_sheet },
                  { label: "行号", value: <span className="num">第 {cat.source_row} 行（{cat.source_range}）</span> },
                  { label: "阶段对应说明", value: cat.phase_mapping_note },
                  { label: "落地说明", value: cat.implementation_note },
                ]}
              />
            </SourceEvidence>
          </>
        ) : (
          <>
            <DescList
              cols={2}
              items={[
                { label: "场景名称", value: scenarioName(scenarioId) },
                {
                  label: "主归属阶段",
                  value: supp?.primary_phase_id ? phaseName(supp.primary_phase_id) : "—",
                },
                { label: "关联规则", value: supp?.rule_id ?? "—" },
                { label: "来源", value: supp?.source ?? "本业需补充设计" },
              ]}
            />
            <Notice tone="amber" title="补充设计场景">
              本场景不是投资底稿原始场景，为满足业务链条由本业需补充设计，界面明确区分来源，不伪装为制度逐字条款。
            </Notice>
          </>
        )}

        <Notice tone="neutral" title="制度来源">
          国务院国资委令第46号《中央企业违规经营投资责任追究实施办法》，2026-01-01 起施行。平台的风险提示仍需经事实核查及有权程序；
          与附件的逐条对应关系保留为制度条款核对项。
        </Notice>

        <div>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">规则与执行统计</h4>
          <DescList
            cols={4}
            items={[
              { label: "配置规则数", value: <span className="num">{ruleIds.length}</span> },
              { label: "应执行规则实例数", value: <span className="num">{rows.filter((r) => r.required && r.status !== "not_applicable" && r.status !== "reference_only").length}</span> },
              {
                label: "已执行实例数",
                value: (
                  <span className="num">
                    {rows.filter((r) => r.status === "evaluated_hit" || r.status === "evaluated_clear").length}
                  </span>
                ),
              },
                { label: "命中规则种类数", value: <span className="num">{hitTypes.size}</span>, hint: "按规则去重" },
              {
                label: "有效命中次数",
                value: <span className="num">{evals.filter((e) => e.effective_result === "hit").length}</span>,
              },
              { label: "涉及责任单位数", value: <span className="num">{new Set(rows.map((r) => r.owner_org_id)).size}</span> },
              {
                label: "数据缺口",
                value: rows.filter((r) => r.status === "data_insufficient").length
                  ? `${rows.filter((r) => r.status === "data_insufficient").length} 条缺数据：${[...new Set(rows.flatMap((r) => r.missing_data))].join("、")}`
                  : "无",
              },
              {
                label: "最近监测时间",
                value: (
                  <span className="num">
                    {rows.length ? rows.map((r) => r.snapshot_date).sort().slice(-1)[0] : "—"}
                  </span>
                ),
              },
            ]}
          />
          <p className="text-[12px] text-textsub mt-2">
            重复跑批的相同命中不累计成多条监管事项；前台不显示无解释的“执行率”。
          </p>
        </div>

        <div>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">监测实例（全部组织范围）</h4>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            empty="该场景暂无监测实例，显示适用流程与场景定义即可，数量用“—”。"
            onRowClick={(r) => onOpenObject?.(r.monitoring_object_id)}
            columns={[
              {
                key: "obj",
                title: "监测对象",
                render: (r) => (
                  <span>
                    <span className="text-textmain">{objectName(r.monitoring_object_id)}</span>
                    <span className="num text-[12px] text-textsub ml-2">{r.monitoring_object_id}</span>
                  </span>
                ),
              },
              { key: "type", title: "对象类型", width: "150px", render: (r) => objectTypeLabel[r.object_type] ?? r.object_type },
              { key: "org", title: "责任单位", width: "130px", render: (r) => orgName(r.owner_org_id) },
              { key: "phase", title: "关联环节", width: "120px", render: (r) => (r.phase_id ? phaseName(r.phase_id) : "—") },
              {
                key: "window",
                title: "归属窗口",
                width: "180px",
                render: (r) => (
                  <span className="num text-[12px]">
                    {r.window_start} ~ {r.window_end}
                  </span>
                ),
              },
              {
                key: "status",
                title: "监测状态",
                width: "150px",
                render: (r) => (
                  <Tag
                    tone={
                      r.status === "evaluated_hit"
                        ? "red"
                        : r.status === "evaluated_clear"
                          ? "green"
                          : r.status === "data_insufficient"
                            ? "amber"
                            : "neutral"
                    }
                  >
                    {monitoringStatusLabel[r.status]}
                  </Tag>
                ),
              },
              {
                key: "risks",
                title: "关联事项",
                width: "130px",
                render: (r) =>
                  r.risk_ids.length === 0 ? (
                    <span className="text-textsub">—</span>
                  ) : (
                    <span className="flex gap-1 flex-wrap">
                      {r.risk_ids.map((id) => (
                        <button
                          key={id}
                          className="num text-brand hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRisk?.(id);
                          }}
                        >
                          {id}
                        </button>
                      ))}
                    </span>
                  ),
              },
            ]}
          />
        </div>

        {rows.length === 0 && riskIds.length === 0 && (
          <EmptyState
            title="本场景当前没有监测实例"
            detail="显示场景定义与适用流程；明确监测完整且没有命中才显示 0，尚缺资料时显示缺口数量与所需材料。"
          />
        )}

        <div className="flex items-center gap-2">
          <SimulatedBadge text="合成样例" />
          <span className="text-[12px] text-textsub">
            场景定义可展示在主阶段和关联阶段；监测与命中只按评估记录实际关联阶段统计，不由场景配置复制。
          </span>
        </div>
      </div>
    </Drawer>
  );
}
