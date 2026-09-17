/**
 * 资金/产权本轮验收截图。本地或 GitHub Pages 均可。
 * BASE_URL=http://127.0.0.1:43917 node scripts/capture-fp-screenshots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BASE = (process.env.BASE_URL ?? "http://localhost:43917").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? path.join("/workspace", "public", "deliverables");
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1100"],
});
const page = await browser.newPage();
page.setDefaultTimeout(25000);

async function shot(name, clip) {
  const file = path.join(OUT, `${name}.png`);
  if (clip) await page.screenshot({ path: file, clip });
  else await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file, fs.statSync(file).size);
  return file;
}

async function goto(url) {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    try {
      localStorage.setItem("cnooc-supervision-notice-ack", "1");
    } catch {}
  });
}

async function shotEl(name, sel) {
  const el = await page.$(sel);
  if (!el) throw new Error(`missing ${sel}`);
  await el.scrollIntoViewIfNeeded();
  await sleep(200);
  const file = path.join(OUT, `${name}.png`);
  await el.screenshot({ path: file });
  console.log("saved", file, fs.statSync(file).size);
  return file;
}

async function clickText(selector, text, exact = false) {
  const els = await page.$$(selector);
  for (const el of els) {
    const t = await page.evaluate((e) => (e.textContent || "").replace(/\s+/g, " ").trim(), el);
    if (exact ? t === text : t.includes(text)) {
      await el.click();
      return true;
    }
  }
  return false;
}

const slash = BASE.includes("github.io") ? "/" : "";
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await goto(`${BASE}/funds${slash}`);
await page.waitForSelector("[data-testid='funds-kpi-grid']");
const upper = await page.evaluate(() => {
  const grid = document.querySelector("[data-testid='funds-kpi-grid']");
  const card = grid?.closest("section");
  const r = (card ?? grid).getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(1432, r.width + 8), height: Math.min(900, r.height + 8) };
});
await shot("funds-upper-kpis", upper);
await shot("r3-funds-profit-sparks");

await page.click("[data-overlay-return='CASH2-I01']");
await page.waitForSelector("[data-drawer-tree]");
await sleep(400);
await shot("r3-funds-revenue-detail-trend");
const collapsed = await page.$$("[data-drawer-tree] button[aria-label='展开']");
for (const b of collapsed) {
  await b.click();
  await sleep(80);
}
await clickText("[data-drawer-tree] [data-node-kind='org']", "二级单位A");
await sleep(200);
await shot("funds-indicator-tree-leaf");
await page.keyboard.press("Escape");
await sleep(300);

await page.click("[data-testid='funds-tab-bs']");
await sleep(250);
await shot("r3-funds-bs");
await page.click("[data-testid='funds-tab-liq']");
await sleep(250);
await shot("r3-funds-liq");

await page.click("[data-testid='funds-topic-CASH2-T-PAYMENT']");
await page.waitForSelector("[data-testid='scenario-compact-stats']");
await sleep(200);
await shotEl("funds-scenario-execution", "#scenario-execution");
await page.click("[data-testid='funds-topic-all']");
await sleep(200);
await page.click("[data-testid='scenario-expand-all']");
await sleep(300);
await page.evaluate(() => document.getElementById("scenario-execution")?.scrollIntoView({ block: "start" }));
await sleep(200);
await shot("r31-funds-full-catalog");
await page.click("[data-testid='funds-topic-CASH2-T-ACCOUNT']");
await sleep(250);
await shot("r3-funds-topic-account");
await page.click("[data-testid='funds-topic-CASH2-T-FINANCE']");
await sleep(250);
await shot("r3-funds-topic-finance");
await page.click("[data-testid='funds-topic-CASH2-T-OPERATION']");
await sleep(250);
await shot("r3-funds-topic-operation");

await goto(`${BASE}/property-rights${slash}`);
await page.waitForSelector("[data-testid='rights-topic-nav']");
await page.waitForSelector("[data-testid='rights-kpi-grid']");
await shotEl("r31-rights-kpi-no-formula-trend", "[data-testid='rights-kpi-grid']");
await shot("r3-rights-census-home");
await page.click("[data-overlay-return='N']");
await page.waitForSelector("[data-drawer-tree]");
await sleep(400);
await shot("r31-rights-indicator-detail-no-trend");
await page.keyboard.press("Escape");
await sleep(250);
await page.click("[data-testid='scenario-expand-all']");
await sleep(300);
await page.evaluate(() => document.getElementById("scenario-execution")?.scrollIntoView({ block: "start" }));
await sleep(200);
await shot("r31-rights-full-catalog");
await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
await page.waitForSelector("[data-testid='rights-behavior-select']");
await page.select("[data-testid='rights-behavior-select']", "nonlisted_transfer");
await page.waitForSelector("[data-testid='rights-chevron-flow']");
await page.evaluate(() => document.getElementById("scenario-execution")?.scrollIntoView({ block: "start" }));
await sleep(250);
await shot("r31-rights-trade");
await shot("property-flow-and-execution");
await page.click("[data-testid='rights-topic-PTY2-T-REG']");
await sleep(300);
await shot("r31-rights-nontrade");
await shot("r3-rights-reg");
await page.click("[data-testid='rights-topic-PTY2-T-IDENTITY']");
await sleep(300);
await shot("r3-rights-identity");
await page.click("[data-testid='rights-topic-PTY2-T-CONTROL']");
await sleep(300);
await shot("r3-rights-control");

const note = path.join(OUT, "README.txt");
fs.writeFileSync(
  note,
  `提交 ${COMMIT}
来源 ${BASE}
R3.1 截图：
- r31-funds-full-catalog.png 资金全部专题 11 项一级目录
- r31-rights-full-catalog.png 产权全部专题 10 项一级目录
- r31-rights-trade.png 产权交易（选定经济行为后的下拉+肩形流程）
- r31-rights-nontrade.png 非交易专题（无经济行为、无流程）
- r31-rights-kpi-no-formula-trend.png 产权四卡：无公式、无趋势
- r31-rights-indicator-detail-no-trend.png 产权指标详情：无趋势图，公式仅在计算依据
资金趋势仍有效：
- funds-upper-kpis.png 资金盈利能力主卡与小趋势
- r3-funds-revenue-detail-trend.png 营业收入详情趋势与同分类切换
`,
);
await browser.close();
console.log("done", COMMIT);
