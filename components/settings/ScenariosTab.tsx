"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, DataTable, Field, Notice, Tag } from "@/components/ui";
import {
  DOMAIN_OPTIONS,
  EXECUTION_MODE_OPTIONS,
  blankGroup,
  blankSub,
  nextGroupId,
  nextSubId,
  validateGroup,
  validateSub,
  type CatalogGroup,
  type CatalogSubscenario,
  type FieldErrors,
} from "@/lib/config-catalog";
import { groupDisableImpact, subDisableImpact } from "@/lib/config-impact";
import { configStatusLabel, domainCodeLabel, executionModeLabel } from "@/lib/labels";
import { authorizedObjectIds, intersectOrgScope } from "@/lib/config";
import { scenarioRuntimeStatus } from "@/lib/monitoring";
import { phaseName, templatesByDomain } from "@/lib/seed";
import { useDemoStore } from "@/lib/store";
import type { DomainId } from "@/lib/types";
import { ActionCell, FormDrawer, SaveBar, denyTitle, fieldClass } from "./shared";

type Target =
  | { kind: "group"; mode: "view" | "edit" | "create"; value: CatalogGroup }
  | { kind: "sub"; mode: "view" | "edit" | "create"; value: CatalogSubscenario }
  | null;

function phasesOf(domain: string) {
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const t of templatesByDomain(domain as DomainId)) {
    for (const n of t.phase_nodes) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push({ id: n.id, name: n.name });
    }
  }
  return out;
}

