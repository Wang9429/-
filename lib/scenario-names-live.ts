/** 运行时场景名称覆盖。独立模块，避免 seed 与 live-config 循环初始化。 */

const names = new Map<string, string>();

export function setLiveScenarioNames(next: Map<string, string> | Iterable<[string, string]>): void {
  names.clear();
  const entries = next instanceof Map ? next.entries() : next;
  for (const [id, name] of entries) names.set(id, name);
}

export function liveScenarioName(id: string): string | undefined {
  return names.get(id);
}
