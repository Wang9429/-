"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense } from "react";
import { Tabs } from "@/components/ui";
import { config } from "@/lib/config";
import UsersTab from "@/components/settings/UsersTab";
import ScenariosTab from "@/components/settings/ScenariosTab";
import RulesTab from "@/components/settings/RulesTab";
import IndicatorsTab from "@/components/settings/IndicatorsTab";
import AiTab from "@/components/settings/AiTab";
import DataTab from "@/components/settings/DataTab";

function SettingsBody() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "users";
  const setTab = (id: string) => router.replace(`/settings?tab=${id}`);

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-semibold leading-[34px]">系统配置</h1>
      <Tabs
        tabs={config.settings.tabs.map((t) => ({ id: t.id, label: t.label }))}
        value={tab}
        onChange={setTab}
      />
      {tab === "users" && <UsersTab />}
      {tab === "scenarios" && <ScenariosTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "indicators" && <IndicatorsTab />}
      {tab === "ai" && <AiTab />}
      {tab === "data" && <DataTab />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-[13px] text-textsub">加载系统配置…</div>}>
      <SettingsBody />
    </Suspense>
  );
}
