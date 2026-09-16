/** CASH2-S039 货币精度容差：单位万元，不是业务差额阈值。 */
export const CASH_S039_TOLERANCE_UNIT = "万元";
/** 0.01 万元 = 100 元，超出即视为不合理测试/业务阈值，按上限执行。 */
export const CASH_S039_TOLERANCE_MAX_WAN = 0.01;
export const CASH_S039_TOLERANCE_MAX_YUAN = 100;
export const CASH_S039_TOLERANCE_DEFAULT = 0;

export function resolveCashS039ToleranceWan(raw: unknown): {
  applied: number;
  input: number;
  clamped: boolean;
  unit: typeof CASH_S039_TOLERANCE_UNIT;
} {
  const input = Number(raw ?? CASH_S039_TOLERANCE_DEFAULT);
  if (!Number.isFinite(input) || input < 0) {
    return {
      applied: CASH_S039_TOLERANCE_DEFAULT,
      input: Number.isFinite(input) ? input : 0,
      clamped: true,
      unit: CASH_S039_TOLERANCE_UNIT,
    };
  }
  if (input > CASH_S039_TOLERANCE_MAX_WAN) {
    return { applied: CASH_S039_TOLERANCE_MAX_WAN, input, clamped: true, unit: CASH_S039_TOLERANCE_UNIT };
  }
  return { applied: input, input, clamped: false, unit: CASH_S039_TOLERANCE_UNIT };
}

export function cashS039ParamsForPublish(
  params: Record<string, string | number>,
): Record<string, string | number> {
  const t = resolveCashS039ToleranceWan(params.amount_tolerance_wan);
  return {
    ...params,
    amount_tolerance_wan: t.applied,
    amount_tolerance_unit: CASH_S039_TOLERANCE_UNIT,
  };
}
