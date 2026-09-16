"use client";

import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  LinkButton,
  Modal,
  Notice,
  SeverityTag,
  SimulatedBadge,
  Tag,
  inputClass,
  selectClass,
} from "@/components/ui";
import {
  computeFiveCounts,
  configuredScenarios,
  scenarioRuntimeStatus,
  selectRows,
  type FiveCounts,
  type ScopeFilter,
} from "@/lib/monitoring";
import { isScenarioMonitoringActive } from "@/lib/live-config";
import {
  objectTypeLabel,
  scenarioAdoption,
  scenarioName,
  scenarioSourceLabel,
  seed,
} from "@/lib/seed";
import { orgName } from "@/lib/org";
import { objectName } from "@/lib/objects";
import { isOverdueRectification, rectificationDueDate, snapshotRisksAtAsOf, statusLabel } from "@/lib/risks";
import { daysBetween, fmtDate } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { useDemoStore } from "@/lib/store";
import { liveSub } from "@/lib/live-config";
import type { DomainId, MonitoringRow, RiskCase } from "@/lib/types";

/**
 * 环节/专题选中后的执行情况（完整业需 5.3、5.4）。
 * 五项摘要分别标“观察期/截至日/本期闭环”，对象数与事项数不混用计数单位。
 */

export interface SubtopicOption {
  id: string;
  label: string;
  note: string;
}

type DetailKind = "monitored" | "hit" | "open" | "closed" | "overdue";

const DETAIL_TITLE: Record<DetailKind, string> = {
  monitored: "监测对象清单（观察期）",
  hit: "命中对象清单（观察期）",
  open: "未关闭事项清单（截至日）",
  closed: "本期已整改闭环事项",
  overdue: "逾期整改事项（截至日）",
};

interface ScenarioRow {
  id: string;
  name: string;
  groupName: string;
  adoption: string;
  rows: MonitoringRow[];
  counts: FiveCounts;
  statusLabelText: string;
  statusTone: "red" | "amber" | "green" | "neutral";
  monitoringActive: boolean;
  redOpen: number;
  objectTypes: string[];
}

