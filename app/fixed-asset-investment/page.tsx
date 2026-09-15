"use client";

import React, { useMemo, useState } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Button, Card, DataTable, Notice, SimulatedBadge, Tag, inputClass, selectClass } from "@/components/ui";
import { seed } from "@/lib/seed";
import { intersectOrgScope } from "@/lib/config";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtDate, fmtPct, fmtSignedPct } from "@/lib/format";
import { isOpen } from "@/lib/risks";
import { downloadCsv } from "@/lib/export";
import { useDemoStore } from "@/lib/store";
import type { Asset, FixedAssetProject } from "@/lib/types";

/**
 * P20 固定资产投资管理。8 个环节固定为 FA-V12-01 至 FA-V12-08，
 * 末环节合并资产运营与投资后评价两个子主题（完整业需 7.3）。
 */

const PHASE_FOCUS: Record<string, string> = {
  "FA-V12-01": "监管重点：需求与存量资产是否匹配、项目准入规则是否更新（FA-S04、FA-S25）。子环节：需求识别、存量能力核实、项目准入、储备更新。",
  "FA-V12-02": "监管重点：论证依据、基础数据与重大风险，中介独立性（FA-S03、07、08、09；审批结果关联 FA-S02）。子环节：可研编制、基础数据核验、收益及风险论证、中介独立性核查、专业审查。",
  "FA-V12-03": "监管重点：材料审批、千万元以下适用报备、超授权与拆分规避（FA-S02、10、12、13）。子环节：方案审议、授权核对、适用报批报备、决策结论及条件落实。",
  "FA-V12-04": "监管重点：概算编制基础、适用审查、与可研批准估算的差异处理（FA-S05、06）。部分项目无独立初设概算环节，按适用条件显示“不适用”，不虚造批复。",
  "FA-V12-05": "监管重点：提前采办条件、应招未招、关联线索与关键资质（FA-S14 至 18）。询价、选商与对外签约/支出分别记录。",
  "FA-V12-06": "监管重点：未批实施、设计变更、超概、进度、成本、环境变化、实施备案与计划资金衔接（FA-S11、19 至 24、34）。",
  "FA-V12-07": "监管重点：分批验收、达到预定可使用状态、实际投用、价值归集与转固办理（新增 FA-X01）；权属登记 FA-S32、境外安排 FA-S31/33 关联查看。",
  "FA-V12-08": "监管重点：资产运营（利用、盘活、权属及境外安排、减值迹象，FA-S29 至 33、35）与投资后评价（计划、评价、目标实现、问题整改，FA-S26 至 28）。资产投用运营在前，后评价依赖实际运营数据，二者并存而非先后互斥。",
};

