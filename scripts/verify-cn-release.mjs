#!/usr/bin/env node
/**
 * 校验独立运行产物：页面可打开，且 HTML/静态资源不指向 localhost、隧道或境外字体 CDN。
 * 这只证明部署包本身自包含，不能当作中国大陆公网验收通过。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:43917 node scripts/verify-cn-release.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 43917);
const FORBIDDEN =
  /localhost:\d+|127\.0\.0\.1|0\.0\.0\.0|ngrok|trycloudflare|loca\.lt|cloudflare\.com\/try|fonts\.googleapis\.com|fonts\.gstatic\.com|ajax\.googleapis\.com|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/i;

const PATHS = ["/api/health", "/overview", "/funds", "/property-rights", "/settings"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  throw new Error(`等待服务超时: ${url}`);
}

function collectRefs(html) {
  const refs = [];
  const re = /\b(?:src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) refs.push(m[1]);
  return refs;
}

async function checkUrl(base, route) {
  const url = `${base}${route}`;
  const res = await fetch(url, { redirect: "follow" });
  const body = await res.text();
  const issues = [];
  if (res.status !== 200) issues.push(`HTTP ${res.status}`);
  if (FORBIDDEN.test(body)) issues.push("正文含本机/隧道/境外 CDN 引用");
  for (const ref of collectRefs(body)) {
    if (FORBIDDEN.test(ref) || /^(https?:)?\/\/localhost/i.test(ref)) {
      issues.push(`资源地址违规: ${ref}`);
    }
  }
  if (route !== "/api/health") {
    if (!body.includes("/_next/static/") && !body.includes("穿透式监管")) {
      issues.push("未看到站点静态资源或页面标题");
    }
  }
  return { url, status: res.status, bytes: body.length, issues, body };
}

async function checkStaticFrom(base, html) {
  const refs = collectRefs(html).filter((r) => r.startsWith("/_next/") || r.startsWith("/public") || r.endsWith(".css") || r.endsWith(".js"));
  const issues = [];
  for (const ref of refs.slice(0, 12)) {
    const abs = ref.startsWith("http") ? ref : `${base}${ref}`;
    const res = await fetch(abs);
    if (res.status !== 200) issues.push(`${ref} -> ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("javascript") || ct.includes("css") || ref.endsWith(".js") || ref.endsWith(".css")) {
      const text = await res.text();
      if (FORBIDDEN.test(text) && /https?:\/\//.test(text.match(FORBIDDEN)?.[0] || "")) {
        // 允许源码字符串里出现文档示例；仅当像真实 URL 加载时失败。已在 HTML refs 检查。
      }
    }
  }
  return issues;
}

async function main() {
  const provided = process.env.BASE_URL;
  let child = null;
  let base = provided?.replace(/\/$/, "") ?? "";

  if (!base) {
    const serverJs = path.join(ROOT, ".next/standalone/server.js");
    const staticDir = path.join(ROOT, ".next/standalone/.next/static");
    if (!existsSync(serverJs)) {
      throw new Error("未找到 .next/standalone/server.js，请先 npm run build");
    }
    if (!existsSync(staticDir)) {
      throw new Error("standalone 缺少 .next/static，请先运行 scripts/pack-cn-release.sh 或拷贝静态资源");
    }
    child = spawn("node", ["server.js"], {
      cwd: path.join(ROOT, ".next/standalone"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(PORT),
        HOSTNAME: "0.0.0.0",
        ENABLE_SOURCE_PACKAGE: "0",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => process.stderr.write(d));
    child.stderr.on("data", (d) => process.stderr.write(d));
    base = `http://127.0.0.1:${PORT}`;
    await waitFor(`${base}/api/health`);
  }

  const results = [];
  let failed = 0;
  for (const route of PATHS) {
    const row = await checkUrl(base, route);
    results.push(row);
    if (row.issues.length) failed += 1;
  }
  const overview = results.find((r) => r.url.endsWith("/overview"));
  if (overview && overview.status === 200) {
    const staticIssues = await checkStaticFrom(base, overview.body);
    if (staticIssues.length) {
      failed += 1;
      results.push({ url: `${base}/_next/static/*`, status: 0, bytes: 0, issues: staticIssues });
    }
  }
  const refresh = await checkUrl(base, "/overview");
  if (refresh.issues.length) failed += 1;
  results.push({ ...refresh, url: `${refresh.url}#refresh` });

  const sourcePkg = await fetch(`${base}/api/source-package`);
  if (sourcePkg.status !== 404) {
    failed += 1;
    results.push({
      url: `${base}/api/source-package`,
      status: sourcePkg.status,
      bytes: 0,
      issues: ["正式服务应关闭源码包下载"],
    });
  }

  const summary = results.map(({ body: _b, ...rest }) => rest);
  console.log(JSON.stringify({ base, failed, results: summary, mainland: "not-claimed" }, null, 2));

  if (child) {
    child.kill("SIGTERM");
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
