"use client";

import React from "react";
import { DataTable, Tag } from "@/components/ui";
import { draftsForRisk } from "@/lib/materials";
import {
  assetDisplay,
  evidenceTitle,
  professionalReviewCopy,
} from "@/lib/fp-display";
import { evidenceById } from "@/lib/seed";
import { statusLabel } from "@/lib/risks";
import { FP_ASSET_SCOPE } from "@/lib/fp-r32-seed";
import { FP_GOVERNANCE } from "@/lib/fp-seed";
import type { RiskCase } from "@/lib/types";

export default function ProfessionalReviewPanel({ risk }: { risk: RiskCase }) {
  const s011 = risk.scenario_ids.includes("PTY2-S011");
  const s032 = risk.scenario_ids.includes("PTY2-S032");
  if (!s011 && !s032) return null;
  const scenarioId = s011 ? "PTY2-S011" : "PTY2-S032";
  const copy = professionalReviewCopy(scenarioId);
  const materials = draftsForRisk(risk.id);
  const evidences = risk.evidence_ids.map((id) => evidenceById(id)).filter(Boolean);
          const assets = s011 ? FP_ASSET_SCOPE.filter((x: { matter_id: string }) => x.matter_id === risk.primary_object_id) : [];
  const gov = s032 ? FP_GOVERNANCE.find((g) => g.legal_entity_id === risk.primary_object_id) ?? FP_GOVERNANCE[0] : null;

  return (
    <div className="rounded-[8px] border border-line p-4 space-y-4" data-testid="professional-review-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-semibold text-textmain">{s011 ? "资产范围专业核查" : "治理权利专业核查"}</h4>
        <Tag tone="amber">{statusLabel[risk.status]}</Tag>
      </div>

      <div>
        <div className="text-[12px] text-textsub mb-1">材料名称</div>
        {materials.length === 0 ? (
          <p className="text-[13px] text-textsub">尚未挂接专业核查材料。</p>
        ) : (
          <ul className="space-y-1">
            {materials.map((m) => (
              <li key={m.id} className="text-[14px] text-textmain">
                {m.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-[12px] text-textsub mb-1">核查要点</div>
        <p className="text-[14px] text-textmain leading-6">{copy.points}</p>
      </div>

      {assets.length > 0 && (
        <DataTable
          dense
          rows={assets}
          rowKey={(a) => a.id}
          columns={[
            { key: "n", title: "资产", render: (a) => assetDisplay(a.asset_code).name },
            {
              key: "book",
              title: "账簿在册",
              width: "90px",
              render: (a) => (a.in_books ? "是" : "否"),
            },
            {
              key: "list",
              title: "评估清单",
              width: "90px",
              render: (a) => (a.in_valuation_list ? "已列入" : "未列入"),
            },
            {
              key: "ex",
              title: "排除依据",
              render: (a) => (a.excluded_with_basis ? "有合法剥离依据" : "无"),
            },
            { key: "note", title: "核对说明", render: (a) => a.note },
          ]}
        />
      )}

      {gov && (
        <DataTable
          dense
          rows={[
            { k: "章程董事会席位", v: String(gov.charter_board_seats) },
            { k: "控股股东应派席位", v: "3" },
            { k: "实际委派到任", v: String(gov.appointed_seats) },
            { k: "权利行使", v: gov.blocked ? "待专业核查" : "未见受阻记录" },
          ]}
          rowKey={(r) => r.k}
          columns={[
            { key: "k", title: "核查项目", width: "180px", render: (r) => r.k },
            { key: "v", title: "事实", render: (r) => r.v },
          ]}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-3 text-[14px]">
        <div>
          <div className="text-[12px] text-textsub">责任人</div>
          <div>{risk.assignee_display_name ?? risk.responsible_role ?? "未认领"}</div>
        </div>
        <div>
          <div className="text-[12px] text-textsub">办理状态</div>
          <div>{statusLabel[risk.status]}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-[12px] text-textsub">结论</div>
          <div>
            {risk.investigation_conclusion
              ? risk.investigation_conclusion
              : "尚未记录专业核查结论。待核查不能视为已确认违规。"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[12px] text-textsub mb-1">证据入口</div>
        {evidences.length === 0 ? (
          <p className="text-[13px] text-textsub">暂无已挂接证据。</p>
        ) : (
          <ul className="space-y-1">
            {evidences.map((e) => (
              <li key={e!.id} className="text-[14px] text-textmain">
                {e!.title}
                <span className="num text-[12px] text-textsub ml-2">{e!.source_type}｜{e!.recorded_at}</span>
              </li>
            ))}
          </ul>
        )}
        {risk.evidence_ids.length > 0 && evidences.length === 0 && (
          <p className="text-[13px] text-textsub">{risk.evidence_ids.map(evidenceTitle).join("、")}</p>
        )}
      </div>
      <p className="text-[12px] text-textsub">{copy.materialsHint}下方办理区可记录并保存结论。</p>
    </div>
  );
}
