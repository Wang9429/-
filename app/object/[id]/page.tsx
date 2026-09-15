"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import ObjectDrawer from "@/components/ObjectDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import { Card, Notice } from "@/components/ui";
import { findObject } from "@/lib/objects";

/**
 * 对象档案独立页。直接访问时提供与抽屉相同的内容，
 * 返回链接指向携带上下文的来源领域（完整业需 4.2.1）。
 */
export default function ObjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id);
  const obj = findObject(id);
  const [riskId, setRiskId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="text-[13px] text-brand hover:underline" onClick={() => router.back()}>
          ‹ 返回来源页面
        </button>
        <span className="text-textsub">/</span>
        <Link href="/overview" className="text-[13px] text-brand hover:underline">
          综合总览
        </Link>
      </div>

      {!obj && (
        <Card title={`对象 ${id}`}>
          <Notice tone="amber" title="对象不存在">
            {id} 在当前样例中没有档案记录。
          </Notice>
        </Card>
      )}

      {obj && <ObjectDrawer objectId={id} variant="page" onClose={() => router.back()} onOpenRisk={setRiskId} />}
      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel={`对象档案 ${id}`} />
    </div>
  );
}
