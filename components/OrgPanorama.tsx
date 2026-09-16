"use client";

import React, { useMemo, useState } from "react";
import { Tag } from "@/components/ui";
import { orgPath, ROOT_ORG_ID } from "@/lib/org";
import {
  authorizedDescendantOrgIds,
  orgNodeStats,
  orgStatsInOrgSet,
  panoramaRootId,
  visibleChildOrgs,
  type OrgNodeStats,
  type OverviewScope,
} from "@/lib/overview";

function monitorTag(stats: OrgNodeStats) {
  if (stats.overdueRectificationCount > 0) {
    return <Tag tone="red">逾期整改 {stats.overdueRectificationCount}</Tag>;
  }
  if (stats.monitorStatus === "complete") return <Tag tone="green">{stats.monitorLabel}</Tag>;
  if (stats.monitorStatus === "partial") return <Tag tone="amber">{stats.monitorLabel}</Tag>;
  return <Tag tone="neutral">{stats.monitorLabel}</Tag>;
}

function OrgNodeCard({
  stats,
  selected,
  onSelectUnit,
  onOpenProjects,
  onOpenRules,
  onOpenRectification,
  onOpenRelated,
}: {
  stats: OrgNodeStats;
  selected: boolean;
  onSelectUnit: () => void;
  onOpenProjects: () => void;
  onOpenRules: () => void;
  onOpenRectification: () => void;
  onOpenRelated: () => void;
}) {
  return (
    <div className={`reg-org-node ${selected ? "is-selected" : ""}`}>
      <div className="reg-org-node-head">
        <button type="button" className="reg-org-node-name" onClick={onSelectUnit}>
          {stats.name}
        </button>
        <span className="text-[12px] text-textsub whitespace-nowrap">{stats.unitType}</span>
      </div>
      <div className="reg-org-node-meta">
        <button type="button" className="reg-org-stat" onClick={onOpenProjects}>
          纳管项目 <span className="num">{stats.projectCount}</span>
        </button>
        <button type="button" className="reg-org-stat" onClick={onOpenRules}>
          命中规则 <span className="num">{stats.hitRuleDisplay}</span>
        </button>
        <button type="button" className="reg-org-stat" onClick={onOpenRectification}>
          未关闭整改 <span className="num">{stats.openRectificationCount}</span>
        </button>
      </div>
      <div className="reg-org-node-tags">{monitorTag(stats)}</div>
      <div className="reg-org-node-actions">
        {stats.hasChildren && (
          <button type="button" className="reg-org-expand" onClick={onSelectUnit}>
            查看下级
          </button>
        )}
        <button type="button" className="reg-org-expand" onClick={onOpenRelated}>
          查看关联对象
        </button>
      </div>
    </div>
  );
}

export default function OrgPanorama({
  selectedOrgId,
  authorizedOrgIds,
  scope,
  onSelect,
  onReturnHq,
  onOpenProjects,
  onOpenRules,
  onOpenRectification,
  onOpenRelated,
}: {
  selectedOrgId: string;
  authorizedOrgIds: Set<string>;
  scope: OverviewScope;
  onSelect: (orgId: string) => void;
  onReturnHq: () => void;
  onOpenProjects: (orgIds: Set<string>, meta: { orgId: string; includeChildren: boolean }) => void;
  onOpenRules: (orgIds: Set<string>) => void;
  onOpenRectification: (orgIds: Set<string>) => void;
  onOpenRelated: (orgIds: Set<string>) => void;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const rootId = panoramaRootId(authorizedOrgIds);
  const focusId = authorizedOrgIds.has(selectedOrgId) ? selectedOrgId : rootId;
  const path = orgPath(focusId);
  const parent = path.length > 1 ? path[path.length - 2] : undefined;
  const children = useMemo(() => visibleChildOrgs(focusId, authorizedOrgIds), [focusId, authorizedOrgIds]);
  const currentStats = orgStatsInOrgSet(focusId, scope.orgIds, scope);
  const canReturnHq = authorizedOrgIds.has(ROOT_ORG_ID) && focusId !== ROOT_ORG_ID;
  const q = query.trim();
  const visibleChildren = children.filter((unit) => !q || unit.name.includes(q) || unit.id.includes(q));
  const currentVisible = !q || currentStats.name.includes(q) || currentStats.orgId.includes(q);

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

      <div className="reg-org-toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索当前层级单位"
          className="reg-org-search"
          aria-label="搜索单位"
        />
        {children.length > 0 && (
          <button type="button" className="text-[13px] text-brand hover:underline shrink-0" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? "展开下属单位" : "收起下属单位"}
          </button>
        )}
      </div>

      {currentVisible && (
        <OrgNodeCard
          stats={currentStats}
          selected
          onSelectUnit={() => onSelect(focusId)}
          onOpenProjects={() => onOpenProjects(scope.orgIds, { orgId: focusId, includeChildren: scope.orgIds.size > 1 })}
          onOpenRules={() => onOpenRules(scope.orgIds)}
          onOpenRectification={() => onOpenRectification(scope.orgIds)}
          onOpenRelated={() => onOpenRelated(scope.orgIds)}
        />
      )}

      {!collapsed && visibleChildren.length > 0 && (
        <div className="reg-org-children">
          {visibleChildren.map((unit) => {
            const stats = orgNodeStats(unit.id, scope);
            const childOrgs = authorizedDescendantOrgIds(unit.id, authorizedOrgIds);
            return (
              <OrgNodeCard
                key={unit.id}
                stats={stats}
                selected={false}
                onSelectUnit={() => onSelect(unit.id)}
                onOpenProjects={() =>
                  onOpenProjects(childOrgs, { orgId: unit.id, includeChildren: childOrgs.size > 1 })
                }
                onOpenRules={() => onOpenRules(childOrgs)}
                onOpenRectification={() => onOpenRectification(childOrgs)}
                onOpenRelated={() => onOpenRelated(childOrgs)}
              />
            );
          })}
        </div>
      )}

      {q && !currentVisible && visibleChildren.length === 0 && (
        <p className="text-[13px] text-textsub">没有匹配的单位。</p>
      )}
    </div>
  );
}
