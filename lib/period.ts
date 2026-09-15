import { AS_OF, DEFAULT_PERIOD } from "./seed";

/**
 * 期间与截至日口径。快照事实绑定 2026 上半年 / 截至 2026-06-30；
 * 缺期间事实时返回未覆盖，不把缺数据当 0。
 */

export type FactCaliber = "period_snapshot" | "ytd" | "balance" | "dated";

export const SNAPSHOT_PERIOD = {
  start: DEFAULT_PERIOD.start,
  end: DEFAULT_PERIOD.end,
  asOf: AS_OF,
} as const;

export function inDateRange(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

export function periodFact(
  ctx: { periodStart: string; periodEnd: string; asOf: string },
  caliber: FactCaliber,
): { ok: boolean; label: string; reason?: string } {
  if (caliber === "dated") {
    return { ok: true, label: `期间发生额（${ctx.periodStart}～${ctx.periodEnd}）` };
  }
  if (caliber === "balance") {
    if (ctx.asOf !== SNAPSHOT_PERIOD.asOf) {
      return { ok: false, label: `余额/存量（截至 ${ctx.asOf}）`, reason: "该截至日数据未覆盖" };
    }
    return { ok: true, label: `余额/存量（截至 ${ctx.asOf}）` };
  }
  if (caliber === "ytd") {
    if (ctx.asOf !== SNAPSHOT_PERIOD.asOf || !ctx.periodEnd.startsWith("2026")) {
      return { ok: false, label: "年度累计", reason: "该期间数据未覆盖" };
    }
    return { ok: true, label: `年度累计（2026-01-01～${ctx.asOf}）` };
  }
  const match =
    ctx.periodStart === SNAPSHOT_PERIOD.start && ctx.periodEnd === SNAPSHOT_PERIOD.end;
  if (!match) {
    return {
      ok: false,
      label: `期间发生额（${ctx.periodStart}～${ctx.periodEnd}）`,
      reason: "该期间数据未覆盖",
    };
  }
  return { ok: true, label: `期间发生额（${ctx.periodStart}～${ctx.periodEnd}）` };
}

/** 使用 2026 上半年快照字段的指标：换期间后不得继续用 84%/80% 等数。 */
export const INDICATOR_CALIBER: Record<string, FactCaliber> = {
  "FA-I06": "period_snapshot",
  "FA-I07": "balance",
  "FA-I21": "period_snapshot",
  "FA-CNT-PROJECT": "balance",
  "FA-CNT-OVERBUDGET": "balance",
  "FA-CNT-WATCH-HIT": "balance",
  "EQ-BALANCE": "balance",
  "EQ-I11": "ytd",
  "EQ-I15": "period_snapshot",
  "EQ-CASH-DEVIATION": "period_snapshot",
  "EQ-X01-RATE": "balance",
  "EQ-X02-RATE": "balance",
  "ENG-CNT": "balance",
  "ENG-REVENUE": "balance",
  "ENG-I01": "balance",
  "ENG-I06": "balance",
  "CASH-I01": "balance",
  "CASH-I02": "balance",
  "CASH-I07": "balance",
  "CASH-I04": "balance",
  "CASH-I06": "dated",
  "INTL-CNT": "balance",
  "INTL-EXPOSURE": "balance",
  "INTL-AFFECTED": "balance",
  "RIGHTS-ENTITIES": "balance",
  "RIGHTS-DIFF": "balance",
  "RIGHTS-MATTERS": "balance",
};
