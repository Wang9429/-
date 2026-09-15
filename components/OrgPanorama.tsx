"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tag } from "@/components/ui";
import { orgLevelLabel, orgPath, ROOT_ORG_ID } from "@/lib/org";
import {
  orgNodeStats,
  panoramaRootId,
  visibleChildOrgs,
  type OrgNodeStats,
  type OverviewScope,
} from "@/lib/overview";
import type { Organization } from "@/lib/types";

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
  expand,
}: {
  stats: OrgNodeStats;
  selected: boolean;
  onSelect: () => void;
  expand?: React.ReactNode;
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
      {expand}
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
  const path = orgPath(selectedOrgId);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]));

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(rootId);
      for (const o of orgPath(selectedOrgId)) {
        if (o.id !== selectedOrgId) next.add(o.id);
      }
      return next;
    });
  }, [selectedOrgId, rootId]);

  const l2 = useMemo(() => visibleChildOrgs(rootId, authorizedOrgIds), [rootId, authorizedOrgIds]);
  const rootStats = orgNodeStats(rootId, scope);
  const canReturnHq = authorizedOrgIds.has(ROOT_ORG_ID) && selectedOrgId !== ROOT_ORG_ID;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
                className={o.id === selectedOrgId ? "text-textmain font-medium" : "text-brand hover:underline"}
                onClick={() => onSelect(o.id)}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ol>
        {canReturnHq && (
          <button type="button" className="text-[13px] text-brand hover:underline shrink-0" onClick={onReturnHq}>
            返回总部
          </button>
        )}
      </div>

      <OrgNodeCard stats={rootStats} selected={selectedOrgId === rootId} onSelect={() => onSelect(rootId)} />

      <div className="reg-org-l2">
        {l2.map((unit) => (
          <LevelBranch
            key={unit.id}
            unit={unit}
            selectedOrgId={selectedOrgId}
            authorizedOrgIds={authorizedOrgIds}
            scope={scope}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function LevelBranch({
  unit,
  selectedOrgId,
  authorizedOrgIds,
  scope,
  expanded,
  onSelect,
  onToggle,
}: {
  unit: Organization;
  selectedOrgId: string;
  authorizedOrgIds: Set<string>;
  scope: OverviewScope;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const children = visibleChildOrgs(unit.id, authorizedOrgIds);
  const stats = orgNodeStats(unit.id, scope);
  const open = expanded.has(unit.id);
  return (
    <div className="reg-org-branch">
      <OrgNodeCard
        stats={stats}
        selected={selectedOrgId === unit.id}
        onSelect={() => onSelect(unit.id)}
        expand={
          children.length > 0 ? (
            <button
              type="button"
              className="reg-org-expand"
              aria-expanded={open}
              onClick={() => onToggle(unit.id)}
            >
              {open ? "收起下级" : `展开${orgLevelLabel(children[0])}`}
            </button>
          ) : null
        }
      />
      {open && children.length > 0 && (
        <div className="reg-org-l3">
          {children.map((child) => (
            <OrgNodeCard
              key={child.id}
              stats={orgNodeStats(child.id, scope)}
              selected={selectedOrgId === child.id}
              onSelect={() => onSelect(child.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
