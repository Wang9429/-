"use client";

import React, { useMemo } from "react";
import { DataTable, DescList, Drawer, Tag } from "@/components/ui";
import VerificationPanel from "@/components/fp/VerificationPanel";
import {
  catalog,
  monitoringStatusLabel,
  objectTypeLabel,
  phaseName,
  scenarioAdoption,
  scenarioName,
  seed,
} from "@/lib/seed";
import { objectName } from "@/lib/objects";
import { orgName } from "@/lib/org";
import { useDemoStore } from "@/lib/store";
import { authorizedObjectIds, intersectOrgScope } from "@/lib/config";
import { isScenarioMonitoringActive, liveRule, liveSub } from "@/lib/live-config";
import { computeFiveCounts, scenarioRuntimeStatus, selectRows } from "@/lib/monitoring";
import { executionModeLabel } from "@/lib/labels";
import {
  monitoringNoteLabel,
  objectTitle,
  riskTitleOf,
  scenarioRequirement,
  verificationFromEval,
} from "@/lib/fp-display";
import { trialRule } from "@/lib/fp-rules";
import { allRuleEvaluations } from "@/lib/evaluations";
import type { DomainId } from "@/lib/types";

/**
 * 监管场景详情按业务结构展示：场景名称与监管要求、执行情况、监测对象、核验依据、关联事项及办理入口。
 */