export default function ScenariosTab() {
  const { catalog, saveCatalog, canAct, risks, filters, user } = useDemoStore();
  const canRead = canAct("config.scenarios.read") || canAct("config.scenarios.edit");
  const canEdit = canAct("config.scenarios.edit");
  const [gid, setGid] = useState(catalog.groups[0]?.id ?? "");
  const [target, setTarget] = useState<Target>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flash, setFlash] = useState<string | null>(null);

  const group = catalog.groups.find((g) => g.id === gid) ?? catalog.groups[0];
  const children = useMemo(
    () => catalog.subscenarios.filter((s) => s.parent_id === (group?.id ?? gid)),
    [catalog.subscenarios, group?.id, gid],
  );

  if (!canRead) return <Notice tone="amber">当前身份不能打开监管场景。</Notice>;

  const persist = (nextGroups: CatalogGroup[], nextSubs: CatalogSubscenario[]) =>
    saveCatalog({ ...catalog, groups: nextGroups, subscenarios: nextSubs }, "config.scenarios.edit");

  const close = () => {
    setTarget(null);
    setErrors({});
  };

  const save = () => {
    if (!target || !canEdit) return;
    if (target.kind === "group") {
      const errs = validateGroup(target.value, catalog.groups, target.mode === "create");
      setErrors(errs);
      if (Object.keys(errs).length) return;
      const groups =
        target.mode === "create"
          ? [...catalog.groups, target.value]
          : catalog.groups.map((g) => (g.id === target.value.id ? target.value : g));
      persist(groups, catalog.subscenarios);
      setGid(target.value.id);
      setFlash(`已保存一级监管场景「${target.value.name}」。`);
    } else {
      const errs = validateSub(target.value, catalog.groups, catalog.subscenarios, target.mode === "create");
      setErrors(errs);
      if (Object.keys(errs).length) return;
      const subs =
        target.mode === "create"
          ? [...catalog.subscenarios, target.value]
          : catalog.subscenarios.map((s) => (s.id === target.value.id ? target.value : s));
      persist(catalog.groups, subs);
      setGid(target.value.parent_id);
      const orgIds = intersectOrgScope(filters.orgId, filters.includeChildren, user);
      const allowedObjectIds = authorizedObjectIds(user);
      const st = scenarioRuntimeStatus(target.value.id, [], {
        domain: target.value.domain as DomainId,
        orgScope: orgIds,
        allowedObjectIds,
      });
      setFlash(`已保存监管子场景「${target.value.name}」。监测状态：${st.label}。`);
    }
    close();
  };

  const toggleGroup = (row: CatalogGroup) => {
    if (!canEdit) return;
    const disable = row.status !== "disabled";
    if (disable) {
      const impact = groupDisableImpact(row, catalog.subscenarios, risks);
      if (!window.confirm(impact.detail)) return;
    }
    persist(
      catalog.groups.map((g) => (g.id === row.id ? { ...g, status: disable ? "disabled" : "published" } : g)),
      catalog.subscenarios,
    );
    setFlash(disable ? `已停用「${row.name}」。后续监测停止；未关闭事项仍可查看并办理。` : `已启用「${row.name}」。`);
  };

  const toggleSub = (row: CatalogSubscenario) => {
    if (!canEdit) return;
    if (row.enabled) {
      const impact = subDisableImpact(row, risks);
      if (!window.confirm(impact.detail)) return;
    }
    persist(
      catalog.groups,
      catalog.subscenarios.map((s) =>
        s.id === row.id
          ? { ...s, enabled: !row.enabled, status: row.enabled ? "disabled" : "published" }
          : s,
      ),
    );
    setFlash(row.enabled ? `已停用「${row.name}」。后续监测停止；未关闭事项仍可查看并办理。` : `已启用「${row.name}」。`);
  };

  const readonly = target?.mode === "view" || !canEdit;

  return (
    <div className="space-y-3">
      {flash && <p className="text-[13px] text-textsub">{flash}</p>}
      <div className="reg-split">
        <Card
          title={`一级监管场景（${catalog.groups.length}）`}
          right={
            <Button
              variant="primary"
              disabled={!canEdit}
              title={denyTitle(canEdit, "新增一级监管场景")}
              onClick={() =>
                setTarget({ kind: "group", mode: "create", value: blankGroup(nextGroupId("FA", catalog.groups)) })
              }
            >
              新增一级监管场景
            </Button>
          }
        >
          <DataTable
            dense
            rows={catalog.groups}
            rowKey={(r) => r.id}
            onRowClick={(r) => setGid(r.id)}
            highlight={(r) => r.id === gid}
            pageSize={8}
            compactEmpty
            tableClassName="min-w-[560px]"
            columns={[
              { key: "name", title: "名称", minWidth: "160px", render: (r) => r.name },
              { key: "domain", title: "领域", width: "80px", render: (r) => domainCodeLabel(r.domain) },
              {
                key: "st",
                title: "状态",
                width: "72px",
                render: (r) => (
                  <Tag tone={r.status === "disabled" ? "neutral" : "green"}>{configStatusLabel(r.status)}</Tag>
                ),
              },
              {
                key: "act",
                title: "操作",
                width: "210px",
                minWidth: "210px",
                nowrap: true,
                render: (r) => (
                  <ActionCell>
                    <Button size="sm" onClick={() => setTarget({ kind: "group", mode: "view", value: { ...r } })}>
                      查看
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canEdit}
                      title={denyTitle(canEdit, "编辑")}
                      onClick={() => setTarget({ kind: "group", mode: "edit", value: { ...r } })}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canEdit}
                      title={denyTitle(canEdit, r.status === "disabled" ? "启用" : "停用")}
                      onClick={() => toggleGroup(r)}
                    >
                      {r.status === "disabled" ? "启用" : "停用"}
                    </Button>
                  </ActionCell>
                ),
              },
            ]}
          />
        </Card>
        <Card
          title="监管子场景"
          right={
            <Button
              variant="primary"
              disabled={!canEdit}
              title={denyTitle(canEdit, "新增监管子场景")}
              onClick={() =>
                setTarget({
                  kind: "sub",
                  mode: "create",
                  value: blankSub(nextSubId(group?.domain ?? "FA", catalog.subscenarios), group),
                })
              }
            >
              新增监管子场景
            </Button>
          }
        >
          <DataTable
            dense
            rows={children}
            rowKey={(r) => r.id}
            empty="该一级场景下暂无子场景"
            pageSize={8}
            compactEmpty
            tableClassName="min-w-[760px]"
            columns={[
              { key: "id", title: "编号", width: "88px", nowrap: true, render: (r) => <span className="num text-[12px]">{r.id}</span> },
              { key: "name", title: "名称", minWidth: "180px", render: (r) => r.name },
              { key: "mode", title: "执行方式", width: "110px", render: (r) => executionModeLabel(r.execution_mode) },
              {
                key: "app",
                title: "适用",
                width: "110px",
                render: (r) => (
                  <Tag tone={r.applicability === "confirmed" ? "green" : "neutral"}>
                    {r.applicability === "confirmed" ? "已确定适用" : "待确认适用"}
                  </Tag>
                ),
              },
              {
                key: "st",
                title: "状态",
                width: "72px",
                render: (r) => (
                  <Tag tone={r.enabled ? "green" : "neutral"}>{r.enabled ? "启用" : "停用"}</Tag>
                ),
              },
              {
                key: "act",
                title: "操作",
                width: "210px",
                minWidth: "210px",
                nowrap: true,
                render: (r) => (
                  <ActionCell>
                    <Button size="sm" onClick={() => setTarget({ kind: "sub", mode: "view", value: { ...r } })}>
                      查看
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canEdit}
                      title={denyTitle(canEdit, "编辑")}
                      onClick={() => setTarget({ kind: "sub", mode: "edit", value: { ...r } })}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canEdit}
                      title={denyTitle(canEdit, r.enabled ? "停用" : "启用")}
                      onClick={() => toggleSub(r)}
                    >
                      {r.enabled ? "停用" : "启用"}
                    </Button>
                  </ActionCell>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {target?.kind === "group" && (
        <FormDrawer
          open
          onClose={close}
          title={target.mode === "create" ? "新增一级监管场景" : target.mode === "view" ? "查看一级监管场景" : "编辑一级监管场景"}
          footer={
            target.mode === "view" ? (
              <Button onClick={close}>关闭</Button>
            ) : (
              <SaveBar onSave={save} onCancel={close} disabled={!canEdit} />
            )
          }
        >
          <Field label="名称" required error={errors.name}>
            <input
              className={fieldClass(errors.name)}
              value={target.value.name}
              disabled={readonly}
              onChange={(e) => setTarget({ ...target, value: { ...target.value, name: e.target.value } })}
            />
          </Field>
          <Field label="领域" required error={errors.domain}>
            <select
              className={fieldClass(errors.domain)}
              value={target.value.domain}
              disabled={readonly}
              onChange={(e) => {
                const domain = e.target.value;
                const id = target.mode === "create" ? nextGroupId(domain, catalog.groups) : target.value.id;
                setTarget({ ...target, value: { ...target.value, domain, id } });
              }}
            >
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[12px] text-textsub">编号 {target.value.id}（保存后不可改）</p>
        </FormDrawer>
      )}

      {target?.kind === "sub" && (
        <FormDrawer
          open
          onClose={close}
          title={target.mode === "create" ? "新增监管子场景" : target.mode === "view" ? "查看监管子场景" : "编辑监管子场景"}
          footer={
            target.mode === "view" ? (
              <Button onClick={close}>关闭</Button>
            ) : (
              <SaveBar onSave={save} onCancel={close} disabled={!canEdit} />
            )
          }
        >
          <Field label="名称" required error={errors.name}>
            <input
              className={fieldClass(errors.name)}
              value={target.value.name}
              disabled={readonly}
              onChange={(e) => setTarget({ ...target, value: { ...target.value, name: e.target.value } })}
            />
          </Field>
          <Field label="所属一级监管场景" required error={errors.parent_id}>
            <select
              className={fieldClass(errors.parent_id)}
              value={target.value.parent_id}
              disabled={readonly}
              onChange={(e) => {
                const parent = catalog.groups.find((g) => g.id === e.target.value);
                setTarget({
                  ...target,
                  value: { ...target.value, parent_id: e.target.value, domain: parent?.domain ?? target.value.domain },
                });
              }}
            >
              {catalog.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="领域" required error={errors.domain}>
            <select
              className={fieldClass(errors.domain)}
              value={target.value.domain}
              disabled={readonly}
              onChange={(e) => setTarget({ ...target, value: { ...target.value, domain: e.target.value } })}
            >
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="执行方式" required error={errors.execution_mode}>
            <select
              className={fieldClass(errors.execution_mode)}
              value={target.value.execution_mode}
              disabled={readonly}
              onChange={(e) => setTarget({ ...target, value: { ...target.value, execution_mode: e.target.value } })}
            >
              {EXECUTION_MODE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="适用性">
            <select
              className={fieldClass()}
              value={target.value.applicability ?? "pending"}
              disabled={readonly}
              onChange={(e) =>
                setTarget({
                  ...target,
                  value: { ...target.value, applicability: e.target.value as "pending" | "confirmed" },
                })
              }
            >
              <option value="pending">待确认适用</option>
              <option value="confirmed">已确定适用</option>
            </select>
          </Field>
          <Field label="必要字段">
            <input
              className={fieldClass()}
              value={(target.value.required_fields ?? []).join("、")}
              disabled={readonly}
              placeholder="无则留空"
              onChange={(e) =>
                setTarget({
                  ...target,
                  value: {
                    ...target.value,
                    required_fields: e.target.value
                      .split(/[、,，]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </Field>
          <Field label="主归属阶段">
            <select
              className={fieldClass()}
              value={target.value.primary_phase_id}
              disabled={readonly}
              onChange={(e) => setTarget({ ...target, value: { ...target.value, primary_phase_id: e.target.value } })}
            >
              <option value="">未指定</option>
              {phasesOf(target.value.domain).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          {target.value.primary_phase_id && (
            <p className="text-[12px] text-textsub">阶段：{phaseName(target.value.primary_phase_id)}</p>
          )}
          <p className="text-[12px] text-textsub">编号 {target.value.id} · 监管子场景为最小监管场景单位</p>
        </FormDrawer>
      )}
    </div>
  );
}
