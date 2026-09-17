"use client";

import React from "react";
import { DataTable, Tag } from "@/components/ui";
import { holdingDiffNote, holdingRowsFor, type HoldingRow } from "@/lib/fp-display";

export default function HoldingsTable({
  investeeId,
  investorId,
  rows,
  title = "持股来源核对",
}: {
  investeeId?: string;
  investorId?: string;
  rows?: HoldingRow[];
  title?: string;
}) {
  const list = rows ?? holdingRowsFor(investeeId, investorId);
  const note = holdingDiffNote(list);
  if (list.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="holdings-table">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-semibold text-textmain">{title}</h4>
        {note && <Tag tone="amber">差异待核实</Tag>}
      </div>
      <DataTable
        dense
        rows={list}
        rowKey={(r) => r.id}
        columns={[
          { key: "from", title: "投资方", render: (r) => r.investorName },
          { key: "to", title: "被投企业", render: (r) => r.investeeName },
          { key: "pct", title: "持股比例", width: "100px", align: "right", render: (r) => <span className="num">{r.pct}%</span> },
          { key: "src", title: "来源", width: "140px", render: (r) => r.source },
          { key: "eff", title: "生效日", width: "110px", render: (r) => <span className="num">{r.effectiveDate}</span> },
          { key: "asof", title: "基准日", width: "110px", render: (r) => <span className="num">{r.asOf}</span> },
        ]}
      />
      {note && <p className="text-[12px] text-textsub">{note}</p>}
    </div>
  );
}