export default function ScenarioExecutionPanel({
  domain,
  phaseId,
  topicId,
  subtopicId,
  orgIds,
  allowedObjectIds,
  scopeTitle,
  subtopicOptions,
  onSubtopicChange,
  onOpenRisk,
  onOpenObject,
  onOpenScenario,
}: {
  domain: DomainId;
  phaseId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  orgIds: Set<string>;
  allowedObjectIds: string[] | null;
  scopeTitle: string;
  subtopicOptions?: SubtopicOption[];
  onSubtopicChange?: (id: string) => void;
  onOpenRisk: (id: string) => void;
  onOpenObject?: (id: string) => void;
  onOpenScenario?: (id: string, source?: boolean) => void;
}) {
  const { filters, risks, actions, canAct, catalog } = useDemoStore();
  const [detail, setDetail] = useState<{ kind: DetailKind; scenarioId: string | null } | null>(null);
  const [search, setSearch] = useState("");
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [objectTypeFilter, setObjectTypeFilter] = useState("all");

  const baseScope: ScopeFilter = useMemo(
    () => ({
      domain,
      orgScope: orgIds,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      asOf: filters.asOf,
      phaseId: phaseId ?? null,
      topicId: topicId ?? null,
      subtopicId: subtopicId ?? null,
      allowedObjectIds,
    }),
    [domain, orgIds, filters.periodStart, filters.periodEnd, filters.asOf, phaseId, topicId, subtopicId, allowedObjectIds],
  );

  const asOfRisks = useMemo(
    () => snapshotRisksAtAsOf(risks, filters.asOf, actions),
    [risks, filters.asOf, actions],
  );

  const summary = useMemo(() => computeFiveCounts(baseScope, asOfRisks), [baseScope, asOfRisks]);

  const scenarioRows: ScenarioRow[] = useMemo(() => {
    const ids = configuredScenarios(domain, phaseId ?? null, topicId ?? null);
    const extra = new Set(ids);
    summary.openRiskIds.forEach((rid) => {
      const r = asOfRisks.find((x) => x.id === rid);
      r?.scenario_ids.forEach((s) => {
        if (topicId) {
          const mapped = liveSub(s)?.topic_id;
          if (mapped !== topicId) return;
        }
        extra.add(s);
      });
    });
    return [...extra]
      .map((id) => {
        const scope = { ...baseScope, scenarioId: id };
        const rows = selectRows(scope);
        const counts = computeFiveCounts(scope, asOfRisks);
        const st = scenarioRuntimeStatus(id, rows, {
          domain,
          orgScope: orgIds,
          allowedObjectIds,
        });
        const redOpen = counts.openRiskIds.filter(
          (rid) => asOfRisks.find((r) => r.id === rid)?.severity === "red",
        ).length;
        const parentId = liveSub(id)?.parent_id;
        const groupName = catalog.groups.find((g) => g.id === parentId)?.name ?? "";
        return {
          id,
          name: scenarioName(id),
          groupName,
          adoption: scenarioAdoption(id),
          rows,
          counts,
          statusLabelText: st.label,
          statusTone: st.tone,
          monitoringActive: isScenarioMonitoringActive(id),
          redOpen,
          objectTypes: [...new Set(rows.map((r) => r.object_type))],
        };
      })
      .filter((r) => r.monitoringActive || r.counts.openRiskIds.length > 0)
      .sort((a, b) => {
        const g = a.groupName.localeCompare(b.groupName, "zh");
        if (g !== 0) return g;
        const rank = (r: ScenarioRow) =>
          r.redOpen > 0
            ? 0
            : r.counts.overdueRiskIds.length > 0
              ? 1
              : r.counts.openRiskIds.length > 0
                ? 2
                : r.statusLabelText.startsWith("未评估")
                  ? 3
                  : 4;
        const d = rank(a) - rank(b);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
  }, [domain, phaseId, topicId, baseScope, asOfRisks, summary.openRiskIds, orgIds, allowedObjectIds, catalog.groups]);

  const visibleScenarioRows = useMemo(
    () =>
      scenarioRows.filter((r) => {
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (
            !r.id.toLowerCase().includes(q) &&
            !r.name.toLowerCase().includes(q) &&
            !r.groupName.toLowerCase().includes(q)
          )
            return false;
        }
        if (onlyAbnormal && r.counts.openRiskIds.length === 0 && r.counts.hitObjects.length === 0) return false;
        if (statusFilter !== "all" && r.statusLabelText !== statusFilter) return false;
        if (objectTypeFilter !== "all" && !r.objectTypes.includes(objectTypeFilter)) return false;
        return true;
      }),
    [scenarioRows, search, onlyAbnormal, statusFilter, objectTypeFilter],
  );

  const statusOptions = useMemo(
    () => [...new Set(scenarioRows.map((r) => r.statusLabelText))].sort(),
    [scenarioRows],
  );
  const objectTypeOptions = useMemo(
    () => [...new Set(scenarioRows.flatMap((r) => r.objectTypes))].sort(),
    [scenarioRows],
  );

  const detailData = useMemo(() => {
    if (!detail) return null;
    const scope = detail.scenarioId ? { ...baseScope, scenarioId: detail.scenarioId } : baseScope;
    const counts = detail.scenarioId ? computeFiveCounts(scope, asOfRisks) : summary;
    const rows = detail.scenarioId ? selectRows(scope) : summary.rows;
    return { counts, rows, scope };
  }, [detail, baseScope, asOfRisks, summary]);

  const riskList = (ids: string[]): RiskCase[] =>
    ids.map((id) => asOfRisks.find((r) => r.id === id)).filter((r): r is RiskCase => Boolean(r));

  const scopeLine = `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}｜${scopeTitle}`;

  const summaryItems: { kind: DetailKind; label: string; value: number; caliber: string; tone: "red" | "amber" | "neutral" | "brand" }[] = [
    {
      kind: "monitored",
      label: "监测对象数",
      value: summary.monitoredObjects.length,
      caliber: "观察期",
      tone: "brand",
    },
    { kind: "hit", label: "命中对象数", value: summary.hitObjects.length, caliber: "观察期", tone: "amber" },
    { kind: "open", label: "未关闭事项数", value: summary.openRiskIds.length, caliber: "截至日", tone: "red" },
    {
      kind: "closed",
      label: "本期已整改闭环数",
      value: summary.rectifiedClosedRiskIds.length,
      caliber: "本期闭环",
      tone: "neutral",
    },
    { kind: "overdue", label: "逾期整改数", value: summary.overdueRiskIds.length, caliber: "截至日", tone: "red" },
  ];

  return (
    <div className="space-y-4" id="scenario-execution">
      <Card
        title={`当前环节：${scopeTitle}`}
        right={
          subtopicOptions && subtopicOptions.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-textsub">业务子类</span>
              <div className="flex rounded-[6px] border border-line overflow-hidden">
                {subtopicOptions.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onSubtopicChange?.(o.id)}
                    className={`h-8 px-3 text-[12px] transition-colors duration-150 ${
                      (subtopicId ?? subtopicOptions[0].id) === o.id
                        ? "bg-brand text-white"
                        : "bg-surface text-textsub hover:bg-tint"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 min-[1440px]:grid-cols-5 gap-3">
          {summaryItems.map((it) => (
            <button
              key={it.kind}
              onClick={() => setDetail({ kind: it.kind, scenarioId: null })}
              className="text-left rounded-[8px] border border-line bg-surface px-3.5 py-3 hover:border-[#c3d8f7] hover:bg-[#fcfdff] transition-colors duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-textsub">{it.label}</span>
                <Tag tone="neutral">{it.caliber}</Tag>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span
                  className="num text-[26px] font-semibold leading-8"
                  style={{
                    color:
                      it.value === 0
                        ? "var(--text-main)"
                        : it.tone === "red"
                          ? "var(--risk-red-fg)"
                          : it.tone === "amber"
                            ? "var(--risk-amber-fg)"
                            : "var(--text-main)",
                  }}
                >
                  {it.value}
                </span>
                <span className="text-[12px] text-textsub">
                  {it.kind === "monitored" || it.kind === "hit" ? "个" : "件"}
                </span>
                <span className="text-[12px] text-brand ml-auto">明细 ›</span>
              </div>
            </button>
          ))}
        </div>

        {summary.monitoredObjects.length === 0 && summary.openRiskIds.length > 0 && (
          <div className="mt-3">
            <Notice tone="amber" title="历史遗留">
              本期已监测 0 个、历史未关闭 {summary.openRiskIds.length} 件。
            </Notice>
          </div>
        )}
      </Card>

      <Card
        title="监管场景执行情况"
        right={
          <Button
            disabled={!canAct("business.export")}
            title={canAct("business.export") ? "导出当前筛选范围内的场景执行清单" : "当前身份不能导出业务数据"}
            onClick={() => {
              if (!canAct("business.export")) return;
              downloadCsv(
                `场景执行清单_${domain}_${phaseId ?? topicId ?? "全部"}.csv`,
                [
                  "场景ID",
                  "场景名称",
                  "纳入方式",
                  "监测状态",
                  "监测对象数",
                  "命中对象数",
                  "未关闭事项数",
                  "本期已整改闭环数",
                  "逾期整改数",
                  "对象类型",
                ],
                visibleScenarioRows.map((r) => [
                  r.id,
                  r.name,
                  r.adoption,
                  r.statusLabelText,
                  r.counts.monitoredObjects.length,
                  r.counts.hitObjects.length,
                  r.counts.openRiskIds.length,
                  r.counts.rectifiedClosedRiskIds.length,
                  r.counts.overdueRiskIds.length,
                  r.objectTypes.map((t) => objectTypeLabel[t] ?? t).join("/"),
                ]),
                {
                  title: "监管场景执行清单",
                  scopeLines: [scopeLine, "金额单位：万元人民币", "口径：对象数按对象类型与对象编号去重，事项数按事项去重"],
                },
              );
            }}
          >
            导出当前筛选
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            className={`${inputClass} w-[220px]`}
            placeholder="搜索场景名称或ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={`${selectClass} w-[160px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">全部监测状态</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={`${selectClass} w-[170px]`}
            value={objectTypeFilter}
            onChange={(e) => setObjectTypeFilter(e.target.value)}
          >
            <option value="all">全部对象类型</option>
            {objectTypeOptions.map((t) => (
              <option key={t} value={t}>
                {objectTypeLabel[t] ?? t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[13px] text-textmain">
            <input type="checkbox" checked={onlyAbnormal} onChange={(e) => setOnlyAbnormal(e.target.checked)} />
            只看异常
          </label>
          {(search || onlyAbnormal || statusFilter !== "all" || objectTypeFilter !== "all") && (
            <>
              <Tag tone="brand">
                已筛选：{visibleScenarioRows.length}/{scenarioRows.length}
              </Tag>
              <Button
                onClick={() => {
                  setSearch("");
                  setOnlyAbnormal(false);
                  setStatusFilter("all");
                  setObjectTypeFilter("all");
                }}
              >
                清除条件
              </Button>
            </>
          )}
        </div>

        <DataTable
          rows={visibleScenarioRows}
          rowKey={(r) => r.id}
          empty={
            scenarioRows.length === 0
              ? "当前环节尚未配置监管场景。"
              : "当前筛选条件下没有匹配场景，请调整搜索或筛选。"
          }
          pageSize={domain === "CASH" || domain === "RIGHTS" ? 40 : 8}
          compactEmpty
          tableClassName="min-w-[1080px]"
          columns={[
            ...(domain === "CASH" || domain === "RIGHTS"
              ? [
                  {
                    key: "group",
                    title: "一级场景",
                    width: "160px" as const,
                    render: (r: (typeof visibleScenarioRows)[number]) => (
                      <span className="text-[13px] text-textsub">{r.groupName || "—"}</span>
                    ),
                  },
                ]
              : []),
            {
              key: "name",
              title: "监管场景",
              minWidth: "240px",
              render: (r) => (
                <button
                  className="text-left hover:text-brand transition-colors duration-150"
                  onClick={() => onOpenScenario?.(r.id)}
                  title={scenarioSourceLabel(r.id)}
                >
                  <span className="text-[14px] text-textmain block break-words whitespace-normal leading-5">{r.name}</span>
                  <span className="num text-[12px] text-textsub">{r.id}</span>
                  <Tag tone={r.adoption === "结构化监测" ? "brand" : "neutral"}>{r.adoption}</Tag>
                </button>
              ),
            },
            {
              key: "src",
              title: "来源",
              width: "100px",
              nowrap: true,
              render: (r) => (
                <LinkButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenScenario?.(r.id, true);
                  }}
                >
                  查看依据
                </LinkButton>
              ),
            },
            {
              key: "status",
              title: "监测状态",
              width: "132px",
              render: (r) => (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <Tag tone={r.statusTone}>{r.statusLabelText}</Tag>
                  {!r.monitoringActive && r.statusLabelText !== "仅维护定义" && <Tag tone="neutral">已停用</Tag>}
                </span>
              ),
            },
            {
              key: "monitored",
              title: "监测对象数",
              align: "right",
              width: "110px",
              render: (r) =>
                r.rows.length === 0 ? (
                  <span className="text-textsub">{r.statusLabelText === "无业务" ? "无业务" : "—"}</span>
                ) : (
                  <button
                    className="num text-brand hover:underline"
                    onClick={() => setDetail({ kind: "monitored", scenarioId: r.id })}
                  >
                    {r.counts.monitoredObjects.length}
                  </button>
                ),
            },
            {
              key: "hit",
              title: "命中对象数",
              align: "right",
              width: "110px",
              render: (r) =>
                r.adoption === "核查依据" && r.counts.hitObjects.length === 0 ? (
                  <span className="text-textsub" title="专业核查尚无结论">
                    —（待人工核查）
                  </span>
                ) : (
                  <button
                    className="num text-brand hover:underline"
                    onClick={() => setDetail({ kind: "hit", scenarioId: r.id })}
                  >
                    {r.counts.hitObjects.length}
                  </button>
                ),
            },
            {
              key: "open",
              title: "未关闭事项数",
              align: "right",
              width: "120px",
              render: (r) => (
                <button
                  className="num hover:underline"
                  style={{ color: r.redOpen > 0 ? "var(--risk-red-fg)" : r.counts.openRiskIds.length > 0 ? "var(--risk-amber-fg)" : "var(--text-sub)" }}
                  onClick={() => setDetail({ kind: "open", scenarioId: r.id })}
                >
                  {r.counts.openRiskIds.length}
                  {r.redOpen > 0 && <span className="ml-1">●</span>}
                </button>
              ),
            },
            {
              key: "closed",
              title: "本期闭环",
              align: "right",
              width: "96px",
              render: (r) => (
                <button
                  className="num text-brand hover:underline"
                  onClick={() => setDetail({ kind: "closed", scenarioId: r.id })}
                >
                  {r.counts.rectifiedClosedRiskIds.length}
                </button>
              ),
            },
            {
              key: "overdue",
              title: "逾期整改",
              align: "right",
              width: "96px",
              render: (r) => (
                <button
                  className="num hover:underline"
                  style={{ color: r.counts.overdueRiskIds.length > 0 ? "var(--risk-red-fg)" : "var(--text-sub)" }}
                  onClick={() => setDetail({ kind: "overdue", scenarioId: r.id })}
                >
                  {r.counts.overdueRiskIds.length}
                </button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={920}
        title={
          <span className="flex items-center gap-2 flex-wrap">
            {detail ? DETAIL_TITLE[detail.kind] : ""}
            {detail?.scenarioId && <Tag tone="brand">{detail.scenarioId} {scenarioName(detail.scenarioId)}</Tag>}
          </span>
        }
      >
        <p className="text-[12px] text-textsub mb-3">{scopeLine}</p>
        {detail && detailData && (detail.kind === "monitored" || detail.kind === "hit") && (
          <>
            {(() => {
              const objects = detail.kind === "monitored" ? detailData.counts.monitoredObjects : detailData.counts.hitObjects;
              if (objects.length === 0) {
                return (
                  <EmptyState
                    title={detail.kind === "monitored" ? "本期尚无已完成监测的对象" : "本期尚无命中对象"}
                  />
                );
              }
              return (
                <DataTable
                  rows={objects}
                  rowKey={(o) => `${o.objectType}-${o.objectId}`}
                  onRowClick={(o) => onOpenObject?.(o.objectId)}
                  columns={[
                    { key: "type", title: "对象类型", width: "150px", render: (o) => objectTypeLabel[o.objectType] ?? o.objectType },
                    { key: "id", title: "对象", render: (o) => (
                      <span>
                        <span className="text-textmain">{objectName(o.objectId)}</span>
                        <span className="num text-[12px] text-textsub ml-2">{o.objectId}</span>
                      </span>
                    ) },
                    {
                      key: "rules",
                      title: "已评估/应评估规则数",
                      align: "right",
                      width: "170px",
                      render: (o) => {
                        const rs = detailData.rows.filter((r) => r.monitoring_object_id === o.objectId);
                        const evaluated = rs.filter((r) => r.status === "evaluated_hit" || r.status === "evaluated_clear").length;
                        const required = rs.filter((r) => r.required && r.status !== "not_applicable" && r.status !== "reference_only").length;
                        return <span className="num">{evaluated} / {required}</span>;
                      },
                    },
                    {
                      key: "window",
                      title: "归属观察窗口",
                      width: "190px",
                      render: (o) => {
                        const r = detailData.rows.find((x) => x.monitoring_object_id === o.objectId);
                        return <span className="num text-[12px]">{r ? `${r.window_start} ~ ${r.window_end}` : "—"}</span>;
                      },
                    },
                    {
                      key: "note",
                      title: "说明",
                      render: (o) => {
                        const r = detailData.rows.find((x) => x.monitoring_object_id === o.objectId);
                        return <span className="text-[12px] text-textsub">{r?.note ?? "—"}</span>;
                      },
                    },
                  ]}
                />
              );
            })()}
          </>
        )}

        {detail && detailData && (detail.kind === "open" || detail.kind === "closed" || detail.kind === "overdue") && (
          (() => {
            const ids =
              detail.kind === "open"
                ? detailData.counts.openRiskIds
                : detail.kind === "closed"
                  ? detailData.counts.rectifiedClosedRiskIds
                  : detailData.counts.overdueRiskIds;
            const list = riskList(ids);
            if (list.length === 0) {
              return (
                <EmptyState
                  title={
                    detail.kind === "open"
                      ? "当前范围没有未关闭事项"
                      : detail.kind === "closed"
                        ? "所选期间没有复核通过关闭的事项"
                        : "当前范围没有逾期整改事项"
                  }
                />
              );
            }
            return (
              <DataTable
                rows={list}
                rowKey={(r) => r.id}
                onRowClick={(r) => {
                  setDetail(null);
                  onOpenRisk(r.id);
                }}
                columns={[
                  { key: "id", title: "事项", width: "80px", render: (r) => <span className="num">{r.id}</span> },
                  { key: "title", title: "名称", render: (r) => r.title },
                  { key: "sev", title: "等级", width: "88px", render: (r) => <SeverityTag severity={r.severity} /> },
                  { key: "status", title: "办理状态", width: "110px", render: (r) => statusLabel[r.status] },
                  { key: "org", title: "责任单位", width: "140px", render: (r) => orgName(r.owner_org_id) },
                  ...(detail.kind === "closed"
                    ? [
                        {
                          key: "closed",
                          title: "复核通过关闭",
                          width: "150px",
                          render: (r: RiskCase) => (
                            <span className="num">{fmtDate(r.verified_closed_at ?? r.closed_at)}</span>
                          ),
                        },
                      ]
                    : []),
                  ...(detail.kind === "overdue"
                    ? [
                        {
                          key: "due",
                          title: "有效整改期限",
                          width: "130px",
                          render: (r: RiskCase) => <span className="num">{fmtDate(rectificationDueDate(r))}</span>,
                        },
                        {
                          key: "days",
                          title: "逾期天数",
                          align: "right" as const,
                          width: "96px",
                          render: (r: RiskCase) => {
                            const d = rectificationDueDate(r);
                            return (
                              <span className="num" style={{ color: "var(--risk-red-fg)" }}>
                                {d ? daysBetween(d, filters.asOf) : "—"}
                              </span>
                            );
                          },
                        },
                      ]
                    : []),
                  ...(detail.kind === "open"
                    ? [
                        {
                          key: "overdue",
                          title: "逾期",
                          width: "96px",
                          render: (r: RiskCase) =>
                            isOverdueRectification(r, filters.asOf) ? <Tag tone="red">整改逾期</Tag> : <span className="text-textsub">—</span>,
                        },
                      ]
                    : []),
                ]}
              />
            );
          })()
        )}

        <div className="mt-3">
          <SimulatedBadge text="合成样例" />
        </div>
      </Modal>
    </div>
  );
}
