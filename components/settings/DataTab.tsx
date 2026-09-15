"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, DataTable, Field, Modal, Notice, Tag, textareaClass } from "@/components/ui";
import {
  validateDataSource,
  type CatalogDataSource,
  type FieldErrors,
} from "@/lib/config-catalog";
import { useDemoStore } from "@/lib/store";
import { ActionCell, FormDrawer, SaveBar, denyTitle, fieldClass } from "./shared";

const SAMPLE_ROWS = [
  { row: 2, objectId: "FA-P001", period: "2026-06", value: "51", unit: "%", basis: "DEMO-PLAN-V1.2", valid: true, error: "" },
  { row: 3, objectId: "FA-P003", period: "2026-06", value: "72", unit: "%", basis: "DEMO-PLAN-V1.2", valid: true, error: "" },
  { row: 4, objectId: "FA-P999", period: "2026-06", value: "40", unit: "%", basis: "DEMO-PLAN-V1.2", valid: false, error: "对象ID不存在于当前演示数据" },
  { row: 5, objectId: "FA-P002", period: "2026-06", value: "0.8", unit: "比例", valid: false, basis: "", error: "单位不一致：期望百分比；缺少计划版本依据" },
];

export default function DataTab() {
  const { catalog, saveCatalog, canAct, imports, addImportBatch, resetBusiness, resetConfig, filters } = useDemoStore();
  const canRead = canAct("config.data.read");
  const canSaveSource = canAct("config.data.validate") || canAct("config.import");
  const canImport = canAct("config.import") || canAct("config.data.validate");
  const canResetBusiness = canAct("config.reset") || canAct("config.data.rerun");
  const canResetConfig = canAct("config.reset");
  const [draft, setDraft] = useState<CatalogDataSource | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [note, setNote] = useState("演示进度补录批次");

  const validCount = useMemo(() => SAMPLE_ROWS.filter((r) => r.valid).length, []);
  const errorCount = SAMPLE_ROWS.length - validCount;

  if (!canRead) {
    return <Notice tone="amber">当前身份不能打开数据与运行。</Notice>;
  }

  const close = () => {
    setDraft(null);
    setMode(null);
    setErrors({});
  };

  const save = () => {
    if (!draft || !canSaveSource) return;
    const errs = validateDataSource(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    saveCatalog(
      { ...catalog, dataSources: catalog.dataSources.map((d) => (d.id === draft.id ? draft : d)) },
      canSaveSource ? "config.data.validate" : "config.data.read",
    );
    setFlash(`已保存数据源「${draft.content}」。连接状态仍为「${draft.connection_state}」，保存配置不代表接口已经连通。`);
    close();
  };

  const runImport = () => {
    if (!canImport) return;
    addImportBatch({
      template: "progress",
      validRows: validCount,
      errorRows: errorCount,
      note,
    });
    setImportOpen(false);
    setFlash(`已记录导入批次：有效 ${validCount} 行，校验失败 ${errorCount} 行。未接入数据源不会因此变为已连通。`);
  };

  const readonly = mode === "view" || !canSaveSource;

  return (
    <div className="space-y-3">
      {flash && <p className="text-[13px] text-textsub">{flash}</p>}
      <Card
        title="数据源配置"
        right={
          <Button disabled={!canImport} title={denyTitle(canImport, "导入与校验")} onClick={() => setImportOpen(true)}>
            导入与校验
          </Button>
        }
      >
        <DataTable
          dense
          rows={catalog.dataSources}
          rowKey={(r) => r.id}
          pageSize={8}
          compactEmpty
          columns={[
            { key: "content", title: "数据内容", minWidth: "180px", render: (r) => r.content },
            { key: "source", title: "拟来源", render: (r) => r.source },
            {
              key: "st",
              title: "连接状态",
              width: "140px",
              render: (r) => <Tag tone={r.connection_state.includes("未接入") ? "amber" : "neutral"}>{r.connection_state}</Tag>,
            },
            {
              key: "act",
              title: "操作",
              width: "150px",
              minWidth: "150px",
              nowrap: true,
              sticky: "right",
              render: (r) => (
                <ActionCell>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDraft({ ...r });
                      setMode("view");
                    }}
                  >
                    查看
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canSaveSource}
                    title={denyTitle(canSaveSource, "编辑")}
                    onClick={() => {
                      setDraft({ ...r });
                      setMode("edit");
                    }}
                  >
                    编辑
                  </Button>
                </ActionCell>
              ),
            },
          ]}
        />
      </Card>

      <Card title="导入批次记录">
        <DataTable
          dense
          rows={imports}
          rowKey={(r) => r.id}
          empty="尚无导入批次"
          columns={[
            { key: "id", title: "批次", width: "140px", render: (r) => <span className="num text-[12px]">{r.id}</span> },
            { key: "tpl", title: "模板", width: "90px", render: (r) => r.template },
            { key: "ok", title: "有效行", width: "72px", align: "right", render: (r) => r.validRows },
            { key: "err", title: "失败行", width: "72px", align: "right", render: (r) => r.errorRows },
            { key: "at", title: "办理生效日", width: "110px", render: (r) => <span className="num">{r.effective_date}</span> },
            { key: "note", title: "说明", render: (r) => r.note },
          ]}
        />
      </Card>

      <Card title="重置范围">
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canResetBusiness}
            title={denyTitle(canResetBusiness, "重置业务办理状态")}
            onClick={() => {
              if (
                window.confirm(
                  "业务重置将清除本地核查、整改、复核、采用材料与导入批次，恢复种子业务办理状态。用户权限、规则草稿与试算参数保留。确认？",
                )
              ) {
                resetBusiness();
                setFlash("已重置业务办理状态。配置保留。");
              }
            }}
          >
            重置业务办理状态
          </Button>
          <Button
            disabled={!canResetConfig}
            variant="danger"
            title={denyTitle(canResetConfig, "重置配置")}
            onClick={() => {
              if (window.confirm("配置重置将恢复本包初始用户、场景、规则、指标、AI 与数据源配置，不影响业务办理记录。确认？")) {
                resetConfig();
                setFlash("已重置配置。");
              }
            }}
          >
            重置配置
          </Button>
        </div>
      </Card>

      {draft && mode && (
        <FormDrawer
          open
          onClose={close}
          title={mode === "view" ? "查看数据源" : "编辑数据源"}
          footer={
            mode === "view" ? (
              <Button onClick={close}>关闭</Button>
            ) : (
              <SaveBar onSave={save} onCancel={close} disabled={!canSaveSource} />
            )
          }
        >
          <Field label="数据内容" required error={errors.content}>
            <input
              className={fieldClass(errors.content)}
              value={draft.content}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
          </Field>
          <Field label="拟来源系统" required error={errors.source}>
            <input
              className={fieldClass(errors.source)}
              value={draft.source}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            />
          </Field>
          <Field label="未接入时的兜底">
            <textarea
              className={textareaClass}
              value={draft.fallback}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, fallback: e.target.value })}
            />
          </Field>
          <Field label="连接状态">
            <input className={fieldClass()} value={draft.connection_state} disabled />
          </Field>
          <Field label="备注">
            <textarea
              className={textareaClass}
              value={draft.notes}
              disabled={readonly}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </Field>
          <p className="text-[12px] text-textsub">连接状态只读。保存拟来源或兜底说明不会把未接入接口标记为已连通。</p>
        </FormDrawer>
      )}

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="导入与校验" width={840} footer={
        <div className="flex gap-2">
          <Button variant="primary" disabled={!canImport} onClick={runImport}>
            记录本批次
          </Button>
          <Button onClick={() => setImportOpen(false)}>取消</Button>
        </div>
      }>
        <Field label="批次说明">
          <input className={fieldClass()} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-[12px] text-textsub mb-2">截至日 {filters.asOf}。下列为校验预览，失败行不会写入业务事实。</p>
        <DataTable
          dense
          rows={SAMPLE_ROWS}
          rowKey={(r) => String(r.row)}
          columns={[
            { key: "row", title: "行", width: "48px", render: (r) => r.row },
            { key: "obj", title: "对象", width: "90px", render: (r) => r.objectId },
            { key: "val", title: "值", render: (r) => `${r.value} ${r.unit}` },
            {
              key: "st",
              title: "校验",
              render: (r) => (r.valid ? <Tag tone="green">通过</Tag> : <Tag tone="red">失败</Tag>),
            },
            { key: "err", title: "说明", render: (r) => r.error || r.basis },
          ]}
        />
      </Modal>
    </div>
  );
}
