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

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await goto(`${BASE}/funds${BASE.includes("github.io") ? "/" : ""}`);
await page.waitForSelector("[data-testid='funds-kpi-grid']");
const upper = await page.evaluate(() => {
  const grid = document.querySelector("[data-testid='funds-kpi-grid']");
  const card = grid?.closest("section");
  const r = (card ?? grid).getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(1432, r.width + 8), height: Math.min(900, r.height + 8) };
});
await shot("funds-upper-kpis", upper);

await page.click("[data-testid='funds-tab-liq']");
await sleep(300);
await page.waitForSelector("[data-overlay-return='CASH-I01']");
await page.click("[data-overlay-return='CASH-I01']");
await page.waitForSelector("[data-drawer-tree]");
await sleep(400);
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
await page.click("[data-testid='funds-topic-CASH2-T-PAYMENT']");
await page.waitForSelector("[data-testid='scenario-compact-stats']");
await sleep(200);
await shotEl("funds-scenario-execution", "#scenario-execution");

await goto(`${BASE}/property-rights${BASE.includes("github.io") ? "/" : ""}`);
await page.waitForSelector("[data-testid='rights-topic-nav']");
await clickText("button", "审计评估");
await page.waitForSelector("#scenario-execution");
await page.evaluate(() => document.getElementById("rights-topic-nav")?.scrollIntoView({ block: "start" }));
await sleep(250);
await shot("property-flow-and-execution");

const note = path.join(OUT, "README.txt");
fs.writeFileSync(
  note,
  `提交 ${COMMIT}\n来源 ${BASE}\n文件：\n- funds-upper-kpis.png 资金上半区经营指标\n- funds-indicator-tree-leaf.png 指标树展开至实际末级\n- funds-scenario-execution.png 资金场景执行区域\n- property-flow-and-execution.png 产权流程与场景执行区域\n`,
);
await browser.close();
console.log("done", COMMIT);
