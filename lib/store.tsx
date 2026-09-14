"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AS_OF, DEFAULT_PERIOD, seed } from "./seed";
import { nextSequence } from "./risks";
import type { CaseAction, RiskCase, RiskStatus } from "./types";

/**
 * 本地演示状态：首次从种子复制，刷新保留修改，重置恢复种子。
 * 所有页面共用同一份状态，办理后各领域与总览同步（完整业需 16.5）。
 */

const STORAGE_KEY = "cnooc-supervision-demo-state-v1";

export type RoleId = "hq_leader" | "hq_domain" | "unit_head" | "operator" | "config_admin";

export const ROLES: { id: RoleId; name: string; scopeNote: string; canHandle: boolean; canVerify: boolean }[] = [
  { id: "hq_leader", name: "总部领导", scopeNote: "全公司概览、指标穿透与重大事项，只读", canHandle: false, canVerify: false },
  { id: "hq_domain", name: "总部领域管理人员", scopeNote: "本领域全部对象；可认领核查、退回与复核", canHandle: true, canVerify: true },
  { id: "unit_head", name: "所属单位负责人", scopeNote: "本单位管理范围；可安排措施与责任", canHandle: true, canVerify: false },
  { id: "operator", name: "项目/业务经办人员", scopeNote: "授权对象；可补充说明、证据与整改进展", canHandle: true, canVerify: false },
  { id: "config_admin", name: "配置管理人员", scopeNote: "演示规则配置、导入记录与演示数据重置", canHandle: false, canVerify: false },
];

export interface GlobalFilters {
  orgId: string;
  includeChildren: boolean;
  periodStart: string;
  periodEnd: string;
  asOf: string;
}

export interface UrgeRecord {
  id: string;
  riskId: string;
  actor: string;
  note: string;
  effective_date: string;
  recorded_at: string;
}

export interface ImportBatch {
  id: string;
  template: string;
  recorded_at: string;
  effective_date: string;
  validRows: number;
  errorRows: number;
  note: string;
}

interface PersistedState {
  risks: RiskCase[];
  actions: CaseAction[];
  urges: UrgeRecord[];
  imports: ImportBatch[];
  role: RoleId;
}

interface StoreValue extends PersistedState {
  filters: GlobalFilters;
  setFilters: (f: Partial<GlobalFilters>) => void;
  setRole: (r: RoleId) => void;
  saveError: string | null;
  dirty: boolean;
  resetDemo: () => void;
  act: (input: ActionInput) => void;
  addUrge: (riskId: string, note: string) => void;
  addImportBatch: (b: Omit<ImportBatch, "id" | "recorded_at" | "effective_date">) => void;
  riskById: (id: string) => RiskCase | undefined;
  actionsFor: (id: string) => CaseAction[];
}

export type ActionKind =
  | "claim"
  | "confirm_rectification"
  | "exclude"
  | "submit_rectification"
  | "pass_verification"
  | "return_verification"
  | "reopen";

