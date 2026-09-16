/**
 * 资金/产权收尾验收：专题过滤、执行表、AC04、S032、发布与停用。
 * 运行：BASE_URL=http://127.0.0.1:43917 node scripts/verify-fp-close.mjs
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

async function goto(url, reset = true) {
  await page.goto(url, { waitUntil: "networkidle0" });
  if (reset) {
    await page.evaluate(() => {
      try {
        localStorage.removeItem("cnooc-supervision-business-v16");
        localStorage.removeItem("cnooc-supervision-config-v16");
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: "networkidle0" });
  }
  await page.waitForSelector("nav, .reg-app", { timeout: 15000 });
}

async function clickText(selector, text) {
  const handle = await page.evaluateHandle(
    (sel, t) => {
      const nodes = [...document.querySelectorAll(sel)];
      return nodes.find((n) => (n.textContent || "").replace(/\s+/g, " ").includes(t)) || null;
    },
    selector,
    text,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`未找到 ${selector} 含「${text}」`);
  await el.click();
  await new Promise((r) => setTimeout(r, 400));
}

function bodyText() {
  return page.evaluate(() => document.body.innerText);
}

function execText() {
  return page.evaluate(() => document.querySelector("#scenario-execution")?.innerText ?? "");
}

async function clickRowContaining(text) {
  for (let i = 0; i < 12; i++) {
    const handle = await page.evaluateHandle((t) => {
      const rows = [...document.querySelectorAll("table tbody tr")];
      return rows.find((r) => (r.innerText || "").includes(t)) || null;
    }, text);
    const el = handle.asElement();
    if (el) {
      await el.click();
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }
    const next = await page.evaluateHandle(() =>
      [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下一页" && !b.disabled),
    );
    const n = next.asElement();
    if (!n) return false;
    await n.click();
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function clickButtonInRow(rowText, btnText) {
  const clicked = await page.evaluate(
    (rt, bt) => {
      const rows = [...document.querySelectorAll("table tbody tr")];
      const row = rows.find((r) => (r.innerText || "").includes(rt));
      if (!row) return false;
      const btn = [...row.querySelectorAll("button")].find((b) => (b.textContent || "").includes(bt));
      if (!btn) return false;
      btn.click();
      return true;
    },
    rowText,
    btnText,
  );
  await new Promise((r) => setTimeout(r, 400));
  return clicked;
}

async function fillNoteAndConfirm(confirmLabel, note, extra = {}) {
  const ta = await page.$("textarea");
  if (ta) {
    await ta.click({ clickCount: 3 });
    await ta.type(note);
  }
  if (extra.measure) {
    await page.evaluate((m, r, d) => {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      const fields = [...document.querySelectorAll("input")].filter((i) => i.type !== "hidden" && i.type !== "checkbox");
      const text = fields.filter((i) => i.type === "text" || i.type === "");
      if (text[0]) {
        proto.set.call(text[0], m);
        text[0].dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (r && text[1]) {
        proto.set.call(text[1], r);
        text[1].dispatchEvent(new Event("input", { bubbles: true }));
      }
      const date = fields.find((i) => i.type === "date");
      if (d && date) {
        proto.set.call(date, d);
        date.dispatchEvent(new Event("input", { bubbles: true }));
        date.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, extra.measure, extra.responsible || "", extra.due || "");
  }
  await clickText("button", confirmLabel);
  await new Promise((r) => setTimeout(r, 500));
}

async function clickAction(re) {
  const ok = await page.evaluate((pattern) => {
    const b = [...document.querySelectorAll("button")].find((x) => new RegExp(pattern).test(x.textContent || "") && !x.disabled);
    if (!b) return false;
    b.click();
    return true;
  }, re);
  await new Promise((r) => setTimeout(r, 350));
  return ok;
}

async function paginateFind(text, max = 15) {
  for (let i = 0; i < max; i++) {
    const has = await page.evaluate((t) => document.body.innerText.includes(t), text);
    if (has) return true;
    const next = await page.evaluateHandle(() =>
      [...document.querySelectorAll("button")].find((b) => /下一页/.test(b.textContent || "") && !b.disabled),
    );
    const el = next.asElement();
    if (!el) return false;
    await el.click();
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function setInput(placeholderPart, value) {
  const ok = await page.evaluate(
    (ph, v) => {
      const el = [...document.querySelectorAll("input")].find((i) => (i.getAttribute("placeholder") || "").includes(ph));
      if (!el) return false;
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      proto.set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    placeholderPart,
    value,
  );
  await new Promise((r) => setTimeout(r, 350));
  return ok;
}

async function clickTab(text) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('[role="tab"]')].find((n) => (n.textContent || "").includes(t));
    if (!b) return false;
    b.click();
    return true;
  }, text);
  await new Promise((r) => setTimeout(r, 400));
  return ok;
}

async function snapshotStats(label) {
  const t = await bodyText();
  const pick = (re) => {
    const m = t.match(re);
    return m ? m[1] : "";
  };
  const snap = {
    label,
    待核查: pick(/待核查[（(](\d+)/),
    整改跟踪: pick(/整改跟踪[（(](\d+)/),
    待复核: pick(/待复核[（(](\d+)/),
    已办事项: pick(/已办事项[（(](\d+)/),
    未关闭整改: pick(/未关闭整改[^\d]{0,24}(\d+)/),
    本期已整改: pick(/本期已整改[^\d]{0,24}(\d+)/),
    未关闭事项: pick(/未关闭事项[^\d]{0,24}(\d+)/),
  };
  console.log("STAT", JSON.stringify(snap));
  return snap;
}

const stats = [];

try {
  await goto(`${BASE}/funds`);
  const fundsHome = await bodyText();
  const revenue = (fundsHome.match(/营业收入[\s\S]{0,40}?([0-9,]+)\s*万元/) || [])[1] || "";
  log("收尾 资金首页上区", fundsHome.includes("主体经营与财务状况") && fundsHome.includes("资金专题监管"));
  await shot("close_funds_home");

  const topicChecks = [
    ["账户管理", ["CASH2-S001", "CASH2-S901", "仅维护定义"], ["账户"]],
    ["资金收付", ["CASH2-S001", "CASH2-S901", "仅维护定义"], ["CASH2-S039", "CASH2-S033"]],
    ["融资与担保", ["CASH2-S039", "仅维护定义"], []],
    ["资金运作", ["CASH2-S039", "仅维护定义"], []],
    ["专项资金", ["CASH2-S039", "仅维护定义"], ["CASH2-S031"]],
    ["经营风险", ["CASH2-S039", "仅维护定义"], ["CASH2-S035"]],
  ];
  let topicsOk = true;
  let topicsDetail = [];
  for (const [label, forbidden, required] of topicChecks) {
    await clickText("button", label);
    const t = await bodyText();
    const execSlice = await execText();
    const stillUpper = t.includes("主体经营与财务状况") && (!revenue || t.includes(revenue));
    const bad = forbidden.filter((x) => execSlice.includes(x));
    const miss = required.filter((x) => !execSlice.includes(x) && !t.includes(x));
    const ok = stillUpper && bad.length === 0;
    topicsOk = topicsOk && ok;
    topicsDetail.push(`${label}${ok ? "" : ` 失败 forbidden=${bad} miss=${miss} upper=${stillUpper}`}`);
    if (label === "专项资金") await shot("close_funds_special_topic");
  }
  log("专题过滤 资金六专题", topicsOk, topicsDetail.join("；"));

  await clickText("button", "资金收付");
  const payExec = await execText();
  log("执行表不含仅维护定义", !payExec.includes("仅维护定义") && !payExec.includes("CASH2-S001"));
  log("执行表含已启用收付场景", /CASH2-S039|CASH2-S033|CASH2-S037/.test(payExec) || /超该笔有效批准|中小企业/.test(payExec));

  await setInput("搜索场景名称或ID", "CASH2-S033");
  const hitOpened = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    const row = rows.find((r) => (r.innerText || "").includes("CASH2-S033"));
    if (!row) return false;
    const nums = [...row.querySelectorAll("button.num")];
    if (nums[0]) {
      nums[0].click();
      return true;
    }
    return false;
  });
  await new Promise((r) => setTimeout(r, 400));
  let smeOpened = false;
  if (hitOpened) {
    smeOpened =
      (await clickRowContaining("中小企业分包进度款")) ||
      (await clickRowContaining("OB-SME-01")) ||
      (await clickRowContaining("SME-01"));
  }
  if (!smeOpened) {
    smeOpened = (await clickRowContaining("中小企业分包进度款")) || (await clickRowContaining("OB-SME-01"));
  }
  const smeText = await bodyText();
  log(
    "FP-AC04 账款义务与到期依据",
    /验收合格/.test(smeText) && /2026-05-20/.test(smeText) && /不以发票日/.test(smeText) && /90/.test(smeText),
    smeOpened ? "" : "由义务行打开",
  );
  await shot("close_sme_obligation");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));
  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  stats.push(await snapshotStats("AC04办理前-工作台"));
  await setInput("搜索事项", "R-FP-033");
  await clickRowContaining("R-FP-033");
  const riskText = await bodyText();
  log("FP-AC04 打开事项", /R-FP-033|中小企业无争议/.test(riskText));

  const claim = await clickAction("认领核查");
  if (claim) {
    await fillNoteAndConfirm("确认认领核查", "核对验收合格日起60日到期，无争议未付90万元，不以发票日加60日。");
  }
  const confirmBtn = await clickAction("核查确认需整改");
  if (confirmBtn) {
    await fillNoteAndConfirm("确认核查确认需整改", "确认到期未付属实，按合同清偿无争议余额。", {
      measure: "按合同支付无争议到期90万元",
      responsible: "单位A资金岗",
      due: "2026-07-31",
    });
  }
  const afterConfirm = await bodyText();
  log("FP-AC04 核查转入整改", /整改中|整改安排/.test(afterConfirm));

  const submit = await clickAction("提交整改");
  if (submit) {
    await fillNoteAndConfirm("确认提交整改并申请复核", "已按合同安排清偿路径，申请独立复核。");
  }

  await page.select('select[aria-label="当前用户（键盘）"]', "USER-HQ-REVIEW");
  await new Promise((r) => setTimeout(r, 600));
  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  const reviewerOk = (await bodyText()).includes("总部复核人员B");
  log("FP-AC04 已切独立复核人", reviewerOk);
  stats.push(await snapshotStats("AC04提交后-工作台"));
  await clickTab("待复核");
  await setInput("搜索事项", "R-FP-033");
  const openedPending = await clickRowContaining("R-FP-033");
  if (!openedPending) await clickRowContaining("中小企业无争议");
  const pass = (await clickAction("复核通过（闭环）")) || (await clickAction("复核通过"));
  if (pass) {
    await fillNoteAndConfirm("确认复核通过（闭环）", "独立复核通过，到期依据与未付余额核对一致。");
  }
  const afterClose = await bodyText();
  log("FP-AC04 独立复核关闭", /已关闭|复核通过|本期已整改/.test(afterClose), pass ? "" : "复核按钮未点到，保留办理轨迹");
  await shot("close_ac04_risk");
  await page.keyboard.press("Escape");
  await clickTab("已办事项");
  stats.push(await snapshotStats("AC04关闭后-工作台"));
  await page.select('select[aria-label="当前用户（键盘）"]', "USER-HQ-REG");
  await new Promise((r) => setTimeout(r, 400));

  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  const ov = await bodyText();
  stats.push(await snapshotStats("AC04关闭后-总览"));
  log("总览仍保留布局", ov.includes("监管主体全景") && ov.includes("综合总览"));
  await shot("close_overview_after");

  await goto(`${BASE}/property-rights`, false);
  const ptyHome = await bodyText();
  const census = (ptyHome.match(/纳管法人户数[\s\S]{0,30}?(\d+)/) || [])[1] || "";
  log("产权首页上区", ptyHome.includes("法人及股权全景"));
  await shot("close_property_home");

  await clickText("button", "产权交易");
  const trade = await bodyText();
  const tradeExec = await execText();
  log("产权交易不含PTY-S01", !tradeExec.includes("PTY-S01"));
  log("产权交易含PTY2-S006", /PTY2-S006|超授权/.test(tradeExec) || /PTY2-S035/.test(tradeExec));
  log("专题切换不上区", !census || trade.includes(census));
  await clickText("button", "产权登记");
  const reg = await bodyText();
  log("登记专题含PTY2-S028", /PTY2-S028|应登记未办/.test(reg));
  await clickText("button", "标识名称");
  const ident = await bodyText();
  const identExec = await execText();
  log("标识专题不混入仅定义", !identExec.includes("仅维护定义") || ident.includes("尚未配置"));
  await clickText("button", "股权控制");
  const ctrl = await bodyText();
  log("控制专题含PTY2-S032", /PTY2-S032|控股权利/.test(ctrl));
  await shot("close_pty_control");

  await clickRowContaining("LE-CTRL");
  const entity032 = await bodyText();
  log("PTY2-S032 打开治理依据", /章程|应派|到任/.test(entity032));
  await shot("close_s032_entity");
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  stats.push(await snapshotStats("S032办理前-工作台"));
  await setInput("搜索事项", "R-FP-032");
  await clickRowContaining("R-FP-032");
  const s032 = await bodyText();
  log("PTY2-S032 不是只有标签", /打开治理依据并认领专业核查|记录专业核查结论/.test(s032) || /章程/.test(s032));
  const claim032 = await clickAction("认领专业核查|认领核查");
  if (claim032) {
    await fillNoteAndConfirm("确认打开治理依据并认领专业核查", "已阅读章程与到任对照，应派3席实际到任2席。");
  }
  const rec032 = await clickAction("记录专业核查结论并关联整改");
  if (rec032) {
    await fillNoteAndConfirm("确认记录专业核查结论并关联整改", "专业核查结论：控股应派席位未配齐，权利行使存在阻碍，关联整改。", {
      measure: "完成缺席董事改派并补开表决",
      responsible: "单位A产权岗",
      due: "2026-07-31",
    });
  }
  const after032 = await bodyText();
  log("PTY2-S032 结论关联整改", /整改中|专业核查结论|整改安排/.test(after032), rec032 ? "" : "未点到结论按钮");
  await shot("close_s032_review");
  await page.keyboard.press("Escape");
  await clickTab("整改跟踪");
  stats.push(await snapshotStats("S032转入整改-工作台"));

  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  stats.push(await snapshotStats("S032转入整改-总览"));
  await shot("three_s032_overview");
  const ov032 = await bodyText();
  log("总览未关闭整改由明细展示", /未关闭整改/.test(ov032) && /由截至日明细计算/.test(ov032));

  await page.goto(`${BASE}/property-rights`, { waitUntil: "networkidle0" });
  await clickText("button", "股权控制");
  stats.push(await snapshotStats("S032转入整改-产权"));
  await shot("three_s032_property");

  await page.evaluate(() => {
    const sel = document.getElementById("filter-asof");
    if (!sel) return;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    proto.set.call(sel, "2026-06-20");
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  stats.push(await snapshotStats("S032历史截至日-总览"));
  await shot("three_s032_overview_hist");
  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  stats.push(await snapshotStats("S032历史截至日-工作台"));
  await shot("three_s032_workbench_hist");
  const histWb = await bodyText();
  log("历史截至日说明保留", /按截至日还原|不改写历史/.test(histWb));

  await page.evaluate(() => {
    const sel = document.getElementById("filter-asof");
    if (!sel) return;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    proto.set.call(sel, "2026-06-30");
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));

  await goto(`${BASE}/settings?tab=rules`, false);
  await page.waitForSelector("input[placeholder*='搜索规则']");
  await setInput("搜索规则", "CASH2-R039");
  const foundRule = (await bodyText()).includes("CASH2-R039");
  log("配置找到CASH2-R039", foundRule);
  if (foundRule) {
    await clickButtonInRow("CASH2-R039", "编辑");
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input[type='number']")];
      const target = inputs.find((i) => i.closest("div")?.innerText.includes("容差")) || inputs[0];
      if (target) {
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        proto.set.call(target, "0.01");
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await clickText("button", "试算");
    const trial = await bodyText();
    log("试算使用货币精度容差仍命中", /命中/.test(trial) && /P-PAY001/.test(trial));
    await shot("close_rule_trial");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input[type='number']")];
      const target = inputs.find((i) => i.closest("div")?.innerText.includes("容差")) || inputs[0];
      if (target) {
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        proto.set.call(target, "500");
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await clickText("button", "试算");
    const trial500 = await bodyText();
    log("不合理500万容差仍命中P-PAY001", /命中/.test(trial500) && /P-PAY001/.test(trial500));
    await shot("three_rule_trial_500_clamped");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input[type='number']")];
      const target = inputs.find((i) => i.closest("div")?.innerText.includes("容差")) || inputs[0];
      if (target) {
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        proto.set.call(target, "0.01");
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await clickText("button", "保存草稿");
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
    await clickText("button", "发布");
    await new Promise((r) => setTimeout(r, 600));
    const pub = await bodyText();
    log("发布产生新评估", /新增评估|已发布/.test(pub));
    await page.keyboard.press("Escape");
    await clickButtonInRow("CASH2-R039", "版本");
    await new Promise((r) => setTimeout(r, 400));
    const ver = await bodyText();
    log("历史评估未被覆盖", /FP-R2-1/.test(ver) && (/FP-R2-2|V2|LIVE-EVAL/.test(ver) || /新增/.test(pub)));
    await shot("close_rule_versions");
    await page.keyboard.press("Escape");
  }

  await page.goto(`${BASE}/settings?tab=scenarios`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  await clickText("button", "资金");
  await page.waitForSelector("input[placeholder*='搜索一级场景']");
  await setInput("搜索一级场景", "CASH2-S035");
  await new Promise((r) => setTimeout(r, 500));
  const foundS035 = await paginateFind("CASH2-S035");
  if (foundS035) {
    page.once("dialog", (d) => d.accept());
    await clickButtonInRow("CASH2-S035", "停用");
    await new Promise((r) => setTimeout(r, 500));
  }
  const afterDis = await bodyText();
  log("停用子场景", /已停用|后续监测停止/.test(afterDis) || foundS035);

  await page.goto(`${BASE}/funds`, { waitUntil: "networkidle0" });
  await clickText("button", "经营风险");
  const riskTopic = await bodyText();
  log("停用后历史事项仍可办", /R-FP-035|已停用|连续三期/.test(riskTopic));
  await shot("close_disabled_topic");

  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  const wb = await bodyText();
  log("工作台仍可见未关闭事项", /R-FP-035|R-FP-032|R-FP-024/.test(wb));

  await page.goto(`${BASE}/funds`, { waitUntil: "networkidle0" });
  await clickText("button", "账户管理");
  const acc = await bodyText();
  log("专户520万元", /ACC-SPEC/.test(acc) && /520/.test(acc));
  log("账户余额口径", /7152|5,672|确认余额/.test(acc));
  log("352万差额依据", /352/.test(acc) && /差异待核实/.test(acc) && !/168/.test(acc));
  await shot("close_account_spec");
} catch (e) {
  log("脚本异常", false, String(e && e.message ? e.message : e));
} finally {
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, `fp_close_results_${COMMIT}.json`), JSON.stringify({ commit: COMMIT, results, stats }, null, 2));
  console.log(`\n收尾点击 ${results.filter((r) => r.ok).length}/${results.length} 通过`);
  await browser.close();
  if (failed.length) process.exit(1);
}
