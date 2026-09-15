/**
 * 校验 P78「计算依据」与当前指标、当前组织节点、当前期间一致，
 * 并把两个指标的计算依据各截一张图。运行：node scripts/trace-check.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43917";
const OUT = "/workspace/screenshots";
const results = [];
const log = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "通过" : "失败"}  ${name}${detail ? "：" + detail : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

/** 取最深层（不含更深匹配子节点）的匹配元素，避免点到外层容器 */
async function clickByText(selector, needle) {
  const h = await page.evaluateHandle(
    (s, t) => {
      const hits = [...document.querySelectorAll(s)].filter((e) => e.textContent.includes(t));
      return hits.find((e) => !hits.some((o) => o !== e && e.contains(o))) ?? null;
    },
    selector,
    needle,
  );
  const el = h.asElement();
  if (!el) return false;
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  await new Promise((r) => setTimeout(r, 450));
  return true;
}

const topOverlay = () =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll('div[role="dialog"]')];
    return all.length ? all[all.length - 1].innerText.replace(/\s+/g, " ") : "";
  });

async function openTraceFor(indicatorName, objectName) {
  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 900));
  await clickByText("button", indicatorName);
  await clickByText('div[role="dialog"] div, div[role="dialog"] button', objectName);
  await clickByText('div[role="dialog"] button', "查看计算依据 P78");
  return topOverlay();
}

console.log("\n== 指标一：投资计划执行率（FA-I06）==");
let t = await openTraceFor("投资计划执行率", "演示基地能力提升项目");
log("弹窗标题绑定当前指标与对象", t.includes("数据追溯 P78：投资计划执行率·演示基地能力提升项目"), t.slice(0, 60));
log("公式为“完成投资 ÷ 同期有效计划”", t.includes("同期累计完成投资合计 ÷ 同期有效累计计划合计 × 100%"));
log("不再串用 EAC 偏差率公式", !t.includes("effective_approved_budget"));
log("分子分母为 4,800.00 ÷ 6,000.00", t.includes("4,800.00 ÷ 6,000.00"), t.match(/分子 ÷ 分母 [^ ]+ ÷ [^ ]+/)?.[0] ?? "");
log("计算结果 80.00%", /计算结果 80\.00%/.test(t), t.match(/计算结果 [^ ]+/)?.[0] ?? "");
log("标注对象与期间", t.includes("FA-P001") && t.includes("2026-01-01~2026-06-30"));
log("输入构成含完成投资与资金支付分列", t.includes("同期完成投资 4800 万元") && t.includes("资金支付 4200 万元"));
await page.screenshot({ path: `${OUT}/p78-投资计划执行率-FA-P001.png` });

console.log("\n== 指标二：预计完工投资偏差率（FA-I07）==");
t = await openTraceFor("预计完工投资偏差率", "演示基地能力提升项目");
log("弹窗标题绑定当前指标与对象", t.includes("数据追溯 P78：预计完工投资偏差率·演示基地能力提升项目"), t.slice(0, 60));
log("公式为 EAC 与有效批准概算之差", t.includes("（预计完工投资 EAC 合计 − 有效批准概算合计） ÷ 有效批准概算合计 × 100%"));
log("分子分母为 1,800.00 ÷ 10,000.00", t.includes("1,800.00 ÷ 10,000.00"), t.match(/分子 ÷ 分母 [^ ]+ ÷ [^ ]+/)?.[0] ?? "");
log("计算结果 +18.00%", /计算结果 \+18\.00%/.test(t), t.match(/计算结果 [^ ]+/)?.[0] ?? "");
log("输入构成显示 EAC 11800 与概算 10000", t.includes("预计完工投资 EAC 11800 万元") && t.includes("有效批准概算 10000 万元"));
log("挂接已登记追溯与源记录", t.includes("已登记追溯") && t.includes("SAP-FA001-ACT"));
await page.screenshot({ path: `${OUT}/p78-预计完工投资偏差率-FA-P001.png` });

console.log("\n== 指标三：同一指标切换到另一项目（FA-P003）==");
t = await openTraceFor("投资计划执行率", "演示设施技改项目");
log("对象切换后取值随之改变", t.includes("3,600.00 ÷ 4,000.00") && /计算结果 90\.00%/.test(t), t.match(/计算结果 [^ ]+/)?.[0] ?? "");
log("FA-P003 无登记追溯时明示未登记源记录", t.includes("演示数据未对") && t.includes("登记逐笔源记录"));

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n合计 ${ok}/${results.length} 项通过`);
process.exit(ok === results.length ? 0 : 1);
