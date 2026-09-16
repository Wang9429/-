/**
 * 综合总览—专项领域指标穿透：范围、联动与「只看异常」。
 * 生产构建浏览器交互，不能用口径脚本替代。
 * 运行：node scripts/verify-indicator-drawer.mjs
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

async function resetStorage() {
  await page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("cnooc-supervision-business-v16");
    localStorage.removeItem("cnooc-supervision-config-v16");
  });
}

async function goto(pathName) {
  await page.goto(`${BASE}${pathName}`, { waitUntil: "networkidle0" });
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(name) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await wait(280);
  const file = path.join(OUT, `${name}_${COMMIT}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function setOrg(orgId, includeChildren) {
  await page.select("#filter-org", `${orgId}::${includeChildren ? "desc" : "self"}`);
  await wait(400);
}

async function filterValue() {
  return page.evaluate(() => document.querySelector("#filter-org")?.value ?? "");
}

async function clickReturn(key) {
  return page.evaluate((k) => {
    const el = document.querySelector(`[data-overlay-return="${k}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, key);
}

async function dialog() {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    if (!d) return { open: false, title: "", text: "", tree: "", node: "", value: "", coverage: "", details: "", switcher: false, switchNames: [] };
    const tree = d.querySelector("[data-drawer-tree]");
    return {
      open: true,
      title: (d.querySelector("h2, h3")?.textContent || "").trim(),
      text: d.innerText.replace(/\s+/g, " "),
      tree: (tree?.innerText || "").replace(/\s+/g, " "),
      node: (d.querySelector("[data-current-node]")?.textContent || "").trim(),
      value: (d.querySelector("[data-drawer-value]")?.textContent || "").trim(),
      coverage: (d.querySelector("[data-drawer-coverage]")?.textContent || "").trim(),
      details: (d.querySelector("[data-detail-count]")?.textContent || "").trim(),
      switcher: Boolean(d.querySelector("[data-indicator-switcher]")),
      switchNames: [...d.querySelectorAll("[data-switch-indicator]")].map((b) => b.getAttribute("data-switch-indicator")),
    };
  });
}

async function clickNode(id) {
  return page.evaluate((nid) => {
    const el = document.querySelector(`[data-node-id="${nid}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, id);
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
  await wait(280);
}

function parseCoverage(s) {
  const m = String(s).match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { evaluated: Number(m[1]), expected: Number(m[2]) } : { evaluated: -1, expected: -1 };
}

function parseDetailCount(s) {
  const m = String(s).match(/共\s*(\d+)\s*个对象/);
  return m ? Number(m[1]) : -1;
}

await resetStorage();
await goto("/overview");
await page.waitForSelector(".reg-domains");

const overviewRateClicked = await clickReturn("FA-I06");
await wait(500);
const ov = await dialog();
log("总览打开投资计划执行率抽屉", overviewRateClicked && ov.open && ov.title.includes("投资计划执行率"), ov.title);
log("总览抽屉无切换指标", ov.open && !ov.switcher && ov.switchNames.length === 0, ov.switchNames.join(","));
log("总览抽屉不含股权等其他领域指标名", ov.open && !ov.text.includes("股权投资账面") && !ov.tree.includes("切换指标"), ov.text.slice(0, 80));
const ovValue = ov.value;
const ovNode = ov.node;
await shot("drawer-overview-fa-i06");
await closeOverlay();

await goto("/fixed-asset-investment");
await page.waitForSelector(".reg-kpis-domain");
const faClicked = await clickReturn("FA-I06");
await wait(500);
const fa = await dialog();
log("领域页打开同一执行率", faClicked && fa.open && fa.title.includes("投资计划执行率"), fa.title);
log("总览与领域页初始节点一致", ovNode === fa.node, `总览 ${ovNode} / 领域 ${fa.node}`);
log("总览与领域页初始数值一致", ovValue === fa.value, `总览 ${ovValue} / 领域 ${fa.value}`);
log("领域页切换仅本领域可运行指标", fa.switcher && fa.switchNames.every((id) => String(id).startsWith("FA-")), fa.switchNames.join(","));
log("领域页切换不含停用/仅目录 FA-I01", !fa.switchNames.includes("FA-I01"), fa.switchNames.join(","));
log("领域页切换不含股权指标", !fa.switchNames.some((id) => String(id).startsWith("EQ-")), fa.switchNames.join(","));
await shot("drawer-domain-fa-i06");

const bgBefore = await filterValue();
const clickA = await clickNode("ORG-A");
await wait(250);
const afterA = await dialog();
const clickA1 = await clickNode("ORG-A1");
await wait(250);
const afterA1 = await dialog();
const clickP = await clickNode("FA-P001");
await wait(250);
const afterP = await dialog();
const bgAfter = await filterValue();
log("总部范围可下钻到单位A", clickA && afterA.node.includes("下属二级单位A"), afterA.node);
log("可继续下钻到A1", clickA1 && afterA1.node.includes("下属三级单位A1"), afterA1.node);
log("可继续下钻到项目", clickP && afterP.node.includes("基地能力"), afterP.node);
log("抽屉下钻不改变背景筛选", bgBefore === bgAfter && bgAfter.startsWith("ORG-HQ"), `${bgBefore} → ${bgAfter}`);
log("项目节点无undefined", afterP.open && !afterP.node.includes("undefined") && !afterP.text.includes("undefined"), afterP.node);
await shot("drawer-hq-drill-p001");
await closeOverlay();

await setOrg("ORG-A", true);
const aBg = await filterValue();
const aOpened = await clickReturn("FA-I06");
await wait(500);
const aDrawer = await dialog();
log("单位A范围打开执行率", aOpened && aDrawer.open && aDrawer.tree.includes("下属二级单位A"), aDrawer.node);
log("单位A范围不能穿透到单位B", aDrawer.open && !aDrawer.tree.includes("下属二级单位B") && !aDrawer.text.includes("下属二级单位B"), aDrawer.tree.slice(0, 120));
log("单位A祖先总部仅路径展示", aDrawer.text.includes("海油工程总部") && !(await page.evaluate(() => Boolean(document.querySelector('[data-drawer-tree] [data-node-id="ORG-HQ"]')))), "path");
const aCov = parseCoverage(aDrawer.coverage);
const aDet = parseDetailCount(aDrawer.details);
log("单位A汇总覆盖与明细同口径", aCov.expected === aDet && aDet >= 0, `覆盖 ${aDrawer.coverage} / ${aDrawer.details}`);
await shot("drawer-unit-a-no-b");

const clickProjectInA = await clickNode("FA-P001");
await wait(300);
if (!clickProjectInA) {
  await clickNode("ORG-A1");
  await wait(200);
  await clickNode("FA-P001");
  await wait(300);
}
const beforeSwitch = await dialog();
const switchToAsset = await page.evaluate(() => {
  const btn = document.querySelector('[data-switch-indicator="FA-I14"]');
  if (!btn) return false;
  btn.click();
  return true;
});
await wait(500);
const afterSwitch = await dialog();
const bgStillA = await filterValue();
log("切换资产指标后背景仍为单位A", bgStillA === aBg, bgStillA);
log("切换后节点回到筛选单位而非总部", afterSwitch.node.includes("下属二级单位A") && !afterSwitch.node.includes("海油工程总部") && !afterSwitch.node.includes("undefined"), afterSwitch.node);
log("切换后无undefined", !afterSwitch.text.includes("undefined") && !afterSwitch.node.includes("undefined"), afterSwitch.node);
const swCov = parseCoverage(afterSwitch.coverage);
const swDet = parseDetailCount(afterSwitch.details);
log("切换后汇总与明细同口径", swCov.expected === swDet, `覆盖 ${afterSwitch.coverage} / ${afterSwitch.details}`);
await shot("drawer-switch-fa-i14");

await page.evaluate(() => {
  const box = document.querySelector("[data-only-abnormal]");
  if (box) box.click();
});
await wait(400);
const abnormal = await dialog();
log("只看异常不混入无关领域事项标题", !abnormal.tree.includes("股权") && !abnormal.text.includes("现金回报"), abnormal.tree.slice(0, 100));
log("只看异常文案区分关联事项", abnormal.text.includes("对象关联事项") && abnormal.text.includes("不计入当前指标异常"), "related");
await shot("drawer-only-abnormal");
await closeOverlay();

const otherDomains = [
  ["/equity-investment", "EQ-BALANCE", "股权"],
  ["/international-business", "INTL-CNT", "国际化"],
  ["/funds", "CASH-I02", "资金"],
  ["/property-rights", "RIGHTS-ENTITIES", "产权"],
  ["/engineering-projects", "ENG-I01", "工程"],
];
for (const [route, id, label] of otherDomains) {
  await goto(route);
  await page.waitForSelector(".reg-kpis-domain, h1");
  const opened = await clickReturn(id);
  await wait(450);
  const d = await dialog();
  const names = d.switchNames;
  const otherPrefix = ["FA", "EQ", "INTL", "CASH", "RIGHTS", "ENG"].filter((p) => !id.startsWith(p.split("-")[0] === "INTL" ? "INTL" : p));
  const domainPrefix = id.split("-")[0];
  const prefix = domainPrefix === "RIGHTS" ? "RIGHTS" : domainPrefix;
  const cross = names.filter((x) => x && !String(x).startsWith(prefix === "CASH" ? "CASH" : prefix));
  log(`${label}领域抽屉可打开且无跨领域切换`, opened && d.open && cross.length === 0, `${d.title} 切换:${names.join(",")}`);
  log(`${label}抽屉无undefined`, d.open && !d.text.includes("undefined"), d.node);
  const cov = parseCoverage(d.coverage);
  const det = parseDetailCount(d.details);
  log(`${label}覆盖与明细同口径`, !d.open || cov.expected === det, `${d.coverage} / ${d.details}`);
  await shot(`drawer-spot-${id.toLowerCase()}`);
  await closeOverlay();
}

await goto("/overview");
await setOrg("ORG-A", true);
const enterFa = await page.evaluate(() => {
  const links = [...document.querySelectorAll("a")];
  const el = links.find((a) => (a.textContent || "").trim() === "进入领域" && a.getAttribute("href")?.includes("fixed-asset"));
  if (!el) return false;
  el.click();
  return true;
});
await wait(800);
const onFa = page.url().includes("fixed-asset-investment");
const stillA = await filterValue();
log("进入领域到达固定资产首页", enterFa && onFa, page.url());
log("进入领域继承单位A筛选", stillA.startsWith("ORG-A"), stillA);

const failed = results.filter((r) => !r.ok);
console.log(`\n合计：${results.filter((r) => r.ok).length} 通过，${failed.length} 失败。`);
if (failed.length) {
  failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? "：" + f.detail : ""}`));
  await browser.close();
  process.exit(1);
}
await browser.close();
console.log("指标抽屉交互验收全部通过。");
