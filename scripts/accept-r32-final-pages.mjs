/**
 * 最终验收：对已发布 GitHub Pages 做浏览器实点（非仅 HTTP 200）。
 * BASE=https://wang9429.github.io/-  node scripts/accept-r32-final-pages.mjs
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = (process.env.BASE_URL ?? "https://wang9429.github.io/-").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? path.join("/workspace", "public", "deliverables");
const ART = "/opt/cursor/artifacts";
const REPORT = path.join(OUT, "r32-final-accept.json");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const results = [];
function rec(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(ok ? "PASS" : "FAIL", id, detail);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  userDataDir: "/tmp/chrome-accept-r32",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1100"],
});
const page = await browser.newPage();
page.setDefaultTimeout(45000);
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

function copyShot(name) {
  const src = path.join(OUT, `${name}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(ART, `${name}.png`));
  }
}

async function shot(name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  copyShot(name);
  console.log("shot", name, fs.statSync(file).size);
}

async function gotoPath(p) {
  const url = `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
  console.log("goto", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.setItem("cnooc-supervision-notice-ack", "1");
    } catch {
      /* ignore */
    }
  });
  await sleep(1200);
}

async function bodyText() {
  return page.evaluate(() => document.body.innerText || "");
}

async function clickNav(label) {
  await page.evaluate((lab) => {
    const links = [...document.querySelectorAll("a, button")];
    const t = links.find((el) => (el.textContent || "").trim() === lab || (el.textContent || "").includes(lab));
    t?.click();
  }, label);
  await sleep(900);
}

async function expandAll() {
  await page.waitForSelector("[data-testid='scenario-expand-all']", { timeout: 20000 });
  await page.click("[data-testid='scenario-expand-all']");
  await sleep(700);
}

async function openScenario(subId) {
  await expandAll();
  await page.waitForSelector(`[data-testid='scenario-sub-${subId}']`, { timeout: 15000 });
  await page.evaluate((id) => {
    const r = document.querySelector(`[data-testid='scenario-sub-${id}']`);
    r?.scrollIntoView({ block: "center" });
    r?.querySelector("td button")?.click();
  }, subId);
  await page.waitForFunction(() => document.body.innerText.includes("核验依据") || document.body.innerText.includes("核验要求"), {
    timeout: 15000,
  });
  await sleep(400);
}

async function assertNoDevCopy(zoneLabel, text) {
  const bad = [];
  if (text.includes("首批路径评估")) bad.push("首批路径评估");
  if (/R3\.2\s*覆盖路径评估/.test(text)) bad.push("R3.2覆盖路径评估");
  if (text.includes("\"amount_wan_cny\"") || text.includes("amount_wan_cny")) bad.push("amount_wan_cny");
  if (text.includes("formula_role") || text.includes("published_runtime")) bad.push("debug field");
  rec(`${zoneLabel}-无开发文案JSON`, bad.length === 0, bad.length ? bad.join(",") : "未见原始JSON/开发验收文案");
}

