"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Card, DataTable, EmptyState, SimulatedBadge, Tag } from "@/components/ui";
import { seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtPct } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import { inDateRange } from "@/lib/period";
import type { Account } from "@/lib/types";

/**
 * P40 资金管理（完整业需第 10 章）。采用专题布局；
 * 资金余额与可用资金分开，账户数与付款笔数不相加。
 */

function AccountView({ helpers }: { helpers: DomainHelpers }) {
  const orgIds = helpers.orgIds;
  const accounts = useMemo(() => seed.accounts.filter((a) => orgIds.has(a.owner_org_id)), [orgIds]);

  const totalCny = accounts.reduce((s, a) => s + a.closing_balance_native * a.fx_to_cny, 0);
  const restrictedCny = accounts.reduce((s, a) => s + a.restricted_balance_native * a.fx_to_cny, 0);

  return (
    <div className="space-y-4">
      <Card title="账户与资金余额">
        <DataTable<Account>
          rows={accounts}
          rowKey={(a) => a.id}
          onRowClick={(a) => helpers.openObject(a.id)}
          empty="当前组织范围内没有纳入监测的账户。"
          columns={[
            {
              key: "name",
              title: "账户",
              render: (a) => (
                <span>
                  <span className="text-textmain">{a.name}</span>
                  <span className="num text-[12px] text-textsub ml-2">{a.id}</span>
                </span>
              ),
            },
            { key: "entity", title: "开户主体", width: "110px", render: (a) => <span className="num">{a.legal_entity_id}</span> },
            { key: "org", title: "管理单位", width: "150px", render: (a) => orgName(a.owner_org_id) },
            { key: "ccy", title: "币种", width: "80px", render: (a) => a.currency },
            {
              key: "native",
              title: "期末余额（原币）",
              align: "right",
              width: "150px",
              render: (a) => (
                <span className="num">
                  {fmtAmount(a.closing_balance_native)} {a.native_amount_unit}
                </span>
              ),
            },
            {
              key: "fx",
              title: "折算汇率",
              align: "right",
              width: "110px",
              render: (a) => (
                <span className="num" title={a.fx_nature}>
                  {a.fx_to_cny}
                </span>
              ),
            },
            {
              key: "cny",
              title: "折人民币余额",
              align: "right",
              width: "130px",
              render: (a) => <span className="num">{fmtAmount(a.closing_balance_native * a.fx_to_cny)}</span>,
            },
            {
              key: "restricted",
              title: "受限（折人民币）",
              align: "right",
              width: "140px",
              render: (a) => (
                <span className="num" style={{ color: a.restricted_balance_native > 0 ? "var(--risk-amber-fg)" : undefined }}>
                  {fmtAmount(a.restricted_balance_native * a.fx_to_cny)}
                </span>
              ),
            },
            {
              key: "avail",
              title: "可动用（折人民币）",
              align: "right",
              width: "150px",
              render: (a) => (
                <span className="num">{fmtAmount((a.closing_balance_native - a.restricted_balance_native) * a.fx_to_cny)}</span>
              ),
            },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Tag tone="brand">
            期末资金余额合计 {fmtAmount(totalCny)} 万元
          </Tag>
          <Tag tone="amber">受限 {fmtAmount(restrictedCny)} 万元</Tag>
          <Tag tone="neutral">可用 {fmtAmount(totalCny - restrictedCny)} 万元</Tag>
          <Tag tone="neutral">受限占比 {fmtPct((restrictedCny / totalCny) * 100)}</Tag>
          <SimulatedBadge text="模拟汇率" />
        </div>
      </Card>
    </div>
  );
}

function PaymentView({ helpers }: { helpers: DomainHelpers }) {
  const { filters } = useDemoStore();
  const orgIds = helpers.orgIds;
  const accounts = seed.accounts.filter((a) => orgIds.has(a.owner_org_id));
  const txs = seed.cash_transactions.filter(
    (t) =>
      accounts.some((a) => a.id === t.account_id) &&
      inDateRange(t.date, filters.periodStart, filters.periodEnd),
  );

  return (
    <div className="space-y-4">
      <Card title="重点交易核查">
        <DataTable
          rows={txs}
          rowKey={(t) => t.id}
          onRowClick={(t) => helpers.openObject(t.id)}
          empty="当前组织范围内没有资金交易记录。"
          columns={[
            { key: "id", title: "交易", width: "150px", render: (t) => <span className="num">{t.id}</span> },
            { key: "date", title: "业务日期", width: "110px", render: (t) => <span className="num">{t.date}</span> },
            { key: "dir", title: "方向", width: "80px", render: (t) => (t.direction === "outflow" ? "支出" : "收入") },
            { key: "proj", title: "项目/投资", width: "120px", render: (t) => <span className="num">{t.project_id ?? "—"}</span> },
            { key: "contract", title: "合同", width: "110px", render: (t) => <span className="num">{t.contract_id ?? "—"}</span> },
            { key: "acc", title: "付款账户", width: "130px", render: (t) => <span className="num">{t.account_id}</span> },
            { key: "amt", title: "本次实付/实收", align: "right", width: "130px", render: (t) => <span className="num">{fmtAmount(t.amount_wan_cny)}</span> },
            {
              key: "appr",
              title: "批准金额",
              align: "right",
              width: "110px",
              render: (t) => <span className="num">{t.approved_amount === undefined ? "—" : fmtAmount(t.approved_amount)}</span>,
            },
            {
              key: "cert",
              title: "合同可支付上限",
              align: "right",
              width: "150px",
              render: (t) => (
                <span className="num">{t.certified_payable_amount === undefined ? "—" : fmtAmount(t.certified_payable_amount)}</span>
              ),
            },
            {
              key: "state",
              title: "核对状态",
              render: (t) => {
                if (t.direction !== "outflow" || t.approved_amount === undefined)
                  return <Tag tone="neutral">非支付核查对象</Tag>;
                const over = t.amount_wan_cny - t.approved_amount;
                const overCert =
                  t.certified_payable_amount !== undefined ? t.amount_wan_cny - t.certified_payable_amount : null;
                if (over > 0)
                  return (
                    <span className="text-[13px]" style={{ color: "var(--risk-red-fg)" }}>
                      超批准 {fmtAmount(over)} 万元
                      {overCert !== null && overCert <= 0 ? "；未超合同可支付上限" : ""}
                    </span>
                  );
                return <Tag tone="green">未命中支付异常</Tag>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}

function PlanView() {
  return (
    <Card title="资金计划监管">
      <EmptyState title="该期间数据未覆盖" />
    </Card>
  );
}

export default function Page() {
  return (
    <DomainPage
      domain="CASH"
      kpiIndicatorIds={["CASH-I01", "CASH-I02", "CASH-I07", "CASH-I04", "CASH-I06", "CASH-OPEN"]}
      flowMode="topics"
      ledger={(h) => <AccountView helpers={h} />}
      tabs={[
        { id: "plan", label: "资金计划监管", render: () => <PlanView /> },
        { id: "account", label: "账户与收支穿透", render: (h) => <AccountView helpers={h} /> },
        { id: "payment", label: "重点交易核查", render: (h) => <PaymentView helpers={h} /> },
      ]}
    />
  );
}
