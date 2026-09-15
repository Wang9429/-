"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Button, Card, DataTable, Tag } from "@/components/ui";
import { seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtDate, fmtPct, fmtPp } from "@/lib/format";
import { isOpen } from "@/lib/risks";
import { downloadCsv } from "@/lib/export";
import { useDemoStore } from "@/lib/store";
import { inDateRange } from "@/lib/period";
import type { EngineeringProject } from "@/lib/types";

/**
 * P60 工程项目管理（完整业需第 12 章）。9 环节为主要业务顺序，
 * 工作包可并行；阶段“已完成”不自动关闭该阶段监管事项。
 */

function EngLedger({ helpers }: { helpers: DomainHelpers }) {
  const { filters, risks, canAct } = useDemoStore();
  const orgIds = helpers.orgIds;
  const rows = useMemo(() => seed.engineering_projects.filter((p) => orgIds.has(p.owner_org_id)), [orgIds]);

  return (
    <Card
      title="工程项目台账"
      right={
        <Button
          disabled={!canAct("business.export")}
          title={canAct("business.export") ? "导出当前筛选" : "当前身份不能导出业务数据"}
          onClick={() => {
            if (!canAct("business.export")) return;
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
            );
          }}
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
          { key: "phase", title: "管理主状态", width: "104px", render: (p) => p.phase },
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
  const payments = seed.cash_transactions.filter(
    (t) =>
      projects.some((p) => p.id === t.project_id) &&
      inDateRange(t.date, filters.periodStart, filters.periodEnd),
  );

  return (
    <div className="space-y-4">
      <Card title="预计完工成本构成">
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
      </Card>

      <Card title="结算与到期收款">
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

      <Card title="付款核查">
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
      kpiIndicatorIds={["ENG-CNT", "ENG-REVENUE", "ENG-I01", "ENG-I06", "ENG-OPEN"]}
      ledger={(h) => <EngLedger helpers={h} />}
      tabs={[
        { id: "cost", label: "成本与回款穿透", render: (h) => <CostAndCash helpers={h} /> },
        { id: "ledger", label: "项目穿透", render: (h) => <EngLedger helpers={h} /> },
      ]}
    />
  );
}
