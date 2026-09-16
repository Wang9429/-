"use client";

import React, { useMemo } from "react";
import { Tag } from "@/components/ui";
import { orgPath, ROOT_ORG_ID } from "@/lib/org";
import {
  orgNodeStats,
  orgStatsInOrgSet,
  panoramaRootId,
  visibleChildOrgs,
  type OrgNodeStats,
  type OverviewScope,
} from "@/lib/overview";

function coverageTag(stats: OrgNodeStats) {
  if (stats.overdueHighRiskCount > 0) return <Tag tone="red">逾期</Tag>;
  if (stats.coverage === "no_business") return <Tag tone="neutral">无业务</Tag>;
  if (stats.coverage === "unevaluated") return <Tag tone="neutral">未评估</Tag>;
  return null;
}

function OrgNodeCard({
  stats,
  selected,
  onSelect,
}: {
  stats: OrgNodeStats;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className={`reg-org-node ${selected ? "is-selected" : ""}`}>
      <button type="button" className="reg-org-node-main" onClick={onSelect}>
        <span className="reg-org-node-name">{stats.name}</span>
        <span className="reg-org-node-meta">
          <span>
            在管项目 <span className="num">{stats.projectCount}</span>
          </span>
          <span>
            未关闭高风险{" "}
            <span className="num" style={{ color: stats.openHighRiskCount ? "var(--risk-red-fg)" : undefined }}>
              {stats.openHighRiskCount}
            </span>
          </span>
        </span>
        <span className="reg-org-node-tags">{coverageTag(stats)}</span>
      </button>
    </div>
  );
}

export default function OrgPanorama({
  selectedOrgId,
  authorizedOrgIds,
  scope,
  onSelect,
  onReturnHq,
}: {
  selectedOrgId: string;
  authorizedOrgIds: Set<string>;
  scope: OverviewScope;
  onSelect: (orgId: string) => void;
  onReturnHq: () => void;
}) {
  const rootId = panoramaRootId(authorizedOrgIds);
  const focusId = authorizedOrgIds.has(selectedOrgId) ? selectedOrgId : rootId;
  const path = orgPath(focusId);
  const parent = path.length > 1 ? path[path.length - 2] : undefined;
  const children = useMemo(() => visibleChildOrgs(focusId, authorizedOrgIds), [focusId, authorizedOrgIds]);
  const currentStats = orgStatsInOrgSet(focusId, scope.orgIds, scope);
  const canReturnHq = authorizedOrgIds.has(ROOT_ORG_ID) && focusId !== ROOT_ORG_ID;

  return (
    <div className="reg-org-panorama">
      <div className="reg-org-path">
        <span className="text-[13px] text-textsub shrink-0">当前层级</span>
        <ol className="reg-org-path-list">
          {path.map((o, i) => (
            <li key={o.id}>
              {i > 0 && <span className="text-textsub px-1">/</span>}
              <button
                type="button"
                className={o.id === focusId ? "text-textmain font-medium" : "text-brand hover:underline"}
                onClick={() => onSelect(o.id)}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ol>
        {parent && (
          <button type="button" className="text-[13px] text-brand hover:underline shrink-0" onClick={() => onSelect(parent.id)}>
            {parent.id === ROOT_ORG_ID ? "返回总部" : "返回上级"}
          </button>
        )}
        {canReturnHq && parent && parent.id !== ROOT_ORG_ID && (
          <button type="button" className="text-[13px] text-brand hover:underline shrink-0" onClick={onReturnHq}>
            返回总部
          </button>
        )}
      </div>

      <OrgNodeCard stats={currentStats} selected onSelect={() => onSelect(focusId)} />

      {children.length > 0 && (
        <div className="reg-org-children">
          {children.map((unit) => (
            <OrgNodeCard
              key={unit.id}
              stats={orgNodeStats(unit.id, scope)}
              selected={false}
              onSelect={() => onSelect(unit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
