/**
 * 交互冒烟：脚本驱动真实 Chrome 走一遍指标穿透、环节联动与事项办理闭环。
 * 仅用于本地核查，不参与构建。运行：node scripts/ui-smoke.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43917";
const results = [];
const errors = [];

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
await page.setViewport({ width: 1440, height: 900 });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("hmr")) errors.push(`console: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() === 404) errors.push(`404: ${new URL(r.url()).pathname}`);
});


async function clickByText(selector, needle) {
  const handle = await page.evaluateHandle(
    (sel, txt) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(txt)) ?? null,
    selector,
    needle,
  );
  const el = handle.asElement();
  if (!el) return false;
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  await new Promise((r) => setTimeout(r, 450));
  return true;
}

async function bodyText() {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
}

async function drawerText() {
  return page.evaluate(() => {
    const d = document.querySelector('div[role="dialog"]');
    return d ? d.innerText.replace(/\s+/g, " ") : "";
  });
}

console.log("\n== 固定资产投资管理：指标穿透抽屉（P71） ==");
await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });

const openedKpi = await clickByText("button", "投资计划执行率");
log("点击「投资计划执行率」指标卡", openedKpi);
let d = await drawerText();
log("指标穿透抽屉已打开", d.length > 0, d.slice(0, 60));
log("抽屉显示总部口径 84.00%", d.includes("84.00%"));
log("左侧组织树含二级单位", d.includes("演示二级单位甲"));

const drilled = await clickByText(
  'div[role="dialog"] button, div[role="dialog"] div[role="treeitem"], div[role="dialog"] div',
  "演示三级单位甲一",
);
log("点击三级单位甲一下钻", drilled);
d = await drawerText();
log("下钻后出现 FA-P001 项目层", d.includes("FA-P001"));
log("下钻后显示 80.00%", d.includes("80.00%"));

const bgBefore = await bodyText();
log("背景页全局组织未被抽屉修改", bgBefore.includes("当前范围：海油工程总部（总部·含下级）"));

await clickByText('div[role="dialog"] button', "查看计算依据 P78");
let modal = await page.evaluate(() => {
  const all = [...document.querySelectorAll('div[role="dialog"]')];
  return all.length > 1 ? all[all.length - 1].innerText.replace(/\s+/g, " ") : "";
});
log("数据追溯 P78 弹窗打开", modal.includes("数据追溯 P78"), modal.slice(0, 50));
log(
  "P78 绑定当前指标而非其他指标",
  modal.includes("投资计划执行率（FA-I06）") &&
    modal.includes("同期累计完成投资合计 ÷ 同期有效累计计划合计 × 100%") &&
    modal.includes("4,800.00 ÷ 6,000.00") &&
    !modal.includes("effective_approved_budget"),
);
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 300));

await clickByText('div[role="dialog"] button', "业务关联 P79");
modal = await page.evaluate(() => {
  const all = [...document.querySelectorAll('div[role="dialog"]')];
  return all.length > 1 ? all[all.length - 1].innerText.replace(/\s+/g, " ") : "";
});
log("业务关联 P79 直接落在对象档案的业务关系页签", modal.includes("业务关系"), modal.slice(0, 50));
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 300));

await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 400));
log("Esc 关闭抽屉", (await drawerText()) === "");

console.log("\n== 横向箭头环节联动（下区五数） ==");
const readFive = async () => {
  const t = await bodyText();
  const m = t.match(
    /监测对象数 观察期 (\d+) 个[\s\S]{0,80}?命中对象数 观察期 (\d+) 个[\s\S]{0,80}?未关闭事项数 截至日 (\d+) 件[\s\S]{0,120}?本期已整改闭环数 本期闭环 (\d+) 件[\s\S]{0,80}?逾期整改数 截至日 (\d+) 件/,
  );
  return m ? m.slice(1, 6).join("/") : "未解析";
};

await clickByText("button", "建设实施");
const fiveA = await readFive();
log("点击「建设实施」后下区统计", fiveA !== "未解析", fiveA);

await clickByText("button", "运营及后评价");
const fiveB = await readFive();
log("切到「运营及后评价」统计变化", fiveB !== fiveA && fiveB !== "未解析", `${fiveA} → ${fiveB}`);

const bt = await bodyText();
log("顶部 KPI 口径未被阶段选择缩小", bt.includes("84.00%"));

console.log("\n== 事项抽屉与整改复核闭环（跨页共享状态） ==");
await page.goto(`${BASE}/engineering-projects`, { waitUntil: "networkidle0" });
const openBefore = (await bodyText()).match(/未关闭监管事项 详情 › (\d+)/)?.[1];
const openedRisk = await clickByText("button, td, tr", "境外工程预计毛利率低于目标");
log("从重点关注点击事项打开办理抽屉", openedRisk);
d = await drawerText();
log("事项抽屉含办理时间线", d.includes("办理"), d.slice(0, 70));

// R05 种子状态为整改中：提交整改 → 复核通过，本期闭环 +1、未关闭 -1
const submitted = await clickByText('div[role="dialog"] button', "提交整改并申请复核");
log("点击「提交整改并申请复核」", submitted);
await page.type('div[role="dialog"] textarea', "演示：整改措施已执行完毕，申请复核。");
await clickByText("div[role=\"dialog\"] button", "确认");
await new Promise((r) => setTimeout(r, 700));
d = await drawerText();
log("状态变为待复核", d.includes("待复核"), d.slice(0, 70));

const verified = await clickByText('div[role="dialog"] button', "复核通过");
log("点击「复核通过」", verified);
await page.type('div[role="dialog"] textarea', "演示：复核确认整改到位，予以关闭。");
await clickByText("div[role=\"dialog\"] button", "确认");
await new Promise((r) => setTimeout(r, 800));
d = await drawerText();
log("事项已关闭", d.includes("已关闭"), d.slice(0, 70));

await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 500));
const openAfter = (await bodyText()).match(/未关闭监管事项 详情 › (\d+)/)?.[1];
log("本页未关闭数减少", Number(openAfter) === Number(openBefore) - 1, `${openBefore} → ${openAfter}`);

await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 900));
const ov = await bodyText();
log("综合总览同步为 7 件", /未关闭监管事项 详情 › 7 件/.test(ov), ov.match(/未关闭监管事项 详情 › \d+ 件/)?.[0] ?? "");

// 复位：重置演示数据，恢复种子 8 件
await clickByText("button", "重置演示数据");
await new Promise((r) => setTimeout(r, 400));
await clickByText("button", "确认重置");
await new Promise((r) => setTimeout(r, 900));
const reset = await bodyText();
log("重置后恢复种子 8 件", /未关闭监管事项 详情 › 8 件/.test(reset), reset.match(/未关闭监管事项 详情 › \d+ 件/)?.[0] ?? "");

await browser.close();

console.log(`\n合计 ${results.filter((r) => r.ok).length}/${results.length} 项通过`);
if (errors.length) {
  console.log("\n浏览器报错：");
  [...new Set(errors)].forEach((e) => console.log("  - " + e));
}
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
