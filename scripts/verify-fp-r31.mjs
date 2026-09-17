/**
 * FP-20260916-R3.1 下半区目录与交易/非交易展示验收。
 * BASE_URL=http://127.0.0.1:43917 node scripts/verify-fp-r31.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:43917").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? "/opt/cursor/artifacts";
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });

const CASH_P = [
  "CASH2-P01",
  "CASH2-P02",
  "CASH2-P03",
  "CASH2-P04",
  "CASH2-P05",
  "CASH2-P06",
  "CASH2-P07",
  "CASH2-P08",
  "CASH2-P09",
  "CASH2-P10",
  "CASH2-P11",
];
const PTY_P = [
  "PTY2-P01",
  "PTY2-P02",
  "PTY2-P03",
  "PTY2-P04",
  "PTY2-P05",
  "PTY2-P06",
  "PTY2-P07",
  "PTY2-P08",
  "PTY2-P09",
  "PTY2-P10",
];

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
const page = await browser.newPage();
page.setDefaultTimeout(25000);
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

async function shot(name) {
  const file = path.join(OUT, `${name}_${COMMIT}.png`);
  await page.screenshot({ path: file, fullPage: true });
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

function bodyText() {
  return page.evaluate(() => document.body.innerText);
}

const slash = BASE.includes("github.io") ? "/" : "";

try {
  await goto(`${BASE}/funds${slash}`);
  const fundsText = await bodyText();
  log("R3.1-01 上半区三类仍在", ["盈利能力", "资产负债状况", "资金流动性"].every((t) => fundsText.includes(t)));
  log("R3.1-01 无独立资金专题监管大卡", !fundsText.includes("资金专题监管"));
  log("R3.1-04 一张场景执行情况", (fundsText.match(/场景执行情况/g) || []).length >= 1 && Boolean(await page.$("#scenario-execution")));
  log("R3.1-06 资金默认全部专题", fundsText.includes("全部专题") && Boolean(await page.$("[data-testid='funds-topic-all']")));
  const cashCount = await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "");
  log("R3.1-07 资金11项一级", cashCount.includes("11"), cashCount);
  for (const id of CASH_P) {
    log(`R3.1-07 可见 ${id}`, Boolean(await page.$(`[data-testid='scenario-group-${id}']`)));
  }
  log("R3.1-07 不含 P12", !(await page.$(`[data-testid='scenario-group-CASH2-P12']`)));
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 400));
  const expandedFunds = await bodyText();
  log("R3.1-09 展开含仅维护定义", expandedFunds.includes("仅维护定义"));
  log("R3.1-09 展开含已启用S039", expandedFunds.includes("CASH2-S039"));
  log("R3.1-09 展开含无启用P03子场景", expandedFunds.includes("CASH2-S006") && expandedFunds.includes("CASH2-S007"));
  log("R3.1-18 未启用不伪造0命中为已评估", !/CASH2-S001[\s\S]{0,80}已完成监测/.test(expandedFunds));
  log("R3.1-19 无未分组", !expandedFunds.includes("未分组"));
  log("R3.1-19 官方80不标补充监管场景", !expandedFunds.includes("补充监管场景"));
  log("R3.1-19 不含S901", !expandedFunds.includes("CASH2-S901"));
  await shot("r31_funds_full_catalog");

  await page.click("[data-testid='funds-topic-CASH2-T-PAYMENT']");
  await new Promise((r) => setTimeout(r, 350));
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 250));
  const payText = await bodyText();
  log("R3.1-15 收付专题仍可见P01", Boolean(await page.$("[data-testid='scenario-group-CASH2-P01']")));
  log("R3.1-15 收付含S001定义项", payText.includes("CASH2-S001"));
  log("专题切换上区仍在", payText.includes("主体经营与财务状况"));

  await goto(`${BASE}/property-rights${slash}`);
  const rightsText = await bodyText();
  log("R3.1-02 上半区法人全景", rightsText.includes("法人及股权全景") && rightsText.includes("纳管法人户数"));
  log("R3.1-05 产权一张执行卡", Boolean(await page.$("#scenario-execution")) && !rightsText.includes("产权事项监管"));
  log("R3.1-06 产权默认全部专题", Boolean(await page.$("[data-testid='rights-topic-all']")));
  log("R3.1-11 默认无经济行为下拉", !(await page.$("[data-testid='rights-behavior-select']")));
  log("R3.1-11 默认无交易流程", !(await page.$("[data-testid='rights-trade-flow']")));
  const ptyCount = await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "");
  log("R3.1-08 产权10项一级", ptyCount.includes("10"), ptyCount);
  for (const id of PTY_P) {
    log(`R3.1-08 可见 ${id}`, Boolean(await page.$(`[data-testid='scenario-group-${id}']`)));
  }
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 400));
  await shot("r31_rights_full_catalog");

  await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
  await new Promise((r) => setTimeout(r, 400));
  const tradeText = await bodyText();
  log("R3.1-10 交易有经济行为下拉", Boolean(await page.$("[data-testid='rights-behavior-select']")));
  log("R3.1-10 交易有肩形流程", Boolean(await page.$("[data-testid='rights-trade-flow']")));
  log("R3.1-13 箭头不堆停留未关闭", !/未关闭\s+\d+\s*件/.test(tradeText) || !(await page.$eval("[data-testid='rights-trade-flow']", (el) => /未关闭|停留/.test(el.innerText))));
  const flowText = await page.$eval("[data-testid='rights-trade-flow']", (el) => el.innerText);
  log("R3.1-13 流程区无停留统计", !flowText.includes("停留") && !/未关闭\s+\d+/.test(flowText), flowText.slice(0, 80));
  await shot("r31_rights_trade");

  await page.click("[data-testid='rights-topic-PTY2-T-REG']");
  await new Promise((r) => setTimeout(r, 350));
  log("R3.1-11 登记无经济行为", !(await page.$("[data-testid='rights-behavior-select']")));
  log("R3.1-11 登记无交易流程", !(await page.$("[data-testid='rights-trade-flow']")));
  const regText = await bodyText();
  log("R3.1-16 登记可见P09", Boolean(await page.$("[data-testid='scenario-group-PTY2-P09']")) || regText.includes("PTY2-P09"));
  await shot("r31_rights_nontrade_reg");

  await goto(`${BASE}/overview${slash}`);
  const ov = await bodyText();
  log("R3.1-03 综合总览保持", ov.includes("监管主体全景") && ov.includes("综合总览"));

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await goto(`${BASE}/funds${slash}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8);
  log("R3.1-21 1280无整页横溢", !overflow);

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, `verify-fp-r31_${COMMIT}.json`), JSON.stringify({ COMMIT, results }, null, 2));
  console.log(`\n合计 ${results.length}，失败 ${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log("  -", f.name, f.detail));
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
