"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Button, Card, DataTable, Notice, Tag } from "@/components/ui";
import { seed } from "@/lib/seed";
import { orgName, orgScope } from "@/lib/org";
import { fmtAmount, fmtDate, fmtPct, fmtSignedPct } from "@/lib/format";
import { isOpen } from "@/lib/risks";
import { downloadCsv } from "@/lib/export";
import { useDemoStore } from "@/lib/store";
import type { EquityProject } from "@/lib/types";

/**
 * P10 股权投资管理（完整业需第 8 章）。8 环节为监管展示模板，
 * 不驱动投资审批，也不按节点序号强制业务串行。
 */

const PHASE_FOCUS: Record<string, string> = {
  "EQ-V12-01": "监管重点：经营基础与预测依据、重大风险、专业报告矛盾或缺失（EQ-S02、03、07）。可查看财务/法律/业务及 HSE 尽调、中介独立性。",
  "EQ-V12-02": "监管重点：价格与同权益估值、协同依据、条款与风险对应（EQ-S04、05、06、10、14）。EQ-S06/10/14 为专业核查依据，不设“条款充分率”等自动 KRI。",
  "EQ-V12-03": "监管重点：适用程序证据、授权版本、决策方案及重大风险响应（EQ-S08、09、18）。查看业务发生当时的有效授权版本。",
  "EQ-V12-04": "监管重点：逐笔付款条件、有效方案与实际交易、权属及登记衔接（EQ-S15、19）。已完成阶段仍展示未关闭问题，如产权来源差异 R08。",
  "EQ-V12-05": "监管重点：到期出资缺口、各方义务与额外资金支持、付款条件（EQ-S12、EQ-X01）。交割与出资分别保存状态，交易价款、增资款、分期出资不是同一字段。",
  "EQ-V12-06": "监管重点：权利执行、约定报送、整合节点、经营风险处置（EQ-S13、16、17）。不自动认定管理失控。",
  "EQ-V12-07": "监管重点：现金回报偏差、分红到期回收、目标兑现、财务确认价值变化（EQ-S11、EQ-X02）。现金回报与会计收益分别追溯，不重复汇总。",
  "EQ-V12-08": "监管重点：评价计划及完成证据、目标差异及整改；已触发退出事项的履行（EQ-S20）。无退出事项时显示“暂无适用退出事项”，不显示逾期。",
};

function EquityLedger({ helpers }: { helpers: DomainHelpers }) {
  const { filters, risks } = useDemoStore();
  const orgIds = useMemo(() => orgScope(filters.orgId, filters.includeChildren), [filters.orgId, filters.includeChildren]);
  const rows = useMemo(() => seed.equity_projects.filter((p) => orgIds.has(p.owner_org_id)), [orgIds]);

  return (
    <Card
      title="投资项目台账"
      subtitle="一个被投企业可关联多个投资项目；法人事件按唯一事件计数后再关联项目，不按持股比例替代会计确认"
      right={
        <Button
          onClick={() =>
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
            )
          }
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
        columns={[
          {
            key: "name",
            title: "投资项目",
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
      <div className="mt-3">
        <Notice tone="neutral" title="收益与交易口径">
          会计收益率＝报告期经财务确认且去重的投资收益 ÷ 同范围期初期末投资账面余额平均数，不自动年化；
          股利与处置收益若已含在会计投资收益中不再相加。投资收益实现偏差率使用实际收到的现金分红与已实现退出收益，
          被投企业利润、未实现估值增值与退出收款中的投资本金不计入。
        </Notice>
      </div>
    </Card>
  );
}

function PostInvestment({ helpers }: { helpers: DomainHelpers }) {
  const { filters } = useDemoStore();
  const orgIds = useMemo(() => orgScope(filters.orgId, filters.includeChildren), [filters.orgId, filters.includeChildren]);
  const projects = seed.equity_projects.filter((p) => orgIds.has(p.owner_org_id));
  const obligations = seed.obligations.filter((o) => projects.some((p) => p.id === o.project_id));

  return (
    <div className="space-y-4">
      <Card title="出资与分红义务履约" subtitle="EQ-X01 到期出资义务履约、EQ-X02 已决议分红回收；与资金领域共用同一义务与收款记录">
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
        <div className="mt-3">
          <Notice tone="neutral" title="口径提示">
            到期履约率＝已匹配到期义务的实际履约金额 ÷ 到期应履约金额；提前支付与未到期义务不作为逾期分母。
            已决议尚未到期与投资方案目标未实现分别显示。
          </Notice>
        </div>
      </Card>

      <Card title="投后经营与收益" subtitle="目标与实际、会计收益、现金分红、减值分别展示，不互相替代">
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
      intro="以海油工程作为投资主体的管理范围，覆盖投资项目、投资方、被投企业、交易、出资、治理、收益、重大事件与后评价。被投企业不并入海油工程管理组织树。"
      kpiIndicatorIds={["EQ-BALANCE", "EQ-I11", "EQ-I15", "EQ-CASH-DEVIATION", "EQ-X01-RATE", "EQ-OPEN"]}
      phaseFocus={PHASE_FOCUS}
      ledger={(h) => <EquityLedger helpers={h} />}
      tabs={[
        { id: "post", label: "投后监管", render: (h) => <PostInvestment helpers={h} /> },
        { id: "ledger", label: "投资穿透", render: (h) => <EquityLedger helpers={h} /> },
      ]}
    />
  );
}
