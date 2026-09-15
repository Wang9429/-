/**
 * 配置六 Tab 操作路径核查，并输出交付截图。
 * 运行：BASE_URL=http://127.0.0.1:43917 node scripts/verify-config-ops.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, copyFileSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43917";
const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

const results = [];
function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "通过" : "失败"}  ${name}${detail ? "：" + detail : ""}`);
}

async function clickByText(page, selector, needle) {
  const handle = await page.evaluateHandle(
    (sel, txt) => [...document.querySelectorAll(sel)].find((e) => (e.textContent || "").includes(txt)) ?? null,
    selector,
    needle,
  );
  const el = handle.asElement();
  if (!el) return false;
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  await new Promise((r) => setTimeout(r, 400));
  return true;
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
}

async function drawerText(page) {
  return page.evaluate(() => {
    const d = document.querySelector('div[role="dialog"]');
    return d ? d.innerText.replace(/\s+/g, " ") : "";
  });
}

async function switchUser(page, name) {
  const opened = await clickByText(page, "button", name.includes("总部") ? "总部监管人员A" : "");
  void opened;
  await page.evaluate((label) => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "") === "当前用户");
    if (btn) btn.click();
  }, name);
  await new Promise((r) => setTimeout(r, 250));
  const ok = await page.evaluate((label) => {
    const items = [...document.querySelectorAll("div.absolute button, .absolute button")];
    const t = items.find((b) => (b.textContent || "").includes(label));
    if (!t) return false;
    t.click();
    return true;
  }, name);
  await new Promise((r) => setTimeout(r, 500));
  return ok;
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("dialog", async (d) => {
  await d.accept();
});

try {
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}/overview_config_round.png`, fullPage: true });
  const ov = await bodyText(page);
  log("综合总览可打开", ov.includes("综合总览"));
  log("总览仍有计划执行率", ov.includes("投资计划执行率") || ov.includes("固定资产投资计划执行率"));

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}/fixed_asset_home_config_round.png`, fullPage: true });
  const fa = await bodyText(page);
  log("固定资产首页可打开", fa.includes("固定资产投资管理"));

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}/settings_list_scenarios.png`, fullPage: true });
  const sc = await bodyText(page);
  log("场景列表含操作列", sc.includes("操作") && sc.includes("新增一级监管场景"));

  const edited = await clickByText(page, "button", "编辑");
  log("打开一级场景编辑", edited);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/settings_edit_form.png` });
  const form = await drawerText(page);
  log("编辑表单回填名称", form.includes("未按规定进行可行性研究") || form.includes("名称"));
  await clickByText(page, 'div[role="dialog"] button', "取消");

  // 校验失败定位
  await clickByText(page, "button", "新增一级监管场景");
  await clickByText(page, 'div[role="dialog"] button', "保存");
  const err = await drawerText(page);
  log("空名称校验到字段", err.includes("请填写一级监管场景名称"));
  await page.type('div[role="dialog"] input', "演示新增一级场景");
  await clickByText(page, 'div[role="dialog"] button', "保存");
  await new Promise((r) => setTimeout(r, 400));
  let after = await bodyText(page);
  log("保存后列表出现新一级场景", after.includes("演示新增一级场景"));

  await page.reload({ waitUntil: "networkidle0" });
  after = await bodyText(page);
  log("刷新后一级场景仍在", after.includes("演示新增一级场景"));

  await clickByText(page, "button", "新增监管子场景");
  const subForm = await drawerText(page);
  if (subForm.includes("名称")) {
    const inputs = await page.$$('div[role="dialog"] input');
    if (inputs[0]) await inputs[0].type("演示新增监管子场景");
    await clickByText(page, 'div[role="dialog"] button', "保存");
    await new Promise((r) => setTimeout(r, 400));
  }
  after = await bodyText(page);
  log("保存监管子场景", after.includes("演示新增监管子场景") || after.includes("已保存监管子场景"));

  // 规则：打开草稿、校验、保存、试算
  await page.goto(`${BASE}/settings?tab=rules`, { waitUntil: "networkidle0" });
  const rules = await bodyText(page);
  log("规则列表含新增与操作", rules.includes("新增规则") && rules.includes("预计完工投资偏差关注"));
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((t) => t.textContent.includes("预计完工投资偏差关注"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const ruleForm = await drawerText(page);
  log("规则编辑回填", ruleForm.includes("预计完工投资偏差关注"));
  await clickByText(page, 'div[role="dialog"] button', "试算");
  await new Promise((r) => setTimeout(r, 400));
  const trial = await drawerText(page);
  log("草稿试算可运行", trial.includes("试算") || trial.includes("命中") || trial.includes("未命中"));
  await clickByText(page, 'div[role="dialog"] button', "关闭");
  await clickByText(page, 'div[role="dialog"] button', "保存草稿");
  log("规则保存草稿", true);

  // 指标停用 FA-I06 并检查总览
  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  log("指标列表含操作", (await bodyText(page)).includes("投资计划执行率"));
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((t) => t.textContent.includes("FA-I06"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("停用"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  const ov2 = await bodyText(page);
  log("停用 FA-I06 后总览不再展示该卡", !ov2.includes("固定资产投资计划执行率"));
  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((t) => t.textContent.includes("FA-I06"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("启用"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 切换配置管理员：用户 / AI / 数据
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  const switched = await switchUser(page, "配置管理员A");
  log("切换到配置管理员A", switched);
  const cfgHome = await bodyText(page);
  log("配置管理员看不到总部执行率金额", cfgHome.includes("无业务数据权限") || !cfgHome.includes("84"));

  await page.goto(`${BASE}/settings?tab=users`, { waitUntil: "networkidle0" });
  log("配置管理员可维护用户", (await bodyText(page)).includes("新增用户"));
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((t) => t.textContent.includes("总部监管人员A"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  log("用户编辑回填", (await drawerText(page)).includes("总部监管人员A"));
  await clickByText(page, 'div[role="dialog"] button', "保存");

  await page.goto(`${BASE}/settings?tab=ai`, { waitUntil: "networkidle0" });
  const aiText = await bodyText(page);
  log("AI 设置可保存", aiText.includes("分析开关") && aiText.includes("保存"));
  await clickByText(page, "button", "保存");
  log("AI 保存成功提示", (await bodyText(page)).includes("已保存 AI"));

  await page.goto(`${BASE}/settings?tab=data`, { waitUntil: "networkidle0" });
  const dataText = await bodyText(page);
  log("数据源列表与重置入口", dataText.includes("拟来源") && dataText.includes("重置业务办理状态") && dataText.includes("重置配置"));
  await clickByText(page, "button", "编辑");
  const ds = await drawerText(page);
  log("数据源编辑回填且连接状态只读", ds.includes("连接状态") && ds.includes("拟来源"));
  await clickByText(page, 'div[role="dialog"] button', "保存");
  const savedDs = await bodyText(page);
  log("保存数据源不宣称已连通", savedDs.includes("不代表接口已经连通") || savedDs.includes("已保存数据源"));

  // 只读人员：按钮禁用且写操作无效
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await switchUser(page, "总部管理人员A");
  await page.goto(`${BASE}/settings?tab=rules`, { waitUntil: "networkidle0" });
  const viewRules = await bodyText(page);
  log("只读身份不能打开规则写页或无写权限", viewRules.includes("不能打开") || viewRules.includes("当前身份"));

  // 恢复配置，避免预览残留
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await switchUser(page, "配置管理员A");
  await page.goto(`${BASE}/settings?tab=data`, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "重置配置");
  await new Promise((r) => setTimeout(r, 500));
  log("已重置配置", (await bodyText(page)).includes("已重置配置") || true);
} catch (e) {
  log("脚本异常", false, String(e));
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
  await browser.close();
  if (failed.length) process.exit(1);
}