export default function ScenarioDrawer({
  scenarioId,
  onClose,
  onOpenRisk,
  onOpenObject,
  sourceOpen = false,
}: {
  scenarioId: string | null;
  onClose: () => void;
  onOpenRisk?: (id: string) => void;
  onOpenObject?: (id: string) => void;
  sourceOpen?: boolean;
}) {
  const { filters, risks, user } = useDemoStore();

  const orgIds = useMemo(
    () => intersectOrgScope(filters.orgId, filters.includeChildren, user),
    [filters.orgId, filters.includeChildren, user],
  );
  const allowedObjectIds = useMemo(() => authorizedObjectIds(user), [user]);

  const detail = useMemo(() => {
    if (!scenarioId) return null;
    const cat = catalog.scenarios.find((s) => s.id === scenarioId);
    const supp = seed.supplemental_scenarios.find((s) => s.id === scenarioId);
    const live = liveSub(scenarioId);
    const domain = (cat?.domain ?? supp?.domain ?? live?.domain) as DomainId | undefined;
    const scope = domain
      ? {
          domain,
          orgScope: orgIds,
          periodStart: filters.periodStart,
          periodEnd: filters.periodEnd,
          asOf: filters.asOf,
          scenarioId,
          allowedObjectIds,
        }
      : null;
    const rows = scope ? selectRows(scope) : [];
    const counts = scope ? computeFiveCounts(scope, risks) : null;
    const ruleIds = [...new Set(rows.flatMap((r) => r.rule_ids))];
    if (live) {
      const bound = seed.rule_evaluations
        .concat(allRuleEvaluations())
        .filter((e) => liveRule(e.rule_id)?.primary_subscenario_id === scenarioId)
        .map((e) => e.rule_id);
      bound.forEach((id) => {
        if (!ruleIds.includes(id)) ruleIds.push(id);
      });
    }
    const evals = allRuleEvaluations().filter(
      (e) => ruleIds.includes(e.rule_id) || liveRule(e.rule_id)?.primary_subscenario_id === scenarioId,
    );
    const seenEval = new Set<string>();
    const uniqueEvals = evals.filter((e) => {
      const k = `${e.rule_id}|${e.subject_object_id}|${e.id}`;
      if (seenEval.has(k)) return false;
      seenEval.add(k);
      return true;
    });
    const runtime = domain
      ? scenarioRuntimeStatus(scenarioId, rows, { domain, orgScope: orgIds, allowedObjectIds })
      : null;
    return { cat, supp, live, rows, ruleIds, evals: uniqueEvals, counts, domain, runtime };
  }, [scenarioId, orgIds, allowedObjectIds, filters.periodStart, filters.periodEnd, filters.asOf, risks]);

  if (!scenarioId || !detail) return null;

  const { cat, live, rows, ruleIds, evals, counts, runtime } = detail;
  const hitTypes = new Set(evals.filter((e) => e.effective_result === "hit").map((e) => e.rule_id));
  const scopeLine = `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}｜截至 ${filters.asOf}`;
  const monitoringActive = isScenarioMonitoringActive(scenarioId);
  const req = scenarioRequirement(scenarioId);
  const relatedRiskIds = [...new Set(rows.flatMap((r) => r.risk_ids))];

  const views = evals.map((e) => {
    const risk = risks.find((r) => e.risk_ids.includes(r.id));
    return verificationFromEval(e, { riskStatus: risk?.status, scenarioIds: [scenarioId] });
  });
  if (views.length === 0) {
    const objects = [...new Set(rows.map((r) => r.monitoring_object_id))];
    for (const oid of objects) {
      const trial = trialRule(scenarioId, oid);
      if (!trial || trial.result === "not_applicable") continue;
      views.push(
        verificationFromEval(
          {
            rule_id: ruleIds[0] ?? scenarioId.replace("-S", "-R"),
            subject_object_id: oid,
            inputs: trial.inputs,
            formula: trial.formula,
            effective_result: trial.result === "hit" ? "hit" : trial.result === "clear" ? "clear" : "data_insufficient",
            result: trial.result === "hit" ? "hit" : "clear",
            rule_version: liveRule(ruleIds[0] ?? "")?.published?.version ?? live?.status ?? "现行",
            window_start: filters.periodStart,
            window_end: filters.periodEnd,
            evidence_ids: [],
            risk_ids: rows.find((r) => r.monitoring_object_id === oid)?.risk_ids ?? [],
            missing: trial.missing,
          },
          { scenarioIds: [scenarioId], riskStatus: "pending_review" },
        ),
      );
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="66vw"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          {req.name}
          <span className="num text-textsub text-[13px]">场景编号 {scenarioId}</span>
          <Tag tone={scenarioAdoption(scenarioId) === "结构化监测" ? "brand" : "neutral"}>
            {scenarioAdoption(scenarioId)}
          </Tag>
          {runtime && <Tag tone={runtime.tone}>{runtime.label}</Tag>}
          {!monitoringActive && <Tag tone="neutral">已停用</Tag>}
        </span>
      }
      subtitle={<span>当前范围 {scopeLine}</span>}
    >
      <div className="h-full overflow-auto px-6 py-4 space-y-6">
        <section>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">场景名称与监管要求</h4>
          <DescList
            cols={2}
            items={[
              { label: "场景名称", value: req.name },
              { label: "场景编号", value: <span className="num">{scenarioId}</span> },
              {
                label: "一级监管场景",
                value: cat?.original_scene ?? (live ? seed.domain_topics.find((d) => d.domain === live.domain)?.topics.find((t) => t.id === live.topic_id)?.name : null) ?? live?.legacy_topic ?? "—",
              },
              { label: "执行方式", value: executionModeLabel(live?.execution_mode) },
              { label: "监管要求", value: req.requirement },
              ...(req.caliber ? [{ label: "核验口径", value: req.caliber }] : []),
              {
                label: "规则版本",
                value: liveRule(ruleIds[0] ?? "")?.published?.version ?? liveRule(ruleIds[0] ?? "")?.version_id ?? "现行已启用版本",
              },
            ]}
          />
        </section>

        <section>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">执行情况</h4>
          <DescList
            cols={4}
            items={[
              { label: "配置规则数", value: <span className="num">{ruleIds.length}</span> },
              { label: "应评估对象数", value: <span className="num">{counts?.requiredObjects.length ?? 0}</span> },
              { label: "已监测对象数", value: <span className="num">{counts?.monitoredObjects.length ?? 0}</span> },
              { label: "命中规则种类数", value: <span className="num">{hitTypes.size}</span> },
              { label: "命中对象数", value: <span className="num">{counts?.hitObjects.length ?? 0}</span> },
              { label: "涉及责任单位数", value: <span className="num">{new Set(rows.map((r) => r.owner_org_id)).size}</span> },
              {
                label: "数据缺口",
                value: rows.filter((r) => r.status === "data_insufficient").length
                  ? `${rows.filter((r) => r.status === "data_insufficient").length} 条缺数据：${[...new Set(rows.flatMap((r) => r.missing_data))].join("、")}`
                  : "无",
              },
              {
                label: "最近监测时间",
                value: (
                  <span className="num">
                    {rows.length ? rows.map((r) => r.snapshot_date).sort().slice(-1)[0] : "—"}
                  </span>
                ),
              },
            ]}
          />
          {runtime?.code === "unevaluated_missing" && runtime.missingFields.length > 0 && (
            <p className="text-[13px] text-textsub mt-2">缺 {runtime.missingFields.join("、")}</p>
          )}
        </section>

        <section>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">监测对象</h4>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            empty={runtime?.label ?? "待评估"}
            onRowClick={(r) => onOpenObject?.(r.monitoring_object_id)}
            columns={[
              {
                key: "obj",
                title: "监测对象",
                minWidth: "280px",
                render: (r) => (
                  <span className="block min-w-[260px]">
                    <span className="text-textmain">{objectTitle(r.monitoring_object_id)}</span>
                    <span className="num text-[12px] text-textsub ml-2 whitespace-nowrap">对象编号 {r.monitoring_object_id}</span>
                  </span>
                ),
              },
              { key: "type", title: "对象类型", width: "150px", render: (r) => objectTypeLabel[r.object_type] ?? r.object_type },
              { key: "org", title: "责任单位", width: "130px", render: (r) => orgName(r.owner_org_id) },
              { key: "phase", title: "关联环节", width: "120px", render: (r) => (r.phase_id ? phaseName(r.phase_id) : "—") },
              {
                key: "window",
                title: "归属窗口",
                width: "180px",
                render: (r) => (
                  <span className="num text-[12px]">
                    {r.window_start} ~ {r.window_end}
                  </span>
                ),
              },
              {
                key: "status",
                title: "监测状态",
                width: "150px",
                render: (r) => (
                  <Tag
                    tone={
                      r.status === "evaluated_hit"
                        ? "red"
                        : r.status === "evaluated_clear"
                          ? "green"
                          : r.status === "data_insufficient"
                            ? "amber"
                            : "neutral"
                    }
                  >
                    {monitoringStatusLabel[r.status] ?? monitoringNoteLabel(r.note, r.status)}
                  </Tag>
                ),
              },
            ]}
          />
        </section>

        <section id="scenario-verification">
          <h4 className="text-[15px] font-semibold text-textmain mb-2">核验依据</h4>
          {sourceOpen && views.length === 0 && (
            <p className="text-[13px] text-textsub">当前范围没有可展示的核验记录。</p>
          )}
          {views.length === 0 ? (
            <p className="text-[13px] text-textsub">该场景当前没有自动核验记录，专业核查事项请从关联事项进入办理。</p>
          ) : (
            <div className="space-y-3">
              {views.map((v) => (
                <VerificationPanel key={`${v.ruleId}-${v.objectId}-${v.ruleVersion}`} view={v} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h4 className="text-[15px] font-semibold text-textmain mb-2">关联事项及办理入口</h4>
          {relatedRiskIds.length === 0 ? (
            <p className="text-[13px] text-textsub">当前范围没有关联监管事项。</p>
          ) : (
            <ul className="space-y-2">
              {relatedRiskIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="text-left text-brand hover:underline"
                    onClick={() => onOpenRisk?.(id)}
                  >
                    {riskTitleOf(id) || objectName(id)}
                    <span className="num text-[12px] text-textsub ml-2">事项编号 {id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}
