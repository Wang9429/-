"use client";

import React, { useMemo, useState } from "react";
import { DataTable, DescList, Drawer, EmptyState, Notice, SeverityTag, SimulatedBadge, Tabs, Tag } from "@/components/ui";
import { findObject } from "@/lib/objects";
import { DOMAIN_META, evidenceById, phaseName, scenarioName, seed, templateById } from "@/lib/seed";
import { orgName, orgPath } from "@/lib/org";
import { fmtAmount, fmtDate, fmtPct } from "@/lib/format";
import { isOpen, statusLabel } from "@/lib/risks";
import { useDemoStore } from "@/lib/store";
import type { LifecycleInstance } from "@/lib/types";

/**
 * P74 对象档案 + P79 横向业务关系 + P75 详细环节核查。
 * 同一对象在任何入口只有一个档案，不因切换 Tab 或领域重建。
 */

const BUSINESS_STATUS_LABEL: Record<string, string> = {
  not_started: "未开始",
  preparing: "准备中",
  in_progress: "进行中",
  completed: "已完成",
  not_applicable: "不适用",
};

function StageTable({ instances }: { instances: LifecycleInstance[] }) {
  return (
    <DataTable
      rows={instances}
      rowKey={(i) => i.id}
      empty="该对象没有环节实例记录。"
      columns={[
        { key: "phase", title: "环节", width: "130px", render: (i) => phaseName(i.phase_id) },
        {
          key: "status",
          title: "业务状态",
          width: "100px",
          render: (i) => (
            <Tag tone={i.business_status === "completed" ? "green" : i.business_status === "in_progress" ? "brand" : "neutral"}>
              {BUSINESS_STATUS_LABEL[i.business_status] ?? i.business_status}
            </Tag>
          ),
          hint: "业务状态与监管状态分开；已完成环节仍可含未关闭事项",
        },
        {
          key: "plan",
          title: "现有效计划",
          width: "190px",
          render: (i) => (
            <span className="num text-[12px]">
              {fmtDate(i.approved_plan_start)} ~ {fmtDate(i.approved_plan_end)}
            </span>
          ),
        },
        {
          key: "actual",
          title: "实际开始/完成",
          width: "190px",
          render: (i) => (
            <span className="num text-[12px]">
              {fmtDate(i.actual_start)} ~ {fmtDate(i.actual_end)}
            </span>
          ),
        },
        { key: "forecast", title: "预计完成", width: "110px", render: (i) => <span className="num text-[12px]">{fmtDate(i.forecast_end)}</span> },
        { key: "ver", title: "计划版本", width: "140px", render: (i) => <span className="num text-[12px]">{i.plan_version}</span> },
        {
          key: "evid",
          title: "依据",
          render: (i) =>
            i.evidence_ids.length === 0 ? (
              <span className="text-textsub">—</span>
            ) : (
              <span className="text-[12px] text-textsub" title={i.evidence_ids.map((e) => evidenceById(e)?.body ?? e).join("\n")}>
                {i.evidence_ids.join("、")}
              </span>
            ),
        },
      ]}
    />
  );
}

/** 切换对象时以 key 重挂载，页签回到「对象档案」。 */
export default function ObjectDrawer({
  objectId,
  onClose,
  onOpenRisk,
}: {
  objectId: string | null;
  onClose: () => void;
  onOpenRisk?: (id: string) => void;
}) {
  if (!objectId) return null;
  return <ObjectDrawerBody key={objectId} objectId={objectId} onClose={onClose} onOpenRisk={onOpenRisk} />;
}

