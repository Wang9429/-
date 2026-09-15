"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Card, DataTable, Notice, SimulatedBadge, Tag } from "@/components/ui";
import { seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtPct } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import type { Account } from "@/lib/types";

/**
 * P40 资金管理（完整业需第 10 章）。采用专题布局；
 * 资金余额与可用资金分开，账户数与付款笔数不相加。
 */

const TOPIC_FOCUS: Record<string, string> = {
  "CASH-T01": "监管重点：期初及有效调整计划、实际收支、预计现金缺口、计划外支出。投资支付计划衔接关联 FA-S34。",
  "CASH-T02": "监管重点：账户主体、币种、银行、余额、可用/受限与集中状态。外币保留原币金额，折算人民币显示汇率日期与来源。",
  "CASH-T03": "监管重点：批准、业务条件、支付计划、金额、收款方及异常。超批准与超合同可支付上限分别判断，不同时捏造两种命中。",
  "CASH-T04": "监管重点：已形成应收、已到期、逾期、实收及匹配。未到期不计入逾期分母；预收与错配不得直接冲销。",
  "CASH-T05": "监管重点：股东借款、担保及其他资金支持安排的适用业务与余额。与 EQ-S12 共用事项与证据，不自动认定违规垫资。",
};

function AccountView({ helpers }: { helpers: DomainHelpers }) {
  const { filters } = useDemoStore();
  const orgIds = helpers.orgIds;
  const accounts = useMemo(() => seed.accounts.filter((a) => orgIds.has(a.owner_org_id)), [orgIds]);

  const totalCny = accounts.reduce((s, a) => s + a.closing_balance_native * a.fx_to_cny, 0);
  const restrictedCny = accounts.reduce((s, a) => s + a.restricted_balance_native * a.fx_to_cny, 0);

  return (
    <div className="space-y-4">
      <Card title="账户与资金余额" subtitle="资金余额与可用资金分开；多重限制账户金额不重复计入受限占比">
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
              hint: "外币折算显示汇率日期与来源，不隐藏折算口径",
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
          <SimulatedBadge text="演示汇率" />
        </div>
        <div className="mt-3">
          <Notice tone="neutral" title="余额口径">
            余额按同一截至日的账户余额统计，不跨期间相加；资金集中后可支用关系另行展示。内部资金划拨在收支汇总中单列，
            不重复计算为经营流入流出。
          </Notice>
        </div>
      </Card>
    </div>
  );
}

function PaymentView({ helpers }: { helpers: DomainHelpers }) {
  const { filters } = useDemoStore();
  const orgIds = helpers.orgIds;
  const accounts = seed.accounts.filter((a) => orgIds.has(a.owner_org_id));
  const txs = seed.cash_transactions.filter((t) => accounts.some((a) => a.id === t.account_id));

  return (
    <div className="space-y-4">
      <Card
        title="重点交易核查"
        subtitle="并列展示“申请与批准”“合同与付款条件”“计划与实付”“业务完成与付款”，命中条件逐项说明"
      >
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
        <div className="mt-3">
          <Notice tone="amber" title="数据边界">
            规划计划数据、SAP 投资/核算事实与财务云资金计划/支付分别作为拟来源；本 Demo 不假设财务云同时承担全部会计核算。
            境外线下付款以统一模板导入并展示银行核对状态，未完成核对时不出“全量支付正常”的结论。
          </Notice>
        </div>
      </Card>
    </div>
  );
}

function PlanView() {
  return (
    <Card title="资金计划监管" subtitle="期初及有效调整计划、实际收支、预计现金缺口与计划外支出">
      <Notice tone="neutral" title="当前样例数据范围">
        本 Demo 的资金计划行、融资与担保业务未纳入种子数据。按业需要求，“当前范围无此业务”与“数据未覆盖”是两种不同状态，
        此处显示为数据未覆盖，不显示零风险。投资资金计划与实际支付的衔接可在固定资产领域 FA-S34 场景与项目台账
        “资金计划/实际支付”列查看；工程与股权的到期收款、出资义务分别在各领域义务清单中跟踪。
      </Notice>
    </Card>
  );
}

export default function Page() {
  return (
    <DomainPage
      domain="CASH"
      intro="资金领域采用专题布局：资金计划、账户与集中、收支与支付、项目资金与回收、出资及资金支持。点击专题只筛选下方区域，顶部指标保留资金领域整体范围。"
      kpiIndicatorIds={["CASH-I01", "CASH-I02", "CASH-I07", "CASH-I04", "CASH-I06", "CASH-OPEN"]}
      flowMode="topics"
      topicFocus={TOPIC_FOCUS}
      ledger={(h) => <AccountView helpers={h} />}
      tabs={[
        { id: "plan", label: "资金计划监管", render: () => <PlanView /> },
        { id: "account", label: "账户与收支穿透", render: (h) => <AccountView helpers={h} /> },
        { id: "payment", label: "重点交易核查", render: (h) => <PaymentView helpers={h} /> },
      ]}
    />
  );
}
