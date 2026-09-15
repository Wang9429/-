"use client";

import React, { useEffect, useState } from "react";
import { Card, Field, Notice, Tag } from "@/components/ui";
import { DOMAIN_OPTIONS, validateAi, type CatalogAi, type FieldErrors } from "@/lib/config-catalog";
import { useDemoStore } from "@/lib/store";
import { SaveBar, denyTitle } from "./shared";

export default function AiTab() {
  const { catalog, saveCatalog, canAct } = useDemoStore();
  const canRead = canAct("config.ai.read") || canAct("config.ai.edit");
  const canEdit = canAct("config.ai.edit");
  const [draft, setDraft] = useState<CatalogAi>(() => structuredClone(catalog.ai));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setDraft(structuredClone(catalog.ai));
  }, [catalog.ai]);

  if (!canRead) return <Notice tone="amber">当前身份不能打开 AI 分析设置。</Notice>;

  const save = () => {
    if (!canEdit) return;
    const errs = validateAi(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    saveCatalog({ ...catalog, ai: draft }, "config.ai.edit");
    setFlash("已保存 AI 分析设置。顶栏入口与可用任务按配置更新。");
  };

  const cancel = () => {
    setDraft(structuredClone(catalog.ai));
    setErrors({});
    setFlash("已取消，未保存改动。");
  };

  return (
    <Card title="AI分析设置">
      <div className="max-w-xl">
        {flash && <p className="text-[13px] text-textsub mb-3">{flash}</p>}
        <Field label="分析开关">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            {draft.enabled ? "开启" : "关闭"}
          </label>
        </Field>
        <div className="mb-3 text-[13px]">
          连接状态：
          <Tag tone={draft.external_model_connected ? "green" : "amber"}>
            {draft.external_model_connected ? "已连接模型服务" : "未连接模型服务"}
          </Tag>
          <span className="text-textsub ml-2">保存配置不改变真实连接状态。</span>
        </div>
        <Field label="可用任务" error={errors.tasks}>
          <div className="flex flex-col gap-1.5">
            {draft.tasks.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={t.enabled}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tasks: draft.tasks.map((x) => (x.id === t.id ? { ...x, enabled: e.target.checked } : x)),
                    })
                  }
                />
                {t.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="使用范围" error={errors.allowed_domains}>
          <div className="flex flex-wrap gap-3">
            {DOMAIN_OPTIONS.map((d) => (
              <label key={d.id} className="flex items-center gap-1.5 text-[13px]">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={draft.allowed_domains.includes(d.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.allowed_domains, d.id]
                      : draft.allowed_domains.filter((id) => id !== d.id);
                    setDraft({ ...draft, allowed_domains: next });
                  }}
                />
                {d.label}
              </label>
            ))}
          </div>
        </Field>
        <SaveBar
          onSave={save}
          onCancel={cancel}
          disabled={!canEdit}
          extra={!canEdit ? <span className="text-[12px] text-textsub">{denyTitle(false, "保存")}</span> : null}
        />
      </div>
    </Card>
  );
}
