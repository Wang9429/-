"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, DataTable, Field, Notice, Tag, textareaClass } from "@/components/ui";
import { roles, type ConfigUser, type DataScope } from "@/lib/config";
import {
  DATA_SCOPE_OPTIONS,
  DOMAIN_OPTIONS,
  blankUser,
  nextUserId,
  validateUser,
  type FieldErrors,
} from "@/lib/config-catalog";
import { userDisableImpact } from "@/lib/config-impact";
import { configStatusLabel, dataScopeModeLabel } from "@/lib/labels";
import { orgName } from "@/lib/org";
import { seed } from "@/lib/seed";
import { useDemoStore } from "@/lib/store";
import { ActionCell, FormDrawer, SaveBar, denyTitle, fieldClass } from "./shared";

type Mode = "view" | "edit" | "create" | null;

export default function UsersTab() {
  const { configUsers, saveConfigUsers, canAct, user } = useDemoStore();
  const canRead = canAct("config.users.read") || canAct("config.users.edit");
  const canEdit = canAct("config.users.edit");
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState<ConfigUser | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flash, setFlash] = useState<string | null>(null);

  const orgs = useMemo(
    () => seed.organizations.map((o) => ({ id: o.id, label: `${orgName(o.id)}` })),
    [],
  );

  if (!canRead) return <Notice tone="amber">当前身份不能打开用户与权限。</Notice>;

  const openForm = (next: ConfigUser, nextMode: Mode) => {
    setDraft(structuredClone(next));
    setErrors({});
    setMode(nextMode);
  };

  const close = () => {
    setMode(null);
    setDraft(null);
    setErrors({});
  };

  const save = () => {
    if (!draft || !canEdit) return;
    const errs = validateUser(draft, { actor: user, allUsers: configUsers, isNew: mode === "create" });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const next =
      mode === "create" ? [...configUsers, draft] : configUsers.map((u) => (u.id === draft.id ? draft : u));
    saveConfigUsers(next);
    setFlash(`已保存「${draft.name}」。现有页面与操作权限按新配置执行。`);
    close();
  };

  const toggleStatus = (row: ConfigUser) => {
    if (!canEdit) return;
    const enabling = row.status === "disabled" || row.status === "retired";
    if (!enabling) {
      const impact = userDisableImpact(row, configUsers, user?.id);
      if (impact.blocking) {
        window.alert(`${impact.detail}\n${impact.blocking}`);
        return;
      }
      if (!window.confirm(impact.detail)) return;
    }
    saveConfigUsers(
      configUsers.map((u) =>
        u.id === row.id ? { ...u, status: enabling ? "enabled" : "disabled" } : u,
      ),
    );
    setFlash(enabling ? `已启用「${row.name}」。` : `已停用「${row.name}」。历史办理记录保留。`);
  };

  const patchScope = (patch: Partial<DataScope>) => {
    if (!draft) return;
    setDraft({ ...draft, data_scope: { ...draft.data_scope, ...patch } });
  };

  const readonly = mode === "view" || !canEdit;

  return (
    <div className="space-y-3">
      {flash && <p className="text-[13px] text-textsub">{flash}</p>}
      <Card
        title="用户"
        right={
          <Button
            variant="primary"
            disabled={!canEdit}
            title={denyTitle(canEdit, "新增用户")}
            onClick={() => openForm(blankUser(nextUserId(configUsers)), "create")}
          >
            新增用户
          </Button>
        }
      >
        <DataTable
          dense
          rows={configUsers}
          rowKey={(r) => r.id}
          empty="暂无用户"
          pageSize={10}
          compactEmpty
          columns={[
            { key: "name", title: "用户", minWidth: "140px", render: (r) => r.name },
            {
              key: "role",
              title: "角色",
              render: (r) => r.role_ids.map((id) => roles.find((x) => x.id === id)?.name ?? id).join("、"),
            },
            { key: "scope", title: "数据范围", width: "120px", render: (r) => dataScopeModeLabel(r.data_scope.mode) },
            {
              key: "st",
              title: "状态",
              width: "72px",
              render: (r) => (
                <Tag tone={r.status === "enabled" ? "green" : "neutral"}>{configStatusLabel(r.status)}</Tag>
              ),
            },
            {
              key: "act",
              title: "操作",
              width: "210px",
              minWidth: "210px",
              nowrap: true,
              sticky: "right",
              render: (r) => (
                <ActionCell>
                  <Button size="sm" onClick={() => openForm(r, "view")}>
                    查看
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canEdit}
                    title={denyTitle(canEdit, "编辑用户")}
                    onClick={() => openForm(r, "edit")}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canEdit}
                    title={denyTitle(canEdit, r.status === "enabled" ? "停用用户" : "启用用户")}
                    onClick={() => toggleStatus(r)}
                  >
                    {r.status === "enabled" ? "停用" : "启用"}
                  </Button>
                </ActionCell>
              ),
            },
          ]}
        />
      </Card>

      {draft && mode && (
        <FormDrawer
          open
          onClose={close}
          title={mode === "create" ? "新增用户" : mode === "view" ? `查看 ${draft.name}` : `编辑 ${draft.name}`}
          footer={
            mode === "view" ? (
              <Button onClick={close}>关闭</Button>
            ) : (
              <SaveBar onSave={save} onCancel={close} disabled={!canEdit} />
            )
          }
        >
          <Field label="用户名称" required error={errors.name}>
            <input
              className={fieldClass(errors.name)}
              value={draft.name}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="所属组织" required error={errors.org_id}>
            <select
              className={fieldClass(errors.org_id)}
              value={draft.org_id}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, org_id: e.target.value })}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="角色" required error={errors.role_ids}>
            <div className="flex flex-col gap-1.5 mt-1">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    disabled={readonly}
                    checked={draft.role_ids.includes(r.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...draft.role_ids, r.id]
                        : draft.role_ids.filter((id) => id !== r.id);
                      setDraft({ ...draft, role_ids: next });
                    }}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="业务领域">
            <div className="flex flex-wrap gap-3">
              {DOMAIN_OPTIONS.map((d) => (
                <label key={d.id} className="flex items-center gap-1.5 text-[13px]">
                  <input
                    type="checkbox"
                    disabled={readonly}
                    checked={(draft.domain_ids as string[]).includes(d.id)}
                    onChange={(e) => {
                      const cur = draft.domain_ids as string[];
                      const next = e.target.checked ? [...cur, d.id] : cur.filter((id) => id !== d.id);
                      setDraft({ ...draft, domain_ids: next });
                    }}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="数据范围" required error={errors.data_scope_mode}>
            <select
              className={fieldClass(errors.data_scope_mode)}
              value={draft.data_scope.mode}
              disabled={readonly}
              onChange={(e) => patchScope({ mode: e.target.value as DataScope["mode"] })}
            >
              {DATA_SCOPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="授权组织" error={errors.root_org_ids}>
            <div className="flex flex-col gap-1.5">
              {orgs.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    disabled={readonly || draft.data_scope.mode === "none"}
                    checked={draft.data_scope.root_org_ids.includes(o.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...draft.data_scope.root_org_ids, o.id]
                        : draft.data_scope.root_org_ids.filter((id) => id !== o.id);
                      patchScope({ root_org_ids: next });
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="指定对象编号" hint="多个编号用逗号分隔" error={errors.object_ids}>
            <textarea
              className={textareaClass}
              disabled={readonly || draft.data_scope.mode !== "explicit_objects"}
              value={draft.data_scope.object_ids.join(",")}
              onChange={(e) =>
                patchScope({
                  object_ids: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <p className="text-[12px] text-textsub">
            可见范围预览：{dataScopeModeLabel(draft.data_scope.mode)}
            {draft.data_scope.root_org_ids.length
              ? `｜${draft.data_scope.root_org_ids.map(orgName).join("、")}`
              : "｜无授权组织"}
          </p>
        </FormDrawer>
      )}
    </div>
  );
}
