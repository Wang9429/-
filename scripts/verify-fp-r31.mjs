/**
 * FP-20260916-R3.1 十二项实点验收（含产权上半区去公式/趋势）。
 * BASE_URL=http://127.0.0.1:43917 node scripts/verify-fp-r31.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const coverageJson = JSON.parse(
  fs.readFileSync(path.join("/workspace", "data", "fp", "primary_catalog_r31.json"), "utf8"),
);

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:43917").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? "/opt/cursor/artifacts";
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });

const CASH_P = coverageJson.primary_records.filter((r) => r.domain_id === "funds");
const PTY_P = coverageJson.primary_records.filter((r) => r.domain_id === "property-rights");

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
const coverageDump = { funds: [], property: [] };

try {
  await goto(`${BASE}/funds${slash}`);
  const fundsText = await bodyText();
  log("R31-01 默认全部专题", fundsText.includes("全部专题") && Boolean(await page.$("[data-testid='funds-topic-all']")));
  log("R31-01 无独立资金专题监管大卡", !fundsText.includes("资金专题监管"));
  const cashCount = await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "");
  log("R31-01 资金11项一级", cashCount.includes("11"), cashCount);
  for (const rec of CASH_P) {
    const el = await page.$(`[data-testid='scenario-group-${rec.primary_id}']`);
    const nameOk = el
      ? await page.evaluate((node, name) => (node.textContent || "").includes(name), el, rec.primary_name)
      : false;
    log(`R31-01 可见 ${rec.primary_id}`, Boolean(el) && nameOk, rec.primary_name);
    coverageDump.funds.push({
      id: rec.primary_id,
      name: rec.primary_name,
      visible: Boolean(el) && nameOk,
      expandable: Boolean(el),
    });
  }
  log("R31-01 不含 P12", !(await page.$("[data-testid='scenario-group-CASH2-P12']")));
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 400));
  const expandedFunds = await bodyText();
  log("R31-06 展开含未启用", expandedFunds.includes("未启用"));
  log("R31-06 展开含已启用S039", Boolean(await page.$("[data-testid='scenario-sub-CASH2-S039']")) || expandedFunds.includes("实付超过该笔有效批准金额"));
  log("R31-06 无启用P03子场景仍可查", Boolean(await page.$("[data-testid='scenario-sub-CASH2-S006']")));
  log("R31-06 未启用不伪造已评估", !/未启用[\s\S]{0,40}已完成监测/.test(expandedFunds));
  log("R31-07 官方80不标补充监管场景", !expandedFunds.includes("补充监管场景"));
  log("R31-07 泛称不占标准一级", !expandedFunds.includes("资金管理监管"));
  await shot("r31_funds_full_catalog");

  await page.click("[data-testid='funds-topic-CASH2-T-PAYMENT']");
  await new Promise((r) => setTimeout(r, 350));
  const payText = await bodyText();
  log("R31-05 收付专题仍可见P01", Boolean(await page.$("[data-testid='scenario-group-CASH2-P01']")));
  log("R31-05 专题切换上区仍在", payText.includes("主体经营与财务状况"));
  log("R31-12 资金首页仍有小趋势", (await page.$$("[data-trend-chart='home']")).length >= 1);
  await page.click("[data-testid='funds-topic-all']");
  await new Promise((r) => setTimeout(r, 250));
  log("R31-05 回全部恢复11项", ((await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "")).includes("11")));

  await page.click("[data-overlay-return='CASH2-I01']");
  await page.waitForSelector("[data-drawer-tree]", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 300));
  log("R31-12 资金详情仍有趋势", Boolean(await page.$("[data-testid='drawer-trend']")));
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));
  await shot("r31_funds_trend_kept");

  await goto(`${BASE}/property-rights${slash}`);
  const rightsText = await bodyText();
  log("R31-02 默认全部专题", Boolean(await page.$("[data-testid='rights-topic-all']")));
  log("R31-02 默认无经济行为下拉", !(await page.$("[data-testid='rights-behavior-select']")));
  log("R31-02 默认无交易流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R31-02 无独立产权事项监管大卡", !rightsText.includes("产权事项监管"));
  const ptyCount = await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "");
  log("R31-02 产权10项一级", ptyCount.includes("10"), ptyCount);
  for (const rec of PTY_P) {
    const el = await page.$(`[data-testid='scenario-group-${rec.primary_id}']`);
    const nameOk = el
      ? await page.evaluate((node, name) => (node.textContent || "").includes(name), el, rec.primary_name)
      : false;
    log(`R31-02 可见 ${rec.primary_id}`, Boolean(el) && nameOk, rec.primary_name);
    coverageDump.property.push({
      id: rec.primary_id,
      name: rec.primary_name,
      visible: Boolean(el) && nameOk,
      expandable: Boolean(el),
    });
  }
  log("R31-07 泛称不占产权一级", !rightsText.includes("产权管理监管"));
  log("R31-11 首页无字母公式", !/B\s*\+\s*C\s*\+\s*P/.test(rightsText) && !rightsText.includes("按事项ID去重"));
  const homeSparks = await page.$$eval("[data-testid='rights-kpi-grid'] [data-trend-chart]", (els) => els.length);
  log("R31-11 首页四卡无趋势", homeSparks === 0, String(homeSparks));
  log("R31-11 四卡名称完整", ["纳管法人户数", "控股及实际控制企业户数", "参股企业户数", "在办产权事项数"].every((n) => rightsText.includes(n)));
  await page.click("[data-testid='scenario-expand-all']");
  await new Promise((r) => setTimeout(r, 400));
  await shot("r31_rights_full_catalog");
  await shot("r31_rights_kpi_no_formula_trend");

  await page.click("[data-overlay-return='N']");
  await page.waitForSelector("[data-drawer-tree]", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 350));
  const drawerText = await page.evaluate(() => document.body.innerText);
  log("R31-11 详情无趋势图", !(await page.$("[data-testid='drawer-trend']")));
  log("R31-11 详情无空图框", !drawerText.includes("暂无趋势"));
  log("R31-11 详情不常显公式", !drawerText.includes("计算公式") && !drawerText.includes("按事项ID去重"));
  log("R31-11 详情可打开计算依据", drawerText.includes("查看计算依据"));
  await shot("r31_rights_indicator_detail_no_trend");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));

  await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
  await new Promise((r) => setTimeout(r, 400));
  log("R31-03 交易有经济行为下拉", Boolean(await page.$("[data-testid='rights-behavior-select']")));
  log("R31-03 未选具体行为无肩形流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  await page.select("[data-testid='rights-behavior-select']", "nonlisted_transfer");
  await new Promise((r) => setTimeout(r, 350));
  log("R31-03 选定经济行为后有肩形流程", Boolean(await page.$("[data-testid='rights-chevron-flow']")));
  const flowText = await page.$eval("[data-testid='rights-trade-flow']", (el) => el.innerText);
  log("R31-03 流程区无停留未关闭堆叠", !flowText.includes("停留") && !/未关闭\s+\d+/.test(flowText), flowText.slice(0, 80));
  await shot("r31_rights_trade");

  await page.click("[data-testid='rights-topic-all']");
  await new Promise((r) => setTimeout(r, 300));
  log("R31-03 回全部恢复10项", ((await page.$eval("[data-testid='scenario-catalog-count']", (el) => el.textContent || "")).includes("10")));
  log("R31-03 回全部无经济行为", !(await page.$("[data-testid='rights-behavior-select']")));

  await page.click("[data-testid='rights-topic-PTY2-T-REG']");
  await new Promise((r) => setTimeout(r, 350));
  log("R31-04 登记无经济行为", !(await page.$("[data-testid='rights-behavior-select']")));
  log("R31-04 登记无交易流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R31-04 登记可见P09", Boolean(await page.$("[data-testid='scenario-group-PTY2-P09']")));
  await shot("r31_rights_nontrade_reg");

  await page.click("[data-testid='rights-topic-PTY2-T-IDENTITY']");
  await new Promise((r) => setTimeout(r, 300));
  const identText = await bodyText();
  log("R31-04 标识页签名完整", identText.includes("标识与名称资质"));
  log("R31-04 标识无流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R31-04 标识可见P08", Boolean(await page.$("[data-testid='scenario-group-PTY2-P08']")));
  log("R31-04 标识不含交易P01", !(await page.$("[data-testid='scenario-group-PTY2-P01']")));

  await page.click("[data-testid='rights-topic-PTY2-T-CONTROL']");
  await new Promise((r) => setTimeout(r, 300));
  const ctrlText = await bodyText();
  log("R31-04 控制页签名完整", ctrlText.includes("股权与控制权"));
  log("R31-04 控制无流程", !(await page.$("[data-testid='rights-chevron-flow']")));
  log("R31-04 控制可见P10", Boolean(await page.$("[data-testid='scenario-group-PTY2-P10']")));

  await goto(`${BASE}/overview${slash}`);
  const ov = await bodyText();
  log("R31-08 综合总览保持", ov.includes("监管主体全景") && ov.includes("综合总览"));

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await goto(`${BASE}/funds${slash}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8);
  log("R31-09 1280无整页横溢", !overflow);

  const fundsCovered = coverageDump.funds.filter((x) => x.visible).length;
  const ptyCovered = coverageDump.property.filter((x) => x.visible).length;
  log("R31-10 资金11/11", fundsCovered === 11, `${fundsCovered}/11`);
  log("R31-10 产权10/10", ptyCovered === 10, `${ptyCovered}/10`);

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(
    path.join(OUT, `verify-fp-r31_${COMMIT}.json`),
    JSON.stringify({ COMMIT, coverageDump, results }, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT, `coverage-11-10_${COMMIT}.json`),
    JSON.stringify(
      {
        funds: `${fundsCovered}/11`,
        property: `${ptyCovered}/10`,
        funds_items: coverageDump.funds,
        property_items: coverageDump.property,
      },
      null,
      2,
    ),
  );
  console.log("\n资金覆盖");
  coverageDump.funds.forEach((x, i) => console.log(`  ${String(i + 1).padStart(2, "0")} ${x.visible ? "✓" : "✗"} ${x.id} ${x.name}`));
  console.log("产权覆盖");
  coverageDump.property.forEach((x, i) => console.log(`  ${String(i + 1).padStart(2, "0")} ${x.visible ? "✓" : "✗"} ${x.id} ${x.name}`));
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
