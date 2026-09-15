"use client";

import React, { useMemo, useState } from "react";
import { Drawer, Tag, DataTable, Notice, Button, LinkButton, DescList, Modal } from "@/components/ui";
import { aggregate, type IndicatorDef, type LeafMetric, type NodeMetric } from "@/lib/metrics";
import { childOrgs, descendantOrgIds, orgLevelLabel, orgById, ROOT_ORG_ID } from "@/lib/org";
import { fmtAmount, fmtInt, fmtPct, fmtSignedPct } from "@/lib/format";
import { objectTypeLabel, seed } from "@/lib/seed";
import { useDemoStore } from "@/lib/store";
import { isOpen } from "@/lib/risks";
import { authorizedObjectIds, authorizedOrgIds, objectAllowed, riskVisible } from "@/lib/config";

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

export interface IndicatorDrawerProps {
  open: boolean;
  onClose: () => void;
  indicator: IndicatorDef | null;
  indicatorOptions: IndicatorDef[];
  onSwitchIndicator: (id: string) => void;
  initialOrgId: string;
  scopeLabel: string;
  /** 对象档案；传入后在浮层之上继续打开，不跳离背景页 */
  onOpenObject?: (id: string, tab?: string) => void;
  /** 事项办理 */
  onOpenRisk?: (id: string) => void;
}

/** 每次打开或换口径时以 key 重挂载，穿透定位回到当前范围的顶层节点。 */
export default function IndicatorDrawer(props: IndicatorDrawerProps) {
  if (!props.open) return null;
  return <IndicatorDrawerBody key={props.initialOrgId} {...props} />;
}

function IndicatorDrawerBody({
  open,
  onClose,
  indicator,
  indicatorOptions,
  onSwitchIndicator,
  initialOrgId,
  scopeLabel,
  onOpenObject,
  onOpenRisk,
}: IndicatorDrawerProps) {
  const { filters, risks, user } = useDemoStore();
  const [selection, setSelection] = useState<Selection>({ kind: "org", id: initialOrgId });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(descendantOrgIds(ROOT_ORG_ID)),
  );
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [traceLeafId, setTraceLeafId] = useState<string | null>(null);

  const openObject = (id: string, tab?: string) => onOpenObject?.(id, tab);
  const openRisk = (id: string) => onOpenRisk?.(id);

  const allowedOrgs = useMemo(() => authorizedOrgIds(user), [user]);
  const allowedObjectIds = useMemo(() => authorizedObjectIds(user), [user]);

  const ctx = useMemo(
    () => ({
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      asOf: filters.asOf,
      risks,
      allowedObjectIds,
    }),
    [filters.periodStart, filters.periodEnd, filters.asOf, risks, allowedObjectIds],
  );

  const allLeaves: LeafMetric[] = useMemo(
    () =>
      (indicator ? indicator.leaves(ctx) : []).filter((l) => objectAllowed(user, l.orgId, l.objectId)),
    [indicator, ctx, user],
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
    return risks.filter((r) => isOpen(r) && scope.has(r.owner_org_id) && riskVisible(user, r)).length;
  };

  const renderTreeNode = (orgId: string, depth: number): React.ReactNode => {
    const org = orgById(orgId);
    if (!org) return null;
    const kids = childOrgs(orgId).filter((c) => {
      const desc = descendantOrgIds(c.id);
      return [...desc].some((id) => allowedOrgs.has(id));
    });
    if (!allowedOrgs.has(orgId) && kids.length === 0 && !allLeaves.some((l) => l.orgId === orgId)) {
      return null;
    }
    const metric = nodeMetric(orgId);
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

  const traceLeaf = traceLeafId ? allLeaves.find((l) => l.objectId === traceLeafId) : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 flex-wrap">
          {indicator.name}
          <Tag tone="brand">组织穿透</Tag>
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
          <span>数据性质：合成样例</span>
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
            {allowedOrgs.size === 0 ? (
              <p className="px-3 py-6 text-[13px] text-textsub">当前身份无业务组织范围。</p>
            ) : (
              [...allowedOrgs]
                .filter((id) => {
                  const o = orgById(id);
                  return o && (!o.parent_id || !allowedOrgs.has(o.parent_id));
                })
                .map((id) => renderTreeNode(id, 0))
            )}
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
                          <button
                            type="button"
                            onClick={() => openObject(leaf.objectId)}
                            className="text-brand text-[14px] hover:underline"
                          >
                            {leaf.name}
                          </button>
                          <Tag tone="neutral">{objectTypeLabel[leaf.objectType] ?? leaf.objectType}</Tag>
                          <span className="text-[12px] text-textsub num">{leaf.objectId}</span>
                          {!leaf.dataComplete && <Tag tone="neutral">数据不足</Tag>}
                          {leaf.riskIds.map((id) => (
                            <button key={id} type="button" onClick={() => openRisk(id)}>
                              <Tag tone="red">未关闭事项 {id}</Tag>
                            </button>
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
                        <LinkButton onClick={() => openObject(leaf.objectId)}>
                          查看对象档案
                        </LinkButton>
                        <LinkButton onClick={() => openObject(leaf.objectId, "relations")}>
                          业务关联
                        </LinkButton>
                        <LinkButton onClick={() => setTraceLeafId(leaf.objectId)}>
                          查看计算依据
                        </LinkButton>
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
                        规则版本 DEMO-RULES-V1.2；参数为底稿参数或配置参数，正式阈值由业务部门确认后配置。
                      </span>
                    ),
                  },
                ]}
              />
              {selectedLeaf && (
                <div className="mt-3">
                  <Button variant="primary" size="sm" onClick={() => setTraceLeafId(selectedLeaf.objectId)}>
                    查看计算依据：{indicator.name}·{selectedLeaf.name}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {traceLeaf && (
        <TraceModal
          indicator={indicator}
          leaf={traceLeaf}
          scopeLabel={`${orgById(traceLeaf.orgId)?.name ?? traceLeaf.orgId}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}`}
          onClose={() => setTraceLeafId(null)}
          onOpenRisk={openRisk}
        />
      )}
    </Drawer>
  );
}