function ProjectLedger({ helpers }: { helpers: DomainHelpers }) {
  const { filters, risks } = useDemoStore();
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyOver, setOnlyOver] = useState(false);
  const [q, setQ] = useState("");
  const orgIds = helpers.orgIds;

  const rows = useMemo(() => {
    return seed.fixed_asset_projects
      .filter((p) => orgIds.has(p.owner_org_id))
      .filter((p) => helpers.allowedObjectIds === null || helpers.allowedObjectIds.includes(p.id))
      .filter((p) => (phaseFilter === "all" ? true : p.phase === phaseFilter))
      .filter((p) => (typeFilter === "all" ? true : p.project_type === typeFilter))
      .filter((p) => (onlyOver ? (p.eac ?? 0) > p.effective_approved_budget : true))
      .filter((p) =>
        q.trim() ? `${p.id}${p.name}`.toLowerCase().includes(q.trim().toLowerCase()) : true,
      );
  }, [orgIds, phaseFilter, typeFilter, onlyOver, q, helpers.allowedObjectIds]);

  const openFor = (id: string) => risks.filter((r) => isOpen(r) && r.primary_object_id === id);

  return (
    <Card
      title="投资项目台账"
      subtitle="“项目当前业务阶段”筛选与首页“问题所属环节”筛选是两个独立条件，不互相覆盖"
      right={
        <Button
          onClick={() =>
            downloadCsv(
              "固定资产投资项目台账.csv",
              [
                "项目编号",
                "项目名称",
                "主归属单位",
                "法律主体",
                "项目类型",
                "当前阶段",
                "当前有效概算",
                "预计完工投资",
                "同期累计计划",
                "同期完成投资",
                "资金计划",
                "实际支付",
                "计划进度",
                "实际进度",
                "未关闭事项",
              ],
              rows.map((p) => [
                p.id,
                p.name,
                orgName(p.owner_org_id),
                p.legal_entity_id,
                p.project_type,
                p.phase,
                p.effective_approved_budget,
                p.eac ?? "",
                p.ytd_plan ?? "",
                p.ytd_completed_investment ?? "",
                p.funds_plan_ytd ?? "",
                p.cash_paid_ytd ?? "",
                p.planned_progress_pct ?? "",
                p.actual_progress_pct ?? "",
                openFor(p.id).length,
              ]),
              {
                title: "固定资产投资项目台账",
                scopeLines: [
                  `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}`,
                  "金额单位：万元人民币；口径：不含可抵扣进项税的可比投资口径",
                  `筛选：阶段=${phaseFilter}，类型=${typeFilter}，仅看超概=${onlyOver ? "是" : "否"}`,
                ],
              },
            )
          }
        >
          导出当前筛选
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          className={`${inputClass} w-[220px]`}
          placeholder="搜索项目编号或名称"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={`${selectClass} w-[150px]`} value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
          <option value="all">全部当前阶段</option>
          {[...new Set(seed.fixed_asset_projects.map((p) => p.phase))].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className={`${selectClass} w-[150px]`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">全部项目类型</option>
          {[...new Set(seed.fixed_asset_projects.map((p) => p.project_type))].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-textmain">
          <input type="checkbox" checked={onlyOver} onChange={(e) => setOnlyOver(e.target.checked)} />
          只看预计超概
        </label>
        {(q || onlyOver || phaseFilter !== "all" || typeFilter !== "all") && (
          <Button
            onClick={() => {
              setQ("");
              setOnlyOver(false);
              setPhaseFilter("all");
              setTypeFilter("all");
            }}
          >
            清除条件
          </Button>
        )}
        <span className="text-[12px] text-textsub ml-auto">金额单位：万元人民币</span>
      </div>

      <DataTable<FixedAssetProject>
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => helpers.openObject(p.id)}
        empty="当前组织范围与筛选条件下没有投资项目。"
        columns={[
          {
            key: "name",
            title: "项目",
            render: (p) => (
              <span>
                <span className="text-textmain">{p.name}</span>
                <span className="num text-[12px] text-textsub ml-2">{p.id}</span>
              </span>
            ),
          },
          { key: "org", title: "主归属单位", width: "130px", render: (p) => orgName(p.owner_org_id) },
          { key: "type", title: "类型", width: "100px", render: (p) => p.project_type },
          { key: "phase", title: "当前阶段", width: "100px", render: (p) => p.phase },
          {
            key: "budget",
            title: "当前有效概算",
            align: "right",
            width: "120px",
            render: (p) => <span className="num">{fmtAmount(p.effective_approved_budget)}</span>,
          },
          {
            key: "eac",
            title: "预计完工投资",
            align: "right",
            width: "130px",
            render: (p) => (
              <span className="num" style={{ color: (p.eac ?? 0) > p.effective_approved_budget ? "var(--risk-red-fg)" : undefined }}>
                {fmtAmount(p.eac)}
                {p.eac_complete === false && <span className="text-[11px] text-textsub"> 下限</span>}
              </span>
            ),
            hint: "构成不完整时显示已知下限，不标为完整 EAC",
          },
          {
            key: "dev",
            title: "偏差率",
            align: "right",
            width: "92px",
            render: (p) =>
              p.eac === undefined ? (
                <span className="text-textsub">—</span>
              ) : (
                <span
                  className="num"
                  style={{ color: p.eac > p.effective_approved_budget ? "var(--risk-red-fg)" : undefined }}
                >
                  {fmtSignedPct(((p.eac - p.effective_approved_budget) / p.effective_approved_budget) * 100)}
                </span>
              ),
          },
          {
            key: "exec",
            title: "同期完成/计划",
            align: "right",
            width: "140px",
            render: (p) =>
              p.ytd_plan === undefined ? (
                <span className="text-textsub" title="无年度计划的项目不进入执行率分母">
                  无同期计划
                </span>
              ) : (
                <span className="num">
                  {fmtAmount(p.ytd_completed_investment)} / {fmtAmount(p.ytd_plan)}
                </span>
              ),
          },
          {
            key: "prog",
            title: "进度（计划/实际）",
            align: "right",
            width: "150px",
            render: (p) =>
              p.planned_progress_pct === undefined ? (
                <span className="text-textsub">—</span>
              ) : (
                <span className="num">
                  {fmtPct(p.planned_progress_pct, 0)} / {fmtPct(p.actual_progress_pct, 0)}
                </span>
              ),
          },
          {
            key: "risk",
            title: "未关闭事项",
            align: "right",
            width: "110px",
            render: (p) => {
              const rs = openFor(p.id);
              const red = rs.filter((r) => r.severity === "red").length;
              return (
                <span
                  className="num"
                  style={{ color: red > 0 ? "var(--risk-red-fg)" : rs.length > 0 ? "var(--risk-amber-fg)" : "var(--text-sub)" }}
                >
                  {rs.length}
                  {red > 0 && " ●"}
                </span>
              );
            },
          },
        ]}
      />
    </Card>
  );
}

function AssetOperation({ helpers }: { helpers: DomainHelpers }) {
  const { filters, risks } = useDemoStore();
  const orgIds = helpers.orgIds;
  const assets = useMemo(() => seed.assets.filter((a) => orgIds.has(a.owner_org_id)), [orgIds]);

  const majors = assets.filter((a) => a.is_major);
  const majorNet = majors.reduce((s, a) => s + a.net_book_value, 0);
  const lowNet = majors.filter((a) => a.low_utilization_confirmed).reduce((s, a) => s + a.net_book_value, 0);
  const idleNet = majors.filter((a) => a.formally_idle).reduce((s, a) => s + a.net_book_value, 0);
  const impairFlag = assets.filter((a) => a.impairment_allowance > 0);

  return (
    <div className="space-y-4">
      <Card
        title="资产运营监管"
        subtitle="重大资产账面净值、低利用率占比、低效闲置、权属与减值迹象分别统计，不把月度利用率标为年度效益"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "纳入监测重大资产净值", value: fmtAmount(majorNet), unit: "万元", note: `${majors.length} 项重大资产` },
            {
              label: "已确认低利用率净值占比",
              value: majorNet ? fmtPct((lowNet / majorNet) * 100) : "—",
              unit: "",
              note: "分子为已人工确认低利用率的重大资产净值",
            },
            {
              label: "正式低效闲置净值",
              value: fmtAmount(idleNet),
              unit: "万元",
              note: idleNet === 0 ? "低利用率不自动认定闲置" : "已认定闲置",
            },
            {
              label: "存在减值迹象资产",
              value: String(impairFlag.length),
              unit: "项",
              note: "减值迹象资产与已计提减值资产分别统计",
            },
          ].map((k) => (
            <div key={k.label} className="rounded-[8px] border border-line px-4 py-3">
              <div className="text-[13px] text-textsub">{k.label}</div>
              <div className="num text-[24px] font-semibold text-textmain mt-1">
                {k.value}
                {k.unit && <span className="text-[13px] text-textsub ml-1">{k.unit}</span>}
              </div>
              <div className="text-[12px] text-textsub mt-1">{k.note}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="资产运营台账" subtitle="低利用率候选、确认低利用率、正式低效闲置、待盘活、盘活中、已完成是不同状态">
        <DataTable<Asset>
          rows={assets}
          rowKey={(a) => a.id}
          onRowClick={(a) => helpers.openObject(a.id)}
          empty="当前组织范围内没有纳入监测的资产。"
          columns={[
            {
              key: "name",
              title: "资产",
              render: (a) => (
                <span>
                  <span className="text-textmain">{a.name}</span>
                  <span className="num text-[12px] text-textsub ml-2">{a.id}</span>
                </span>
              ),
            },
            { key: "type", title: "类别", width: "110px", render: (a) => a.asset_type },
            { key: "major", title: "重大资产", width: "90px", render: (a) => (a.is_major ? "是" : "否") },
            { key: "src", title: "来源投资项目", width: "120px", render: (a) => <span className="num">{a.source_project_id}</span> },
            { key: "org", title: "权属/使用单位", width: "130px", render: (a) => orgName(a.owner_org_id) },
            { key: "net", title: "账面净值", align: "right", width: "110px", render: (a) => <span className="num">{fmtAmount(a.net_book_value)}</span> },
            {
              key: "util",
              title: "最近季度利用率",
              align: "right",
              width: "130px",
              render: (a) => {
                const last = a.quarterly_utilization_history.slice(-1)[0];
                if (!last) return <span className="text-textsub">样本不足</span>;
                return (
                  <span
                    className="num"
                    style={{ color: last.actual_pct < a.utilization_threshold_pct ? "var(--risk-amber-fg)" : undefined }}
                    title={`${last.period}；目标 ${a.utilization_threshold_pct}%`}
                  >
                    {fmtPct(last.actual_pct, 0)}
                  </span>
                );
              },
              hint: "季度为触发依据，月度明细仅作趋势",
            },
            {
              key: "state",
              title: "监管状态",
              width: "190px",
              render: (a) => (
                <span className="flex flex-wrap gap-1">
                  {a.low_utilization_confirmed ? (
                    <Tag tone="amber">已确认低利用率</Tag>
                  ) : (
                    <Tag tone="neutral">未确认</Tag>
                  )}
                  {a.formally_idle && <Tag tone="red">正式低效闲置</Tag>}
                  {a.registration_required && <Tag tone="neutral">应办权属登记</Tag>}
                </span>
              ),
            },
            {
              key: "risk",
              title: "未关闭事项",
              align: "right",
              width: "110px",
              render: (a) => {
                const rs = risks.filter((r) => isOpen(r) && r.primary_object_id === a.id);
                return (
                  <span className="num" style={{ color: rs.length > 0 ? "var(--risk-amber-fg)" : "var(--text-sub)" }}>
                    {rs.length}
                  </span>
                );
              },
            },
          ]}
        />
        <div className="mt-3 space-y-2">
          <Notice tone="neutral" title="资产汇总口径">
            同一资产仅按已定义归属汇总一次；多个工程项目使用同一资产时，利用量按不重叠使用记录归集，不把完整资产净值分配到每个项目后重复汇总。
            资产利用率只汇总同类别、同计量口径的使用量与可利用量，小时、天数与产能不相加。
          </Notice>
          <div className="flex items-center gap-2">
            <SimulatedBadge text="配置阈值参数" />
            <span className="text-[12px] text-textsub">
              利用率目标为模拟参数，正式落地按同类别批准目标替换（见数据依据页“待确认参数”）。
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TransferLedger() {
  const { filters, user } = useDemoStore();
  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );
  const projects = seed.fixed_asset_projects.filter((p) => orgIds.has(p.owner_org_id));

  return (
    <Card
      title="验收投用与转固衔接（FA-X01 补充场景）"
      subtitle="分别保存验收、达到预定可使用状态、实际投用、转固与后评价状态；尚未取得办理期限时只显示待核查，不编造法定天数"
    >
      <DataTable
        rows={projects}
        rowKey={(p) => p.id}
        empty="当前范围没有投资项目。"
        columns={[
          { key: "name", title: "项目", render: (p) => p.name },
          { key: "acc", title: "验收日期", width: "120px", render: (p) => <span className="num">{fmtDate(p.acceptance_date)}</span> },
          { key: "ready", title: "达到预定可使用状态", width: "160px", render: (p) => <span className="num">{fmtDate(p.ready_for_use_date)}</span> },
          { key: "cap", title: "转固日期", width: "120px", render: (p) => <span className="num">{fmtDate(p.capitalization_date)}</span> },
          {
            key: "assets",
            title: "已关联资产",
            width: "150px",
            render: (p) => (p.asset_ids?.length ? p.asset_ids.join("、") : <span className="text-textsub">—</span>),
          },
          {
            key: "state",
            title: "衔接状态",
            render: (p) => {
              if (!p.acceptance_date && !p.ready_for_use_date) return <Tag tone="neutral">尚未进入验收投用环节</Tag>;
              if (p.ready_for_use_date && !p.capitalization_date) return <Tag tone="amber">达到可使用状态未转固，待核查办理期限</Tag>;
              if (p.capitalization_date && !(p.asset_ids?.length)) return <Tag tone="amber">已转固但未完成项目/资产关联</Tag>;
              return <Tag tone="green">批次衔接完整</Tag>;
            },
          },
          { key: "post", title: "后评价计划", width: "130px", render: (p) => <span className="num">{fmtDate(p.post_evaluation_due)}</span> },
        ]}
      />
      <div className="mt-3">
        <Notice tone="amber" title="补充设计">
          FA-X01 及补充指标 FA-XI01/XI02/XI03 明确标为本业需补充设计，不是投资底稿原始场景；分批验收、分批投用、分批转固分别建批次。
        </Notice>
      </div>
    </Card>
  );
}

export default function Page() {
  return (
    <DomainPage
      domain="FA"
      intro="从投资需求、论证审批、建设投入，监管到资产投用、运营效益、盘活与后评价。项目类型与资产类别分别用于匹配监测口径，不作为同一字段。"
      kpiIndicatorIds={["FA-CNT-PROJECT", "FA-I06", "FA-CNT-OVERBUDGET", "FA-I07", "FA-I14", "FA-OPEN"]}
      phaseFocus={PHASE_FOCUS}
      subtopicByPhase={{
        "FA-V12-08": [
          { id: "operation", label: "资产运营", note: "按资产统计：利用、盘活、权属及境外安排、减值迹象（FA-S29 至 33、35）" },
          { id: "post_evaluation", label: "投资后评价", note: "按项目统计：评价计划、评价实施、目标实现、问题整改（FA-S26 至 28）" },
        ],
      }}
      ledger={(h) => <ProjectLedger helpers={h} />}
      tabs={[
        { id: "asset", label: "资产运营监管", render: (h) => <AssetOperation helpers={h} /> },
        {
          id: "project",
          label: "项目穿透",
          render: (h) => (
            <div className="space-y-4">
              <ProjectLedger helpers={h} />
              <TransferLedger />
            </div>
          ),
        },
      ]}
    />
  );
}
