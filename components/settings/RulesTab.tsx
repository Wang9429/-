"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, DataTable, Field, Modal, Notice, Tag, inputClass } from "@/components/ui";
import { objectAllowed } from "@/lib/config";
import {
  blankRule,
  nextRuleId,
  nextRuleVersion,
  ruleRuntimeKind,
  RULE_RUNTIME_LABEL,
  validateRule,
  type CatalogRule,
  type FieldErrors,
  type RuleVersion,
} from "@/lib/config-catalog";
import { ruleDisableImpact } from "@/lib/config-impact";
import { fmtPct } from "@/lib/format";
import { configStatusLabel } from "@/lib/labels";
import { statusLabel } from "@/lib/risks";
import { seed } from "@/lib/seed";
import { useDemoStore } from "@/lib/store";
import { INDEPENDENT_TRIAL_PROJECTS } from "@/lib/trial";
import { evaluationsForPublish, FP_TRIAL_OBJECTS, trialRule } from "@/lib/fp-rules";
import { allRuleEvaluations } from "@/lib/evaluations";
import { FIRST_BATCH_SUBS } from "@/lib/fp-topics";
import { ActionCell, FormDrawer, SaveBar, denyTitle, fieldClass } from "./shared";

type Mode = "view" | "edit" | "create" | null;

