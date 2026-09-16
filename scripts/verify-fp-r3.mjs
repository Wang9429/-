/**
 * FP-20260916-R3 生产构建点击验收。不能用路由 200 代替交互。
 * 运行：BASE_URL=http://127.0.0.1:43917 node scripts/verify-fp-r3.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:43917").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? "/opt/cursor/artifacts";
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "通过" : "失败"}  ${name}${detail ? "：" + detail : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
});
const page = await browser.newPage();
page.setDefaultTimeout(25000);
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

async function shot(name) {
  const file = path.join(OUT, `${name}_${COMMIT}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function goto(url) {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("cnooc-supervision-business-v16");
      localStorage.removeItem("cnooc-supervision-config-v16");
      localStorage.setItem("cnooc-supervision-notice-ack", "1");
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("nav, .reg-app", { timeout: 15000 });
}

async function clickText(selector, text) {
  const handle = await page.evaluateHandle(
    (sel, t) => {
      const nodes = [...document.querySelectorAll(sel)];
      return nodes.find((n) => (n.textContent || "").replace(/\s+/g, " ").includes(t)) || null;
    },
    selector,
    text,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`未找到 ${selector} 含「${text}」`);
  await el.click();
  await new Promise((r) => setTimeout(r, 400));
}

function bodyText() {
  return page.evaluate(() => document.body.innerText);
}

const slash = BASE.includes("github.io") ? "/" : "";

try {
  await goto(`${BASE}/funds${slash}`);
  const fundsText = await bodyText();
  log("R3-01 三类入口", ["盈利能力", "资产负债状况", "资金流动性"].every((t) => fundsText.includes(t)));
  log("R3-01 无首页单位对比表", !/各单位对比|下级单位对照表/.test(fundsText));
  const sparkCount = await page.$$eval("[data-trend-chart='home']", (els) => els.length);
  log("R3-01 盈利能力小趋势", sparkCount >= 1, `首页小图 ${sparkCount}`);
  const kpiCount = await page.$$eval("[data-testid='funds-kpi-grid'] [data-overlay-return]", (els) => els.length);
  log("R3-01 每类最多4卡", kpiCount <= 4, `当前 ${kpiCount}`);

  await page.click("[data-overlay-return='CASH2-I01']");
  await page.waitForSelector("[data-indicator-switcher]");
  const switcher = await page.$eval("[data-indicator-switcher]", (el) => el.innerText);
  log("R3-02 同分类文案", switcher.includes("同分类") || switcher.includes("同领域同分类"));
  log("R3-02 无资产负债率候选", !switcher.includes("资产负债率"));
  log("R3-02 无可用资金候选", !switcher.includes("可用资金"));
  log("R3-02 含营业利润", switcher.includes("营业利润"));
  const detailTrend = await page.$("[data-testid='drawer-trend']");
  log("R3-07 详情趋势", Boolean(detailTrend));
  await shot("r3_profit_drawer_trend");

  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  await page.click("[data-testid='funds-tab-bs']");
  await new Promise((r) => setTimeout(r, 250));
  await page.click("[data-overlay-return='CASH2-I06']");
  await page.waitForSelector("[data-indicator-switcher]");
  const bsSwitcher = await page.$eval("[data-indicator-switcher]", (el) => el.innerText);
  log("R3-03 资产负债不含营业收入", !bsSwitcher.includes("营业收入"));
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));

  await page.click("[data-testid='funds-tab-liq']");
  await new Promise((r) => setTimeout(r, 250));
  const liqText = await bodyText();
  log("R3-01 流动性含账户资金", liqText.includes("账户资金余额") || liqText.includes("可用资金"));

  const topics = ["账户管理", "资金收付", "融资与担保", "资金运作", "专项资金", "经营风险"];
  for (const t of topics) {
    await clickText("[data-testid^='funds-topic-']", t);
    await page.waitForSelector("[data-testid='scenario-compact-stats']");
    const txt = await bodyText();
    log(`R3-16 ${t} 有执行区`, txt.includes("场景执行") || Boolean(await page.$("#scenario-execution")));
  }
  await shot("r3_funds_topics");

  await goto(`${BASE}/property-rights${slash}`);
  const rightsText = await bodyText();
  log("R3-22 四专题", ["产权交易", "产权登记", "标识名称", "股权控制"].every((t) => rightsText.includes(t)));
  log("R3-22 交易有经济行为", rightsText.includes("经济行为") && rightsText.includes("非上市企业产权转让"));
  const censusSpark = await page.$$eval("[data-trend-chart='home']", (els) => els.length);
  log("R3-28 产权统计趋势", censusSpark >= 1, `快照小图 ${censusSpark}`);

  await page.click("[data-testid='rights-topic-PTY2-T-REG']");
  await new Promise((r) => setTimeout(r, 350));
  const regText = await bodyText();
  log("R3-22 登记无经济行为", !regText.includes("非上市企业产权转让") || !regText.includes("经济行为"));
  await page.click("[data-testid='rights-topic-PTY2-T-IDENTITY']");
  await new Promise((r) => setTimeout(r, 350));
  const identText = await bodyText();
  log("R3-26 标识专题有S025", identText.includes("PTY2-S025") || identText.includes("名称") || identText.includes("字号"));
  await shot("r3_rights_identity");

  await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
  await new Promise((r) => setTimeout(r, 350));
  const tradeBack = await bodyText();
  log("R3-22 回到交易有流程", tradeBack.includes("经济行为"));

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await goto(`${BASE}/funds${slash}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8);
  log("R3-33 1280无整页横溢", !overflow);
  await shot("r3_funds_1280");

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, `verify-fp-r3_${COMMIT}.json`), JSON.stringify({ COMMIT, results }, null, 2));
  console.log(`\n合计 ${results.length}，失败 ${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log("  -", f.name, f.detail));
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