function ObjectDrawerBody({
  objectId,
  onClose,
  onOpenRisk,
}: {
  objectId: string;
  onClose: () => void;
  onOpenRisk?: (id: string) => void;
}) {
  const { risks, filters } = useDemoStore();
  const [tab, setTab] = useState("profile");

  const obj = findObject(objectId);

  const related = useMemo(
    () => seed.business_links.filter((l) => l.from_id === objectId || l.to_id === objectId),
    [objectId],
  );

  const objRisks = useMemo(
    () => risks.filter((r) => r.primary_object_id === objectId),
    [risks, objectId],
  );

  const stages = useMemo(
    () => seed.lifecycle_instances.filter((i) => i.object_id === objectId),
    [objectId],
  );

  const monitoring = useMemo(
    () => seed.scenario_monitoring_coverage.filter((r) => r.monitoring_object_id === objectId),
    [objectId],
  );

  if (!obj) {
    return (
      <Drawer open onClose={onClose} title={`对象 ${objectId}`} width="60vw">
        <div className="p-6">
          <Notice tone="amber" title="对象不在演示数据范围">
            {objectId} 在当前演示数据中没有档案记录。可能属于来源待核实的对象，按“来源待核实”处理，不创建虚假档案。
          </Notice>
        </div>
      </Drawer>
    );
  }

  const fa = seed.fixed_asset_projects.find((p) => p.id === objectId);
  const asset = seed.assets.find((a) => a.id === objectId);
  const eq = seed.equity_projects.find((p) => p.id === objectId);
  const eng = seed.engineering_projects.find((p) => p.id === objectId);
  const account = seed.accounts.find((a) => a.id === objectId);
  const matter = seed.property_matters.find((m) => m.id === objectId);

  return (
    <Drawer
      open
      onClose={onClose}
      width="76vw"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          {obj.name}
          <span className="num text-[14px] text-textsub">{obj.id}</span>
          <Tag tone="neutral">{obj.typeLabel}</Tag>
        </span>
      }
      subtitle={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>管理归属：{orgPath(obj.orgId).map((o) => o.name).join(" / ")}</span>
          <span>截至日：{filters.asOf}</span>
          <SimulatedBadge text="模拟演示数据" />
        </span>
      }
    >
      <div className="h-full overflow-auto px-6 py-4 space-y-4">
        <Tabs
          tabs={[
            { id: "profile", label: "对象全景" },
            { id: "stages", label: `环节核查（${stages.length}）` },
            { id: "relations", label: `业务关系（${related.length}）` },
            { id: "monitoring", label: `监管执行（${monitoring.length}）` },
            { id: "cases", label: `监管事项（${objRisks.length}）` },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "profile" && (
          <>
            {fa && (
              <>
                <DescList
                  cols={4}
                  items={[
                    { label: "项目类型", value: fa.project_type },
                    { label: "当前业务阶段", value: fa.phase },
                    { label: "法律主体", value: fa.legal_entity_id },
                    { label: "金额口径", value: `${fa.amount_unit}｜${fa.tax_basis ?? "—"}` },
                    { label: "可研批准估算", value: <span className="num">{fmtAmount(fa.feasibility_approved_estimate)}</span> },
                    { label: "原初设批准概算", value: <span className="num">{fmtAmount(fa.original_approved_budget)}</span> },
                    { label: "当前有效概算", value: <span className="num">{fmtAmount(fa.effective_approved_budget)}</span> },
                    { label: "预计完工投资 EAC", value: <span className="num">{fmtAmount(fa.eac)}</span>, hint: fa.eac_complete ? "构成完整" : "构成不完整，显示为已知下限" },
                    { label: "年度投资计划", value: <span className="num">{fmtAmount(fa.annual_plan)}</span> },
                    { label: "同期累计计划", value: <span className="num">{fmtAmount(fa.ytd_plan)}</span> },
                    { label: "同期完成投资", value: <span className="num">{fmtAmount(fa.ytd_completed_investment)}</span> },
                    { label: "累计完成投资", value: <span className="num">{fmtAmount(fa.cumulative_completed_investment)}</span> },
                    { label: "资金计划（同期）", value: <span className="num">{fmtAmount(fa.funds_plan_ytd)}</span> },
                    { label: "实际支付（同期）", value: <span className="num">{fmtAmount(fa.cash_paid_ytd)}</span>, hint: "投资完成额与资金支付分别统计，不互相替换" },
                    { label: "总体进度（计划/实际）", value: <span className="num">{fmtPct(fa.planned_progress_pct)} / {fmtPct(fa.actual_progress_pct)}</span> },
                    { label: "批准/预计完工", value: <span className="num">{fmtDate(fa.approved_completion)} / {fmtDate(fa.forecast_completion)}</span> },
                  ]}
                />
                {fa.eac_complete === false && (
                  <Notice tone="amber" title="预计完工投资数据不完整">
                    当前仅显示“已知预计投资下限”，缺失构成项已列示；不把删除缺失项后的结果标为完整 EAC。
                  </Notice>
                )}
              </>
            )}

            {asset && (
              <>
                <DescList
                  cols={4}
                  items={[
                    { label: "资产类别", value: asset.asset_type },
                    { label: "重大资产", value: asset.is_major ? "是" : "否" },
                    { label: "来源投资项目", value: <span className="num">{asset.source_project_id}</span> },
                    { label: "运行状态", value: asset.status },
                    { label: "原值", value: <span className="num">{fmtAmount(asset.gross_value)}</span> },
                    { label: "累计折旧", value: <span className="num">{fmtAmount(asset.accumulated_depreciation)}</span> },
                    { label: "减值准备", value: <span className="num">{fmtAmount(asset.impairment_allowance)}</span> },
                    { label: "账面净值", value: <span className="num">{fmtAmount(asset.net_book_value)}</span> },
                    { label: "监测频率", value: asset.monitoring_frequency === "quarterly" ? "季度" : asset.monitoring_frequency },
                    { label: "利用率目标", value: <span className="num">{fmtPct(asset.utilization_threshold_pct)}</span>, hint: asset.threshold_nature },
                    {
                      label: "低利用率确认",
                      value: asset.low_utilization_confirmed ? `已确认（${fmtDate(asset.confirmation_date)}）` : "未确认",
                    },
                    { label: "是否正式低效闲置", value: asset.formally_idle ? "是" : "否，低利用率不自动认定闲置" },
                  ]}
                />
                <div>
                  <h4 className="text-[15px] font-semibold text-textmain mb-2">季度利用率（触发依据）</h4>
                  <DataTable
                    dense
                    rows={asset.quarterly_utilization_history}
                    rowKey={(p) => p.period}
                    columns={[
                      { key: "p", title: "监测期", render: (p) => p.period },
                      { key: "v", title: "实际利用率", align: "right", render: (p) => <span className="num">{fmtPct(p.actual_pct)}</span> },
                      { key: "t", title: "目标", align: "right", render: () => <span className="num">{fmtPct(asset.utilization_threshold_pct)}</span> },
                      {
                        key: "r",
                        title: "结论",
                        render: (p) =>
                          p.actual_pct < asset.utilization_threshold_pct ? (
                            <Tag tone="amber">低于目标</Tag>
                          ) : (
                            <Tag tone="green">达标</Tag>
                          ),
                      },
                    ]}
                  />
                  <p className="text-[12px] text-textsub mt-2">{asset.monthly_trend_note}</p>
                </div>
              </>
            )}

            {eq && (
              <DescList
                cols={4}
                items={[
                  { label: "投资类型", value: eq.investment_type },
                  { label: "被投企业", value: <span className="num">{eq.investee_id}</span> },
                  { label: "持股比例", value: <span className="num">{fmtPct(eq.holding_pct)}</span> },
                  { label: "核算方法", value: eq.accounting_method_demo },
                  { label: "批准投资总额", value: <span className="num">{fmtAmount(eq.approved_total_investment)}</span> },
                  { label: "年度投资计划", value: <span className="num">{fmtAmount(eq.annual_investment_plan)}</span> },
                  { label: "同期出资", value: <span className="num">{fmtAmount(eq.ytd_contribution)}</span> },
                  { label: "累计出资", value: <span className="num">{fmtAmount(eq.cumulative_contribution)}</span> },
                  { label: "已到期应出资", value: <span className="num">{fmtAmount(eq.contribution_due_to_date)}</span>, hint: `到期日 ${eq.contribution_due_date}` },
                  { label: "期初账面余额", value: <span className="num">{fmtAmount(eq.opening_book_balance)}</span> },
                  { label: "期末账面余额（减值前）", value: <span className="num">{fmtAmount(eq.closing_book_balance_before_impairment)}</span> },
                  { label: "减值准备", value: <span className="num">{fmtAmount(eq.impairment_allowance)}</span> },
                  { label: "会计口径投资收益", value: <span className="num">{fmtAmount(eq.accounting_investment_income_ytd)}</span>, hint: eq.accounting_income_includes_declared_dividends ? "含已宣告股利" : "不含已宣告股利" },
                  { label: "应收分红", value: <span className="num">{fmtAmount(eq.dividend_due)}</span>, hint: `到期日 ${eq.dividend_due_date}` },
                  { label: "实收现金分红", value: <span className="num">{fmtAmount(eq.cash_dividend_received)}</span> },
                  { label: "现金回报目标", value: <span className="num">{fmtAmount(eq.cash_return_target_ytd)}</span> },
                ]}
              />
            )}

            {eng && (
              <DescList
                cols={4}
                items={[
                  { label: "国别", value: eng.country },
                  { label: "客户", value: <span className="num">{eng.customer_id}</span> },
                  { label: "主合同", value: <span className="num">{eng.contract_id}</span> },
                  { label: "当前阶段", value: eng.phase },
                  { label: "合同收入（不含税）", value: <span className="num">{fmtAmount(eng.contract_revenue_ex_vat)}</span> },
                  { label: "预计完工成本", value: <span className="num">{fmtAmount(eng.forecast_completion_cost)}</span>, hint: eng.cost_forecast_complete ? "构成完整" : "构成不完整" },
                  { label: "目标毛利率", value: <span className="num">{fmtPct(eng.target_margin_pct)}</span> },
                  { label: "批准成本目标", value: <span className="num">{fmtAmount(eng.approved_cost_target)}</span> },
                  { label: "同期收款", value: <span className="num">{fmtAmount(eng.cash_received_ytd)}</span> },
                  { label: "同期付款", value: <span className="num">{fmtAmount(eng.cash_paid_ytd)}</span> },
                  { label: "已到期应收", value: <span className="num">{fmtAmount(eng.receivable_due)}</span> },
                  { label: "未到期应收", value: <span className="num">{fmtAmount(eng.receivable_not_yet_due)}</span>, hint: "未到期应收不计入逾期口径" },
                  { label: "并行工作包", value: eng.parallel_work.join("、") || "—" },
                  { label: "航线", value: eng.route_ids.join("、") || "—" },
                ]}
              />
            )}

            {account && (
              <DescList
                cols={4}
                items={[
                  { label: "开户主体", value: <span className="num">{account.legal_entity_id}</span> },
                  { label: "币种", value: account.currency },
                  { label: "期初余额（原币）", value: <span className="num">{fmtAmount(account.opening_balance_native)}</span>, hint: `期初日 ${account.opening_balance_date}` },
                  { label: "期末余额（原币）", value: <span className="num">{fmtAmount(account.closing_balance_native)}</span>, hint: `余额日 ${account.balance_as_of}` },
                  { label: "受限余额（原币）", value: <span className="num">{fmtAmount(account.restricted_balance_native)}</span> },
                  { label: "折人民币汇率", value: <span className="num">{account.fx_to_cny}</span>, hint: account.fx_nature },
                  { label: "折人民币期末余额", value: <span className="num">{fmtAmount(account.closing_balance_native * account.fx_to_cny)}</span> },
                  { label: "可动用余额（折人民币）", value: <span className="num">{fmtAmount((account.closing_balance_native - account.restricted_balance_native) * account.fx_to_cny)}</span> },
                ]}
              />
            )}

            {matter && (
              <DescList
                cols={3}
                items={[
                  { label: "事项类型", value: matter.matter_type },
                  { label: "流程模板", value: templateById(matter.template_id)?.matter_type_name ?? matter.template_id },
                  { label: "当前环节", value: phaseName(matter.current_phase_id) },
                  { label: "投资方", value: <span className="num">{matter.investor_id}</span> },
                  { label: "被投企业", value: <span className="num">{matter.investee_id}</span> },
                  { label: "关联投资项目", value: <span className="num">{matter.related_project_id}</span> },
                  { label: "说明", value: matter.note },
                  { label: "数据性质", value: matter.data_nature },
                ]}
              />
            )}
          </>
        )}

        {tab === "stages" && (
          <>
            <StageTable instances={stages} />
            <Notice tone="neutral" title="环节核查口径">
              批准计划调整保留版本、原因与批准日期，后补批复不改写为事前批准；标“不适用”需有适用条件与依据，不计入阶段完成率。
              多个阶段可同时进行中，风险颜色按未关闭事项独立显示。
            </Notice>
          </>
        )}

        {tab === "relations" && (
          <>
            <DataTable
              rows={related}
              rowKey={(l) => l.id}
              empty="该对象暂无已登记的业务关系。关系边必须带业务含义和有效依据，不画无含义连线。"
              columns={[
                { key: "from", title: "来源对象", render: (l) => <span className="num">{l.from_id}</span> },
                { key: "rel", title: "业务关系", width: "160px", render: (l) => <Tag tone="brand">{l.relation_type}</Tag> },
                { key: "to", title: "关联对象", render: (l) => <span className="num">{l.to_id}</span> },
                { key: "domains", title: "可进入的关联监管", render: (l) => l.domains.map((d) => DOMAIN_META[d].label).join("、") },
                { key: "asof", title: "关系有效期", width: "110px", render: (l) => <span className="num text-[12px]">{l.as_of}</span> },
                { key: "evid", title: "依据", render: (l) => <span className="text-[12px] text-textsub">{l.evidence_ids?.join("、") ?? "—"}</span> },
              ]}
            />
            <Notice tone="neutral" title="关系穿透口径">
              组织树、股权结构与业务关系分开切换；父子管理关系、持股关系、项目合同关系不混在同一棵管理树中。
            </Notice>
          </>
        )}

        {tab === "monitoring" && (
          <DataTable
            rows={monitoring}
            rowKey={(r) => r.id}
            empty="该对象当前没有监测实例。"
            columns={[
              { key: "sc", title: "监管场景", render: (r) => `${r.scenario_id} ${scenarioName(r.scenario_id)}` },
              { key: "phase", title: "关联环节", width: "130px", render: (r) => (r.phase_id ? phaseName(r.phase_id) : "—") },
              {
                key: "win",
                title: "归属窗口",
                width: "180px",
                render: (r) => (
                  <span className="num text-[12px]">
                    {r.window_start} ~ {r.window_end}
                  </span>
                ),
              },
              { key: "status", title: "监测状态", width: "140px", render: (r) => r.note || r.status },
              {
                key: "risk",
                title: "事项",
                width: "120px",
                render: (r) =>
                  r.risk_ids.length === 0 ? (
                    <span className="text-textsub">—</span>
                  ) : (
                    r.risk_ids.map((id) => (
                      <button key={id} className="num text-brand hover:underline mr-1" onClick={() => onOpenRisk?.(id)}>
                        {id}
                      </button>
                    ))
                  ),
              },
            ]}
          />
        )}

        {tab === "cases" && (
          <>
            {objRisks.length === 0 ? (
              <EmptyState title="该对象没有监管事项" detail="监测完整且没有命中时显示 0；尚缺资料时会显示数据缺口而不是 0。" />
            ) : (
              <DataTable
                rows={objRisks}
                rowKey={(r) => r.id}
                onRowClick={(r) => onOpenRisk?.(r.id)}
                columns={[
                  { key: "id", title: "事项", width: "76px", render: (r) => <span className="num">{r.id}</span> },
                  { key: "title", title: "名称", render: (r) => r.title },
                  { key: "sev", title: "等级", width: "88px", render: (r) => <SeverityTag severity={r.severity} /> },
                  { key: "status", title: "办理状态", width: "110px", render: (r) => statusLabel[r.status] },
                  { key: "open", title: "是否未关闭", width: "110px", render: (r) => (isOpen(r) ? "是" : "否") },
                  { key: "org", title: "责任单位", width: "140px", render: (r) => orgName(r.owner_org_id) },
                ]}
              />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
