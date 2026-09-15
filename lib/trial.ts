/**
 * 配置试算使用的独立测试输入。无业务数据权限时不得读取总部项目金额。
 */

export interface TrialProject {
  id: string;
  name: string;
  effective_approved_budget: number;
  eac: number;
  source: "business" | "test";
}

export const INDEPENDENT_TRIAL_PROJECTS: TrialProject[] = [
  {
    id: "TEST-EAC-01",
    name: "试算样本甲（独立测试输入）",
    effective_approved_budget: 10000,
    eac: 11800,
    source: "test",
  },
  {
    id: "TEST-EAC-02",
    name: "试算样本乙（独立测试输入）",
    effective_approved_budget: 5000,
    eac: 4500,
    source: "test",
  },
];
