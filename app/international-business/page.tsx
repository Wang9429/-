"use client";

import React, { useMemo, useState } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import NormalizedChart from "@/components/NormalizedChart";
import { Card, DataTable, DescList, EmptyState, Field, Notice, SimulatedBadge, Tag, inputClass, selectClass } from "@/components/ui";
import { analyzeWindow, overlappingEvents } from "@/lib/market";
import { seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtAmount, fmtPct, fmtPp, fmtSignedPct } from "@/lib/format";

/**
 * P30 国际化业务（完整业需第 9 章）。地区是辅助分组，不代替管理树；
 * 行情曲线明确标识为模拟重放，不表述为实际历史涨跌。
 */

function EventMarket() {
  const [eventId, setEventId] = useState("EVT-HIST-01");
  const [before, setBefore] = useState(90);
  const [after, setAfter] = useState(90);
  const [seriesIds, setSeriesIds] = useState<string[]>(["HISTORY-freight", "HISTORY-oil"]);

  const event = seed.international_events.find((e) => e.id === eventId)!;
  const stats = useMemo(
    () => seriesIds.map((id) => analyzeWindow(id, event.event_date, before, after)),
    [seriesIds, event.event_date, before, after],
  );
  const overlaps = useMemo(() => {
    const from = new Date(`${event.event_date}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - before);
    const to = new Date(`${event.event_date}T00:00:00Z`);
    to.setUTCDate(to.getUTCDate() + after);
    return overlappingEvents(event.id, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
  }, [event, before, after]);

  const availableSeries = seed.price_series.filter((s) =>
    event.data_nature === "real_event" ? s.id.startsWith("HISTORY-") : s.id.startsWith("CURRENT-"),
  );

  return (
    <div className="space-y-4">
      <Card title="国际事件台账">
        <DataTable
          rows={seed.international_events}
          rowKey={(e) => e.id}
          onRowClick={(e) => {
            setEventId(e.id);
            setSeriesIds(e.data_nature === "real_event" ? ["HISTORY-freight", "HISTORY-oil"] : ["CURRENT-steel", "CURRENT-freight"]);
          }}
          highlight={(e) => e.id === eventId}
          columns={[
            { key: "id", title: "事件", width: "130px", render: (e) => <span className="num">{e.id}</span> },
            { key: "title", title: "名称", render: (e) => e.title },
            { key: "type", title: "事件类型", width: "120px", render: (e) => e.event_type ?? "—" },
            { key: "date", title: "发生时间", width: "110px", render: (e) => <span className="num">{e.event_date}</span> },
            {
              key: "report",
              title: "首次报道/最新核实",
              width: "180px",
              render: (e) => (
                <span className="num text-[12px]">
                  {e.reported_at ?? "—"} / {e.latest_verified_at ?? "—"}
                </span>
              ),
            },
            {
              key: "nature",
              title: "数据性质",
              width: "150px",
              render: (e) => (
                <span className="flex gap-1 flex-wrap">
                  <Tag tone={e.data_nature === "real_event" ? "brand" : "neutral"}>
                    {e.data_nature === "real_event" ? "真实事件日期" : "模拟事件"}
                  </Tag>
                  {e.market_data_nature === "simulated" && <Tag tone="neutral">行情模拟重放</Tag>}
                </span>
              ),
            },
            { key: "status", title: "状态", width: "100px", render: (e) => e.status },
            {
              key: "affected",
              title: "受影响对象",
              render: (e) =>
                e.affected_project_ids?.length ? e.affected_project_ids.join("、") : <span className="text-textsub">待核实</span>,
            },
          ]}
        />
      </Card>

      <Card
        title="历史事件窗口比较"
        right={
          <div className="flex items-center gap-2">
            <select className={`${selectClass} w-[130px]`} value={before} onChange={(e) => setBefore(Number(e.target.value))}>
              {[30, 90].map((d) => (
                <option key={d} value={d}>
                  事件前 {d} 天
                </option>
              ))}
            </select>
            <select className={`${selectClass} w-[130px]`} value={after} onChange={(e) => setAfter(Number(e.target.value))}>
              {[30, 90].map((d) => (
                <option key={d} value={d}>
                  事件后 {d} 天
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-[13px] text-textmain">
            当前事件：{event.title}
            <span className="num text-textsub ml-2">{event.event_date}</span>
          </span>
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-brand hover:underline"
            >
              查看公开来源{event.source_section ? `（${event.source_section}）` : ""} ↗
            </a>
          )}
          <div className="flex flex-wrap gap-2 ml-auto">
            {availableSeries.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-[13px] text-textmain">
                <input
                  type="checkbox"
                  checked={seriesIds.includes(s.id)}
                  onChange={(e) =>
                    setSeriesIds((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>

        <NormalizedChart series={stats} eventLabel={`事件日 ${event.event_date}`} />

        <div className="mt-4">
          <DataTable
            rows={stats}
            rowKey={(s) => s.seriesId}
            empty="请至少选择一个价格序列。"
            columns={[
              { key: "name", title: "序列", render: (s) => `${s.seriesName}（${s.unit}）` },
              {
                key: "base",
                title: "实际基准日/基期价",
                width: "180px",
                render: (s) => (
                  <span className="num text-[12px]">
                    {s.baseDate ?? "—"}｜{s.baseValue?.toFixed(2) ?? "—"}
                  </span>
                ),
              },
              {
                key: "end",
                title: "窗口末相对基期",
                align: "right",
                width: "140px",
                render: (s) => <span className="num">{s.endChangePct === null ? "—" : fmtSignedPct(s.endChangePct)}</span>,
              },
              {
                key: "range",
                title: "最高/最低相对基期",
                align: "right",
                width: "180px",
                render: (s) => (
                  <span className="num">
                    {s.maxChangePct === null ? "—" : fmtSignedPct(s.maxChangePct)} /{" "}
                    {s.minChangePct === null ? "—" : fmtSignedPct(s.minChangePct)}
                  </span>
                ),
              },
              {
                key: "mean",
                title: "前后窗口均价变化",
                align: "right",
                width: "150px",
                render: (s) => <span className="num">{s.meanChangePct === null ? "—" : fmtSignedPct(s.meanChangePct)}</span>,
              },
              {
                key: "vol",
                title: "前/后年化波动率",
                align: "right",
                width: "170px",
                render: (s) => (
                  <span className="num text-[12px]">
                    {s.preVolatility === null ? `样本不足（${s.preSamples}）` : fmtPct(s.preVolatility)} /{" "}
                    {s.postVolatility === null ? `样本不足（${s.postSamples}）` : fmtPct(s.postVolatility)}
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div className="mt-3 space-y-2">
          {stats.flatMap((s) => s.note).length > 0 && (
            <Notice tone="amber" title="窗口与样本说明">
              {[...new Set(stats.flatMap((s) => s.note))].join(" ")}
            </Notice>
          )}
          {overlaps.length > 0 && (
            <Notice tone="neutral" title="窗口内其他事件">
              {overlaps.map((e) => `${e.event_date} ${e.title}`).join("；")}
            </Notice>
          )}
          <div>
            <SimulatedBadge text="行情模拟重放" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ImpactPanel({ helpers }: { helpers: DomainHelpers }) {
  const steel = seed.exposures.find((e) => e.category === "steel");
  const freight = seed.exposures.find((e) => e.category === "freight");
  const project = steel ? seed.engineering_projects.find((p) => p.id === steel.project_id) : undefined;
  const inScope = Boolean(project && helpers.orgIds.has(project.owner_org_id));
  const exposures = seed.exposures.filter((e) => {
    const p = seed.engineering_projects.find((x) => x.id === e.project_id);
    return Boolean(p && helpers.orgIds.has(p.owner_org_id));
  });

  const [steelShock, setSteelShock] = useState(steel?.default_shock_pct ?? 10);
  const [passThrough, setPassThrough] = useState((steel?.confirmed_pass_through_share ?? 0) * 100);
  const [qty, setQty] = useState(steel?.quantity_tonnes ?? 0);
  const [basePrice, setBasePrice] = useState(steel?.base_price_yuan_per_tonne ?? 0);
  const [freightShock, setFreightShock] = useState(freight?.default_shock_pct ?? 25);
  const [freightBase, setFreightBase] = useState(freight?.unpriced_base_cost_wan ?? 0);

  if (!inScope || !steel || !freight || !project) {
    return (
      <EmptyState title="当前范围没有可测算敞口" />
    );
  }

  // 钢材净增成本（万元）= 未定价数量 × 基准单价 × 价格变化比例 × 不能转嫁比例 ÷ 10000
  const steelIncrease = (qty * basePrice * (steelShock / 100) * (1 - passThrough / 100)) / 10000;
  const freightIncrease = freightBase * (freightShock / 100);
  const total = steelIncrease + freightIncrease;

  const baseCost = project.forecast_completion_cost;
  const baseMargin = ((project.contract_revenue_ex_vat - baseCost) / project.contract_revenue_ex_vat) * 100;
  const scenarioCost = baseCost + total;
  const scenarioMargin = ((project.contract_revenue_ex_vat - scenarioCost) / project.contract_revenue_ex_vat) * 100;

  return (
    <div className="space-y-4">
      <Card title="影响测算（成本敏感性）">
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-[15px] font-semibold text-textmain mb-2">钢材敞口（{steel.specification}）</h4>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="未定价数量（吨）">
                <input className={inputClass} type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </Field>
              <Field label="基准单价（元/吨）">
                <input className={inputClass} type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} />
              </Field>
              <Field label="价格变化比例（%）">
                <input className={inputClass} type="number" value={steelShock} onChange={(e) => setSteelShock(Number(e.target.value))} />
              </Field>
              <Field label="经确认可转嫁比例（%）">
                <input className={inputClass} type="number" value={passThrough} onChange={(e) => setPassThrough(Number(e.target.value))} />
              </Field>
            </div>
            <p className="text-[13px] text-textsub">
              钢材净增成本 = {qty} × {basePrice} × {steelShock}% × (1 − {passThrough}%) ÷ 10000 ={" "}
              <span className="num text-textmain">{fmtAmount(steelIncrease)} 万元</span>
            </p>
          </div>

          <div>
            <h4 className="text-[15px] font-semibold text-textmain mb-2">
              运输敞口（{freight.route_id}｜{freight.ship_type}）
            </h4>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="未锁定运费基数（万元）">
                <input className={inputClass} type="number" value={freightBase} onChange={(e) => setFreightBase(Number(e.target.value))} />
              </Field>
              <Field label="运费变化比例（%）">
                <input className={inputClass} type="number" value={freightShock} onChange={(e) => setFreightShock(Number(e.target.value))} />
              </Field>
            </div>
            <p className="text-[13px] text-textsub">
              运费增量 = {freightBase} × {freightShock}% ={" "}
              <span className="num text-textmain">{fmtAmount(freightIncrease)} 万元</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "基准预计完工成本", value: fmtAmount(baseCost), note: "" },
            { label: "模拟增量合计", value: fmtAmount(total), note: "钢材 + 运输" },
            { label: "模拟预计完工成本", value: fmtAmount(scenarioCost), note: "" },
            { label: "基准毛利率", value: fmtPct(baseMargin), note: `有效合同收入 ${fmtAmount(project.contract_revenue_ex_vat)} 万元` },
            { label: "情景毛利率", value: fmtPct(scenarioMargin), note: `较基准 ${fmtPp(scenarioMargin - baseMargin)}` },
          ].map((k) => (
            <div key={k.label} className="rounded-[8px] border border-line px-3.5 py-3">
              <div className="text-[12px] text-textsub">{k.label}</div>
              <div className="num text-[22px] font-semibold text-textmain mt-1">{k.value}</div>
              {k.note ? <div className="text-[12px] text-textsub mt-1">{k.note}</div> : null}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="text-[13px] text-brand hover:underline" onClick={() => helpers.openObject(project.id)}>
            打开工程项目 {project.id} 档案 ›
          </button>
          <SimulatedBadge text="模拟情景，不构成已发生损失" />
        </div>
      </Card>

      <Card title="敞口台账">
        <DataTable
          rows={exposures}
          rowKey={(e) => e.id}
          empty="当前组织范围内没有敞口记录。"
          columns={[
            { key: "id", title: "敞口", width: "130px", render: (e) => <span className="num">{e.id}</span> },
            { key: "proj", title: "项目", width: "120px", render: (e) => <span className="num">{e.project_id}</span> },
            { key: "event", title: "关联事件", width: "130px", render: (e) => <span className="num">{e.event_id}</span> },
            { key: "cat", title: "类别", width: "90px", render: (e) => (e.category === "steel" ? "钢材" : "运输") },
            {
              key: "scale",
              title: "敞口规模",
              render: (e) =>
                e.category === "steel"
                  ? `${e.quantity_tonnes} 吨 × ${e.base_price_yuan_per_tonne} 元/吨（未定价份额 ${fmtPct((e.unpriced_share ?? 0) * 100, 0)}）`
                  : `未锁定运费基数 ${fmtAmount(e.unpriced_base_cost_wan)} 万元`,
            },
            {
              key: "pass",
              title: "已确认可转嫁",
              align: "right",
              width: "130px",
              render: (e) => <span className="num">{fmtPct(e.confirmed_pass_through_share * 100, 0)}</span>,
            },
            {
              key: "inc",
              title: "是否已含基准EAC",
              width: "150px",
              render: (e) => (e.included_in_base_eac ? <Tag tone="neutral">已含基准</Tag> : <Tag tone="amber">未含基准</Tag>),
            },
          ]}
        />
      </Card>
    </div>
  );
}

function OverseasProjects({ helpers }: { helpers: DomainHelpers }) {
  const orgIds = helpers.orgIds;
  const projects = seed.engineering_projects.filter((p) => orgIds.has(p.owner_org_id) && p.country !== "中国");
  const overseasOrgs = seed.organizations.filter((o) => o.node_type === "branch");

  return (
    <div className="space-y-4">
      <Card title="境外项目穿透">
        <DataTable
          rows={projects}
          rowKey={(p) => p.id}
          onRowClick={(p) => helpers.openObject(p.id)}
          empty="当前组织范围内没有境外工程项目。"
          columns={[
            { key: "name", title: "项目", render: (p) => p.name },
            { key: "country", title: "实施国", width: "110px", render: (p) => p.country },
            { key: "org", title: "主归属单位", width: "140px", render: (p) => orgName(p.owner_org_id) },
            { key: "customer", title: "客户", width: "130px", render: (p) => <span className="num">{p.customer_id}</span> },
            {
              key: "rev",
              title: "有效合同额",
              align: "right",
              width: "120px",
              render: (p) => <span className="num">{fmtAmount(p.contract_revenue_ex_vat)}</span>,
            },
            {
              key: "ar",
              title: "已到期/未到期应收",
              align: "right",
              width: "170px",
              render: (p) => (
                <span className="num">
                  {fmtAmount(p.receivable_due)} / {fmtAmount(p.receivable_not_yet_due)}
                </span>
              ),
            },
            { key: "route", title: "航线", width: "120px", render: (p) => p.route_ids.join("、") || "—" },
          ]}
        />
      </Card>

      <Card title="境外机构与主体">
        <DescList
          cols={2}
          items={overseasOrgs.map((o) => ({
            label: o.name,
            value: `管理层级 ${o.management_level}｜节点类型：分支机构｜法律主体：${o.legal_entity_id}`,
          }))}
        />
        {overseasOrgs.length === 0 && <p className="text-[13px] text-textsub">当前授权范围内没有境外机构节点。</p>}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <DomainPage
      domain="INTL"
      kpiIndicatorIds={["INTL-CNT", "INTL-EXPOSURE", "INTL-AFFECTED", "INTL-OPEN"]}
      flowMode="topics"
      ledger={() => <EventMarket />}
      tabs={[
        { id: "market", label: "事件与市场", render: () => <EventMarket /> },
        { id: "impact", label: "业务影响", render: (h) => <ImpactPanel helpers={h} /> },
        { id: "overseas", label: "境外项目穿透", render: (h) => <OverseasProjects helpers={h} /> },
      ]}
    />
  );
}
