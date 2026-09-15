"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Button, Card, DataTable, Notice, Tag } from "@/components/ui";
import { seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtDate, fmtPct, fmtPp } from "@/lib/format";
import { isOpen } from "@/lib/risks";
import { downloadCsv } from "@/lib/export";
import { useDemoStore } from "@/lib/store";
import type { EngineeringProject } from "@/lib/types";

/**
 * P60 工程项目管理（完整业需第 12 章）。9 环节为主要业务顺序，
 * 工作包可并行；阶段“已完成”不自动关闭该阶段监管事项。
 */

const PHASE_FOCUS: Record<string, string> = {
  "ENG-V12-01": "监管重点：客户及项目风险、报价成本依据、投标/承揽决策证据。首版以资料与已批准事实核查为主，不设无制度依据的自动承揽打分。",
  "ENG-V12-02": "监管重点：有效合同收入、批准目标成本、关键风险、变更责任、收付款安排（关联 ENG-S01、03、06、07）。",
  "ENG-V12-03": "监管重点：交付与确认节点、版本一致性、设计变更对采购建造的影响（ENG-S03）。设计未全部完成不自动判定采购违规。",
  "ENG-V12-04": "监管重点：供应商履约、到货节点、价格敞口、分包及支付条件（ENG-S04、05）。付款异常需说明命中的具体条件：超批准、超已确认可支付上限或收款方不符。",
  "ENG-V12-05": "监管重点：预计完工成本及毛利、关键路径、变更执行、重大事项响应（ENG-S01、02、08）。",
  "ENG-V12-06": "监管重点：航线事件、运费与船舶资源、作业窗口、安装节点及成本影响（ENG-S07）。情景测算只改变模拟结果，不改写实际预测基准。",
  "ENG-V12-07": "监管重点：交付证据、客户确认、遗留问题、余料与资产安排（关联 ENG-S02、06、08、09）。",
  "ENG-V12-08": "监管重点：未结算、已结算未到期与逾期分开；客户确认金额与应收匹配（ENG-S06）。本箭头集中查看应收与结算，不表示交付后才可收款。",
  "ENG-V12-09": "监管重点：质保及保函释放条件、未结事项、资产余料与尾款（ENG-S09）。收款完成不表示全部履约结束。",
};

