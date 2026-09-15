/** 导出当前筛选后的明细与口径说明（完整业需 3.3 / AC35 / AC63）。 */

export interface ExportMeta {
  title: string;
  scopeLines: string[];
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  meta: ExportMeta,
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines: string[] = [];
  lines.push(esc(meta.title));
  meta.scopeLines.forEach((l) => lines.push(esc(l)));
  lines.push(esc("数据性质：合成样例，用于功能验证，不代表海油工程真实经营数据"));
  lines.push("");
  lines.push(headers.map(esc).join(","));
  rows.forEach((r) => lines.push(r.map(esc).join(",")));
  const blob = new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
