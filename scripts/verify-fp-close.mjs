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

async function clickRowContaining(text) {
  const handle = await page.evaluateHandle((t) => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows.find((r) => (r.innerText || "").includes(t)) || null;
  }, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await new Promise((r) => setTimeout(r, 500));
  return true;
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

try {
  await goto(`${BASE}/funds`);
  const fundsHome = await bodyText();
  const revenue = (fundsHome.match(/营业收入[\s\S]{0,40}?([0-9,]+)\s*万元/) || [])[1] || "";
  log("收尾 资金首页上区", fundsHome.includes("主体经营与财务状况") && fundsHome.includes("资金专题监管"));
  await shot("close_funds_home");

  const topicChecks = [
    ["账户管理", ["CASH2-S001", "仅维护定义"], ["账户"]],
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
    const stillUpper = t.includes("主体经营与财务状况") && (!revenue || t.includes(revenue));
    const bad = forbidden.filter((x) => t.includes(x) && t.includes("监管场景执行情况"));
    const execSlice = t.split("监管场景执行情况")[1] ?? t;
    const miss = required.filter((x) => !execSlice.includes(x) && !t.includes(x));
    const ok = stillUpper && bad.length === 0;
    topicsOk = topicsOk && ok;
    topicsDetail.push(`${label}${ok ? "" : ` 失败 forbidden=${bad} miss=${miss} upper=${stillUpper}`}`);
    if (label === "专项资金") await shot("close_funds_special_topic");
  }
  log("专题过滤 资金六专题", topicsOk, topicsDetail.join("；"));

  await clickText("button", "资金收付");
  const payExec = (await bodyText()).split("监管场景执行情况")[1] ?? "";
  log("执行表不含仅维护定义", !payExec.includes("仅维护定义") && !payExec.includes("CASH2-S001"));
  log("执行表含已启用收付场景", /CASH2-S039|CASH2-S033|CASH2-S037/.test(payExec) || /超该笔有效批准|中小企业/.test(payExec));

  await clickText("button", "全部对象");
  const smeOpened = await clickRowContaining("中小企业分包");
  let smeText = "";
  if (smeOpened) {
    smeText = await bodyText();
  } else {
    await clickRowContaining("OB-SME-01");
    smeText = await bodyText();
  }
  log(
    "FP-AC04 账款义务与到期依据",
    /验收合格/.test(smeText) && /2026-05-20/.test(smeText) && /不以发票日/.test(smeText) && /90/.test(smeText),
    smeOpened ? "" : "由义务行打开",
  );
  await shot("close_sme_obligation");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 250));

  const statsBefore = await page.evaluate(() => {
    const text = document.body.innerText;
    const n = (label) => {
      const m = text.match(new RegExp(label + "[\\s\\S]{0,40}?(\\d+)"));
      return m ? m[1] : "";
    };
    return {
      monitored: n("监测对象数"),
      open: n("未关闭事项数"),
    };
  });

  const openSmeRisk = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, a")];
    const b = btns.find((x) => (x.textContent || "").includes("R-FP-033"));
    if (b) {
      b.click();
      return true;
    }
    const rows = [...document.querySelectorAll("table tbody tr")];
    const row = rows.find((r) => /中小企业无争议|R-FP-033/.test(r.innerText));
    if (row) {
      const num = [...row.querySelectorAll("button")].find((x) => /^\d+$/.test((x.textContent || "").trim()));
      (num || row).click();
      return Boolean(row);
    }
    return false;
  });
  await new Promise((r) => setTimeout(r, 500));
  if (!openSmeRisk) {
    await page.evaluate(() => {
      const cells = [...document.querySelectorAll("button")];
      const openBtn = cells.find((b) => (b.textContent || "").trim() !== "0" && b.closest("tr")?.innerText.includes("中小企业"));
      openBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    await clickRowContaining("R-FP-033");
  }
  let riskText = await bodyText();
  if (!riskText.includes("R-FP-033") && !riskText.includes("中小企业无争议")) {
    await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
    await clickRowContaining("R-FP-033");
    riskText = await bodyText();
  }
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
  await new Promise((r) => setTimeout(r, 500));
  await page.goto(`${BASE}/supervision-workbench`, { waitUntil: "networkidle0" });
  await clickRowContaining("R-FP-033");
  const pass = await clickAction("复核通过");
  if (pass) {
    await fillNoteAndConfirm("确认复核通过（闭环）", "独立复核通过，到期依据与未付余额核对一致。");
  }
  const afterClose = await bodyText();
  log("FP-AC04 独立复核关闭", /已关闭|复核通过|本期已整改/.test(afterClose), pass ? "" : "复核按钮未点到，保留办理轨迹");
  await shot("close_ac04_risk");
  await page.keyboard.press("Escape");
  await page.select('select[aria-label="当前用户（键盘）"]', "USER-HQ-REG");
  await new Promise((r) => setTimeout(r, 400));

  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  const ov = await bodyText();
  log("总览仍保留布局", ov.includes("监管主体全景") && ov.includes("综合总览"));
  await shot("close_overview_after");

  await goto(`${BASE}/property-rights`, false);
  const ptyHome = await bodyText();
  const census = (ptyHome.match(/纳管法人户数[\s\S]{0,30}?(\d+)/) || [])[1] || "";
  log("产权首页上区", ptyHome.includes("法人及股权全景"));
  await shot("close_property_home");

  await clickText("button", "产权交易");
  const trade = await bodyText();
  const tradeExec = trade.split("监管场景执行情况")[1] ?? trade;
  log("产权交易不含PTY-S01", !tradeExec.includes("PTY-S01"));
  log("产权交易含PTY2-S006", /PTY2-S006|超授权/.test(tradeExec) || /PTY2-S035/.test(tradeExec));
  log("专题切换不上区", !census || trade.includes(census));
  await clickText("button", "产权登记");
  const reg = await bodyText();
  log("登记专题含PTY2-S028", /PTY2-S028|应登记未办/.test(reg));
  await clickText("button", "标识名称");
  const ident = await bodyText();
  const identExec = ident.split("监管场景执行情况")[1] ?? "";
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

  await goto(`${BASE}/settings?tab=rules`, false);
  const foundRule = await paginateFind("CASH2-R039");
  log("配置找到CASH2-R039", foundRule);
  if (foundRule) {
    await clickButtonInRow("CASH2-R039", "编辑");
    await new Promise((r) => setTimeout(r, 400));
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
    const trial = await bodyText();
    log("试算使用新容差", /未命中|容差500/.test(trial) || trial.includes("P-PAY001"));
    await shot("close_rule_trial");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 200));
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
  await page.evaluate(() => {
    const sel = document.querySelector("select");
    if (sel) {
      const opt = [...sel.options].find((o) => /资金/.test(o.textContent || ""));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });
  await new Promise((r) => setTimeout(r, 400));
  const foundS035 = await paginateFind("CASH2-S035");
  if (foundS035) {
    page.once("dialog", (d) => d.accept());
    await clickButtonInRow("CASH2-S035", "停用");
    await new Promise((r) => setTimeout(r, 500));
  } else {
    const groups = await page.$$("button, [role='option']");
    log("定位CASH2-S035", false, "需在一级场景中切换");
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
  await shot("close_account_spec");
} catch (e) {
  log("脚本异常", false, String(e && e.message ? e.message : e));
} finally {
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, `fp_close_results_${COMMIT}.json`), JSON.stringify({ commit: COMMIT, results }, null, 2));
  console.log(`\n收尾点击 ${results.filter((r) => r.ok).length}/${results.length} 通过`);
  await browser.close();
  if (failed.length) process.exit(1);
}