function EngLedger({ helpers }: { helpers: DomainHelpers }) {
  const { filters, risks } = useDemoStore();
  const orgIds = helpers.orgIds;
  const rows = useMemo(() => seed.engineering_projects.filter((p) => orgIds.has(p.owner_org_id)), [orgIds]);

  return (
    <Card
      title="工程项目台账"
      subtitle="管理主体与合同法律主体分别标明；境外分支机构不是自动独立法人"
      right={
        <Button
          onClick={() =>
            downloadCsv(
              "工程项目台账.csv",
              [
                "项目编号",
                "名称",
                "主归属单位",
                "法律主体",
                "客户",
                "国别",
                "当前阶段",
                "有效不含税合同收入",
                "预计完工成本",
                "预计完工毛利率%",
                "目标毛利率%",
                "已到期应收",
                "未到期应收",
                "同期收款",
                "未关闭事项",
              ],
              rows.map((p) => [
                p.id,
                p.name,
                orgName(p.owner_org_id),
                p.legal_entity_id,
                p.customer_id,
                p.country,
                p.phase,
                p.contract_revenue_ex_vat,
                p.forecast_completion_cost,
                (((p.contract_revenue_ex_vat - p.forecast_completion_cost) / p.contract_revenue_ex_vat) * 100).toFixed(2),
                p.target_margin_pct,
                p.receivable_due,
                p.receivable_not_yet_due,
                p.cash_received_ytd,
                risks.filter((r) => isOpen(r) && r.primary_object_id === p.id).length,
              ]),
              {
                title: "工程项目台账",
                scopeLines: [
                  `${orgName(filters.orgId)}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}`,
                  "金额单位：万元人民币；收入口径：有效不含税合同收入",
                ],
              },
            )
          }
        >
          导出当前筛选
        </Button>
      }
    >
      <DataTable<EngineeringProject>
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => helpers.openObject(p.id)}
        empty="当前组织范围内没有工程项目。"
        columns={[
          {
            key: "name",
            title: "工程项目",
            render: (p) => (
              <span>
                <span className="text-textmain">{p.name}</span>
                <span className="num text-[12px] text-textsub ml-2">{p.id}</span>
                {p.data_nature === "simulated" && <Tag tone="neutral">模拟</Tag>}
              </span>
            ),
          },
          { key: "org", title: "主归属单位", width: "126px", render: (p) => orgName(p.owner_org_id) },
          { key: "country", title: "国别", width: "92px", render: (p) => p.country },
          { key: "phase", title: "管理主状态", width: "104px", render: (p) => p.phase, hint: "工作包可并行，主状态不代表各工作包状态" },
          {
            key: "rev",
            title: "有效合同收入",
            align: "right",
            width: "128px",
            render: (p) => <span className="num">{fmtAmount(p.contract_revenue_ex_vat)}</span>,
          },
          {
            key: "cost",
            title: "预计完工成本",
            align: "right",
            width: "128px",
            render: (p) => (
              <span className="num">
                {fmtAmount(p.forecast_completion_cost)}
                {!p.cost_forecast_complete && <span className="text-[11px] text-textsub"> 下限</span>}
              </span>
            ),
          },
          {
            key: "margin",
            title: "预计完工毛利率",
            align: "right",
            width: "140px",
            render: (p) => {
              const v = ((p.contract_revenue_ex_vat - p.forecast_completion_cost) / p.contract_revenue_ex_vat) * 100;
              const diff = v - p.target_margin_pct;
              return (
                <span className="num" style={{ color: diff <= -3 ? "var(--risk-red-fg)" : diff < 0 ? "var(--risk-amber-fg)" : undefined }}>
                  {fmtPct(v)}
                  <span className="text-[12px] text-textsub ml-1">（目标 {fmtPct(p.target_margin_pct, 0)}，{fmtPp(diff)}）</span>
                </span>
              );
            },
            hint: "上层按同口径收入、成本重新计算，不平均项目毛利率；低于目标 3 个百分点及以上为红",
          },
          {
            key: "ar",
            title: "已到期/未到期应收",
            align: "right",
            width: "160px",
            render: (p) => (
              <span className="num">
                {fmtAmount(p.receivable_due)} / {fmtAmount(p.receivable_not_yet_due)}
              </span>
            ),
            hint: "未到期应收不计入逾期口径",
          },
          {
            key: "risk",
            title: "未关闭事项",
            align: "right",
            width: "106px",
            render: (p) => {
              const rs = risks.filter((r) => isOpen(r) && r.primary_object_id === p.id);
              const red = rs.filter((r) => r.severity === "red").length;
              return (
                <span className="num" style={{ color: red ? "var(--risk-red-fg)" : rs.length ? "var(--risk-amber-fg)" : "var(--text-sub)" }}>
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

function CostAndCash({ helpers }: { helpers: DomainHelpers }) {
  const { filters } = useDemoStore();
  const orgIds = helpers.orgIds;
  const projects = seed.engineering_projects.filter((p) => orgIds.has(p.owner_org_id));
  const costItems = seed.cost_items.filter((c) => projects.some((p) => p.id === c.project_id));
  const obligations = seed.obligations.filter((o) => projects.some((p) => p.id === o.project_id));
  const payments = seed.cash_transactions.filter((t) => projects.some((p) => p.id === t.project_id));

  return (
    <div className="space-y-4">
      <Card
        title="预计完工成本构成"
        subtitle="包括已发生、应计未入账、已签未执行、合理预计变更索赔成本与剩余工作估算，并按来源去重"
      >
        <DataTable
          rows={costItems}
          rowKey={(c) => c.id}
          empty="当前范围没有成本构成记录。"
          columns={[
            { key: "id", title: "成本项", width: "150px", render: (c) => <span className="num">{c.id}</span> },
            { key: "proj", title: "项目", width: "120px", render: (c) => <span className="num">{c.project_id}</span> },
            { key: "cat", title: "来源类型", render: (c) => c.category },
            { key: "amt", title: "金额", align: "right", width: "110px", render: (c) => <span className="num">{fmtAmount(c.amount)}</span> },
            { key: "src", title: "来源记录", width: "170px", render: (c) => <span className="num text-[12px]">{c.source_record_id}</span> },
            {
              key: "excl",
              title: "去重与互斥说明",
              render: (c) => (
                <span className="text-[12px] text-textsub">
                  {[
                    c.excludes_accruals ? "不含应计未入账" : null,
                    c.excluded_from_remaining_contract_amount ? "不计入合同剩余" : null,
                    c.not_yet_implemented ? "尚未执行" : null,
                    c.not_in_signed_contracts ? "不在已签合同内" : null,
                    c.not_in_other_cost_items ? "与其他成本项互斥" : null,
                  ]
                    .filter(Boolean)
                    .join("；") || "—"}
                </span>
              ),
            },
          ]}
        />
        <div className="mt-2">
          <Notice tone="neutral" title="成本口径">
            已签未执行与剩余工作估算范围明确区分，避免同一采购包重复计入；未获客户确认的索赔收益单列潜在增益，不计入基准有效合同收入。
          </Notice>
        </div>
      </Card>

      <Card title="结算与到期收款" subtitle="未结算、已结算未到期、逾期分开显示；到期应收回收率与资金领域 CASH-I04 使用同一义务与收款匹配">
        <DataTable
          rows={obligations}
          rowKey={(o) => o.id}
          empty="当前范围没有收款义务记录。"
          columns={[
            { key: "id", title: "义务", width: "150px", render: (o) => <span className="num">{o.id}</span> },
            { key: "kind", title: "类型", width: "130px", render: (o) => o.kind },
            { key: "due", title: "到期日", width: "110px", render: (o) => <span className="num">{fmtDate(o.due_date)}</span> },
            { key: "amt", title: "应收", align: "right", width: "110px", render: (o) => <span className="num">{fmtAmount(o.amount_due)}</span> },
            { key: "rec", title: "已收", align: "right", width: "110px", render: (o) => <span className="num">{fmtAmount(o.amount_received)}</span> },
            {
              key: "state",
              title: "状态",
              render: (o) => {
                const due = o.due_date <= filters.asOf;
                const paid = (o.amount_received ?? 0) >= (o.amount_due ?? 0);
                if (!due) return <Tag tone="neutral">未到期，不计入逾期</Tag>;
                return paid ? <Tag tone="green">已到期并回收</Tag> : <Tag tone="red">已到期未回收</Tag>;
              },
            },
          ]}
        />
      </Card>

      <Card title="付款核查" subtitle="同时显示批准金额、已确认可支付业务上限、实际支付与收款方，准确说明命中的具体条件">
        <DataTable
          rows={payments}
          rowKey={(t) => t.id}
          empty="当前范围没有付款记录。"
          onRowClick={(t) => helpers.openObject(t.id)}
          columns={[
            { key: "id", title: "支付记录", width: "150px", render: (t) => <span className="num">{t.id}</span> },
            { key: "date", title: "业务日期", width: "110px", render: (t) => <span className="num">{t.date}</span> },
            { key: "dir", title: "方向", width: "80px", render: (t) => (t.direction === "outflow" ? "支出" : "收入") },
            { key: "amt", title: "实际金额", align: "right", width: "110px", render: (t) => <span className="num">{fmtAmount(t.amount_wan_cny)}</span> },
            {
              key: "appr",
              title: "批准金额",
              align: "right",
              width: "110px",
              render: (t) => <span className="num">{t.approved_amount === undefined ? "—" : fmtAmount(t.approved_amount)}</span>,
            },
            {
              key: "cert",
              title: "已确认可支付上限",
              align: "right",
              width: "160px",
              render: (t) => (
                <span className="num">{t.certified_payable_amount === undefined ? "—" : fmtAmount(t.certified_payable_amount)}</span>
              ),
            },
            {
              key: "hit",
              title: "命中说明",
              render: (t) => {
                if (t.direction !== "outflow" || t.approved_amount === undefined) return <span className="text-textsub">—</span>;
                const overApproved = t.amount_wan_cny - t.approved_amount;
                const overCert =
                  t.certified_payable_amount !== undefined ? t.amount_wan_cny - t.certified_payable_amount : null;
                if (overApproved > 0) {
                  return (
                    <span className="text-[13px]" style={{ color: "var(--risk-red-fg)" }}>
                      超批准 {fmtAmount(overApproved)} 万元
                      {overCert !== null && overCert <= 0 && "；未超已确认可支付业务上限"}
                    </span>
                  );
                }
                return <span className="text-[13px] text-textsub">未命中支付条件异常</span>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <DomainPage
      domain="ENG"
      intro="以海油工程承揽并执行的工程合同及履约项目为主要对象，关注合同收入、目标成本、预计完工成本、交付、采购分包、变更、结算收款及质量 HSE 重大事项。主要业务顺序展示 9 个环节，工作包可并行。"
      kpiIndicatorIds={["ENG-CNT", "ENG-REVENUE", "ENG-I01", "ENG-I06", "ENG-OPEN"]}
      phaseFocus={PHASE_FOCUS}
      ledger={(h) => <EngLedger helpers={h} />}
      tabs={[
        { id: "cost", label: "成本与回款穿透", render: (h) => <CostAndCash helpers={h} /> },
        { id: "ledger", label: "项目穿透", render: (h) => <EngLedger helpers={h} /> },
      ]}
    />
  );
}
