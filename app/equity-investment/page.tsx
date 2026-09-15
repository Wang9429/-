"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Button, Card, DataTable, Tag } from "@/components/ui";
import { seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtDate, fmtPct, fmtSignedPct } from "@/lib/format";
import { isOpen } from "@/lib/risks";
import { downloadCsv } from "@/lib/export";
import { useDemoStore } from "@/lib/store";
import type { EquityProject } from "@/lib/types";

/**
 * P10 股权投资管理（完整业需第 8 章）。8 环节为监管展示模板，
 * 不驱动投资审批，也不按节点序号强制业务串行。
 */

function EquityLedger({ helpers }: { helpers: DomainHelpers }) {
  const { filters, risks, canAct } = useDemoStore();
  const orgIds = helpers.orgIds;
  const rows = useMemo(() => seed.equity_projects.filter((p) => orgIds.has(p.owner_org_id)), [orgIds]);

  return (
    <Card
      title="投资项目台账"
      right={
        <Button
          disabled={!canAct("business.export")}
          title={canAct("business.export") ? "导出当前筛选" : "当前身份不能导出业务数据"}
          onClick={() => {
            if (!canAct("business.export")) return;
            downloadCsv(
              "股权投资项目台账.csv",
              [
                "项目编号",
                "名称",
                "主归属单位",
                "投资法律主体",
                "被投企业",
                "投资类型",
                "持股比例",
                "批准投资额",
                "年度计划",
                "同期出资",
                "累计出资",
                "期末余额(减值前)",
                "减值准备",
                "会计投资收益",
                "现金分红",
                "未关闭事项",
              ],
              rows.map((p) => [
                p.id,
                p.name,
                orgName(p.owner_org_id),
                p.legal_entity_id,
                p.investee_id,
                p.investment_type,
                p.holding_pct,
                p.approved_total_investment,
                p.annual_investment_plan,
                p.ytd_contribution,
                p.cumulative_contribution,
                p.closing_book_balance_before_impairment,
                p.impairment_allowance,
                p.accounting_investment_income_ytd,
                p.cash_dividend_received,
                risks.filter((r) => isOpen(r) && r.primary_object_id === p.id).length,
              ]),
              {
                title: "股权投资项目台账",
                scopeLines: [
                  `${orgName(filters.orgId)}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}`,
                  "金额单位：万元人民币",
                ],
              },
            );
          }}
        >
          导出当前筛选
        </Button>
      }
    >
      <DataTable<EquityProject>
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => helpers.openObject(p.id)}
        empty="当前组织范围内没有股权投资项目。"
        pageSize={8}
        compactEmpty
        tableClassName="min-w-[1200px]"
        columns={[
          {
            key: "name",
            title: "投资项目",
            minWidth: "220px",
            render: (p) => (
              <span>
                <span className="text-textmain">{p.name}</span>
                <span className="num text-[12px] text-textsub ml-2">{p.id}</span>
              </span>
            ),
          },
          { key: "org", title: "主归属单位", width: "126px", render: (p) => orgName(p.owner_org_id) },
          { key: "investee", title: "被投企业", width: "100px", render: (p) => <span className="num">{p.investee_id}</span> },
          { key: "pct", title: "持股比例", align: "right", width: "96px", render: (p) => <span className="num">{fmtPct(p.holding_pct, 0)}</span> },
          {
            key: "plan",
            title: "年度计划/期内投入",
            align: "right",
            width: "150px",
            render: (p) => (
              <span className="num">
                {fmtAmount(p.annual_investment_plan)} / {fmtAmount(p.ytd_contribution)}
              </span>
            ),
          },
          {
            key: "due",
            title: "到期应出资/实际",
            align: "right",
            width: "150px",
            render: (p) => (
              <span
                className="num"
                style={{ color: p.cumulative_contribution < p.contribution_due_to_date ? "var(--risk-amber-fg)" : undefined }}
                title={`到期日 ${p.contribution_due_date}；提前支付或未到期义务不作为逾期分母`}
              >
                {fmtAmount(p.contribution_due_to_date)} / {fmtAmount(p.cumulative_contribution)}
              </span>
            ),
          },
          {
            key: "bal",
            title: "期末余额（减值前）",
            align: "right",
            width: "150px",
            render: (p) => <span className="num">{fmtAmount(p.closing_book_balance_before_impairment)}</span>,
          },
          {
            key: "div",
            title: "应收分红/实收",
            align: "right",
            width: "140px",
            render: (p) => (
              <span
                className="num"
                style={{ color: p.cash_dividend_received < p.dividend_due ? "var(--risk-amber-fg)" : undefined }}
              >
                {fmtAmount(p.dividend_due)} / {fmtAmount(p.cash_dividend_received)}
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

function PostInvestment({ helpers }: { helpers: DomainHelpers }) {
  const orgIds = helpers.orgIds;
  const projects = seed.equity_projects.filter((p) => orgIds.has(p.owner_org_id));
  const obligations = seed.obligations.filter((o) => projects.some((p) => p.id === o.project_id));

  return (
    <div className="space-y-4">
      <Card title="出资与分红义务履约">
        <DataTable
          rows={obligations}
          rowKey={(o) => o.id}
          empty="当前范围内没有出资或分红义务记录。"
          columns={[
            { key: "id", title: "义务", width: "140px", render: (o) => <span className="num">{o.id}</span> },
            { key: "kind", title: "类型", width: "130px", render: (o) => o.kind },
            { key: "proj", title: "投资项目", width: "120px", render: (o) => <span className="num">{o.project_id}</span> },
            { key: "due", title: "到期日", width: "110px", render: (o) => <span className="num">{fmtDate(o.due_date)}</span> },
            {
              key: "amount",
              title: "到期应履约",
              align: "right",
              width: "120px",
              render: (o) => <span className="num">{fmtAmount(o.cumulative_due ?? o.amount_due)}</span>,
            },
            {
              key: "done",
              title: "实际履约/到账",
              align: "right",
              width: "130px",
              render: (o) => <span className="num">{fmtAmount(o.cumulative_fulfilled ?? o.amount_received)}</span>,
            },
            {
              key: "rate",
              title: "履约/回收率",
              align: "right",
              width: "120px",
              render: (o) => {
                const due = o.cumulative_due ?? o.amount_due ?? 0;
                const done = o.cumulative_fulfilled ?? o.amount_received ?? 0;
                if (!due) return <span className="text-textsub">无到期义务</span>;
                const v = (done / due) * 100;
                return (
                  <span className="num" style={{ color: v < 100 ? "var(--risk-amber-fg)" : "var(--risk-green-fg)" }}>
                    {fmtPct(v)}
                  </span>
                );
              },
            },
            {
              key: "gap",
              title: "缺口",
              align: "right",
              width: "110px",
              render: (o) => {
                const due = o.cumulative_due ?? o.amount_due ?? 0;
                const done = o.cumulative_fulfilled ?? o.amount_received ?? 0;
                const gap = due - done;
                return (
                  <span className="num" style={{ color: gap > 0 ? "var(--risk-amber-fg)" : undefined }}>
                    {fmtAmount(gap)}
                  </span>
                );
              },
            },
          ]}
        />
      </Card>

      <Card title="投后经营与收益">
        <DataTable
          rows={projects}
          rowKey={(p) => p.id}
          onRowClick={(p) => helpers.openObject(p.id)}
          empty="当前组织范围内没有股权投资项目。"
          columns={[
            { key: "name", title: "投资项目", render: (p) => p.name },
            { key: "ind", title: "行业", width: "110px", render: (p) => p.industry },
            {
              key: "pred",
              title: "预测/实际营业收入",
              align: "right",
              width: "170px",
              render: (p) => (
                <span className="num">
                  {fmtAmount(p.predicted_revenue_ytd)} / {fmtAmount(p.actual_revenue_ytd)}
                </span>
              ),
            },
            {
              key: "gapPct",
              title: "经营兑现偏差",
              align: "right",
              width: "120px",
              render: (p) =>
                p.predicted_revenue_ytd ? (
                  <span
                    className="num"
                    style={{
                      color:
                        p.actual_revenue_ytd < p.predicted_revenue_ytd ? "var(--risk-amber-fg)" : "var(--risk-green-fg)",
                    }}
                  >
                    {fmtSignedPct(((p.actual_revenue_ytd - p.predicted_revenue_ytd) / p.predicted_revenue_ytd) * 100)}
                  </span>
                ) : (
                  <span className="text-textsub">零基期不计算增长率</span>
                ),
            },
            {
              key: "income",
              title: "会计投资收益",
              align: "right",
              width: "130px",
              render: (p) => <span className="num">{fmtAmount(p.accounting_investment_income_ytd)}</span>,
            },
            {
              key: "cash",
              title: "现金回报/目标",
              align: "right",
              width: "140px",
              render: (p) => (
                <span className="num">
                  {fmtAmount(p.cash_dividend_received)} / {fmtAmount(p.cash_return_target_ytd)}
                </span>
              ),
            },
            {
              key: "events",
              title: "重大风险事件",
              render: (p) =>
                p.major_risk_events.length === 0 ? (
                  <span className="text-textsub">无</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {p.major_risk_events.map((e) => (
                      <Tag key={e} tone="amber">
                        {e}
                      </Tag>
                    ))}
                  </span>
                ),
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
      domain="EQ"
      kpiIndicatorIds={["EQ-BALANCE", "EQ-I11", "EQ-I15", "EQ-CASH-DEVIATION", "EQ-X01-RATE", "EQ-OPEN"]}
      ledger={(h) => <EquityLedger helpers={h} />}
      tabs={[
        { id: "post", label: "投后监管", render: (h) => <PostInvestment helpers={h} /> },
        { id: "ledger", label: "投资穿透", render: (h) => <EquityLedger helpers={h} /> },
      ]}
    />
  );
}
