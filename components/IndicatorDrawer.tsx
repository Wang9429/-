"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Drawer, Tag, DataTable, Notice, Button, LinkButton, DescList } from "@/components/ui";
import { aggregate, type IndicatorDef, type LeafMetric, type NodeMetric } from "@/lib/metrics";
import { childOrgs, descendantOrgIds, orgLevelLabel, orgById, ROOT_ORG_ID } from "@/lib/org";
import { fmtAmount, fmtInt, fmtPct, fmtSignedPct } from "@/lib/format";
import { objectTypeLabel, seed } from "@/lib/seed";
import { useDemoStore } from "@/lib/store";
import { isOpen } from "@/lib/risks";

type Selection = { kind: "org"; id: string } | { kind: "leaf"; id: string };

function statusTag(m: NodeMetric) {
  switch (m.status) {
    case "risk":
      return <Tag tone="red" icon="●">高风险</Tag>;
    case "attention":
      return <Tag tone="amber" icon="▲">关注</Tag>;
    case "normal":
      return <Tag tone="green" icon="✓">有效监测正常</Tag>;
    case "no_business":
      return <Tag tone="neutral">当前范围无业务</Tag>;
    default:
      return <Tag tone="neutral">数据不足/未评估</Tag>;
  }
}

export function formatMetric(def: IndicatorDef, m: NodeMetric): string {
  if (m.value === null) return "—";
  if (def.kind === "count") return fmtInt(m.value);
  if (def.kind === "amount") return fmtAmount(m.value);
  if (def.kind === "signed_ratio") return fmtSignedPct(m.value);
  return fmtPct(m.value);
}

