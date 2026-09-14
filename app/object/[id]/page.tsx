"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import ObjectDrawer from "@/components/ObjectDrawer";
import RiskCaseDrawer from "@/components/RiskCaseDrawer";
import { Card, Notice, Tag } from "@/components/ui";
import { findObject } from "@/lib/objects";
import { orgPath } from "@/lib/org";

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

      <Card
        title={obj ? obj.name : `对象 ${id}`}
        subtitle={
          obj
            ? `${obj.typeLabel}｜管理归属：${orgPath(obj.orgId).map((o) => o.name).join(" / ")}`
            : "该对象不在当前演示数据范围"
        }
        right={<Tag tone="neutral">P74</Tag>}
      >
        {obj ? (
          <p className="text-[13px] text-textsub">
            下方档案与各领域点击对象时打开的内容完全一致；同一对象不因入口不同创建新档案。
          </p>
        ) : (
          <Notice tone="amber" title="对象不存在">
            {id} 在当前演示数据中没有档案记录。按“来源待核实”处理，不创建虚假档案。
          </Notice>
        )}
      </Card>

      {obj && <ObjectDrawer objectId={id} onClose={() => router.back()} onOpenRisk={setRiskId} />}
      <RiskCaseDrawer riskId={riskId} onClose={() => setRiskId(null)} sourceLabel={`对象档案 ${id}`} />
    </div>
  );
}
