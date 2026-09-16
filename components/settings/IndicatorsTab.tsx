"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, DataTable, Field, Notice, Tag, textareaClass } from "@/components/ui";
import { intersectOrgScope } from "@/lib/config";
import {
  DOMAIN_OPTIONS,
  blankIndicator,
  nextIndicatorId,
  validateIndicator,
  type CatalogIndicator,
  type FieldErrors,
} from "@/lib/config-catalog";
import { indicatorDisableImpact } from "@/lib/config-impact";
import { fmtPct } from "@/lib/format";
import { configStatusLabel, displayPositionLabel, domainCodeLabel } from "@/lib/labels";
import { INDICATORS, computeIndicator, indicatorById } from "@/lib/metrics";
import { useDemoStore } from "@/lib/store";
import { ActionCell, FormDrawer, SaveBar, denyTitle, fieldClass } from "./shared";

type Mode = "view" | "edit" | "create" | null;

export default function IndicatorsTab() {
  const { catalog, saveCatalog, canAct, filters, risks, user } = useDemoStore();
  const canRead = canAct("config.indicators.read") || canAct("config.indicators.edit");
  const canEdit = canAct("config.indicators.edit");
  const canBusiness = canAct("business.read");
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState<CatalogIndicator | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flash, setFlash] = useState<string | null>(null);

  const orgIds = intersectOrgScope(filters.orgId, filters.includeChildren, user);
  const trial = useMemo(() => {
    if (!canBusiness) return [];
    const ctx = { periodStart: filters.periodStart, periodEnd: filters.periodEnd, asOf: filters.asOf, risks };
    return INDICATORS.filter((i) => i.id === "FA-I06" || i.id === "FA-I07").map((def) => {
      const m = computeIndicator(def, orgIds, ctx);
      return { id: def.id, name: def.name, value: m.value, status: m.status, reason: m.emptyReason, formula: def.formula };
    });
  }, [canBusiness, filters, risks, orgIds]);

  if (!canRead) return <Notice tone="amber">当前身份不能打开指标管理。</Notice>;

  const persist = (indicators: CatalogIndicator[]) =>
    saveCatalog({ ...catalog, indicators }, "config.indicators.edit");

  const openForm = (row: CatalogIndicator, next: Mode) => {
    setDraft(structuredClone(row));
    setErrors({});
    setMode(next);
  };

  const close = () => {
    setMode(null);
    setDraft(null);
    setErrors({});
  };

  const save = () => {
    if (!draft || !canEdit) return;
    const errs = validateIndicator(draft, catalog.indicators, mode === "create");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const next =
      mode === "create" ? [...catalog.indicators, draft] : catalog.indicators.map((i) => (i.id === draft.id ? draft : i));
    persist(next);
    setFlash(
      indicatorById(draft.id)
        ? `已保存「${draft.name}」。展示位置与启用状态立即作用于业务首页。`
        : `已保存「${draft.name}」。仅进入目录，尚未接入计算。`,
    );
    close();
  };

  const toggle = (row: CatalogIndicator) => {
    if (!canEdit) return;
    if (row.enabled) {
      if (!window.confirm(indicatorDisableImpact(row).detail)) return;
    }
    persist(
      catalog.indicators.map((i) =>
        i.id === row.id
          ? { ...i, enabled: !row.enabled, status: row.enabled ? "disabled" : i.status === "disabled" ? "published" : i.status }
          : i,
      ),
    );
    setFlash(row.enabled ? `已停用「${row.name}」。` : `已启用「${row.name}」。`);
  };

  const readonly = mode === "view" || !canEdit;

  return (
    <div className="space-y-3">
      {flash && <p className="text-[13px] text-textsub">{flash}</p>}
      {canBusiness && (
        <Card title="已实现指标试算">
          <DataTable
            dense
            rows={trial}
            rowKey={(r) => r.id}
            columns={[
              { key: "name", title: "指标", render: (r) => r.name },
              { key: "formula", title: "计算公式", render: (r) => r.formula },
              {
                key: "v",
                title: "当前范围试算",
                align: "right",
                render: (r) => (
                  <span className="num">
                    {r.status === "no_business" ? "无业务" : r.value === null ? r.reason ?? "—" : fmtPct(r.value)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
      {!canBusiness && <Notice tone="neutral">当前身份无业务数据权限，不能用总部项目金额试算指标。</Notice>}
      <Card
        title={`指标目录（${catalog.indicators.length}）`}
        right={
          <Button
            variant="primary"
            disabled={!canEdit}
            title={denyTitle(canEdit, "新增指标")}
            onClick={() => openForm(blankIndicator(nextIndicatorId("FA", catalog.indicators)), "create")}
          >
            新增指标
          </Button>
        }
      >
        <DataTable
          dense
          rows={catalog.indicators}
          rowKey={(r) => r.id}
          pageSize={10}
          compactEmpty
          columns={[
            { key: "id", title: "编号", width: "88px", nowrap: true, render: (r) => <span className="num text-[12px]">{r.id}</span> },
            { key: "name", title: "名称", minWidth: "200px", render: (r) => r.name },
            { key: "domain", title: "领域", width: "80px", render: (r) => domainCodeLabel(r.domain) },
            { key: "st", title: "状态", width: "80px", render: (r) => configStatusLabel(r.status) },
            {
              key: "run",
              title: "运行",
              width: "110px",
              render: (r) => (
                <Tag tone={indicatorById(r.id) ? "green" : "neutral"}>
                  {indicatorById(r.id) ? "已接入计算" : "仅目录"}
                </Tag>
              ),
            },
            { key: "pos", title: "展示位置", width: "90px", render: (r) => displayPositionLabel(r.display_position) },
            {
              key: "en",
              title: "启用",
              width: "64px",
              render: (r) => <Tag tone={r.enabled ? "green" : "neutral"}>{r.enabled ? "启用" : "停用"}</Tag>,
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
                    title={denyTitle(canEdit, "编辑")}
                    onClick={() => openForm(r, "edit")}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canEdit}
                    title={denyTitle(canEdit, r.enabled ? "停用" : "启用")}
                    onClick={() => toggle(r)}
                  >
                    {r.enabled ? "停用" : "启用"}
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
          title={mode === "create" ? "新增指标" : mode === "view" ? `查看 ${draft.name}` : `编辑 ${draft.name}`}
          footer={
            mode === "view" ? (
              <Button onClick={close}>关闭</Button>
            ) : (
              <SaveBar onSave={save} onCancel={close} disabled={!canEdit} />
            )
          }
        >
          <Field label="名称" required error={errors.name}>
            <input
              className={fieldClass(errors.name)}
              value={draft.name}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="领域" required error={errors.domain}>
            <select
              className={fieldClass(errors.domain)}
              value={draft.domain}
              disabled={readonly || mode === "edit"}
              onChange={(e) => {
                const domain = e.target.value;
                const id = mode === "create" ? nextIndicatorId(domain, catalog.indicators) : draft.id;
                setDraft({ ...draft, domain, id });
              }}
            >
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="口径 / 计算公式" required error={errors.formula_display}>
            <textarea
              className={textareaClass}
              value={draft.formula_display}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, formula_display: e.target.value })}
            />
          </Field>
          <Field label="口径说明">
            <textarea
              className={textareaClass}
              value={draft.definition_note}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, definition_note: e.target.value })}
            />
          </Field>
          {draft.id === "FA-I06" && (
            <p className="text-[13px] text-textsub -mt-1">
              综合总览以投资计划执行率为首页主指标，投资完成额为辅助业务字段（本指标分子）；二者共用本配置项的启用和首页展示开关，不是另一条独立指标。该关系写入口径说明与查看计算依据，首页不常显解释句。
            </p>
          )}
          <Field label="展示位置">
            <select
              className={fieldClass()}
              value={draft.display_position}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, display_position: e.target.value })}
            >
              <option value="homepage">首页</option>
              <option value="metric_library">指标目录</option>
            </select>
          </Field>
          <p className="text-[12px] text-textsub">编号 {draft.id}。无计算器的新增指标仅进入目录，不会虚报已可运行。</p>
        </FormDrawer>
      )}
    </div>
  );
}
