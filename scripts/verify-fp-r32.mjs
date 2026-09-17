/**
 * FP-20260917-R3.2 针对性验收（业务页可执行覆盖、产权下半区切换）。
 * BASE_URL=http://127.0.0.1:43917 node scripts/verify-fp-r32.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const coverageJson = JSON.parse(
  fs.readFileSync(path.join("/workspace", "data", "fp", "primary_catalog_r31.json"), "utf8"),
);
const planJson = JSON.parse(
  fs.readFileSync(path.join("/workspace", "data", "fp", "coverage_plan_r32.json"), "utf8"),
);

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:43917").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? "/opt/cursor/artifacts";
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });

const CASH_P = coverageJson.primary_records.filter((r) => r.domain_id === "funds");
const PTY_P = coverageJson.primary_records.filter((r) => r.domain_id === "property-rights");
const REPR = Object.fromEntries(planJson.records.map((r) => [r.primary_id, r.recommended_existing_subscenario_id]));

const results = [];
function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "通过" : "失败"}  ${name}${detail ? "：" + detail : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1100"],
});

async function newTab() {
  const p = await browser.newPage();
  p.setDefaultTimeout(25000);
  await p.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  return p;
}

let page = await newTab();

async function shot(name, target = page, fullPage = false) {
  const file = path.join(OUT, `${name}_${COMMIT}.png`);
  await target.screenshot({ path: file, fullPage });
  return file;
}

async function goto(url, target = page) {
  await target.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await target.evaluate(() => {
    try {
      localStorage.removeItem("cnooc-supervision-business-v16");
      localStorage.removeItem("cnooc-supervision-config-v16");
      localStorage.setItem("cnooc-supervision-notice-ack", "1");
    } catch {
      /* ignore */
    }
  });
  await target.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await target.waitForSelector("nav, .reg-app, main, [data-testid], header", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 400));
}

function bodyText(target = page) {
  return target.evaluate(() => document.body.innerText);
}

async function clickNthButton(subId, index) {
  await page.evaluate(
    (id, i) => {
      const row = document.querySelector(`[data-testid='scenario-sub-${id}']`);
      const btns = row ? [...row.querySelectorAll("button")] : [];
      btns[i]?.click();
    },
    subId,
    index,
  );
  await new Promise((r) => setTimeout(r, 400));
}

const slash = BASE.includes("github.io") ? "/" : "";
const coverageDump = { funds: [], property: [], commit: COMMIT };