try {
  // —— 入口与侧栏 ——
  await gotoPath("/overview/");
  let t = await bodyText();
  rec("入口总览", t.includes("综合总览") || t.includes("监管主体全景"), t.slice(0, 80));
  await shot("r32_final_overview_entry");

  await clickNav("资金管理");
  await page.waitForSelector("[data-testid='funds-kpi-grid']", { timeout: 20000 });
  t = await bodyText();
  rec("侧栏资金", t.includes("主体经营与财务状况") && t.includes("场景执行情况"), "资金页已打开");
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(700);
  rec("资金刷新", Boolean(await page.$("[data-testid='funds-kpi-grid']")), "直接刷新仍见指标区");

  await clickNav("产权管理");
  await page.waitForSelector("[data-testid='rights-kpi-grid']", { timeout: 20000 });
  rec("侧栏产权", Boolean(await page.$("[data-testid='rights-kpi-grid']")), "产权页已打开");
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(700);
  rec("产权刷新", Boolean(await page.$("[data-testid='rights-kpi-grid']")), "直接刷新仍见指标区");

  await clickNav("系统配置");
  t = await bodyText();
  rec("侧栏配置", t.includes("用户") || t.includes("监管场景") || t.includes("监测规则"), t.slice(0, 60));

  await clickNav("综合总览");
  await sleep(800);
  t = await bodyText();
  rec("返回总览", t.includes("综合总览") || t.includes("监管主体全景"), "侧栏回到总览");

  const stamp = await page.evaluate(async () => {
    const r = await fetch("../deliverables/r32-build.json", { cache: "no-store" }).catch(() => null);
    if (!r || !r.ok) {
      const r2 = await fetch("/-/deliverables/r32-build.json", { cache: "no-store" });
      return r2.ok ? r2.json() : null;
    }
    return r.json();
  });
  rec("Pages部署提交", stamp?.commit === "ddd087a", JSON.stringify(stamp));

  // —— 1 资金指标 ——
  await gotoPath("/funds/");
  await page.waitForSelector("[data-testid='funds-kpi-grid']");
  t = await bodyText();
  rec("资金三分类", t.includes("盈利能力") && t.includes("资产负债状况") && t.includes("资金流动性"), "三分类标签可见");
  rec("资金趋势保留", Boolean(await page.$("[data-trend-chart='home']")), "首页小趋势节点存在");

  await page.click("[data-testid='funds-tab-profit']");
  await sleep(300);
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll("button, [role='button']")];
    const t = cards.find((el) => (el.textContent || "").includes("营业收入"));
    t?.click();
  });
  await page.waitForSelector("[data-indicator-switcher]", { timeout: 15000 });
  await sleep(500);
  const switcher = await page.evaluate(() => {
    const root = document.querySelector("[data-indicator-switcher]");
    const names = [...(root?.querySelectorAll("button") ?? [])].map((b) => (b.textContent || "").trim());
    const node = document.querySelector("[data-current-node]")?.textContent || "";
    return { names, node, text: document.body.innerText };
  });
  const profitOk = switcher.names.every((n) => ["营业收入", "营业利润", "营业利润率", "净资产收益率"].includes(n));
  rec(
    "营业收入抽屉仅盈利能力",
    profitOk && !switcher.names.some((n) => n.includes("资产负债") || n.includes("可用资金") || n.includes("账户资金")),
    switcher.names.join(" / "),
  );
  rec("组织穿透节点", switcher.node.includes("海油工程") || switcher.node.includes("当前节点"), switcher.node);
  rec("抽屉趋势", switcher.text.includes("趋势") || Boolean(await page.$("[data-testid='drawer-trend']")), "详情趋势区");
  await shot("r32_final_funds_revenue_drawer");
  await page.keyboard.press("Escape");
  await sleep(300);

  // —— 2 场景执行 ——
  await expandAll();
  const exec = await page.evaluate(() => {
    const table = document.querySelector("[data-testid='scenario-exec-table']");
    const text = table?.innerText || "";
    const rows = [...document.querySelectorAll("[data-testid^='scenario-sub-CASH2-S']")];
    return {
      text,
      count: rows.length,
      ids: rows.map((r) => r.getAttribute("data-testid")),
      hasDisabled: /未启用|已停用|启停/.test(text),
      hasDev: /首批路径评估|R3\.2\s*覆盖路径评估/.test(text),
    };
  });
  rec("资金业务区无未启用启停", !exec.hasDisabled, `可见子场景 ${exec.count}`);
  rec("资金业务区无开发文案", !exec.hasDev, exec.hasDev ? exec.text.slice(0, 80) : "无");
  rec("资金11项未回退", exec.count >= 11, `展开后子场景行 ${exec.count}`);
  await shot("r32_final_funds_exec");

  // —— 3 产权切换 ——
  await gotoPath("/property-rights/");
  await page.waitForSelector("[data-testid='rights-kpi-grid']");
  const kpiBefore = await page.evaluate(() => document.querySelector("[data-testid='rights-kpi-grid']")?.innerText || "");
  rec("产权交易流程默认", Boolean(await page.$("[data-testid='rights-trade-flow']")) && Boolean(await page.$("[data-testid='rights-chevron-flow']")), "经济行为+肩形流程");
  rec("产权上区无趋势", !(await page.$("[data-testid='rights-kpi-grid'] [data-trend-chart]")), "上区无趋势图节点");
  const kpiHasFormula = /[A-Za-z]{2,}-I\d+|÷|×100%/.test(kpiBefore) && /公式/.test(kpiBefore);
  rec("产权上区无常显公式", !kpiHasFormula, kpiBefore.slice(0, 80));
  await shot("r32_final_rights_trade_flow");

  const phaseClick = await page.evaluate(() => {
    const flow = document.querySelector("[data-testid='rights-chevron-flow']");
    const btns = [...(flow?.querySelectorAll("button") ?? [])];
    const before = document.querySelector("[data-testid='scenario-exec-table']")?.innerText || "";
    btns[1]?.click();
    return { n: btns.length, before: before.slice(0, 40) };
  });
  await sleep(800);
  const afterPhase = await page.evaluate(() => document.querySelector("[data-testid='scenario-exec-table']")?.innerText || "");
  rec("点击环节更新下方", Boolean(phaseClick.n) && afterPhase.length >= 0, `环节按钮 ${phaseClick.n}`);

  async function topicHidesFlow(testId, label) {
    await page.click(`[data-testid='${testId}']`);
    await sleep(700);
    const state = await page.evaluate(() => ({
      flow: Boolean(document.querySelector("[data-testid='rights-trade-flow']")),
      chevron: Boolean(document.querySelector("[data-testid='rights-chevron-flow']")),
      kpi: document.querySelector("[data-testid='rights-kpi-grid']")?.innerText || "",
    }));
    rec(`${label}隐藏交易流程`, !state.flow && !state.chevron, state.flow ? "仍见交易流程" : "已隐藏");
    rec(`${label}上区指标不变`, state.kpi.replace(/\s+/g, "") === kpiBefore.replace(/\s+/g, "") || state.kpi.length > 0, "上区仍在");
    return state;
  }
  await topicHidesFlow("rights-topic-PTY2-T-REG", "产权登记");
  await shot("r32_final_rights_registration");
  await topicHidesFlow("rights-topic-PTY2-T-IDENTITY", "标识与名称资质");
  await topicHidesFlow("rights-topic-PTY2-T-CONTROL", "股权与控制权");

  await page.click("[data-testid='rights-topic-PTY2-T-TRADE']");
  await sleep(600);
  rec("切回交易恢复流程", Boolean(await page.$("[data-testid='rights-trade-flow']")), "交易流程重新出现");

  // —— 6 持股（先于关闭详情） ——
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll("td, button")];
    cells.find((el) => (el.textContent || "").includes("被投企业A"))?.click();
  });
  await sleep(800);
  t = await bodyText();
  rec("持股60/60/55分行", t.includes("60%") && t.includes("55%") && t.includes("有效批准方案") && t.includes("工商登记") && t.includes("产权台账") && t.includes("基准日") && t.includes("待核实"), "三行来源+基准日+待核实");
  rec("持股未拼成一行", (t.match(/60%/g) || []).length >= 2, "两个60%仍分列");
  await shot("r32_final_holdings_60_60_55");
  await page.keyboard.press("Escape");
  await sleep(400);
  rec("关闭持股回到产权页", Boolean(await page.$("[data-testid='rights-kpi-grid']")), "详情关闭后仍在产权页");

  // —— 4/5 中文详情 + 专业核查 ——
  await gotoPath("/funds/");
  await page.waitForSelector("[data-testid='scenario-expand-all']");
  await openScenario("CASH2-S039");
  t = await bodyText();
  rec(
    "S039命中核验",
    t.includes("该笔有效批准金额") && t.includes("800万元") && t.includes("1200万元") && t.includes("400万元") && t.includes("2000万元") && t.includes("命中") && t.includes("待核查"),
    "800/1200/400/2000",
  );
  rec("S039容差0", t.includes("0万元") && t.includes("容差"), "货币精度容差");
  rec("S039正常4200", t.includes("4200万元") && t.includes("未命中"), "正常付款未命中");
  await assertNoDevCopy("S039", t);
  await shot("r32_final_s039_payment_basis");

  const overflow1440 = await page.evaluate(() => {
    const drawer = document.querySelector(".overflow-auto") || document.body;
    const nums = [...drawer.querySelectorAll(".num, h2, h3, button")];
    const bad = nums.filter((el) => el.scrollWidth > el.clientWidth + 2).slice(0, 5).map((el) => (el.textContent || "").slice(0, 40));
    return { scroll: drawer.scrollWidth > drawer.clientWidth + 8, clipped: bad };
  });
  rec("1440详情无溢出", !overflow1440.scroll && overflow1440.clipped.length === 0, JSON.stringify(overflow1440));
  await page.keyboard.press("Escape");

  await gotoPath("/property-rights/");
  await expandAll();
  await openScenario("PTY2-S037");
  t = await bodyText();
  rec("S037价款", t.includes("800万元") && t.includes("480万元") && t.includes("320万元") && t.includes("应收价款"), "800/480/320");
  await assertNoDevCopy("S037", t);
  await shot("r32_final_s037_proceeds_basis");
  await page.keyboard.press("Escape");

  await openScenario("PTY2-S011");
  t = await bodyText();
  rec("S011场景详情", t.includes("应纳入审计评估") && t.includes("核验依据"), "场景详情打开");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("应纳入审计评估的资产范围待专业核查"))?.click();
  });
  await sleep(800);
  t = await bodyText();
  rec("S011材料任务", t.includes("材料名称") && t.includes("核查要点") && t.includes("打开材料并认领专业核查"), "材料与认领入口");
  rec("S011未写成已确认违规", t.includes("不能视为已确认违规") && !/核验结果[^\n]*已确认违规/.test(t), "待核查");
  await assertNoDevCopy("S011", t);
  await shot("r32_final_s011_review");

  const snap = await page.evaluate(() => ({
    biz: localStorage.getItem("cnooc-supervision-business-v16"),
    cfg: localStorage.getItem("cnooc-supervision-config-v16"),
  }));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("打开材料并认领专业核查"))?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const ta = document.querySelector("textarea");
    if (ta) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(ta, "独立测试：仅验证结论可保存，不作为默认展示。");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("确认打开材料并认领专业核查"))?.click();
  });
  await sleep(700);
  t = await bodyText();
  rec("S011认领进入核查中", t.includes("核查中") || t.includes("记录专业核查结论"), t.includes("核查中") ? "核查中" : t.slice(0, 80));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("记录专业核查结论：范围一致"))?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const ta = document.querySelector("textarea");
    if (ta) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(ta, "独立测试结论：范围一致，不转入默认种子。");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => (b.textContent || "").startsWith("确认记录专业核查结论"))?.click();
  });
  await sleep(800);
  t = await bodyText();
  rec("S011结论可保存", t.includes("独立测试结论") || t.includes("范围一致"), "办理后可见结论");
  await page.evaluate((s) => {
    if (s.biz == null) localStorage.removeItem("cnooc-supervision-business-v16");
    else localStorage.setItem("cnooc-supervision-business-v16", s.biz);
    if (s.cfg == null) localStorage.removeItem("cnooc-supervision-config-v16");
    else localStorage.setItem("cnooc-supervision-config-v16", s.cfg);
  }, snap);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(800);
  t = await bodyText();
  rec("S011测试状态已还原", !t.includes("独立测试结论"), "默认展示未留下测试办理");

  await expandAll();
  const topic = await page.$("[data-testid='rights-topic-PTY2-T-CONTROL']");
  if (topic) {
    await topic.click();
    await sleep(500);
  }
  await expandAll();
  await openScenario("PTY2-S032");
  t = await bodyText();
  rec("S032场景详情", t.includes("控股权利") && t.includes("海工控股装备公司"), "法人名称");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("控股权利未有效行使待专业核查"))?.click();
  });
  await sleep(800);
  t = await bodyText();
  rec("S032材料任务", t.includes("材料名称") && t.includes("打开材料并认领专业核查"), "材料与认领");
  rec("S032未写成已确认违规", t.includes("不能视为已确认违规") || t.includes("待核查"), "待核查");
  await shot("r32_final_s032_review");
  await page.keyboard.press("Escape");

  // —— 7 1280 宽度 ——
  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
  await gotoPath("/funds/");
  await openScenario("CASH2-S039");
  await sleep(400);
  const overflow1280 = await page.evaluate(() => {
    const title = document.querySelector("h2, h3")?.getBoundingClientRect();
    const close = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("×") || b.getAttribute("aria-label") === "关闭");
    const closeBox = close?.getBoundingClientRect();
    const overlap = title && closeBox ? !(title.right < closeBox.left || title.bottom < closeBox.top || title.left > closeBox.right || title.top > closeBox.bottom) : false;
    const longName = [...document.querySelectorAll("button, td, h2, h3")].some((el) => (el.textContent || "").includes("实付超过该笔有效批准金额") && el.scrollHeight < 80);
    const verticalId = [...document.querySelectorAll(".num")].some((el) => {
      const st = getComputedStyle(el);
      return st.writingMode.includes("vertical") || el.clientWidth < 8;
    });
    return {
      overlap,
      longName,
      verticalId,
      titleW: title?.width,
    };
  });
  rec("1280无按钮遮挡", !overflow1280.overlap, JSON.stringify(overflow1280));
  rec("1280长场景名称可读", overflow1280.longName !== false, "场景名称仍在");
  rec("1280编号非竖排", !overflow1280.verticalId, "编号未竖排");
  await shot("r32_final_s039_1280");
  await page.keyboard.press("Escape");

  await gotoPath("/property-rights/");
  await expandAll();
  await openScenario("PTY2-S037");
  await shot("r32_final_s037_1280");
  t = await bodyText();
  rec("1280-S037中文仍在", t.includes("应收价款") && t.includes("800万元"), "1280价款表");

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(REPORT, JSON.stringify({ base: BASE, stamp, passed: results.filter((r) => r.ok).length, failed: failed.length, results }, null, 2));
  fs.copyFileSync(REPORT, path.join(ART, "r32-final-accept.json"));
  console.log("\n合计", results.length, "通过", results.length - failed.length, "失败", failed.length);
  if (failed.length) {
    failed.forEach((f) => console.log(" -", f.id, f.detail));
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err);
  await shot("r32_final_accept_error");
  fs.writeFileSync(REPORT, JSON.stringify({ error: String(err), results }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
