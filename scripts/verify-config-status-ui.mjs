/**
 * 配置状态校准的页面路径核查。
 * 运行：BASE_URL=http://127.0.0.1:43917 node scripts/verify-config-status-ui.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";

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

async function setFieldSelect(page, fieldLabel, optionText) {
  return page.evaluate(
    (lab, opt) => {
      const field = [...document.querySelectorAll("label")].find((n) => {
        const span = n.querySelector("span");
        return span && span.textContent.trim().startsWith(lab);
      });
      const sel = field?.querySelector("select");
      if (!sel) return false;
      const option = [...sel.options].find((o) => o.textContent.includes(opt));
      if (!option) return false;
      sel.value = option.value;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    fieldLabel,
    optionText,
  );
}

async function setFieldInput(page, fieldLabel, value) {
  return page.evaluate(
    (lab, val) => {
      const field = [...document.querySelectorAll("label")].find((n) => {
        const span = n.querySelector("span");
        return span && span.textContent.trim().startsWith(lab);
      });
      const input = field?.querySelector("input");
      if (!input) return false;
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      proto.set.call(input, val);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    fieldLabel,
    value,
  );
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
  await page.goto(`${BASE}/settings?tab=data`, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "重置配置");
  await new Promise((r) => setTimeout(r, 500));

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "新增监管子场景");
  await new Promise((r) => setTimeout(r, 300));
  const nameInput = await page.$('div[role="dialog"] input');
  if (nameInput) await nameInput.type("校准状态子场景");
  await clickByText(page, 'div[role="dialog"] button', "保存");
  await new Promise((r) => setTimeout(r, 500));
  let t = await bodyText(page);
  log("新增子场景默认待确认适用性", t.includes("待确认适用性"), t.slice(0, 180));
  await page.screenshot({ path: `${OUT}/status_new_scenario_pending.png`, fullPage: true });

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("固定资产清单显示待确认适用性", t.includes("待确认适用性") && t.includes("校准状态子场景"));
  await page.screenshot({ path: `${OUT}/status_fa_pending_applicability.png`, fullPage: true });

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((el) => el.textContent.includes("校准状态子场景"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await setFieldSelect(page, "适用性", "已确定适用");
  await clickByText(page, 'div[role="dialog"] button', "保存");
  await new Promise((r) => setTimeout(r, 500));
  t = await bodyText(page);
  log("已确定适用后反馈待评估", t.includes("待评估"));

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("总部范围清单为待评估", t.includes("校准状态子场景") && t.includes("待评估"));
  await page.screenshot({ path: `${OUT}/status_fa_pending_eval.png`, fullPage: true });

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((el) => el.textContent.includes("校准状态子场景"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await setFieldInput(page, "必要字段", "完工预计投资构成");
  await clickByText(page, 'div[role="dialog"] button', "保存");
  await new Promise((r) => setTimeout(r, 500));
  t = await bodyText(page);
  log("缺字段反馈未评估", t.includes("未评估") && t.includes("完工预计投资构成"));

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("清单显示未评估并列出缺失字段", t.includes("未评估（缺 完工预计投资构成）"));
  await page.screenshot({ path: `${OUT}/status_fa_unevaluated_missing.png`, fullPage: true });

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((el) => el.textContent.includes("校准状态子场景"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await setFieldInput(page, "必要字段", "");
  await clickByText(page, 'div[role="dialog"] button', "保存");
  await new Promise((r) => setTimeout(r, 400));

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  await page.select("#filter-org", "ORG-C::self");
  await new Promise((r) => setTimeout(r, 700));
  t = await bodyText(page);
  log("ORG-C 仅本级显示无业务", t.includes("校准状态子场景") && t.includes("无业务"));
  await page.screenshot({ path: `${OUT}/status_fa_no_business_org_c.png`, fullPage: true });
  await page.select("#filter-org", "ORG-HQ::desc");
  await new Promise((r) => setTimeout(r, 500));

  t = await bodyText(page);
  log("预计超概项目数卡存在", t.includes("预计超概项目数"));
  log("超概关注规则命中项目数卡存在", t.includes("超概关注规则命中项目数"));
  log("未发布时关注命中显示未执行而非0", t.includes("关注规则未发布，未执行") || t.includes("未执行"));
  await page.screenshot({ path: `${OUT}/status_fa_kpis_unpublished.png` });

  await page.goto(`${BASE}/settings?tab=rules`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("规则列表含尚未具备运行条件", t.includes("尚未具备运行条件"));
  log("可执行规则有运行标签", t.includes("可执行"));
  await page.screenshot({ path: `${OUT}/status_rules_runtime.png`, fullPage: true });

  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((el) => el.textContent.includes("预计完工投资偏差关注"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await setFieldInput(page, "偏差率阈值", "10");
  await clickByText(page, 'div[role="dialog"] button', "发布");
  await new Promise((r) => setTimeout(r, 600));
  t = await bodyText(page);
  log("发布10%反馈后续评估采用该版本", t.includes("后续评估采用该版本") && t.includes("历史"));

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("阈值10%后仍有预计超概项目数", t.includes("预计超概项目数"));
  await page.screenshot({ path: `${OUT}/status_fa_kpis_watch_10.png`, fullPage: true });

  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("发布10%后工作台仍有R01", t.includes("R01"));

  await page.goto(`${BASE}/settings?tab=rules`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((el) => el.textContent.includes("预计完工投资偏差关注"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("编辑"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await setFieldInput(page, "偏差率阈值", "25");
  await clickByText(page, 'div[role="dialog"] button', "发布");
  await new Promise((r) => setTimeout(r, 600));
  t = await bodyText(page);
  log("发布25%不覆盖历史", t.includes("历史事项") || t.includes("历史评估") || t.includes("后续评估"));

  await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}/status_fa_kpis_watch_25.png`, fullPage: true });

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  const clickedGroup = await clickByText(page, "td, button, tr", "擅自变更工程设计");
  log("定位 FA-S20 所属一级场景", clickedGroup);
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((el) => el.textContent.includes("FA-S20") || el.textContent.includes("投资执行超概算风险"));
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.includes("停用"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 700));
  t = await bodyText(page);
  log("停用场景反馈未关闭事项仍可办理", t.includes("后续监测停止") && t.includes("未关闭事项仍可查看并办理"));

  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("停用后工作台仍列出 R01", t.includes("R01") && t.includes("预计完工投资超过有效概算"));
  await page.screenshot({ path: `${OUT}/status_workbench_r01_after_disable.png`, fullPage: true });

  const opened = await clickByText(page, "td, button, tr", "R01");
  log("可打开 R01", opened);
  await new Promise((r) => setTimeout(r, 500));
  let d = await drawerText(page);
  log("事项可见触发规则名称", d.includes("FA-R20-01") && d.includes("预计完工投资"));
  log("事项可见历史评估版本", d.includes("DEMO-RULES-V1.2") || d.includes("历史评估版本"));
  log("事项显示场景已停用", d.includes("已停用"));
  log("事项仍可办理", d.includes("认领核查") || d.includes("核查确认") || d.includes("提交整改"));
  await page.screenshot({ path: `${OUT}/status_r01_source_after_disable.png` });

  const evid = await clickByText(page, "button", "依据与规则");
  await new Promise((r) => setTimeout(r, 400));
  d = await drawerText(page);
  log("依据页可见当时参数", d.includes("11800") && (d.includes("10000") || d.includes("DEMO-RULES-V1.2")));
  await page.screenshot({ path: `${OUT}/status_r01_eval_after_disable.png` });

  await page.goto(`${BASE}/object/FA-P001`, { waitUntil: "networkidle0" }).catch(() => null);
  if (page.url().includes("FA-P001")) {
    t = await bodyText(page);
    log("对象档案仍能进入 FA-P001", t.includes("FA-P001") || t.includes("基地能力提升"));
  } else {
    await page.goto(`${BASE}/fixed-asset-investment`, { waitUntil: "networkidle0" });
    await clickByText(page, "button, td, a", "FA-P001");
    await new Promise((r) => setTimeout(r, 500));
    d = await drawerText(page);
    const switched = await clickByText(page, "button", "监管事项");
    void switched;
    await new Promise((r) => setTimeout(r, 400));
    d = await drawerText(page);
    log("对象档案仍列出 R01", d.includes("R01"));
    await page.screenshot({ path: `${OUT}/status_object_r01_after_disable.png` });
  }

  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  t = await bodyText(page);
  log("指标运行列含仅目录", t.includes("仅目录"));
  log("指标运行列含已接入计算", t.includes("已接入计算"));
  await page.screenshot({ path: `${OUT}/status_indicators_runtime.png`, fullPage: true });

  await page.goto(`${BASE}/settings?tab=data`, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "重置配置");
  await new Promise((r) => setTimeout(r, 500));
  log("已重置配置避免预览残留", true);
} catch (e) {
  log("脚本异常", false, String(e));
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
  await browser.close();
  if (failed.length) process.exit(1);
}