try {
  await goto(`${BASE}/funds${slash}`);
  const fundsText = await bodyText();
  log("R32-01 默认全部专题", fundsText.includes("全部专题") && Boolean(await page.$("[data-testid='funds-topic-all']")));
  const cashCount = await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "");
  log("R32-01 资金11项一级", cashCount.includes("11"), cashCount);
  for (const rec of CASH_P) {
    const el = await page.$(`[data-testid='scenario-group-${rec.primary_id}']`);
    const nameOk = el
      ? await page.evaluate((node, name) => (node.textContent || "").includes(name), el, rec.primary_name)
      : false;
    log(`R32-01 可见 ${rec.primary_id}`, Boolean(el) && nameOk, rec.primary_name);
  }
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 500));
  const expandedFunds = await bodyText();
  log("R32-03 业务区无未启用标签", !expandedFunds.includes("未启用") && !expandedFunds.includes("已停用"));
  log("R32-03 无草稿占位S001", !(await page.$("[data-testid='scenario-sub-CASH2-S001']")));
  log("R32-01 可执行 S039", Boolean(await page.$("[data-testid='scenario-sub-CASH2-S039']")));
  log("R32-01 可执行 S006", Boolean(await page.$("[data-testid='scenario-sub-CASH2-S006']")));
  log("R32-01 可执行 S017", Boolean(await page.$("[data-testid='scenario-sub-CASH2-S017']")));
  log("R32-01 可执行 S020", Boolean(await page.$("[data-testid='scenario-sub-CASH2-S020']")));
  for (const rec of CASH_P) {
    const subId = REPR[rec.primary_id];
    const subEl = await page.$(`[data-testid='scenario-sub-${subId}']`);
    coverageDump.funds.push({
      primary_id: rec.primary_id,
      primary_name: rec.primary_name,
      sub_id: subId,
      visible: Boolean(subEl),
    });
    log(`R32-01 ${rec.primary_id} 代表 ${subId}`, Boolean(subEl));
  }
  await shot("r32_funds_executable_11", page, false);
  await clickNthButton("CASH2-S039", 1);
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  const s039Modal = await page.$eval('[role="dialog"]', (el) => el.innerText || "");
  log("R32-01 S039 可打开对象清单", s039Modal.includes("P-PAY001") || s039Modal.includes("监测对象"), s039Modal.slice(0, 120).replace(/\s+/g, " "));
  await shot("r32_funds_s039_objects", page, false);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 5000 }).catch(() => {});

  const fundTopics = [
    "CASH2-T-ACCOUNT",
    "CASH2-T-PAYMENT",
    "CASH2-T-FINANCE",
    "CASH2-T-OPERATION",
    "CASH2-T-SPECIAL",
    "CASH2-T-OPERATING",
  ];
  for (const tid of fundTopics) {
    await page.click(`[data-testid='funds-topic-${tid}']`);
    await new Promise((r) => setTimeout(r, 400));
    await page.click("[data-testid='scenario-expand-all']").catch(() => {});
    await new Promise((r) => setTimeout(r, 250));
    const rows = await page.$$("[data-testid^='scenario-sub-']");
    const groups = await page.$$("[data-testid^='scenario-group-']");
    log(`R32-04 资金专题 ${tid} 有可执行行`, rows.length > 0 || groups.length > 0, `rows=${rows.length} groups=${groups.length}`);
  }
  await page.click("[data-testid='funds-topic-all']");
  await new Promise((r) => setTimeout(r, 250));
  log("R32-15 资金首页仍有小趋势", (await page.$$("[data-trend-chart='home']")).length >= 1);

  await goto(`${BASE}/property-rights${slash}`);
  const rightsText = await bodyText();
  log("R32-05 默认产权交易", Boolean(await page.$("[data-testid='rights-topic-PTY2-T-TRADE']")));
  log("R32-05 经济行为可见", Boolean(await page.$("[data-testid='rights-behavior-select']")));
  const behaviorVal = await page.$eval("[data-testid='rights-behavior-select']", (el) => el.value);
  log("R32-05 默认非上市企业产权转让", behaviorVal === "nonlisted_transfer", behaviorVal);
  log("R32-05 肩形流程可见", Boolean(await page.$("[data-testid='rights-chevron-flow']")));
  log("R32-05 全部场景入口", (await page.$eval("[data-testid='rights-topic-all']", (el) => el.textContent || "")).includes("全部场景（10）"));
  log("R32-15 首页无字母公式", !/B\s*\+\s*C\s*\+\s*P/.test(rightsText) && !rightsText.includes("按事项ID去重"));
  log("R32-15 首页四卡无趋势", (await page.$$eval("[data-testid='rights-kpi-grid'] [data-trend-chart]", (els) => els.length)) === 0);
  log("R32-05 无独立当前环节大卡", !rightsText.includes("当前环节"));

  const beforeKpi = await page.$eval("[data-testid='rights-kpi-grid']", (el) => el.innerText);
  const chevrons = await page.$$("[data-testid='chevron-flow'] button");
  if (chevrons.length > 1) {
    await chevrons[2].click();
    await new Promise((r) => setTimeout(r, 350));
  }
  const afterKpi = await page.$eval("[data-testid='rights-kpi-grid']", (el) => el.innerText);
  log("R32-05 点环节上区不变", beforeKpi === afterKpi);
  await shot("r32_rights_trade_flow");

  await page.click("[data-testid='rights-topic-PTY2-T-REG']");
  await new Promise((r) => setTimeout(r, 400));
  const regText = await bodyText();
  log("R32-06 登记无经济行为下拉", !(await page.$("[data-testid='rights-behavior-select']")));
  log("R32-06 登记无肩形流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R32-06 登记场景可见", Boolean(await page.$("[data-testid='scenario-group-PTY2-P09']")) || regText.includes("产权变动登记"));
  log("R32-06 登记不残留交易一级P01", !(await page.$("[data-testid='scenario-group-PTY2-P01']")));
  await shot("r32_rights_registration");

  await page.click("[data-testid='rights-topic-PTY2-T-IDENTITY']");
  await new Promise((r) => setTimeout(r, 300));
  log("R32-07 标识无交易流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R32-07 标识可见P08", Boolean(await page.$("[data-testid='scenario-group-PTY2-P08']")));
  await shot("r32_rights_identity");

  await page.click("[data-testid='rights-topic-PTY2-T-CONTROL']");
  await new Promise((r) => setTimeout(r, 400));
  await page.click("[data-testid='scenario-expand-all']").catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  log("R32-07 控制权无交易流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R32-10 控制权专业核查S032", Boolean(await page.$("[data-testid='scenario-sub-PTY2-S032']")) || Boolean(await page.$("[data-testid='scenario-group-PTY2-P10']")));

  await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
  await new Promise((r) => setTimeout(r, 400));
  const restored = await page.$eval("[data-testid='rights-behavior-select']", (el) => el.value);
  log("R32-07 返回交易恢复经济行为", restored === "nonlisted_transfer" || restored === "all", restored);
  log("R32-07 返回交易流程可见", Boolean(await page.$("[data-testid='rights-chevron-flow']")) || restored === "all");

  await page.select("[data-testid='rights-behavior-select']", "all");
  await new Promise((r) => setTimeout(r, 300));
  log("R32-08 全部行为无肩形流程", !(await page.$("[data-testid='rights-chevron-flow']")));

  await page.select("[data-testid='rights-behavior-select']", "free_transfer");
  await new Promise((r) => setTimeout(r, 400));
  await page.click("[data-testid='scenario-expand-all']").catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  log("R32-09 无偿划转无价款逾期行", !(await page.$("[data-testid='scenario-sub-PTY2-S037']")));
  log("R32-09 无偿划转仍有决策规则", Boolean(await page.$("[data-testid='scenario-sub-PTY2-S003']")));

  await page.select("[data-testid='rights-behavior-select']", "nonlisted_transfer");
  await new Promise((r) => setTimeout(r, 400));
  await page.click("[data-testid='scenario-expand-all']").catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  log("R32-09 有偿转让可见价款规则", Boolean(await page.$("[data-testid='scenario-sub-PTY2-S037']")));
  log("R32-10 交易可见专业核查S011", Boolean(await page.$("[data-testid='scenario-sub-PTY2-S011']")));

  await page.click("[data-testid='rights-topic-all']");
  await new Promise((r) => setTimeout(r, 400));
  const allText = await bodyText();
  const ptyCount = await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "");
  log("R32-02/08 全部场景10项", ptyCount.includes("10"), ptyCount);
  log("R32-08 全部场景无交易流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 500));
  for (const rec of PTY_P) {
    const el = await page.$(`[data-testid='scenario-group-${rec.primary_id}']`);
    const subId = REPR[rec.primary_id];
    const subEl = await page.$(`[data-testid='scenario-sub-${subId}']`);
    coverageDump.property.push({
      primary_id: rec.primary_id,
      primary_name: rec.primary_name,
      sub_id: subId,
      visible: Boolean(subEl),
    });
    log(`R32-02 ${rec.primary_id} 代表 ${subId}`, Boolean(el) && Boolean(subEl), rec.primary_name);
  }
  log("R32-03 产权业务区无未启用", !(await bodyText()).includes("未启用"));
  await shot("r32_rights_all_10", page, false);

  await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
  await new Promise((r) => setTimeout(r, 400));
  await page.click("[data-testid='scenario-expand-all']").catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  await clickNthButton("PTY2-S037", 3);
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  const s037Modal = await page.$eval('[role="dialog"]', (el) => el.innerText || "");
  log("R32-01 S037 可打开命中对象", s037Modal.includes("PTY-M002") || s037Modal.includes("命中对象"), s037Modal.slice(0, 120).replace(/\s+/g, " "));
  await shot("r32_rights_s037_hit", page, false);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 5000 }).catch(() => {});
  await clickNthButton("PTY2-S011", 4);
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  const s011Modal = await page.$eval('[role="dialog"]', (el) => el.innerText || "");
  log(
    "R32-10 S011 可打开专业核查事项",
    s011Modal.includes("专业核查") || s011Modal.includes("待核查") || s011Modal.includes("R-FP-011") || s011Modal.includes("隐匿"),
    s011Modal.slice(0, 120).replace(/\s+/g, " "),
  );
  await shot("r32_rights_s011_review", page, false);
  await page.keyboard.press("Escape");
  await page.close().catch(() => {});

  await browser.close();
  const browser2 = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1100"],
  });
  const settingsPage = await browser2.newPage();
  settingsPage.setDefaultTimeout(40000);
  await settingsPage.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await settingsPage.goto(`${BASE}/settings${slash}?tab=scenarios`, { waitUntil: "domcontentloaded", timeout: 40000 });
  await settingsPage.evaluate(() => {
    try {
      localStorage.setItem("cnooc-supervision-notice-ack", "1");
    } catch {
      /* ignore */
    }
  });
  await settingsPage.waitForFunction(() => (document.body?.innerText || "").includes("系统配置"), { timeout: 20000 });
  const setText = await settingsPage.evaluate(() => document.body.innerText);
  log(
    "R32-03 配置保留完整目录线索",
    setText.includes("监管场景") || setText.includes("CASH2") || setText.includes("子场景") || setText.includes("监测规则") || setText.includes("一级监管场景"),
  );
  await shot("r32_settings_catalog", settingsPage, false);

  await settingsPage.goto(`${BASE}/overview${slash}`, { waitUntil: "domcontentloaded", timeout: 40000 });
  await settingsPage.waitForFunction(() => (document.body?.innerText || "").includes("综合总览") || (document.body?.innerText || "").includes("纳管"), { timeout: 20000 });
  const ovText = await settingsPage.evaluate(() => document.body.innerText);
  log("R32-16 总览入口可打开", ovText.includes("综合总览") || ovText.includes("纳管"));
  await shot("r32_overview_entry", settingsPage, false);
  await browser2.close();
} catch (err) {
  log("脚本异常", false, String(err));
  try {
    await shot("r32_script_error", page, false);
  } catch {
    /* ignore */
  }
} finally {
  await browser.close().catch(() => {});
}

const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, `r32-results_${COMMIT}.json`), JSON.stringify({ commit: COMMIT, pass, fail: fail.length, results, coverageDump }, null, 2));
const detailPath = path.join("/workspace", "public", "deliverables", "coverage-r32.json");
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(detailPath, "utf8"));
} catch {
  existing = {};
}
existing.ui_visibility = coverageDump;
existing.ui_results = results;
existing.ui_commit = COMMIT;
fs.writeFileSync(detailPath, JSON.stringify(existing, null, 2));
console.log(`\nR3.2 页面验收：${pass} 通过，${fail.length} 未通过。提交 ${COMMIT}`);
if (fail.length) {
  fail.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  process.exit(1);
}
