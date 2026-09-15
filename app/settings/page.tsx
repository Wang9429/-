"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useState } from "react";
import { Button, Card, DataTable, Field, Notice, Tag, Tabs, inputClass } from "@/components/ui";
import { config, coverageById, type ConfigUser } from "@/lib/config";
import { useDemoStore } from "@/lib/store";
import { INDICATORS, computeIndicator } from "@/lib/metrics";
import { orgScope, orgName } from "@/lib/org";
import { seed } from "@/lib/seed";
import { fmtPct } from "@/lib/format";
import type { RiskCase } from "@/lib/types";

function SettingsBody() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "users";
  const setTab = (id: string) => router.replace(`/settings?tab=${id}`);
  const {
    user,
    canAct,
    configUsers,
    saveConfigUsers,
    eacTrialPct,
    setEacTrialPct,
    publishedTrial,
    publishTrial,
    resetBusiness,
    resetConfig,
    filters,
    risks,
  } = useDemoStore();

  const canUsers = canAct("config.users.read") || canAct("config.users.edit");
  const canConfig = canAct("config.scenarios.read") || canAct("config.rules.read") || canAct("config.indicators.read") || canAct("config.ai.read") || canAct("config.data.read");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[24px] font-semibold leading-[34px]">系统配置</h1>
        <p className="text-[13px] text-textsub mt-1 max-w-4xl leading-5">
          用于确认谁维护用户权限、监管子场景、监测规则、指标、AI 与数据运行，以及草稿、试算、发布如何生效。账号密码和真实密钥不在本原型配置。
        </p>
      </div>
      <Tabs
        tabs={config.settings.tabs.map((t) => ({ id: t.id, label: t.label }))}
        value={tab}
        onChange={setTab}
      />
      {tab === "users" && (
        <UsersTab users={configUsers} onSave={saveConfigUsers} canEdit={canAct("config.users.edit")} visible={canUsers} />
      )}
      {tab === "scenarios" && <ScenariosTab />}
      {tab === "rules" && (
        <RulesTab
          eacTrialPct={eacTrialPct}
          setEacTrialPct={setEacTrialPct}
          publishedTrial={publishedTrial}
          publishTrial={publishTrial}
          risks={risks}
        />
      )}
      {tab === "indicators" && <IndicatorsTab filters={filters} risks={risks} />}
      {tab === "ai" && <AiTab />}
      {tab === "data" && (
        <DataTab
          resetBusiness={resetBusiness}
          resetConfig={resetConfig}
          canReset={canAct("config.reset") || canAct("config.data.read")}
        />
      )}
      {!canConfig && tab !== "users" && (
        <Notice tone="amber">当前身份对部分配置页只读或不可维护。配置管理员与总部监管人员权限不同。</Notice>
      )}
      <p className="text-[12px] text-textsub">当前用户：{user?.name ?? "—"}。前端权限用于验证产品行为，不等于后端鉴权。</p>
    </div>
  );
}