export default function RulesTab() {
  const { catalog, saveCatalog, canAct, user, risks, filters } = useDemoStore();
  const canRead = canAct("config.rules.read") || canAct("config.rules.edit");
  const canEdit = canAct("config.rules.edit") || canAct("config.test");
  const canPublish = canAct("config.rules.publish");
  const canBusiness = canAct("business.read");
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState<CatalogRule | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [versionsOf, setVersionsOf] = useState<CatalogRule | null>(null);
  const [trialOpen, setTrialOpen] = useState(false);
  const [query, setQuery] = useState("");

  const pct = Number(draft?.draft_parameters.deviation_gt_pct ?? 10);
  const fpSubId = draft?.primary_subscenario_id ?? "";
  const isFpTrial = Boolean(draft && (FIRST_BATCH_SUBS as readonly string[]).includes(fpSubId));
  const trials = useMemo(() => {
    if (!draft) return [];
    if (isFpTrial) {
      return (FP_TRIAL_OBJECTS[fpSubId] ?? []).map((o) => {
        const t = trialRule(draft.id, o.id, draft.draft_parameters);
        return { id: o.id, name: o.name, pct: null as number | null, result: t.result, formula: t.formula, hit: t.result === "hit" };
      });
    }
    const source = canBusiness
      ? seed.fixed_asset_projects
          .filter((p) => p.eac != null && objectAllowed(user, p.owner_org_id, p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            pct: ((p.eac! - p.effective_approved_budget) / p.effective_approved_budget) * 100,
          }))
      : INDEPENDENT_TRIAL_PROJECTS.map((p) => ({
          id: p.id,
          name: p.name,
          pct: ((p.eac - p.effective_approved_budget) / p.effective_approved_budget) * 100,
        }));
    return source.map((p) => ({
      ...p,
      result: (p.pct > pct ? "hit" : "clear") as "hit" | "clear",
      formula: `偏差率 ${p.pct.toFixed(2)}%`,
      hit: p.pct > pct,
    }));
  }, [draft, canBusiness, user, pct, isFpTrial, fpSubId]);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.rules;
    return catalog.rules.filter(
      (r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.primary_subscenario_id.toLowerCase().includes(q),
    );
  }, [catalog.rules, query]);

  if (!canRead) return <Notice tone="amber">当前身份不能打开监测规则。</Notice>;

  const persist = (rules: CatalogRule[], action: string) => saveCatalog({ ...catalog, rules }, action);

  const runtimeOf = (r: CatalogRule) =>
    ruleRuntimeKind(
      r,
      catalog.subscenarios.find((s) => s.id === r.primary_subscenario_id),
    );

  const openForm = (rule: CatalogRule, next: Mode) => {
    setDraft(structuredClone(rule));
    setErrors({});
    setMode(next);
    setTrialOpen(false);
  };

  const close = () => {
    setMode(null);
    setDraft(null);
    setErrors({});
    setTrialOpen(false);
  };

  const saveDraft = () => {
    if (!draft || !canEdit) return;
    const errs = validateRule(draft, catalog.subscenarios, catalog.rules, mode === "create");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const nextRule = { ...draft, status: draft.published ? draft.status : "draft" };
    const rules =
      mode === "create" ? [...catalog.rules, nextRule] : catalog.rules.map((r) => (r.id === nextRule.id ? nextRule : r));
    persist(rules, "config.rules.edit");
    setFlash(`已保存草稿「${nextRule.name}」。未发布版本不会改写历史评估。`);
    close();
  };

  const publish = (rule: CatalogRule) => {
    if (!canPublish) return;
    const errs = validateRule(rule, catalog.subscenarios, catalog.rules, false);
    if (Object.keys(errs).length) {
      setErrors(errs);
      openForm(rule, "edit");
      return;
    }
    const version: RuleVersion = {
      version: nextRuleVersion(rule.versions),
      at: new Date().toISOString(),
      operator: user?.name ?? "监管人员",
      scope: "授权范围内适用对象",
      effective_date: filters.asOf,
      parameters: { ...rule.draft_parameters },
    };
    const published: CatalogRule = {
      ...rule,
      status: "published",
      enabled: true,
      version_id: version.version,
      published: version,
      versions: [...rule.versions, version],
    };
    const nextRules = catalog.rules.some((r) => r.id === rule.id)
      ? catalog.rules.map((r) => (r.id === rule.id ? published : r))
      : [...catalog.rules, published];
    const appended = evaluationsForPublish(published, filters.asOf);
    const prev = catalog.runtime_evaluations ?? [];
    const keep = prev.filter((e) => !appended.some((n) => n.id === e.id));
    saveCatalog(
      { ...catalog, rules: nextRules, runtime_evaluations: [...keep, ...appended] },
      "config.rules.publish",
    );
    const kind = runtimeOf(published);
    if (kind === "executable") {
      setFlash(
        `已发布「${rule.name}」${version.version}，生效日 ${version.effective_date}。新增评估 ${appended.length} 条采用该版本；历史评估、原参数与已有事项未被覆盖。`,
      );
    } else if (kind === "manual_review") {
      setFlash(
        `已发布「${rule.name}」${version.version}。按专业核查办理，不改为自动阈值判断。`,
      );
    } else {
      setFlash(
        `已记录发布版本「${rule.name}」${version.version}。该规则尚未具备运行条件，不会自动执行。`,
      );
    }
    close();
  };

  const toggle = (row: CatalogRule) => {
    if (!canEdit && !canPublish) return;
    if (row.enabled) {
      if (!window.confirm(ruleDisableImpact(row, risks).detail)) return;
    }
    persist(
      catalog.rules.map((r) =>
        r.id === row.id
          ? { ...r, enabled: !row.enabled, status: row.enabled ? "disabled" : r.published ? "published" : "draft" }
          : r,
      ),
      canPublish ? "config.rules.publish" : "config.rules.edit",
    );
    setFlash(
      row.enabled
        ? `已停用「${row.name}」。后续监测停止；未关闭事项仍可查看并办理。`
        : `已启用「${row.name}」。`,
    );
  };

  const r01 = risks.find((r) => r.id === "R01");
  const readonly = mode === "view";

  return (
    <div className="space-y-3">
      {flash && <p className="text-[13px] text-textsub">{flash}</p>}
      <Card
        title={`监测规则（${catalog.rules.length}）`}
        right={
          <Button
            variant="primary"
            disabled={!canEdit}
            title={denyTitle(canEdit, "新增规则")}
            onClick={() =>
              openForm(blankRule(nextRuleId("FA", catalog.rules), catalog.subscenarios.find((s) => s.domain === "FA")), "create")
            }
          >
            新增规则
          </Button>
        }
      >
        <div className="mb-3">
          <input
            className={`${inputClass} w-[280px]`}
            placeholder="搜索规则编号、名称或子场景"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <DataTable
          dense
          rows={filteredRules}
          rowKey={(r) => r.id}
          pageSize={10}
          compactEmpty
          columns={[
            { key: "name", title: "规则", minWidth: "200px", render: (r) => r.name },
            { key: "st", title: "状态", width: "88px", render: (r) => configStatusLabel(r.status) },
            {
              key: "run",
              title: "运行",
              width: "148px",
              render: (r) => {
                const kind = runtimeOf(r);
                return (
                  <Tag tone={kind === "executable" ? "green" : kind === "manual_review" ? "amber" : "neutral"}>
                    {RULE_RUNTIME_LABEL[kind]}
                  </Tag>
                );
              },
            },
            { key: "ver", title: "已发布版本", width: "100px", render: (r) => r.published?.version ?? "未发布" },
            { key: "en", title: "启用", width: "64px", render: (r) => (r.enabled ? "是" : "否") },
            {
              key: "act",
              title: "操作",
              width: "268px",
              minWidth: "268px",
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
                  <Button size="sm" onClick={() => setVersionsOf(r)}>
                    版本
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canEdit && !canPublish}
                    title={denyTitle(canEdit || canPublish, r.enabled ? "停用" : "启用")}
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
          title={mode === "create" ? "新增规则" : mode === "view" ? `查看 ${draft.name}` : `编辑 ${draft.name}`}
          width="640px"
          footer={
            mode === "view" ? (
              <div className="flex gap-2">
                <Button onClick={close}>关闭</Button>
                <Button onClick={() => setVersionsOf(draft)}>查看版本</Button>
              </div>
            ) : (
              <SaveBar
                onSave={saveDraft}
                onCancel={close}
                saveLabel="保存草稿"
                disabled={!canEdit}
                extra={
                  <>
                    {runtimeOf(draft) === "executable" || isFpTrial ? (
                      <Button disabled={!canEdit} onClick={() => setTrialOpen(true)}>
                        试算
                      </Button>
                    ) : null}
                    <Button
                      variant="primary"
                      disabled={!canPublish}
                      title={denyTitle(canPublish, "发布")}
                      onClick={() => publish(draft)}
                    >
                      发布
                    </Button>
                  </>
                }
              />
            )
          }
        >
          <Field label="规则名称" required error={errors.name}>
            <input
              className={fieldClass(errors.name)}
              value={draft.name}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="适用监管子场景" required error={errors.primary_subscenario_id}>
            <select
              className={fieldClass(errors.primary_subscenario_id)}
              value={draft.primary_subscenario_id}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, primary_subscenario_id: e.target.value })}
            >
              <option value="">请选择</option>
              {catalog.subscenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="条件说明">
            <input
              className={fieldClass()}
              value={draft.condition_description}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, condition_description: e.target.value })}
            />
          </Field>
          {fpSubId === "CASH2-S039" ? (
            <Field
              label="付款差额容差（万元）"
              hint="草稿参数，试算与发布后新评估使用。历史评估保持原参数。"
            >
              <input
                className={fieldClass() + " w-28"}
                type="number"
                disabled={readonly}
                value={draft.draft_parameters.amount_tolerance_wan ?? 0}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    draft_parameters: {
                      ...draft.draft_parameters,
                      amount_tolerance_wan: e.target.value === "" ? 0 : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          ) : (
            <Field
              label="偏差率阈值（%）"
              hint={
                runtimeOf(draft) === "executable"
                  ? "草稿参数，试算用；发布后才进入后续评估"
                  : "定义项。当前规则不会按该阈值自动执行。"
              }
              error={errors.deviation_gt_pct}
            >
              <input
                className={fieldClass(errors.deviation_gt_pct) + " w-28"}
                type="number"
                disabled={readonly}
                value={draft.draft_parameters.deviation_gt_pct ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    draft_parameters: {
                      ...draft.draft_parameters,
                      deviation_gt_pct: e.target.value === "" ? "" : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          )}
          <p className="text-[12px] text-textsub">
            {RULE_RUNTIME_LABEL[runtimeOf(draft)]}
            {runtimeOf(draft) === "definition_only"
              ? "：可维护定义与发布版本，当前不会自动执行。"
              : runtimeOf(draft) === "manual_review"
                ? "：按既定人工核查办理。"
                : "。"}
            已发布版本 {draft.published?.version ?? "无"}。
            {r01 ? ` R01 当前状态「${statusLabel[r01.status as keyof typeof statusLabel] ?? r01.status}」，不因新版本关闭。` : ""}
          </p>
        </FormDrawer>
      )}

      <Modal open={trialOpen} onClose={() => setTrialOpen(false)} title="试算（草稿参数）" width={720}>
        {!canBusiness && (
          <Notice tone="neutral">当前身份无业务数据权限，试算只使用独立测试样本，不读取总部或单位项目金额。</Notice>
        )}
        <DataTable
          dense
          rows={trials}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", title: isFpTrial ? "对象" : "项目", render: (r) => r.name },
            {
              key: "pct",
              title: isFpTrial ? "试算说明" : "偏差率",
              align: isFpTrial ? "left" : "right",
              render: (r) => (isFpTrial ? <span className="text-[12px] text-textsub">{r.formula}</span> : <span className="num">{fmtPct(r.pct ?? 0)}</span>),
            },
            {
              key: "hit",
              title: "试算结果",
              render: (r) =>
                r.result === "hit" ? (
                  <Tag tone="red">命中</Tag>
                ) : r.result === "clear" ? (
                  <Tag tone="green">未命中</Tag>
                ) : r.result === "not_applicable" ? (
                  <Tag tone="neutral">不适用</Tag>
                ) : (
                  <Tag tone="amber">缺数</Tag>
                ),
            },
          ]}
        />
        <p className="text-[12px] text-textsub mt-2">试算不写回历史评估，也不改变未发布规则的业务运行结果。</p>
      </Modal>

      <Modal
        open={Boolean(versionsOf)}
        onClose={() => setVersionsOf(null)}
        title={versionsOf ? `版本记录 · ${versionsOf.name}` : "版本记录"}
        width={760}
      >
        <DataTable
          dense
          rows={versionsOf?.versions ?? []}
          rowKey={(r, i) => `${r.version}-${i}`}
          empty="尚无发布版本"
          columns={[
            { key: "v", title: "版本", width: "80px", render: (r) => r.version },
            { key: "eff", title: "生效日期", width: "110px", render: (r) => <span className="num">{r.effective_date}</span> },
            { key: "scope", title: "适用范围", render: (r) => r.scope },
            {
              key: "p",
              title: "参数",
              render: (r) =>
                Object.entries(r.parameters)
                  .map(([k, v]) => `${k}=${v}`)
                  .join("，") || "—",
            },
            { key: "op", title: "发布人", width: "100px", render: (r) => r.operator },
          ]}
        />
        <p className="text-[13px] text-textmain mt-4 mb-2">采用各版本的评估（含发布后追加，不覆盖历史）</p>
        <DataTable
          dense
          rows={allRuleEvaluations().filter((e) => e.rule_id === versionsOf?.id)}
          rowKey={(r) => r.id}
          empty="尚无评估记录"
          columns={[
            { key: "id", title: "评估ID", width: "220px", render: (r) => <span className="num">{r.id}</span> },
            { key: "v", title: "版本", width: "100px", render: (r) => r.rule_version },
            { key: "obj", title: "对象", render: (r) => r.subject_object_id },
            { key: "res", title: "结果", width: "80px", render: (r) => (r.result === "hit" ? "命中" : "未命中") },
            { key: "f", title: "公式", render: (r) => <span className="text-[12px] text-textsub">{r.formula}</span> },
          ]}
        />
      </Modal>
    </div>
  );
}
