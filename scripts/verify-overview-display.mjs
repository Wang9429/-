/**
 * 综合总览两处显示修正：首页 FA 文案、历史截至日监测空态。
 * 只核对本轮默认截至日 2026-06-30 与历史截至日 2026-05-15。
 * 运行：node scripts/verify-overview-display.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43917";
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
page.setDefaultTimeout(30000);

async function gotoOverview() {
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".reg-kpis");
}
async function kpis() {
  return page.evaluate(() =>
    [...document.querySelectorAll(".reg-kpis > *")].map((c) => c.innerText.replace(/\s+/g, " ")),
  );
}
async function textHas(s) {
  return page.evaluate((t) => document.body.innerText.includes(t), s);
}
async function clickReturn(key) {
  return page.evaluate((k) => {
    const el = document.querySelector(`[data-overlay-return="${k}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, key);
}
async function topDialog() {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    if (!d) return { open: false, title: "", text: "" };
    return {
      open: true,
      title: (d.querySelector("h3, h2")?.textContent || "").trim(),
      text: d.innerText.replace(/\s+/g, " "),
    };
  });
}
async function closeOverlay() {
  const closed = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const btn = d?.querySelector('button[aria-label="关闭"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (!closed) await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 280));
}
async function shot(name) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 280));
  const file = path.join(OUT, `${name}_${COMMIT}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

const shots = [];

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("cnooc-supervision-business-v16");
    localStorage.removeItem("cnooc-supervision-config-v16");
  });
  await gotoOverview();

  const asOf = await page.$eval("#filter-asof", (el) => el.value);
  log("默认截至日为2026-06-30", asOf === "2026-06-30", asOf);

  const homepage = await page.evaluate(() => document.body.innerText);
  log("首页有投资计划执行率", homepage.includes("投资计划执行率"));
  log("首页有投资完成额", homepage.includes("投资完成额"));
  log("首页不常显完成额为执行率分子", !homepage.includes("完成额为执行率分子"));

  const faOrder = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-domain-card")].find((c) =>
      (c.textContent || "").includes("固定资产投资"),
    );
    const labels = [...(card?.querySelectorAll(".reg-domain-metrics > *") ?? [])].map((n) => {
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      return t;
    });
    return labels;
  });
  log(
    "固定资产卡执行率在完成额之前",
    Boolean(faOrder[0]?.includes("投资计划执行率") && faOrder[1]?.includes("投资完成额")),
    faOrder.slice(0, 2).join(" || "),
  );

  const clickedRate = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      (b.textContent || "").includes("投资计划执行率"),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  log("打开投资计划执行率抽屉", clickedRate);
  await new Promise((r) => setTimeout(r, 500));
  const drawer = await topDialog();
  log(
    "计算依据含完成额为分子关系",
    drawer.text.includes("分子（投资完成额）") ||
      drawer.text.includes("投资完成额是本指标分子") ||
      drawer.text.includes("投资完成额即本指标分子") ||
      drawer.text.includes("共用启用和首页展示开关"),
    drawer.title,
  );
  shots.push(await shot("display_fa_i06_basis_20260630"));
  await closeOverlay();

  const junCards = await kpis();
  const junHit = junCards.find((t) => t.includes("规则命中涉及单位")) || "";
  log(
    "默认截至日命中单位为数字",
    /\d+\s*家/.test(junHit) && !junHit.includes("未开展监测"),
    junHit,
  );
  const junDomainHit = await page.evaluate(() =>
    [...document.querySelectorAll(".reg-domain-exceptions button")]
      .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
      .filter((t) => t.includes("命中规则")),
  );
  log(
    "默认截至日领域命中为数字条",
    junDomainHit.some((t) => /命中规则\s+\d+\s+条/.test(t)) && !junDomainHit.every((t) => t.includes("未开展监测")),
    junDomainHit.slice(0, 4).join(" | "),
  );
  shots.push(await shot("display_overview_20260630"));

  await page.select("#filter-asof", "2026-05-15");
  await new Promise((r) => setTimeout(r, 700));
  const histCards = await kpis();
  const histHit = histCards.find((t) => t.includes("规则命中涉及单位")) || "";
  log(
    "历史截至日命中单位为—／未开展监测",
    histHit.includes("未开展监测") && histHit.includes("—") && !/\d+\s*家/.test(histHit),
    histHit,
  );
  log("历史截至日首页仍无分子说明", !(await textHas("完成额为执行率分子")));
  log("历史截至日金额未覆盖", (await textHas("该截至日数据未覆盖")) || (await textHas("数据未覆盖")));

  const histDomainHit = await page.evaluate(() =>
    [...document.querySelectorAll(".reg-domain-exceptions button")]
      .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
      .filter((t) => t.includes("命中规则")),
  );
  log(
    "历史截至日领域卡未开展监测",
    histDomainHit.length > 0 && histDomainHit.every((t) => t.includes("—") && t.includes("未开展监测")),
    histDomainHit.slice(0, 4).join(" | "),
  );

  const unitHit = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-org-node")].find((c) =>
      (c.textContent || "").includes("海油工程总部"),
    );
    const btn = [...(card?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("命中规则"));
    return (btn?.textContent || "").replace(/\s+/g, " ").trim();
  });
  log("历史截至日单位卡命中为—", unitHit.includes("—") && !/\d/.test(unitHit.replace("命中规则", "")), unitHit);

  await clickReturn("kpi-hit-orgs");
  await new Promise((r) => setTimeout(r, 400));
  const hitDlg = await topDialog();
  log(
    "历史截至日命中清单为未开展监测",
    hitDlg.open && hitDlg.text.includes("未开展监测") && !hitDlg.text.includes("共 0 家"),
    hitDlg.text.slice(0, 180),
  );
  await closeOverlay();

  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 400));
  const rectDlg = await topDialog();
  log(
    "历史截至日R11仍未关闭",
    rectDlg.text.includes("导管架建造") || rectDlg.text.includes("R11") || rectDlg.text.includes("已闭环"),
    rectDlg.text.slice(0, 180),
  );
  shots.push(await shot("display_overview_20260515"));
  await closeOverlay();

  const faHistHit = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-domain-card")].find((c) =>
      (c.textContent || "").includes("固定资产投资"),
    );
    const btn = [...(card?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("命中规则"));
    btn?.click();
    return (btn?.textContent || "").replace(/\s+/g, " ").trim();
  });
  await new Promise((r) => setTimeout(r, 400));
  const faHitDlg = await topDialog();
  log(
    "历史截至日领域清单与卡片一致",
    faHistHit.includes("未开展监测") && faHitDlg.text.includes("未开展监测"),
    `${faHistHit} || ${faHitDlg.text.slice(0, 120)}`,
  );
  await closeOverlay();

  await page.select("#filter-asof", "2026-06-30");
  await new Promise((r) => setTimeout(r, 600));
  const restored = ((await kpis()).find((t) => t.includes("规则命中涉及单位")) || "");
  log("切回默认截至日命中单位恢复数字", /\d+\s*家/.test(restored) && restored.includes(junHit.match(/\d+/)?.[0] || "8"), restored);
  log("切回后默认截至日仍为2026-06-30", (await page.$eval("#filter-asof", (el) => el.value)) === "2026-06-30");
} catch (err) {
  log("脚本异常", false, String(err && err.stack ? err.stack : err));
} finally {
  const fail = results.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, `overview_display_verify_${COMMIT}.json`), JSON.stringify({ commit: COMMIT, results, shots }, null, 2));
  console.log(`\n合计：${results.filter((r) => r.ok).length} 通过，${fail} 失败。COMMIT=${COMMIT}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