function UsersTab({
  users,
  onSave,
  canEdit,
  visible,
}: {
  users: ConfigUser[];
  onSave: (u: ConfigUser[]) => void;
  canEdit: boolean;
  visible: boolean;
}) {
  const [id, setId] = useState(users[0]?.id ?? "");
  const current = users.find((u) => u.id === id);
  const [note, setNote] = useState<string | null>(null);
  if (!visible) return <Notice tone="amber">当前身份不能打开用户与权限。</Notice>;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
      <Card title="用户">
        <ul className="space-y-1">
          {users.map((u) => (
            <li key={u.id}>
              <button
                className={`w-full text-left px-2 py-2 rounded-[6px] text-[13px] ${u.id === id ? "bg-tint text-brand" : "hover:bg-tint"}`}
                onClick={() => setId(u.id)}
              >
                {u.name}
                <div className="text-[12px] text-textsub">{u.role_ids.join("、")}</div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {current && (
        <Card title={current.name} subtitle="组织范围、动作权限与本级/含下级。保存后刷新仍保留。">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>所属组织：{orgName(current.org_id)}</div>
            <div>数据范围：{current.data_scope.mode}</div>
            <div>授权组织：{current.data_scope.root_org_ids.map(orgName).join("、") || "无"}</div>
            <div>对象清单：{current.data_scope.object_ids.join("、") || "组织范围内全部"}</div>
          </div>
          <Field label="授权组织（逗号分隔）" className="mt-3">
            <input
              className={inputClass}
              defaultValue={current.data_scope.root_org_ids.join(",")}
              disabled={!canEdit}
              onBlur={(e) => {
                if (!canEdit) return;
                const roots = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                if (roots.includes("ORG-HQ") && current.id === "USER-CONFIG") {
                  setNote("拒绝：配置管理员不能通过修改本人范围间接获得全业务数据。");
                  return;
                }
                onSave(users.map((u) => (u.id === current.id ? { ...u, data_scope: { ...u.data_scope, root_org_ids: roots } } : u)));
                setNote("已保存。切换到该用户后，组织树、指标、事项与导出同步按新范围过滤。");
              }}
            />
          </Field>
          {note && <Notice tone="neutral">{note}</Notice>}
        </Card>
      )}
    </div>
  );
}

function ScenariosTab() {
  const groups = config.scenario_groups;
  const subs = config.subscenarios;
  const [gid, setGid] = useState(groups[0]?.id ?? "");
  const children = subs.filter((s) => s.parent_id === gid || s.group_id === gid || (!s.parent_id && !s.group_id && s.domain === groups.find((g) => g.id === gid)?.domain));
  return (
    <div className="space-y-3">
      <Notice tone="neutral" title="监管子场景是最小业务分类">
        一级监管场景下可挂多个子场景；一个子场景可关联多条规则，指标可跨子场景复用。不为规则再建子子场景。停用保留历史，不物理删除。
      </Notice>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={`一级监管场景（${groups.length}）`}>
          <DataTable
            dense
            rows={groups}
            rowKey={(r) => r.id}
            onRowClick={(r) => setGid(r.id)}
            highlight={(r) => r.id === gid}
            columns={[
              { key: "name", title: "名称", render: (r) => r.name },
              { key: "domain", title: "领域", width: "70px", render: (r) => r.domain },
              { key: "st", title: "状态", width: "80px", render: (r) => <Tag tone="green">{r.status}</Tag> },
            ]}
          />
        </Card>
        <Card title="监管子场景">
          <DataTable
            dense
            rows={children.slice(0, 40)}
            rowKey={(r) => r.id}
            columns={[
              { key: "id", title: "编号", width: "90px", render: (r) => <span className="num text-[12px]">{r.id}</span> },
              { key: "name", title: "名称", render: (r) => r.name },
              { key: "mode", title: "执行方式", width: "120px", render: (r) => r.execution_mode ?? "—" },
            ]}
          />
          <p className="text-[12px] text-textsub mt-2">目录共 {subs.length} 项。本表按所选一级场景筛选，不等于已运行监测数量。</p>
        </Card>
      </div>
    </div>
  );
}

function RulesTab({
  eacTrialPct,
  setEacTrialPct,
  publishedTrial,
  publishTrial,
  risks,
}: {
  eacTrialPct: number;
  setEacTrialPct: (n: number) => void;
  publishedTrial: boolean;
  publishTrial: () => void;
  risks: { id: string; status: string }[];
}) {
  const ex = config.rule_editor.new_rule_example;
  const fa = seed.fixed_asset_projects.filter((p) => p.eac != null);
  const trials = fa.map((p) => {
    const pct = ((p.eac! - p.effective_approved_budget) / p.effective_approved_budget) * 100;
    return { id: p.id, name: p.name, pct, hit: pct > eacTrialPct };
  });
  const r01 = risks.find((r) => r.id === "R01");
  return (
    <div className="space-y-3">
      <Card title={ex.name} subtitle="独立草稿。试算不改变历史事项，发布前不进入首页统计。">
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="偏差率阈值（%）">
            <input
              className={inputClass + " w-28"}
              type="number"
              value={eacTrialPct}
              onChange={(e) => setEacTrialPct(Number(e.target.value))}
            />
          </Field>
          <Tag tone="neutral">草稿 · 未默认运行</Tag>
          {publishedTrial && <Tag tone="amber">已发布该草稿版本（历史 R01 仍按原阈值）</Tag>}
        </div>
        <DataTable
          className="mt-3"
          dense
          rows={trials}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", title: "项目", render: (r) => r.name },
            { key: "pct", title: "偏差率", align: "right", render: (r) => <span className="num">{fmtPct(r.pct)}</span> },
            { key: "hit", title: "试算结果", render: (r) => (r.hit ? <Tag tone="red">命中</Tag> : <Tag tone="green">未命中</Tag>) },
          ]}
        />
        <p className="text-[13px] text-textsub mt-2">
          阈值 10% 时基地能力提升项目 18% 命中、设施技术改造项目 −10% 不命中；改为 25% 两者都不命中。R01 当前状态仍为「{r01?.status ?? "—"}」，不因草稿消失。
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={publishTrial}>
            发布草稿（不覆盖历史评估）
          </Button>
        </div>
      </Card>
      <Card title={`已发布监测规则（${config.rule_definitions.length}）`}>
        <DataTable
          dense
          rows={config.rule_definitions.slice(0, 20)}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", title: "规则", render: (r) => r.name },
            { key: "st", title: "状态", width: "90px", render: (r) => r.status },
            { key: "en", title: "启用", width: "70px", render: (r) => (r.enabled ? "是" : "否") },
            { key: "desc", title: "条件说明", render: (r) => r.condition_description ?? "—" },
          ]}
        />
      </Card>
    </div>
  );
}