export default function IndicatorDrawer({
  open,
  onClose,
  indicator,
  indicatorOptions,
  onSwitchIndicator,
  initialOrgId,
  scopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  indicator: IndicatorDef | null;
  indicatorOptions: IndicatorDef[];
  onSwitchIndicator: (id: string) => void;
  initialOrgId: string;
  scopeLabel: string;
}) {
  const { filters, risks } = useDemoStore();
  const [selection, setSelection] = useState<Selection>({ kind: "org", id: initialOrgId });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(descendantOrgIds(ROOT_ORG_ID)),
  );
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);

  React.useEffect(() => {
    if (open) setSelection({ kind: "org", id: initialOrgId });
  }, [open, initialOrgId]);

  const ctx = useMemo(
    () => ({
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      asOf: filters.asOf,
      risks,
    }),
    [filters.periodStart, filters.periodEnd, filters.asOf, risks],
  );

  const allLeaves: LeafMetric[] = useMemo(
    () => (indicator ? indicator.leaves(ctx) : []),
    [indicator, ctx],
  );

  const nodeMetric = (orgId: string): NodeMetric =>
    indicator
      ? aggregate(indicator, allLeaves, new Set(descendantOrgIds(orgId)))
      : ({ value: null, numerator: null, denominator: null, leaves: [], status: "unknown", coverage: { evaluated: 0, expected: 0, partial: false } } as NodeMetric);

  const selectedMetric: NodeMetric = useMemo(() => {
    if (!indicator) return nodeMetric(ROOT_ORG_ID);
    if (selection.kind === "org") return nodeMetric(selection.id);
    const leaf = allLeaves.find((l) => l.objectId === selection.id);
    if (!leaf) return nodeMetric(ROOT_ORG_ID);
    return aggregate(indicator, [leaf], new Set([leaf.orgId]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicator, selection, allLeaves]);

  const selectedLeaf =
    selection.kind === "leaf" ? allLeaves.find((l) => l.objectId === selection.id) : undefined;

  if (!indicator) return null;

  const openRiskCountForOrg = (orgId: string) => {
    const scope = new Set(descendantOrgIds(orgId));
    return risks.filter((r) => isOpen(r) && scope.has(r.owner_org_id)).length;
  };

  const renderTreeNode = (orgId: string, depth: number): React.ReactNode => {
    const org = orgById(orgId);
    if (!org) return null;
    const metric = nodeMetric(orgId);
    const kids = childOrgs(orgId);
    const leaves = allLeaves.filter((l) => l.orgId === orgId);
    const isExpanded = expanded.has(orgId);
    const selected = selection.kind === "org" && selection.id === orgId;
    const abnormalHere = metric.status === "risk" || metric.status === "attention";
    const riskCount = openRiskCountForOrg(orgId);

    if (onlyAbnormal && riskCount === 0 && !abnormalHere) return null;

    return (
      <div key={orgId}>
        <div
          className={`flex items-center gap-1.5 pr-2 rounded-[4px] cursor-pointer transition-colors duration-150 ${
            selected ? "bg-tint" : "hover:bg-[#eef3fb]"
          }`}
          style={{ paddingLeft: 6 + depth * 14, minHeight: 34 }}
          onClick={() => setSelection({ kind: "org", id: orgId })}
          role="treeitem"
          aria-selected={selected}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelection({ kind: "org", id: orgId });
            }
          }}
        >
          {kids.length + leaves.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((s) => {
                  const n = new Set(s);
                  if (n.has(orgId)) n.delete(orgId);
                  else n.add(orgId);
                  return n;
                });
              }}
              className="w-4 h-4 shrink-0 text-[10px] text-textsub hover:text-brand"
              aria-label={isExpanded ? "收起" : "展开"}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span
            className={`text-[13px] truncate flex-1 ${selected ? "text-brand font-medium" : "text-textmain"}`}
          >
            {org.name}
          </span>
          <span className="text-[11px] text-textsub shrink-0">{orgLevelLabel(org)}</span>
          <span className="num text-[13px] shrink-0 w-[74px] text-right text-textmain">
            {formatMetric(indicator, metric)}
          </span>
          {riskCount > 0 && (
            <span className="num text-[11px] shrink-0 text-[#b42318]" title={`含未关闭事项 ${riskCount} 件`}>
              {riskCount}
            </span>
          )}
        </div>
        {isExpanded && (
          <>
            {kids.map((k) => renderTreeNode(k.id, depth + 1))}
            {leaves.map((leaf) => {
              const lm = aggregate(indicator, [leaf], new Set([leaf.orgId]));
              const leafAbnormal = lm.status === "risk" || lm.status === "attention";
              if (onlyAbnormal && leaf.riskIds.length === 0 && !leafAbnormal) return null;
              const sel = selection.kind === "leaf" && selection.id === leaf.objectId;
              return (
                <div
                  key={leaf.objectId}
                  className={`flex items-center gap-1.5 pr-2 rounded-[4px] cursor-pointer transition-colors duration-150 ${
                    sel ? "bg-tint" : "hover:bg-[#eef3fb]"
                  }`}
                  style={{ paddingLeft: 6 + (depth + 1) * 14 + 16, minHeight: 32 }}
                  onClick={() => setSelection({ kind: "leaf", id: leaf.objectId })}
                  role="treeitem"
                  aria-selected={sel}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelection({ kind: "leaf", id: leaf.objectId });
                    }
                  }}
                >
                  <span className={`text-[13px] truncate flex-1 ${sel ? "text-brand font-medium" : "text-textmain"}`}>
                    {leaf.name}
                  </span>
                  <span className="text-[11px] text-textsub shrink-0">
                    {objectTypeLabel[leaf.objectType] ?? leaf.objectType}
                  </span>
                  <span className="num text-[13px] shrink-0 w-[74px] text-right text-textmain">
                    {formatMetric(indicator, lm)}
                  </span>
                  {leaf.riskIds.length > 0 && (
                    <span className="num text-[11px] shrink-0 text-[#b42318]">{leaf.riskIds.length}</span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  const childRows =
    selection.kind === "org"
      ? [
          ...childOrgs(selection.id).map((c) => ({
            id: c.id,
            name: c.name,
            type: orgLevelLabel(c),
            metric: nodeMetric(c.id),
            isOrg: true,
          })),
          ...allLeaves
            .filter((l) => l.orgId === selection.id)
            .map((l) => ({
              id: l.objectId,
              name: l.name,
              type: objectTypeLabel[l.objectType] ?? l.objectType,
              metric: aggregate(indicator, [l], new Set([l.orgId])),
              isOrg: false,
            })),
        ]
      : [];

  const detailLeaves = selection.kind === "org" ? selectedMetric.leaves : selectedLeaf ? [selectedLeaf] : [];

  const target = indicator.target ?? null;
  const deviation =
    target !== null && selectedMetric.value !== null ? selectedMetric.value - target : null;

  const relatedTrace = seed.data_traces.find(
    (t) => selectedLeaf && t.object_id === selectedLeaf.objectId,
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 flex-wrap">
          {indicator.name}
          <Tag tone="brand">P71 指标组织穿透</Tag>
          <Tag tone="neutral">单位 {indicator.unit}</Tag>
        </span>
      }
      subtitle={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>指标范围：{scopeLabel}</span>
          <span className="num">
            期间 {filters.periodStart} ~ {filters.periodEnd}
          </span>
          <span className="num">截至日 {filters.asOf}</span>
          <span>口径版本 DEMO-RULES-V1.2</span>
          <span>数据性质：模拟</span>
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-textsub">
            浮层内选择组织只改变本浮层范围，不修改背景页全局组织；关闭或 Esc 后恢复背景页阶段、筛选、页码与滚动位置。
          </span>
          <Button onClick={onClose}>关闭</Button>
        </div>
      }
    >
      <div className="h-full flex min-h-0">
        {/* 左侧组织树 30% */}
        <aside className="w-[30%] min-w-[280px] max-w-[380px] border-r border-line bg-[#f7f9fd] flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-textmain">组织及对象穿透</span>
            <label className="flex items-center gap-1 text-[12px] text-textsub cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAbnormal}
                onChange={(e) => setOnlyAbnormal(e.target.checked)}
              />
              只看异常
            </label>
          </div>
          <div className="px-4 py-1.5 border-b border-line text-[11px] text-textsub leading-4">
            海油工程总部—二级单位—三级单位—{objectTypeLabel[indicator.leafObjectType] ?? "末端对象"}；
            缺层按真实管理关系跳过，被投企业不并入管理树。
          </div>
          <div className="flex-1 overflow-auto py-2 px-2" role="tree">
            {renderTreeNode(ROOT_ORG_ID, 0)}
          </div>
        </aside>

        {/* 右侧指标详情 70% */}
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="px-6 py-4 space-y-4">
            {indicatorOptions.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-textsub">切换指标（保留当前组织节点）：</span>
                {indicatorOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onSwitchIndicator(opt.id)}
                    className={`h-7 px-2.5 rounded-[6px] border text-[12px] transition-colors duration-150 ${
                      opt.id === indicator.id
                        ? "border-brand bg-tint text-brand"
                        : "border-line bg-surface text-textsub hover:bg-tint"
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )}

            <div className="border border-line rounded-[8px] p-4 bg-surface">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[12px] text-textsub">
                    当前节点：
                    {selection.kind === "org"
                      ? orgById(selection.id)?.name
                      : `${selectedLeaf?.name}（${objectTypeLabel[selectedLeaf?.objectType ?? ""] ?? ""}）`}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="num text-[32px] font-semibold leading-9">
                      {formatMetric(indicator, selectedMetric)}
                    </span>
                    <span className="text-[13px] text-textsub">{indicator.unit}</span>
                    {statusTag(selectedMetric)}
                  </div>
                </div>
                <div className="text-right">
                  {target !== null ? (
                    <>
                      <div className="text-[12px] text-textsub">{indicator.targetLabel}</div>
                      <div className="num text-[14px] text-textmain mt-1">
                        偏差 {deviation === null ? "—" : `${deviation > 0 ? "+" : ""}${deviation.toFixed(2)} 个百分点`}
                      </div>
                    </>
                  ) : (
                    <div className="text-[12px] text-textsub">未配置目标，不生成虚构偏差</div>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-line">
                <DescList
                  cols={4}
                  items={[
                    {
                      label: "分子",
                      value:
                        selectedMetric.numerator === null ? (
                          "—"
                        ) : (
                          <span className="num">{fmtAmount(selectedMetric.numerator)}</span>
                        ),
                    },
                    {
                      label: "分母",
                      value:
                        selectedMetric.denominator === null ? (
                          <span className="text-textsub">不适用（计数/金额类指标）</span>
                        ) : (
                          <span className="num">{fmtAmount(selectedMetric.denominator)}</span>
                        ),
                    },
                    {
                      label: "数据覆盖",
                      value: `${selectedMetric.coverage.evaluated}/${selectedMetric.coverage.expected} 个对象${
                        selectedMetric.coverage.partial ? "（部分覆盖）" : ""
                      }`,
                    },
                    {
                      label: "含未关闭事项",
                      value:
                        selectedMetric.leaves.reduce((a, l) => a + l.riskIds.length, 0) > 0 ? (
                          <span className="text-[#b42318]">
                            含高风险对象 {selectedMetric.leaves.filter((l) => l.riskIds.length > 0).length} 个
                          </span>
                        ) : (
                          "0"
                        ),
                    },
                  ]}
                />
              </div>

              {selectedMetric.emptyReason && (
                <div className="mt-3">
                  <Notice tone="neutral">{selectedMetric.emptyReason}</Notice>
                </div>
              )}
            </div>

            {selection.kind === "org" && childRows.length > 0 && (
              <div className="border border-line rounded-[8px] overflow-hidden bg-surface">
                <div className="px-4 py-2.5 border-b border-line text-[14px] font-medium">
                  下级比较
                </div>
                <DataTable
                  dense
                  rows={childRows}
                  rowKey={(r) => r.id}
                  onRowClick={(r) =>
                    setSelection(r.isOrg ? { kind: "org", id: r.id } : { kind: "leaf", id: r.id })
                  }
                  columns={[
                    { key: "name", title: "名称", render: (r) => <span className="text-brand">{r.name}</span> },
                    { key: "type", title: "类型", width: "120px", render: (r) => <span className="text-textsub text-[13px]">{r.type}</span> },
                    {
                      key: "value",
                      title: `指标值（${indicator.unit}）`,
                      align: "right",
                      width: "160px",
                      render: (r) => formatMetric(indicator, r.metric),
                    },
                    {
                      key: "status",
                      title: "状态",
                      width: "140px",
                      render: (r) => statusTag(r.metric),
                    },
                  ]}
                />
              </div>
            )}

            <div className="border border-line rounded-[8px] overflow-hidden bg-surface">
              <div className="px-4 py-2.5 border-b border-line text-[14px] font-medium flex items-center justify-between">
                <span>指标构成与业务明细</span>
                <span className="text-[12px] text-textsub">
                  共 {detailLeaves.length} 个对象，按对象 ID 去重
                </span>
              </div>
              {detailLeaves.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-textsub">
                  当前范围无业务，不显示 0% 或正常绿灯
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {detailLeaves.map((leaf) => (
                    <div key={leaf.objectId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/objects/${leaf.objectType}/${leaf.objectId}`}
                            className="text-brand text-[14px] hover:underline"
                          >
                            {leaf.name}
                          </Link>
                          <Tag tone="neutral">{objectTypeLabel[leaf.objectType] ?? leaf.objectType}</Tag>
                          <span className="text-[12px] text-textsub num">{leaf.objectId}</span>
                          {!leaf.dataComplete && <Tag tone="neutral">数据不足</Tag>}
                          {leaf.riskIds.map((id) => (
                            <Link key={id} href={`/risk-cases/${id}`}>
                              <Tag tone="red">未关闭事项 {id}</Tag>
                            </Link>
                          ))}
                        </div>
                        <span className="num text-[16px] font-semibold">
                          {formatMetric(indicator, aggregate(indicator, [leaf], new Set([leaf.orgId])))}
                        </span>
                      </div>
                      {leaf.gapNote && (
                        <div className="mt-2">
                          <Notice tone="amber">{leaf.gapNote}</Notice>
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-1.5">
                        {leaf.extras.map((x, i) => (
                          <div key={i} className="min-w-0">
                            <div className="text-[12px] text-textsub">{x.label}</div>
                            <div className="num text-[13px] text-textmain" title={x.hint}>
                              {x.value}
                              {x.hint && <span className="ml-1 text-[11px] text-textsub">ⓘ</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <Link href={`/objects/${leaf.objectType}/${leaf.objectId}`}>
                          <LinkButton>查看对象档案 P74</LinkButton>
                        </Link>
                        <Link href={`/business-links/${leaf.objectType}/${leaf.objectId}`}>
                          <LinkButton>业务关联 P79</LinkButton>
                        </Link>
                        {seed.data_traces.some((t) => t.object_id === leaf.objectId) && (
                          <Link
                            href={`/data-trace/${seed.data_traces.find((t) => t.object_id === leaf.objectId)!.id}`}
                          >
                            <LinkButton>查看计算依据 P78</LinkButton>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-line rounded-[8px] p-4 bg-surface">
              <div className="text-[14px] font-medium mb-2">口径与构成</div>
              <DescList
                cols={1}
                items={[
                  { label: "计算公式", value: <span className="text-[13px]">{indicator.formula}</span> },
                  { label: "口径说明", value: <span className="text-[13px]">{indicator.caliber}</span> },
                  { label: "数据来源", value: <span className="text-[13px]">{indicator.sourceNote}</span> },
                  {
                    label: "版本与性质",
                    value: (
                      <span className="text-[13px]">
                        演示规则版本 DEMO-RULES-V1.2；参数为底稿参数或演示参数，正式阈值由业务部门确认后配置。
                      </span>
                    ),
                  },
                ]}
              />
              {relatedTrace && (
                <div className="mt-3">
                  <Link href={`/data-trace/${relatedTrace.id}`}>
                    <Button variant="primary" size="sm">
                      进入数据追溯 P78：{relatedTrace.name}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
