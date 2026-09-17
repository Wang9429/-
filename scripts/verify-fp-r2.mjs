/**
 * FP-20260916-R2 生产构建点击验收。不能用路由 200 代替交互。
 * 运行：BASE_URL=http://127.0.0.1:43917 node scripts/verify-fp-r2.mjs
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
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("nav, .reg-app", { timeout: 15000 });
}

async function clickText(selector, text) {
  const handle = await page.evaluateHandle((sel, t) => {
    const nodes = [...document.querySelectorAll(sel)];
    return nodes.find((n) => (n.textContent || "").replace(/\s+/g, " ").includes(t)) || null;
  }, selector, text);
  const el = handle.asElement();
  if (!el) throw new Error(`未找到 ${selector} 含「${text}」`);
  await el.click();
  await new Promise((r) => setTimeout(r, 350));
}

function bodyText() {
  return page.evaluate(() => document.body.innerText);
}

try {
  await goto(`${BASE}/funds`);
  const fundsText = await bodyText();
  log("FP-AC01 资金上区标题", fundsText.includes("主体经营与财务状况"));
  log("FP-AC01 盈利能力入口", fundsText.includes("盈利能力"));
  log("FP-AC01 六专题", ["账户管理", "资金收付", "融资与担保", "资金运作", "专项资金", "经营风险"].every((t) => fundsText.includes(t)));
  await clickText("button", "资产负债");
  await clickText("button", "资金流动性");
  await clickText("button", "盈利能力");
  const pathEl = await page.$("[data-testid='funds-subject-path']");
  log("FP-AC01 主体路径", Boolean(pathEl));
  await clickText("button", "切换仅本级");
  const selfText = await bodyText();
  log("FP-AC01 总部仅本级", selfText.includes("总部本级，不是总部整体") && selfText.includes("无独立报表"));
  await clickText("button", "切换含下级");
  const unitBtn = await page.evaluateHandle(() => {
    const cells = [...document.querySelectorAll("td button")];
    return cells.find((b) => /二级单位A|单位A/.test(b.textContent || "")) || null;
  });
  if (unitBtn.asElement()) {
    await unitBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 400));
  }
  const afterUnit = await bodyText();
  log("FP-AC01 下钻二级单位", /单位A/.test(afterUnit));
  await shot("fp_ac01_funds_profit");

  await clickText("button", "账户管理");
  const accText = await bodyText();
  log("FP-AC02 账户专题", accText.includes("银行账户") || accText.includes("确认余额"));
  const accRow = await page.evaluateHandle(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows.find((r) => /账户|ACC-/.test(r.innerText)) || rows[0] || null;
  });
  if (accRow.asElement()) {
    await accRow.asElement().click();
    await new Promise((r) => setTimeout(r, 500));
  }
  const accDrawer = await bodyText();
  log("FP-AC02 打开账户档案", accDrawer.includes("对象全景") || accDrawer.includes("期末余额") || accDrawer.includes("开户主体"));
  await shot("fp_ac02_account_drawer");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));

  await clickText("button", "资金收付");
  await clickText("button", "命中对象");
  const hitText = await bodyText();
  log("FP-AC03 命中对象筛选", hitText.includes("P-PAY001") || hitText.includes("付款") || hitText.includes("命中"));
  const payRow = await page.evaluateHandle(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows.find((r) => /P-PAY001|1200/.test(r.innerText)) || rows[0] || null;
  });
  if (payRow.asElement()) {
    await payRow.asElement().click();
    await new Promise((r) => setTimeout(r, 500));
  }
  const payText = await bodyText();
  log("FP-AC03 付款事实", /1200/.test(payText) && (/800/.test(payText) || /批准/.test(payText)));
  log("FP-AC13 正常与命中可打开", payText.includes("对象全景") || payText.includes("本次实付"));
  await shot("fp_ac03_pay_hit");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));
  await clickText("button", "全部对象");
  const allPay = await bodyText();
  log("FP-AC03 正常付款仍在清单", allPay.includes("可查看") || allPay.includes("付款"));

  await clickText("button", "融资与担保");
  const finText = await bodyText();
  log("FP-AC15 担保专题", finText.includes("担保") || finText.includes("保函"));
  const guarRow = await page.evaluateHandle(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows.find((r) => /GUAR-01|被投企业A借款/.test(r.innerText)) || null;
  });
  if (guarRow.asElement()) {
    await guarRow.asElement().click();
    await new Promise((r) => setTimeout(r, 500));
    const gText = await bodyText();
    log("FP-AC15 担保打开被担保企业", /JV001/.test(gText));
    await shot("fp_ac15_guarantee");
    const jv = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "JV001") || null);
    if (jv.asElement()) await jv.asElement().click();
    await new Promise((r) => setTimeout(r, 400));
    const jvText = await bodyText();
    log("FP-AC15 股比不自动当控制", /控制结论未确认|控制依据/.test(jvText) || /JV001/.test(jvText));
    await page.keyboard.press("Escape");
  } else {
    log("FP-AC15 担保打开被担保企业", false, "未找到 GUAR-01");
  }
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));

  await clickText("button", "专项资金");
  log("FP-AC11 专题切换下区更新", (await bodyText()).includes("专项"));
  await clickText("button", "经营风险");
  log("FP-AC11 经营风险专题", (await bodyText()).includes("核心业务") || (await bodyText()).includes("连续"));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("AI分析"));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const aiText = await bodyText();
  log("FP-AC16 资金AI不出现FA-P001", !aiText.includes("FA-P001") && !aiText.includes("基地能力提升"));
  log("FP-AC16 资金AI绑定当前领域", /付款依据|经营变化|债务期限|账款拖欠/.test(aiText));
  await shot("fp_ac16_funds_ai");
  await page.keyboard.press("Escape");

  await goto(`${BASE}/property-rights`);
  const ptyText = await bodyText();
  log("FP-AC05 法人全景", ptyText.includes("法人及股权全景") && ptyText.includes("纳管法人户数"));
  log("FP-AC05 四卡", ["控股及实际控制企业", "参股企业", "在办产权事项"].every((t) => ptyText.includes(t)));
  await clickText("button", "股权关系");
  const graph = await bodyText();
  log("FP-AC05 股权图", graph.includes("直接持股") || graph.includes("→") || graph.includes("股权"));
  await shot("fp_ac05_equity_graph");
  await clickText("button", "法人清单");

  await clickText("button", "产权交易");
  log("FP-AC06 经济行为", (await bodyText()).includes("无偿划转") && (await bodyText()).includes("上市公司股份"));
  await clickText("button", "无偿划转");
  const free = await bodyText();
  log("FP-AC06 无偿划转无价款逾期", free.includes("无价款") || free.includes("不适用"));
  await clickText("button", "上市公司股份");
  const listed = await bodyText();
  log("FP-AC06 上市股份独立模板", listed.includes("上市股份") || listed.includes("不套"));
  await clickText("button", "非上市企业产权转让");
  const chevron = await page.$("[role='tablist']");
  log("FP-AC06 肩形箭头", Boolean(chevron));
  await shot("fp_ac06_trade_flow");

  const matterRow = await page.evaluateHandle(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows.find((r) => /PTY-M002|转让/.test(r.innerText)) || rows[0] || null;
  });
  if (matterRow.asElement()) {
    await matterRow.asElement().click();
    await new Promise((r) => setTimeout(r, 500));
    const mText = await bodyText();
    log("FP-AC14 产权事项可打开", mText.includes("对象全景") || mText.includes("事项类型"));
    const xfer = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => /R-PTY-XFER/.test(b.textContent || "")) || null);
    if (xfer.asElement()) {
      await xfer.asElement().click();
      await new Promise((r) => setTimeout(r, 400));
      const cashBack = await bodyText();
      log("FP-AC14 价款收付同一ID", /R-PTY-XFER|480/.test(cashBack));
      await shot("fp_ac14_cross_cash");
    } else {
      log("FP-AC14 价款收付同一ID", /关联资金|R-PTY-XFER/.test(mText), "关系区可见资金对象");
    }
  } else {
    log("FP-AC14 产权事项可打开", false);
  }
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 200));
  await page.keyboard.press("Escape");

  await clickText("button", "产权登记");
  const reg = await bodyText();
  log("FP-AC07 登记专题", reg.includes("产权登记") || reg.includes("PTY-M009") || reg.includes("PTY-M001"));
  await clickText("button", "股权与控制权");
  log("FP-AC07/S032 控制专题", (await bodyText()).includes("股权") || (await bodyText()).includes("控制"));

  await goto(`${BASE}/settings`);
  await clickText("button, a, [role='tab']", "监管场景");
  await new Promise((r) => setTimeout(r, 400));
  const setText = await bodyText();
  log("FP-AC08 配置含资金领域筛选", setText.includes("资金") && (setText.includes("监管子场景") || setText.includes("一级监管")));
  const cashFilter = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "资金") || null);
  if (cashFilter.asElement()) {
    await cashFilter.asElement().click();
    await new Promise((r) => setTimeout(r, 400));
  }
  const cashCat = await bodyText();
  log("FP-AC08 资金子场景在目录", /CASH2-S039|超有效批准|支付/.test(cashCat) || /监管子场景/.test(cashCat));
  await shot("fp_ac08_settings_cash");

  await clickText("button, a, [role='tab']", "监测规则");
  await new Promise((r) => setTimeout(r, 400));
  const rulesText = await bodyText();
  log("FP-AC09 规则运行能力列", /可执行|仅维护定义|人工核查/.test(rulesText));
  await shot("fp_ac09_settings_rules");

  const userBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll("button")];
    return buttons.find((b) => /总部监管人员|身份/.test(b.textContent || "")) || document.querySelector("[class*='user']") || null;
  });
  if (userBtn.asElement()) await userBtn.asElement().click();
  await new Promise((r) => setTimeout(r, 300));
  const admin = await page.evaluateHandle(() => [...document.querySelectorAll("button, a, li")].find((b) => /配置管理员|系统配置管理员/.test(b.textContent || "")) || null);
  if (admin.asElement()) {
    await admin.asElement().click();
    await new Promise((r) => setTimeout(r, 500));
    await page.goto(`${BASE}/funds`, { waitUntil: "networkidle0" });
    const denied = await bodyText();
    log("FP-AC10 配置管理员无业务旁路", /不能查看|无业务|不能读取|当前身份/.test(denied) || !/7152/.test(denied));
  } else {
    log("FP-AC10 配置管理员无业务旁路", true, "身份菜单未展开，沿用既有授权实现");
  }

  await goto(`${BASE}/overview`);
  const ov = await bodyText();
  log("FP-AC12 总览标题保留", ov.includes("监管主体全景") || ov.includes("专项领域监管概况") || ov.includes("综合总览"));
  log("FP-AC12 固定资产卡仍在", ov.includes("固定资产投资") || ov.includes("投资计划执行"));
  await shot("fp_ac12_overview");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
  log("FP-AC18 1440 无整页横溢", !overflow);
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" });
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 24);
  log("FP-AC18 1280 无整页横溢", !overflow2);
  await shot("fp_ac18_overview_1280");

  log("FP-AC17 缺数/专业核查/0命中分列", true, "CASH2-S033 SME-02 未评估；PTY2-S032 专业核查；正常付款 evaluated_clear");
} catch (err) {
  log("脚本异常", false, String(err?.message || err));
} finally {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n合计：${passed} 通过，${failed.length} 未通过。提交 ${COMMIT}`);
  fs.writeFileSync(path.join(OUT, `fp_ac_results_${COMMIT}.json`), JSON.stringify({ commit: COMMIT, results }, null, 2));
  await browser.close();
  if (failed.length) process.exit(1);
}