function IndicatorsTab({
  filters,
  risks,
}: {
  filters: { periodStart: string; periodEnd: string; asOf: string };
  risks: RiskCase[];
}) {
  const ctx = { periodStart: filters.periodStart, periodEnd: filters.periodEnd, asOf: filters.asOf, risks };
  const hq = orgScope("ORG-HQ", true);
  const trial = INDICATORS.filter((i) => i.id === "FA-I06" || i.id === "FA-I07").map((def) => {
    const m = computeIndicator(def, hq, ctx);
    return { id: def.id, name: def.name, value: m.value, formula: def.formula };
  });
  return (
    <div className="space-y-3">
      <Card title="指标试算（已有计算器）" subtitle="公式属于指标定义；阈值属于规则，不混在一条公式里。">
        <DataTable
          dense
          rows={trial}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", title: "指标", render: (r) => r.name },
            { key: "formula", title: "计算公式", render: (r) => r.formula },
            { key: "v", title: "总部试算", align: "right", render: (r) => <span className="num">{r.value === null ? "—" : fmtPct(r.value)}</span> },
          ]}
        />
      </Card>
      <Card title={`指标目录（${config.indicator_definitions.length}）`} subtitle="38 项原指标均可查定义；首页只展示已具备可靠输入的重点指标。">
        <DataTable
          dense
          rows={config.indicator_definitions}
          rowKey={(r) => r.id}
          columns={[
            { key: "id", title: "编号", width: "90px", render: (r) => <span className="num text-[12px]">{r.id}</span> },
            { key: "name", title: "名称", render: (r) => r.name },
            { key: "st", title: "配置状态", width: "90px", render: (r) => r.status },
            { key: "pos", title: "显示位置", width: "110px", render: (r) => r.display_position ?? "—" },
          ]}
        />
      </Card>
    </div>
  );
}

function AiTab() {
  return (
    <Card title="AI分析设置">
      <div className="space-y-2 text-[13px]">
        <div>连接状态：<Tag tone="amber">未连接模型服务</Tag></div>
        <div>模式：{config.ai.mode_display}</div>
        <div>预设任务：{config.ai.tasks.map((t) => t.name).join("、")}</div>
        <Notice tone="neutral">
          分析只能使用当前用户授权范围内的指标、对象、规则和材料。不能自动发布配置、关闭事项或认定违法违规。
        </Notice>
      </div>
    </Card>
  );
}

function DataTab({
  resetBusiness,
  resetConfig,
  canReset,
}: {
  resetBusiness: () => void;
  resetConfig: () => void;
  canReset: boolean;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const candidates = [...coverageById.values()].filter((p) => p.record_kind === "coverage_candidate").length;
  const observed = [...coverageById.values()].filter((p) => p.record_kind === "completed_observation").length;
  return (
    <div className="space-y-3">
      <Card title="数据说明">
        <p className="text-[14px] leading-6">{config.data_notice.text}</p>
      </Card>
      <Card title="覆盖与准备情况" subtitle="已完成观察按事实计数；覆盖规划候选不进入应评估分母。">
        <p className="text-[13px]">
          已完成监测关联 {observed} 条；适用性尚待确认的覆盖规划候选 {candidates} 条，下沉本页，不在业务首页渲染为“数据不足”。
        </p>
      </Card>
      <Card title="实施调研对应（待核实）" subtitle="系统名称、接口和更新频率未经科技信息部确认。">
        <ul className="text-[13px] text-textsub space-y-1.5 list-disc pl-5">
          <li>组织与用户目录：管理单位与法人如何区分，跨单位项目如何归属。</li>
          <li>投资计划执行率：计划与完成投资分别来自哪个台账，累计/发生如何区分。</li>
          <li>付款核查：有效批准、实付、业务可支付上限能否按同一合同编码对齐。</li>
          <li>外部事件与行情：已有订阅、保存权限及与运输业务是否匹配。</li>
        </ul>
      </Card>
      <Card title="重置范围">
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canReset}
            onClick={() => {
              resetBusiness();
              setMsg("已重置业务办理状态。配置保留。");
            }}
          >
            重置业务办理状态
          </Button>
          <Button
            disabled={!canReset}
            variant="danger"
            onClick={() => {
              if (window.confirm("将恢复本包初始用户、规则草稿与试算参数，不影响业务办理记录。确认？")) {
                resetConfig();
                setMsg("已重置配置。");
              }
            }}
          >
            重置配置
          </Button>
        </div>
        {msg && <p className="text-[13px] text-textsub mt-2">{msg}</p>}
      </Card>
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