/**
 * 数据追溯：公式、输入值与结果全部按“当前指标 + 当前对象 + 当前期间”实算，
 * 不复用其他指标已登记的追溯记录。种子追溯只有在 object_id 与 indicator_id
 * 同时对上时才作为源记录补充展示（完整业需 16.3）。
 */
function TraceModal({
  indicator,
  leaf,
  scopeLabel,
  onClose,
  onOpenRisk,
}: {
  indicator: IndicatorDef;
  leaf: LeafMetric;
  scopeLabel: string;
  onClose: () => void;
  onOpenRisk: (id: string) => void;
}) {
  const trace = seed.data_traces.find(
    (t) => t.object_id === leaf.objectId && t.indicator_id === indicator.id,
  );
  const sources = trace
    ? seed.source_records.filter((s) => trace.source_record_ids.includes(s.id))
    : [];
  const result = aggregate(indicator, [leaf], new Set([leaf.orgId]));
  const isRatio = indicator.kind === "ratio" || indicator.kind === "signed_ratio";

  return (
    <Modal
      open
      onClose={onClose}
      title={`计算依据：${indicator.name}·${leaf.name}`}
      width={760}
    >
      <div className="space-y-4">
        <DescList
          cols={1}
          items={[
            { label: "指标", value: <span className="text-[13px]">{indicator.name}（{indicator.id}）</span> },
            { label: "对象", value: <span className="text-[13px]">{leaf.name}<span className="num ml-2 text-textsub">{leaf.objectId}</span></span> },
            { label: "范围与期间", value: <span className="text-[13px]">{scopeLabel}</span> },
            { label: "计算公式", value: <span className="text-[13px]">{indicator.formula}</span> },
            {
              label: isRatio ? "分子 ÷ 分母" : "取值",
              value: (
                <span className="num text-[13px]">
                  {isRatio
                    ? `${fmtAmount(leaf.numerator)} ÷ ${fmtAmount(leaf.denominator)}`
                    : fmtAmount(leaf.numerator)}
                </span>
              ),
            },
            {
              label: "计算结果",
              value: (
                <span className="num text-[14px] font-semibold">
                  {formatMetric(indicator, result)}
                  {result.value === null ? "" : ` ${indicator.unit}`}
                </span>
              ),
            },
            { label: "口径说明", value: <span className="text-[13px]">{indicator.caliber}</span> },
            { label: "数据来源", value: <span className="text-[13px]">{indicator.sourceNote}</span> },
            { label: "数据性质", value: <Tag tone="neutral">模拟数据</Tag> },
          ]}
        />

        <div>
          <div className="text-[13px] font-medium mb-1.5">输入构成</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {leaf.extras.map((x, i) => (
              <div key={i} className="min-w-0">
                <div className="text-[12px] text-textsub">{x.label}</div>
                <div className="num text-[13px] text-textmain">{x.value}</div>
              </div>
            ))}
          </div>
          {leaf.gapNote && (
            <div className="mt-2">
              <Notice tone="amber">{leaf.gapNote}</Notice>
            </div>
          )}
        </div>

        {trace ? (
          <div>
            <div className="text-[13px] font-medium mb-1.5">
              已登记追溯：{trace.name}
            </div>
            <p className="text-[12px] text-textsub mb-2">
              登记公式 <span className="num">{trace.calculation.formula}</span>；
              登记输入{" "}
              <span className="num">
                {trace.calculation.inputs
                  .map((i) => `${i.field} = ${fmtAmount(i.value)} ${i.unit}`)
                  .join("；")}
              </span>
              。{trace.detail_note}
            </p>
            {trace.component_object_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {trace.component_object_ids.map((id) => (
                  <Tag key={id} tone="neutral">{id}</Tag>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Notice tone="neutral" title="源记录明细">
            当前样例未对「{indicator.name}」登记逐笔源记录，上方取值来自该对象的业务台账字段，
            接入后按拟来源系统补充逐笔凭据。
          </Notice>
        )}

        <DataTable
          columns={[
            {
              key: "id",
              title: "源记录",
              width: "180px",
              render: (s) => <span className="num text-[12px]">{s.id}</span>,
            },
            { key: "name", title: "内容", render: (s) => s.name },
            {
              key: "amount",
              title: "金额",
              align: "right",
              render: (s) => (
                <span className="num">
                  {fmtAmount(s.amount)} {s.amount_unit}
                </span>
              ),
            },
            { key: "system", title: "拟来源系统", render: (s) => s.source_system_label },
            {
              key: "date",
              title: "业务日期",
              width: "110px",
              render: (s) => <span className="num text-[12px]">{s.business_date}</span>,
            },
          ]}
          rows={sources}
          rowKey={(s) => s.id}
          dense
          empty="本指标在当前样例中没有逐笔源记录。"
        />
        {leaf.riskIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {leaf.riskIds.map((id) => (
              <Button key={id} variant="secondary" size="sm" onClick={() => onOpenRisk(id)}>
                查看关联事项 {id}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
