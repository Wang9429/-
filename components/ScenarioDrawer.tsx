"use client";

import React, { useMemo } from "react";
import { DataTable, DescList, Drawer, SimulatedBadge, SourceEvidence, Tag } from "@/components/ui";
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
import { useDemoStore } from "@/lib/store";
import { authorizedObjectIds, intersectOrgScope } from "@/lib/config";
import { isScenarioMonitoringActive, liveSub } from "@/lib/live-config";
import { computeFiveCounts, scenarioRuntimeStatus, selectRows } from "@/lib/monitoring";
import type { DomainId } from "@/lib/types";

/**
 * 监管场景详情：摘要、清单与执行面板共用同一套覆盖判定；
 * 未确认适用性的候选不进入业务应评估分母。
 */
export default function ScenarioDrawer({
  scenarioId,
  onClose,
  onOpenRisk,
  onOpenObject,
  sourceOpen = false,
}: {
  scenarioId: string | null;
  onClose: () => void;
  onOpenRisk?: (id: string) => void;
  onOpenObject?: (id: string) => void;
  sourceOpen?: boolean;
}) {
  const { filters, risks, user } = useDemoStore();

  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );
  const allowedObjectIds = useMemo(() => authorizedObjectIds(user), [user]);

  const detail = useMemo(() => {
    if (!scenarioId) return null;
    const cat = catalog.scenarios.find((s) => s.id === scenarioId);
    const supp = seed.supplemental_scenarios.find((s) => s.id === scenarioId);
    const live = liveSub(scenarioId);
    const domain = (cat?.domain ?? supp?.domain ?? live?.domain) as DomainId | undefined;
    const scope = domain
      ? {
          domain,
          orgScope: orgIds,
          periodStart: filters.periodStart,
          periodEnd: filters.periodEnd,
          asOf: filters.asOf,
          scenarioId,
          allowedObjectIds,
        }
      : null;
    const rows = scope ? selectRows(scope) : [];
    const counts = scope ? computeFiveCounts(scope, risks) : null;
    const ruleIds = [...new Set(rows.flatMap((r) => r.rule_ids))];
    const evals = seed.rule_evaluations.filter((e) => ruleIds.includes(e.rule_id));
    const runtime = domain
      ? scenarioRuntimeStatus(scenarioId, rows, { domain, orgScope: orgIds, allowedObjectIds })
      : null;
    return { cat, supp, rows, ruleIds, evals, counts, domain, runtime };
  }, [scenarioId, orgIds, allowedObjectIds, filters.periodStart, filters.periodEnd, filters.asOf, risks]);

  if (!scenarioId || !detail) return null;

  const { cat, supp, rows, ruleIds, evals, counts, runtime } = detail;
  const hitTypes = new Set(evals.filter((e) => e.effective_result === "hit").map((e) => e.rule_id));
  const scopeLine = `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}`;
  const monitoringActive = isScenarioMonitoringActive(scenarioId);

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
          {runtime && <Tag tone={runtime.tone}>{runtime.label}</Tag>}
          {!monitoringActive && <Tag tone="neutral">已停用</Tag>}
        </span>
      }
      subtitle={<span>当前范围 {scopeLine}</span>}
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
                { label: "关联监管指标", value: cat.indicator_ids.join("、") || "本场景无对应监管指标" },
              ]}
            />
            <SourceEvidence defaultOpen={sourceOpen}>
              <DescList
                cols={2}
                items={[
                  { label: "目录来源", value: scenarioSourceLabel(scenarioId) },
                  { label: "工作表", value: cat.source_sheet },
                  { label: "行号", value: <span className="num">第 {cat.source_row} 行（{cat.source_range}）</span> },
                  { label: "阶段对应说明", value: cat.phase_mapping_note },
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
              ]}
            />
            <SourceEvidence defaultOpen={sourceOpen}>
              <DescList
                cols={2}
                items={[
                  { label: "目录来源", value: scenarioSourceLabel(scenarioId) },
                  { label: "来源说明", value: supp?.source ?? "—" },
                ]}
              />
            </SourceEvidence>
          </>
        )}

        {runtime?.code === "unevaluated_missing" && runtime.missingFields.length > 0 && (
          <p className="text-[13px] text-textsub">缺 {runtime.missingFields.join("、")}</p>
        )}

        <div>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">规则与执行统计</h4>
          <DescList
            cols={4}
            items={[
              { label: "配置规则数", value: <span className="num">{ruleIds.length}</span> },
              {
                label: "应评估对象数",
                value: <span className="num">{counts?.requiredObjects.length ?? 0}</span>,
              },
              {
                label: "已监测对象数",
                value: <span className="num">{counts?.monitoredObjects.length ?? 0}</span>,
              },
              { label: "命中规则种类数", value: <span className="num">{hitTypes.size}</span> },
              {
                label: "命中对象数",
                value: <span className="num">{counts?.hitObjects.length ?? 0}</span>,
              },
              {
                label: "涉及责任单位数",
                value: <span className="num">{new Set(rows.map((r) => r.owner_org_id)).size}</span>,
              },
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
        </div>

        <div>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">监测实例（当前授权范围）</h4>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            empty={runtime?.label ?? "待评估"}
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

        <div>
          <SimulatedBadge text="合成样例" />
        </div>
      </div>
    </Drawer>
  );
}
