"use client";

import React, { useMemo, useState } from "react";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import { Button, Card, DataTable, Notice, SeverityTag, Tabs, Tag, inputClass, selectClass } from "@/components/ui";
import { DOMAIN_META, seed } from "@/lib/seed";
import { orgName } from "@/lib/org";
import {
  isCurrentTaskOverdue,
  isMissingRectificationDeadline,
  isOverdueRectification,
  rectificationDueDate,
  statusLabel,
  taskTypeLabel,
} from "@/lib/risks";
import { daysBetween, fmtDate } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { intersectOrgScope, riskVisible } from "@/lib/config";
import { useDemoStore } from "@/lib/store";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import type { DomainId, RiskCase } from "@/lib/types";

/**
 * P77 共用监管工作台（完整业需 13.6）。与显示型页面共用同一对象与事项，
 * 不生成第二套统计；筛选不会把同一风险因多领域关联复制成多行。
 */

const VIEWS = [
  { id: "pending", label: "待核查" },
  { id: "rectifying", label: "整改跟踪" },
  { id: "verification", label: "待复核" },
  { id: "done", label: "已办事项" },
];

export default function WorkbenchPage() {
  const { risks, filters, user, urges, canAct } = useDemoStore();
  const [view, setView] = useState("pending");
  const [domain, setDomain] = useState<DomainId | "all">("all");
  const [severity, setSeverity] = useState<"all" | "red" | "yellow">("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [q, setQ] = useState("");
  const [riskId, setRiskId] = useState<string | null>(null);

  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );

  const base = useMemo(
    () => risks.filter((r) => orgIds.has(r.owner_org_id) && riskVisible(user, r)),
    [risks, orgIds, user],
  );

  const byView = useMemo(() => {
    switch (view) {
      case "pending":
        return base.filter((r) => r.status === "pending_review" || r.status === "investigating");
      case "rectifying":
        return base.filter((r) => r.status === "rectifying");
      case "verification":
        return base.filter((r) => r.status === "pending_verification");
      default:
        return base.filter((r) => r.status === "closed" || r.status === "excluded");
    }
  }, [base, view]);

  const rows = useMemo(
    () =>
      byView.filter((r) => {
        if (domain !== "all" && !r.domains.includes(domain)) return false;
        if (severity !== "all" && r.severity !== severity) return false;
        if (onlyOverdue && !isCurrentTaskOverdue(r, filters.asOf) && !isOverdueRectification(r, filters.asOf)) return false;
        if (q.trim() && !`${r.id}${r.title}${r.primary_object_id}`.toLowerCase().includes(q.trim().toLowerCase()))
          return false;
        return true;
      }),
    [byView, domain, severity, onlyOverdue, q, filters.asOf],
  );

  const counts = {
    pending: base.filter((r) => r.status === "pending_review" || r.status === "investigating").length,
    rectifying: base.filter((r) => r.status === "rectifying").length,
    verification: base.filter((r) => r.status === "pending_verification").length,
    done: base.filter((r) => r.status === "closed" || r.status === "excluded").length,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="监管工作台"
        subtitle="从预警确认到整改复核的日常办理入口。与各领域页面共用同一对象与同一事项状态，不生成第二套统计。"
      />
      <FilterBar />

      <Tabs
        tabs={VIEWS.map((v) => ({ id: v.id, label: `${v.label}（${counts[v.id as keyof typeof counts]}）` }))}
        value={view}
        onChange={setView}
      />

      <Card
        title={VIEWS.find((v) => v.id === view)!.label}
        subtitle={
          view === "pending"
            ? "支持认领、查看事实、补充说明与核查结论；确认需整改必须填写结论、责任与措施"
            : view === "rectifying"
              ? "显示措施、责任、有效整改期限与进展；仅改计划日期不自动关闭原事项"
              : view === "verification"
                ? "查看前后证据后通过或退回；复核通过才关闭并计入本期已整改闭环"
                : "包含已排除与已关闭，保留具体结论与历史动作"
        }
        right={
          <Button
            disabled={!canAct("business.export")}
            title={canAct("business.export") ? "导出当前筛选" : "当前身份不能导出业务数据"}
            onClick={() => {
              if (!canAct("business.export")) return;
              downloadCsv(
                `监管工作台_${view}.csv`,
                ["事项编号", "问题摘要", "主对象", "关联领域", "触发规则", "办理状态", "当前节点", "当前期限", "有效整改期限", "责任单位", "承办人"],
                rows.map((r) => [
                  r.id,
                  r.title,
                  r.primary_object_id,
                  r.domains.map((d) => DOMAIN_META[d].label).join("/"),
                  r.rule_id,
                  statusLabel[r.status],
                  taskTypeLabel[r.current_task_type],
                  r.current_task_due_date ?? "",
                  rectificationDueDate(r) ?? "",
                  orgName(r.owner_org_id),
                  r.assignee_display_name ?? "",
                ]),
                {
                  title: `监管工作台 ${VIEWS.find((v) => v.id === view)!.label}`,
                  scopeLines: [
                    `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜截至 ${filters.asOf}`,
                    `筛选：领域=${domain}，等级=${severity}，仅看逾期=${onlyOverdue ? "是" : "否"}`,
                  ],
                },
              );
            }}
          >
            导出当前筛选
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input className={`${inputClass} w-[220px]`} placeholder="搜索事项编号、摘要或主对象" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${selectClass} w-[170px]`} value={domain} onChange={(e) => setDomain(e.target.value as never)}>
            <option value="all">全部主/关联领域</option>
            {Object.values(DOMAIN_META).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select className={`${selectClass} w-[130px]`} value={severity} onChange={(e) => setSeverity(e.target.value as never)}>
            <option value="all">全部等级</option>
            <option value="red">高风险</option>
            <option value="yellow">关注</option>
          </select>
          <label className="flex items-center gap-1.5 text-[13px] text-textmain">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
            只看逾期
          </label>
          {(q || onlyOverdue || domain !== "all" || severity !== "all") && (
            <>
              <Tag tone="brand">
                已筛选 {rows.length}/{byView.length}
              </Tag>
              <Button
                onClick={() => {
                  setQ("");
                  setOnlyOverdue(false);
                  setDomain("all");
                  setSeverity("all");
                }}
              >
                清除条件
              </Button>
            </>
          )}
        </div>

        <DataTable<RiskCase>
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setRiskId(r.id)}
          empty={
            byView.length === 0
              ? "当前组织范围内该视图没有事项。"
              : "当前筛选条件下没有匹配事项，请调整搜索或筛选。"
          }
          columns={[
            { key: "id", title: "事项编号", width: "84px", render: (r) => <span className="num">{r.id}</span> },
            { key: "title", title: "问题摘要", render: (r) => r.title },
            { key: "obj", title: "主对象", width: "120px", render: (r) => <span className="num">{r.primary_object_id}</span> },
            {
              key: "domains",
              title: "关联领域",
              width: "150px",
              render: (r) => r.domains.map((d) => DOMAIN_META[d].short).join("、"),
              hint: "同一事项跨领域只显示一行，不按领域复制",
            },
            { key: "rule", title: "触发规则", width: "120px", render: (r) => <span className="num text-[12px]">{r.rule_id}</span> },
            { key: "sev", title: "等级", width: "84px", render: (r) => <SeverityTag severity={r.severity} /> },
            { key: "status", title: "办理状态", width: "104px", render: (r) => statusLabel[r.status] },
            {
              key: "task",
              title: "当前节点/期限",
              width: "160px",
              render: (r) => (
                <span className="text-[13px]">
                  {taskTypeLabel[r.current_task_type]}
                  <span
                    className="num text-[12px] ml-1"
                    style={{ color: isCurrentTaskOverdue(r, filters.asOf) ? "var(--risk-red-fg)" : "var(--text-sub)" }}
                  >
                    {fmtDate(r.current_task_due_date)}
                  </span>
                </span>
              ),
              hint: "当前办理超期按当前核查/整改/复核节点期限计算，与首页“逾期整改”分别计算",
            },
            {
              key: "rectDue",
              title: "有效整改期限",
              width: "150px",
              render: (r) => {
                if (isMissingRectificationDeadline(r)) return <Tag tone="amber">整改期限缺失</Tag>;
                const d = rectificationDueDate(r);
                if (!d) return <span className="text-textsub">—</span>;
                const over = isOverdueRectification(r, filters.asOf);
                return (
                  <span className="num" style={{ color: over ? "var(--risk-red-fg)" : undefined }}>
                    {fmtDate(d)}
                    {over && <span className="ml-1">逾期 {daysBetween(d, filters.asOf)} 天</span>}
                  </span>
                );
              },
            },
            { key: "org", title: "责任单位", width: "134px", render: (r) => orgName(r.owner_org_id) },
            { key: "assignee", title: "承办人", width: "110px", render: (r) => r.assignee_display_name ?? <span className="text-textsub">未认领</span> },
            {
              key: "urge",
              title: "督办",
              width: "80px",
              render: (r) => {
                const n = urges.filter((u) => u.riskId === r.id).length;
                return n ? <Tag tone="brand">{n} 次</Tag> : <span className="text-textsub">—</span>;
              },
            },
          ]}
        />

        <div className="mt-3 space-y-2">
          <Notice tone="neutral" title="办理与期限口径">
            核查期限、整改期限与复核期限分别保存；调整期限需说明原因与批准依据，原到期日保留，不通过改日期抹掉历史逾期。
            仅指标恢复、计划改期或源系统状态改变不自动关闭监管事项。
          </Notice>
          <Notice tone="amber" title="Demo 办理边界">
            认领、说明、整改提交与复核更新本地办理状态，立即反映到总览与各领域数量，并可重置业务办理状态。
            “催办”仅保存带操作者、时间与说明的本地督办记录，不发送邮件、短信或企业消息。正式业务办理仍在相应源系统进行。
          </Notice>
        </div>
      </Card>

      <Card title="办理状态流转" subtitle="待核查 → 核查中 →（排除 / 确认需整改）→ 整改中 → 待复核 →（通过关闭 / 退回整改）；已关闭可凭新证据重开">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {[
            { label: "待核查", tone: "neutral" as const },
            { label: "核查中", tone: "brand" as const },
            { label: "整改中", tone: "amber" as const },
            { label: "待复核", tone: "brand" as const },
            { label: "已关闭", tone: "green" as const },
            { label: "已排除", tone: "neutral" as const },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <Tag tone={s.tone}>{s.label}</Tag>
              {i < arr.length - 1 && <span className="text-textsub">→</span>}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[12px] text-textsub mt-3">
          “逾期”是叠加状态，不覆盖风险等级；一个已完成业务环节仍可含高风险未关闭事项。
          种子基线：未关闭 8 件（红 4、黄 4），待核查 5、整改中 3、当前逾期整改 1，已排除 1（
          {seed.risk_cases.filter((r) => r.status === "excluded").map((r) => r.id).join("、")}）。
        </p>
      </Card>

      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel="监管工作台" />
    </div>
  );
}
