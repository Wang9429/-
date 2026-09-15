"use client";

import React, { useMemo } from "react";
import DomainPage, { type DomainHelpers } from "@/components/DomainPage";
import { Card, DataTable, EmptyState, Notice, Tag } from "@/components/ui";
import { phaseName, seed, templateById } from "@/lib/seed";
import { orgName } from "@/lib/org";
import { fmtPct } from "@/lib/format";
import { isOpen } from "@/lib/risks";
import { useDemoStore } from "@/lib/store";

/**
 * P50 产权管理（完整业需第 11 章）。以法律主体与产权事项为核心对象；
 * 组织归属树、股权关系图与产权事项流程分别表达，不混成一棵树。
 */

function ConsistencyCheck({ helpers }: { helpers: DomainHelpers }) {
  const { risks } = useDemoStore();
  const orgIds = helpers.orgIds;
  const matters = seed.property_matters.filter((m) => orgIds.has(m.owner_org_id));

  return (
    <div className="space-y-4">
      <Card title="权益信息一致性核查（PTY-S01）">
        {matters.length === 0 ? (
          <EmptyState title="当前组织范围内没有产权事项" />
        ) : (
          matters.map((m) => {
            const snapshots = seed.ownership_snapshots.filter((s) => m.snapshot_ids.includes(s.id));
            const values = [...new Set(snapshots.map((s) => s.pct))];
            const hasDiff = values.length > 1;
            return (
              <div key={m.id} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <button className="text-[15px] text-textmain hover:text-brand" onClick={() => helpers.openObject(m.id)}>
                    {m.name}
                  </button>
                  <span className="num text-[12px] text-textsub">{m.id}</span>
                  <Tag tone="neutral">{m.matter_type}</Tag>
                  <Tag tone="brand">当前环节：{phaseName(m.current_phase_id)}</Tag>
                  {hasDiff && <Tag tone="amber">权益信息待核实</Tag>}
                </div>
                <DataTable
                  dense
                  rows={snapshots}
                  rowKey={(s) => s.id}
                  columns={[
                    { key: "src", title: "来源", render: (s) => s.source_type },
                    { key: "inv", title: "投资方 / 被投企业", render: (s) => `${s.investor_id} → ${s.investee_id}` },
                    { key: "pct", title: "权益比例", align: "right", width: "110px", render: (s) => <span className="num">{fmtPct(s.pct, 0)}</span> },
                    { key: "eff", title: "有效期起", width: "120px", render: (s) => <span className="num">{s.effective_date}</span> },
                    { key: "snap", title: "快照日期", width: "120px", render: (s) => <span className="num">{s.snapshot_date}</span> },
                  ]}
                />
                <div className="mt-2 space-y-2">
                  {hasDiff ? (
                    <Notice tone="amber" title="来源差异待核实">
                      同一有效期下不同来源权益比例为 {values.map((v) => `${v}%`).join(" / ")}。
                    </Notice>
                  ) : (
                    <Notice tone="green" title="来源一致">
                      各来源同一有效期权益比例一致，未发现待核实差异。
                    </Notice>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {m.risk_ids.map((id) => {
                      const r = risks.find((x) => x.id === id);
                      return (
                        <button
                          key={id}
                          onClick={() => helpers.openRisk(id)}
                          className="h-8 px-3 inline-flex items-center gap-2 rounded-[6px] border border-line text-[13px] hover:bg-tint transition-colors duration-150"
                        >
                          <span className="num">{id}</span>
                          <span>{r?.title ?? "事项"}</span>
                          {r && !isOpen(r) && <Tag tone="neutral">已关闭</Tag>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-textsub">{m.note}</p>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function RelationView({ helpers }: { helpers: DomainHelpers }) {
  const matters = seed.property_matters.filter((m) => helpers.orgIds.has(m.owner_org_id));
  const snapshotIds = new Set(matters.flatMap((m) => m.snapshot_ids));
  const snapshots = seed.ownership_snapshots.filter((s) => snapshotIds.has(s.id));
  const entityIds = new Set<string>();
  snapshots.forEach((s) => {
    entityIds.add(s.investor_id);
    entityIds.add(s.investee_id);
  });
  matters.forEach((m) => {
    entityIds.add(m.investor_id);
    entityIds.add(m.investee_id);
  });
  seed.organizations
    .filter((o) => helpers.orgIds.has(o.id) && o.legal_entity_id)
    .forEach((o) => entityIds.add(o.legal_entity_id));
  const entities = seed.legal_entities.filter((e) => entityIds.has(e.id));

  return (
    <div className="space-y-4">
      <Card title="产权关系穿透">
        <DataTable
          rows={snapshots}
          rowKey={(s) => s.id}
          empty="当前组织范围内没有与产权事项关联的持股关系。"
          columns={[
            {
              key: "investor",
              title: "投资方（法律主体）",
              render: (s) => (
                <span>
                  {entities.find((e) => e.id === s.investor_id)?.name ?? s.investor_id}
                  <span className="num text-[12px] text-textsub ml-2">{s.investor_id}</span>
                </span>
              ),
            },
            { key: "rel", title: "关系", width: "110px", render: () => <Tag tone="brand">直接持股</Tag> },
            {
              key: "investee",
              title: "被投企业",
              render: (s) => (
                <span>
                  {entities.find((e) => e.id === s.investee_id)?.name ?? s.investee_id}
                  <span className="num text-[12px] text-textsub ml-2">{s.investee_id}</span>
                </span>
              ),
            },
            { key: "pct", title: "比例", align: "right", width: "90px", render: (s) => <span className="num">{fmtPct(s.pct, 0)}</span> },
            { key: "src", title: "来源", width: "170px", render: (s) => s.source_type },
            { key: "eff", title: "有效期起", width: "116px", render: (s) => <span className="num">{s.effective_date}</span> },
          ]}
        />
      </Card>

      <Card title="纳入产权管理的法律主体">
        <DataTable
          rows={entities}
          rowKey={(e) => e.id}
          onRowClick={(e) => helpers.openObject(e.id)}
          empty="当前组织范围内没有纳入产权管理的法律主体。"
          columns={[
            { key: "id", title: "法人ID", width: "130px", render: (e) => <span className="num">{e.id}</span> },
            { key: "name", title: "名称", render: (e) => e.name },
            { key: "country", title: "国家", width: "110px", render: (e) => e.country },
            {
              key: "role",
              title: "角色",
              width: "150px",
              render: (e) =>
                ({ managed_entity: "纳入管理主体", investee: "被投企业", customer: "客户", supplier: "供应商" } as Record<string, string>)[
                  e.role
                ] ?? e.role,
            },
            {
              key: "orgs",
              title: "对应管理单位",
              render: (e) =>
                seed.organizations
                  .filter((o) => o.legal_entity_id === e.id)
                  .map((o) => orgName(o.id))
                  .join("、") || <span className="text-textsub">无（不属管理组织树节点）</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

function MatterLedger({ helpers }: { helpers: DomainHelpers }) {
  const { risks } = useDemoStore();
  const orgIds = helpers.orgIds;
  const matters = seed.property_matters.filter((m) => orgIds.has(m.owner_org_id));

  return (
    <Card title="产权事项清单">
      <DataTable
        rows={matters}
        rowKey={(m) => m.id}
        onRowClick={(m) => helpers.openObject(m.id)}
        empty="当前组织范围内没有产权事项。"
        columns={[
          { key: "id", title: "事项", width: "120px", render: (m) => <span className="num">{m.id}</span> },
          { key: "name", title: "名称", render: (m) => m.name },
          { key: "type", title: "事项类型", width: "110px", render: (m) => m.matter_type },
          {
            key: "tpl",
            title: "适用流程",
            width: "130px",
            render: (m) => templateById(m.template_id)?.matter_type_name ?? m.template_id,
          },
          { key: "org", title: "主办单位", width: "130px", render: (m) => orgName(m.owner_org_id) },
          { key: "entity", title: "相关法人", width: "150px", render: (m) => `${m.investor_id} → ${m.investee_id}` },
          { key: "phase", title: "当前环节", width: "120px", render: (m) => phaseName(m.current_phase_id) },
          {
            key: "risk",
            title: "未关闭事项",
            align: "right",
            width: "106px",
            render: (m) => {
              const n = m.risk_ids.filter((id) => {
                const r = risks.find((x) => x.id === id);
                return r ? isOpen(r) : false;
              }).length;
              return (
                <span className="num" style={{ color: n ? "var(--risk-amber-fg)" : "var(--text-sub)" }}>
                  {n}
                </span>
              );
            },
          },
        ]}
      />
    </Card>
  );
}

export default function Page() {
  return (
    <DomainPage
      domain="RIGHTS"
      kpiIndicatorIds={["RIGHTS-ENTITIES", "RIGHTS-MATTERS", "RIGHTS-DIFF", "RIGHTS-OPEN"]}
      ledger={(h) => <MatterLedger helpers={h} />}
      tabs={[
        { id: "relation", label: "产权关系穿透", render: (h) => <RelationView helpers={h} /> },
        { id: "consistency", label: "一致性核查", render: (h) => <ConsistencyCheck helpers={h} /> },
      ]}
    />
  );
}
