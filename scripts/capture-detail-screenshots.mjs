/**
 * 场景详情业务化截图：必须拍到核验表/专业核查/持股来源，不能只截清单。
 * BASE_URL=http://127.0.0.1:43917 node scripts/capture-detail-screenshots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:43917").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? path.join("/workspace", "public", "deliverables");
const ART = "/opt/cursor/artifacts";
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1100"],
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

function copy(name) {
  const src = path.join(OUT, `${name}.png`);
  fs.copyFileSync(src, path.join(ART, `${name}.png`));
  fs.copyFileSync(src, path.join(ART, `${name}_${COMMIT}.png`));
}

async function shot(name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  copy(name);
  console.log("saved", file, fs.statSync(file).size);
}

async function goto(url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("cnooc-supervision-business-v16");
      localStorage.removeItem("cnooc-supervision-config-v16");
      localStorage.setItem("cnooc-supervision-notice-ack", "1");
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("[data-testid='scenario-expand-all'], [data-testid='rights-kpi-grid'], nav", { timeout: 20000 });
  await sleep(800);
}

async function expandAll() {
  await page.waitForSelector("[data-testid='scenario-expand-all']", { timeout: 15000 });
  await page.click("[data-testid='scenario-expand-all']");
  await sleep(800);
}

async function openScenario(subId) {
  await expandAll();
  await page.waitForSelector(`[data-testid='scenario-sub-${subId}']`, { timeout: 15000 });
  const row = await page.$(`[data-testid='scenario-sub-${subId}']`);
  if (!row) throw new Error(`missing row ${subId}`);
  await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await sleep(200);
  await page.evaluate((id) => {
    const r = document.querySelector(`[data-testid='scenario-sub-${id}']`);
    const nameBtn = r?.querySelector("td button");
    nameBtn?.click();
  }, subId);
  await page.waitForFunction(() => document.body.innerText.includes("核验依据") || document.body.innerText.includes("核验要求"), {
    timeout: 15000,
  });
  await sleep(500);
}

async function assertText(label, ...needles) {
  const text = await page.evaluate(() => document.body.innerText);
  for (const n of needles) {
    if (!text.includes(n)) throw new Error(`${label} 缺少「${n}」`);
  }
  console.log("ok", label, needles.join(" / "));
}

async function scrollToText(needle, testid) {
  await page.evaluate(
    (n, id) => {
      const root = id ? document.querySelector(`[data-testid='${id}']`) : document.body;
      const nodes = id
        ? [...document.querySelectorAll(`[data-testid='${id}']`)]
        : [...document.querySelectorAll("section, article, div")];
      const hit = nodes.find((el) => (el.innerText || "").includes(n)) ?? root;
      hit?.scrollIntoView({ block: "start" });
      const drawer =
        document.querySelector("[data-testid='drawer-body']") ||
        [...document.querySelectorAll(".overflow-auto, .overflow-y-auto")].find((el) => hit && el.contains(hit)) ||
        null;
      if (drawer && hit && drawer.contains(hit)) {
        const top = hit.getBoundingClientRect().top - drawer.getBoundingClientRect().top + drawer.scrollTop - 12;
        drawer.scrollTop = Math.max(0, top);
      }
    },
    needle,
    testid ?? null,
  );
  await sleep(400);
}

try {
  await goto(`${BASE}/funds`);
  await openScenario("CASH2-S039");
  await assertText("S039详情", "该笔有效批准金额", "800万元", "实际支付金额", "1200万元", "超出批准金额", "400万元", "业务授权上限", "2000万元", "命中，待核查");
  await scrollToText("该笔有效批准金额", "verification-panel");
  await shot("r32_s039_payment_basis");

  await assertText("S039未命中", "4200万元", "未命中");
  await scrollToText("4200万元", "verification-panel");
  await shot("r32_s039_clear_basis");

  await scrollToText("关联事项及办理入口");
  const openR07 = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((b) => (b.textContent || "").includes("付款超有效批准金额"));
    t?.click();
    return Boolean(t);
  });
  await sleep(700);
  if (openR07) {
    await assertText("S039事项入口", "付款超有效批准金额", "事项编号");
    await scrollToText("该笔有效批准金额", "verification-panel");
    await shot("r32_s039_hit_basis_entry");
  }

  await goto(`${BASE}/property-rights`);
  await page.waitForSelector("[data-testid='rights-kpi-grid']");
  const jv = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("td, button")];
    const t = cells.find((el) => (el.textContent || "").includes("被投企业A"));
    t?.click();
    return Boolean(t);
  });
  await sleep(700);
  if (jv) {
    await assertText("持股60/60/55", "60%", "55%", "有效批准方案", "工商登记", "产权台账", "基准日");
    await shot("r32_holdings_60_60_55");
  }

  await page.keyboard.press("Escape");
  await sleep(200);
  await expandAll();
  await openScenario("PTY2-S037");
  await assertText("S037价款", "应收价款", "800万元", "已核实到账", "480万元", "到期未收", "320万元");
  await shot("r32_s037_proceeds_basis");

  await page.keyboard.press("Escape");
  await sleep(300);
  await openScenario("PTY2-S011");
  await sleep(400);
  const s011Text = await page.evaluate(() => document.body.innerText);
  if (!s011Text.includes("应纳入审计评估") && !s011Text.includes("专业核查")) {
    throw new Error("S011 场景详情未打开");
  }
  await shot("r32_s011_scenario_detail");
  const open011 = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((b) => (b.textContent || "").includes("应纳入审计评估的资产范围待专业核查"));
    t?.click();
    return Boolean(t);
  });
  await sleep(700);
  if (open011) {
    await assertText("S011专业核查", "材料名称", "核查要点", "办理状态", "待核查");
    const bad = await page.evaluate(() => document.body.innerText.includes("已确认违规") && !document.body.innerText.includes("不能视为已确认违规") && !document.body.innerText.includes("尚未记录"));
    if (bad) throw new Error("S011 把待核查写成了已确认违规");
    await page.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 1 });
    await scrollToText("材料名称", "professional-review-panel");
    await shot("r32_s011_professional_review");
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  }

  await page.keyboard.press("Escape");
  await sleep(300);
  const topic = await page.$("[data-testid='rights-topic-PTY2-T-CONTROL']");
  if (topic) {
    await topic.click();
    await sleep(500);
  } else {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => (b.textContent || "").includes("股权与控制权") || (b.textContent || "").includes("控制权"))?.click();
    });
    await sleep(500);
  }
  await expandAll();
  await openScenario("PTY2-S032");
  await shot("r32_s032_scenario_detail");
  const open032 = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((b) => (b.textContent || "").includes("控股权利未有效行使待专业核查"));
    t?.click();
    return Boolean(t);
  });
  await sleep(700);
  if (open032) {
    await assertText("S032专业核查", "材料名称", "核查要点", "章程董事会席位", "待核查");
    await page.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 1 });
    await scrollToText("材料名称", "professional-review-panel");
    await shot("r32_s032_governance_review");
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  }

  await goto(`${BASE}/overview`);
  await shot("r32_overview_entry");

  console.log("commit", COMMIT);
} catch (err) {
  console.error(err);
  await shot("r32_detail_capture_error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