export interface ActionInput {
  riskId: string;
  kind: ActionKind;
  actor: string;
  note: string;
  evidenceIds?: string[];
  measure?: string;
  responsible?: string;
  dueDate?: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

function initialState(): PersistedState {
  return {
    risks: JSON.parse(JSON.stringify(seed.risk_cases)) as RiskCase[],
    actions: JSON.parse(JSON.stringify(seed.case_actions)) as CaseAction[],
    urges: [],
    imports: [],
    role: "hq_domain",
  };
}

const ACTION_LABEL: Record<ActionKind, string> = {
  claim: "认领核查",
  confirm_rectification: "核查确认需整改",
  exclude: "核查排除",
  submit_rectification: "提交整改并申请复核",
  pass_verification: "复核通过",
  return_verification: "复核退回",
  reopen: "新证据重开",
};

function applyAction(
  risks: RiskCase[],
  actions: CaseAction[],
  input: ActionInput,
  asOf: string,
): { risks: RiskCase[]; actions: CaseAction[] } {
  const idx = risks.findIndex((r) => r.id === input.riskId);
  if (idx < 0) return { risks, actions };
  const prev = risks[idx];
  const next: RiskCase = { ...prev };
  let to: RiskStatus = prev.status;

  switch (input.kind) {
    case "claim":
      to = "investigating";
      next.assignee_display_name = input.actor;
      next.current_task_type = "investigation";
      break;
    case "confirm_rectification":
      to = "rectifying";
      next.current_task_type = "rectification";
      next.investigation_conclusion = input.note;
      next.rectification_plan = {
        measure: input.measure ?? input.note,
        responsible_display_name: input.responsible ?? input.actor,
        due_date: input.dueDate ?? null,
        progress_note: "本地演示措施执行中。",
      };
      next.current_task_due_date = input.dueDate ?? null;
      break;
    case "exclude":
      to = "excluded";
      next.exclusion_reason = input.note;
      next.close_reason = "excluded";
      next.closed_at = asOf;
      break;
    case "submit_rectification":
      to = "pending_verification";
      next.current_task_type = "verification";
      next.rectification_completion_note = input.note;
      // 待复核不自动停表：有效整改期限保持不变
      break;
    case "pass_verification":
      to = "closed";
      next.verification_result = "passed";
      next.verified_at = asOf;
      next.closed_at = asOf;
      next.verified_closed_at = asOf;
      next.close_reason = "rectified";
      break;
    case "return_verification":
      to = "rectifying";
      next.verification_result = "returned";
      next.current_task_type = "rectification";
      next.verified_at = null;
      next.closed_at = null;
      next.verified_closed_at = null;
      next.close_reason = null;
      break;
    case "reopen":
      to = "investigating";
      next.current_task_type = "investigation";
      next.closed_at = null;
      next.verified_closed_at = null;
      next.close_reason = null;
      next.verification_result = null;
      next.reopened_count = (prev.reopened_count ?? 0) + 1;
      break;
  }
  next.status = to;

  const action: CaseAction = {
    id: `ACT-LOCAL-${input.riskId}-${nextSequence(actions)}`,
    risk_id: input.riskId,
    action: input.kind,
    date: asOf,
    actor: input.actor,
    from_status: prev.status,
    to_status: to,
    note: `${ACTION_LABEL[input.kind]}：${input.note}`,
    evidence_ids: input.evidenceIds ?? [],
    effective_date: asOf,
    sequence: nextSequence(actions),
    recorded_at: new Date().toISOString(),
    recorded_at_nature: "本地演示操作实际时间，不替代业务生效日期",
    local: true,
  };

  const newRisks = [...risks];
  newRisks[idx] = next;
  return { risks: newRisks, actions: [...actions, action] };
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filters, setFiltersState] = useState<GlobalFilters>({
    orgId: "ORG-HQ",
    includeChildren: true,
    periodStart: DEFAULT_PERIOD.start,
    periodEnd: DEFAULT_PERIOD.end,
    asOf: AS_OF,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed?.risks?.length) {
          setState(parsed);
          setDirty(true);
        }
      }
    } catch {
      setSaveError("本地演示状态读取失败，已使用种子数据。");
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PersistedState) => {
    setState(next);
    setDirty(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveError(null);
    } catch {
      setSaveError("本地演示状态保存失败，本次修改仅在当前页面有效。");
    }
  }, []);

  const act = useCallback(
    (input: ActionInput) => {
      setState((cur) => {
        const res = applyAction(cur.risks, cur.actions, input, filters.asOf);
        const next = { ...cur, ...res };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          setSaveError(null);
        } catch {
          setSaveError("本地演示状态保存失败，本次修改仅在当前页面有效。");
        }
        return next;
      });
      setDirty(true);
    },
    [filters.asOf],
  );

  const addUrge = useCallback(
    (riskId: string, note: string) => {
      const rec: UrgeRecord = {
        id: `URGE-${riskId}-${Date.now()}`,
        riskId,
        actor: "演示监管人员",
        note,
        effective_date: filters.asOf,
        recorded_at: new Date().toISOString(),
      };
      setState((cur) => {
        const next = { ...cur, urges: [...cur.urges, rec] };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          setSaveError("本地演示状态保存失败。");
        }
        return next;
      });
      setDirty(true);
    },
    [filters.asOf],
  );

  const addImportBatch = useCallback(
    (b: Omit<ImportBatch, "id" | "recorded_at" | "effective_date">) => {
      const rec: ImportBatch = {
        ...b,
        id: `IMP-${Date.now()}`,
        recorded_at: new Date().toISOString(),
        effective_date: filters.asOf,
      };
      setState((cur) => {
        const next = { ...cur, imports: [...cur.imports, rec] };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          setSaveError("本地演示状态保存失败。");
        }
        return next;
      });
      setDirty(true);
    },
    [filters.asOf],
  );

  const resetDemo = useCallback(() => {
    const fresh = initialState();
    setState(fresh);
    setDirty(false);
    setSaveError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      setSaveError("本地演示状态清除失败。");
    }
    setFiltersState({
      orgId: "ORG-HQ",
      includeChildren: true,
      periodStart: DEFAULT_PERIOD.start,
      periodEnd: DEFAULT_PERIOD.end,
      asOf: AS_OF,
    });
  }, []);

  const setFilters = useCallback((f: Partial<GlobalFilters>) => {
    setFiltersState((cur) => ({ ...cur, ...f }));
  }, []);

  const setRole = useCallback(
    (r: RoleId) => {
      persist({ ...state, role: r });
    },
    [persist, state],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      filters,
      setFilters,
      setRole,
      saveError,
      dirty,
      resetDemo,
      act,
      addUrge,
      addImportBatch,
      riskById: (id: string) => state.risks.find((r) => r.id === id),
      actionsFor: (id: string) =>
        state.actions.filter((a) => a.risk_id === id).sort((a, b) => a.sequence - b.sequence),
    }),
    [state, filters, setFilters, setRole, saveError, dirty, resetDemo, act, addUrge, addImportBatch],
  );

  // 避免服务端与客户端首帧不一致
  if (!hydrated) {
    return (
      <StoreContext.Provider value={value}>
        <div style={{ visibility: "hidden" }}>{children}</div>
      </StoreContext.Provider>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDemoStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDemoStore 必须在 DemoStoreProvider 内使用");
  return ctx;
}
