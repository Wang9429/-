"use client";

import React, { useMemo } from "react";
import { AS_OF, seed } from "@/lib/seed";
import { authorizedOrgIds } from "@/lib/config";
import { useDemoStore } from "@/lib/store";
import { selectClass } from "@/components/ui";

export const PERIOD_OPTIONS = [
  { id: "h1-2026", label: "2026年上半年", start: "2026-01-01", end: "2026-06-30" },
  { id: "q2-2026", label: "2026年第二季度", start: "2026-04-01", end: "2026-06-30" },
  { id: "q1-2026", label: "2026年第一季度", start: "2026-01-01", end: "2026-03-31" },
  { id: "y2025-h2", label: "2025年下半年", start: "2025-07-01", end: "2025-12-31" },
];

function encodeOrg(orgId: string, includeChildren: boolean) {
  return `${orgId}::${includeChildren ? "desc" : "self"}`;
}

export default function FilterBar({ className = "" }: { className?: string }) {
  const { filters, setFilters, user } = useDemoStore();
  const allowedOrgs = useMemo(() => authorizedOrgIds(user), [user]);
  const orgOptions = seed.organizations.filter((o) => allowedOrgs.has(o.id));
  const list = orgOptions.length ? orgOptions : seed.organizations;
  const currentOrg = allowedOrgs.has(filters.orgId) ? filters.orgId : list[0]?.id ?? filters.orgId;
  const currentPeriodId =
    PERIOD_OPTIONS.find((p) => p.start === filters.periodStart && p.end === filters.periodEnd)?.id ??
    "custom";

  return (
    <div className={`reg-filters ${className}`} role="group" aria-label="业务筛选">
      <div className="reg-filter-item">
        <label htmlFor="filter-org">组织范围</label>
        <select
          id="filter-org"
          className={`${selectClass} min-w-[200px] w-[240px] max-w-full`}
          value={encodeOrg(currentOrg, filters.includeChildren)}
          onChange={(e) => {
            const [orgId, scope] = e.target.value.split("::");
            setFilters({ orgId, includeChildren: scope === "desc" });
          }}
          aria-label="全局组织范围"
        >
          {list.map((o) => (
            <React.Fragment key={o.id}>
              <option value={encodeOrg(o.id, true)}>{o.name}（含下级）</option>
              <option value={encodeOrg(o.id, false)}>{o.name}（仅本级）</option>
            </React.Fragment>
          ))}
        </select>
      </div>
      <div className="reg-filter-item">
        <label htmlFor="filter-period">统计期</label>
        <select
          id="filter-period"
          className={`${selectClass} w-[176px] min-w-[148px] max-w-full`}
          value={currentPeriodId}
          onChange={(e) => {
            const p = PERIOD_OPTIONS.find((x) => x.id === e.target.value);
            if (p) setFilters({ periodStart: p.start, periodEnd: p.end });
          }}
          aria-label="统计期间"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          {currentPeriodId === "custom" && (
            <option value="custom">
              {filters.periodStart} 至 {filters.periodEnd}
            </option>
          )}
        </select>
      </div>
      <div className="reg-filter-item">
        <label htmlFor="filter-asof">截至日</label>
        <select
          id="filter-asof"
          className={`${selectClass} w-[132px] min-w-[120px] max-w-full`}
          value={filters.asOf}
          aria-label="业务截至日"
          disabled
        >
          <option value={AS_OF}>{AS_OF}</option>
        </select>
      </div>
    </div>
  );
}
