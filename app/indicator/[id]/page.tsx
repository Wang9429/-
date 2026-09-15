"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import IndicatorDrawer from "@/components/IndicatorDrawer";
import { Card, Notice } from "@/components/ui";
import { DOMAIN_META } from "@/lib/seed";
import { indicatorById, indicatorsForDomain } from "@/lib/metrics";
import { orgName } from "@/lib/org";
import { useDemoStore } from "@/lib/store";

/**
 * P71 指标穿透独立页。直接访问路由时提供同内容，
 * 返回链接指向携带上下文的来源领域；卡片默认交互仍是弹出组织树。
 */
export default function IndicatorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { filters } = useDemoStore();
  const id = decodeURIComponent(params.id);
  const def = indicatorById(id);

  const scopeLabel = `${orgName(filters.orgId)}${filters.includeChildren ? "（含下级）" : "（仅本级）"}｜${filters.periodStart}~${filters.periodEnd}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="text-[13px] text-brand hover:underline" onClick={() => router.back()}>
          ‹ 返回来源页面
        </button>
        {def && (
          <>
            <span className="text-textsub">/</span>
            <Link href={DOMAIN_META[def.domain].route} className="text-[13px] text-brand hover:underline">
              {DOMAIN_META[def.domain].label}
            </Link>
          </>
        )}
      </div>

      <Card
        title={def ? `${def.name}（${def.unit}）` : `指标 ${id}`}
        subtitle={def ? `${DOMAIN_META[def.domain].label}指标范围｜${scopeLabel}｜截至 ${filters.asOf}` : undefined}
      >
        {def ? (
          <div className="text-[13px] text-textsub space-y-1.5">
            <p>公式：{def.formula}</p>
            <p>口径：{def.caliber}</p>
            <p>数据来源：{def.sourceNote}</p>
          </div>
        ) : (
          <Notice tone="amber" title="指标不存在">
            {id} 不在当前指标目录中。可在场景规则库查看原 KRI 与已实现指标的对应关系。
          </Notice>
        )}
      </Card>

      {def && (
        <IndicatorDrawer
          open
          onClose={() => router.back()}
          indicator={def}
          indicatorOptions={indicatorsForDomain(def.domain)}
          onSwitchIndicator={(next) => router.replace(`/indicator/${next}`)}
          initialOrgId={filters.orgId}
          scopeLabel={scopeLabel}
          onOpenObject={(oid) => router.push(`/object/${oid}`)}
          onOpenRisk={() => router.push("/supervision-workbench")}
        />
      )}
    </div>
  );
}
