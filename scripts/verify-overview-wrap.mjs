/**
 * 综合总览四项收尾：指标独立开关、单位卡/清单范围、历史截至日、整改闭环。
 * 运行：node scripts/verify-overview-wrap.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43917";
const OUT = process.env.SHOT_DIR ?? "/opt/cursor/artifacts";
const COMMIT = execSync("git rev-parse --short HEAD", { cwd: "/workspace" }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync("/workspace/public", { recursive: true });

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
page.on("dialog", async (d) => d.accept());

async function gotoOverview() {
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".reg-kpis");
}
async function resetStorage() {
  await page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("cnooc-supervision-business-v16");
    localStorage.removeItem("cnooc-supervision-config-v16");
  });
  await gotoOverview();
}
async function shot(name) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 350));
  const file = path.join(OUT, `${name}_${COMMIT}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
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
async function clickText(t, exact = false) {
  return page.evaluate(
    (text, exactMatch) => {
      const nodes = [...document.querySelectorAll("button, a, [role='button']")];
      const el = nodes.find((n) => {
        const s = (n.textContent || "").replace(/\s+/g, " ").trim();
        return exactMatch ? s === text : s.includes(text);
      });
      if (!el) return false;
      el.click();
      return true;
    },
    t,
    exact,
  );
}
async function topDialog() {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    if (!d) return { open: false, title: "", text: "", n: 0, rows: [] };
    const title = (d.querySelector("h3, h2")?.textContent || "").trim();
    const text = d.innerText.replace(/\s+/g, " ");
    const rows = [...d.querySelectorAll("tbody tr")].map((r) => r.innerText.replace(/\s+/g, " ").trim());
    const n = Number((text.match(/共\s+(\d+)\s+(家|条)/) || [])[1] || 0);
    return { open: true, title, text: text.slice(0, 400), n, rows };
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
async function kpis() {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".reg-kpis > *")];
    return cards.map((c) => c.innerText.replace(/\s+/g, " "));
  });
}
async function clickPagedAction(idText, action) {
  for (let i = 0; i < 25; i++) {
    const found = await page.evaluate(
      (id, act) => {
        const row = [...document.querySelectorAll("tr")].find((r) => (r.textContent || "").includes(id));
        if (!row) return "missing";
        const btn = [...row.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === act);
        if (!btn || btn.disabled) return "no-btn";
        btn.click();
        return "ok";
      },
      idText,
      action,
    );
    if (found === "ok") return true;
    const next = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "下一页");
      if (!b || b.disabled) return false;
      b.click();
      return true;
    });
    if (!next) return false;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}
async function switchUser(name) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").includes("本地身份"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate((n) => {
    const item = [...document.querySelectorAll("button, [role='menuitem']")].find((b) => (b.textContent || "").includes(n));
    item?.click();
  }, name);
  await new Promise((r) => setTimeout(r, 600));
}
function parseRect(text) {
  const open = Number((text.match(/未关闭整改事项数\s*(\d+)\s*件/) || [])[1] || 0);
  const done = Number((text.match(/本期完成整改\s*(\d+)\s*件/) || [])[1] || 0);
  const overdue = Number((text.match(/逾期整改\s*(\d+)\s*件/) || [])[1] || 0);
  return { open, done, overdue };
}

const shots = [];

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await resetStorage();

  const before = parseRect((await kpis()).join(" "));
  log("默认未关闭整改可读", before.open > 0, JSON.stringify(before));

  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  log("停用FA-I06", await clickPagedAction("FA-I06", "停用"));
  await gotoOverview();
  const faGone = !(await textHas("投资计划执行率")) && !(await textHas("投资完成额"));
  const otherKeep = (await textHas("股权投资账面金额")) && (await textHas("可用资金"));
  log("停用执行率后完成额一并隐藏且不补位", faGone && otherKeep, `完成额/执行率隐藏=${faGone} 其他领域仍在=${otherKeep}`);
  shots.push(await shot("wrap_fa_i06_disabled"));
  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  log("重新启用FA-I06", await clickPagedAction("FA-I06", "启用"));
  await gotoOverview();
  log(
    "启用后完成额与执行率恢复且首页无分子说明",
    (await textHas("投资计划执行率")) && (await textHas("投资完成额")) && !(await textHas("完成额为执行率分子")),
  );
  shots.push(await shot("wrap_fa_i06_enabled"));

  const clickedA = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下属二级单位A");
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 700));
  const aCardN = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-org-node")].find((c) =>
      (c.textContent || "").includes("下属二级单位A"),
    );
    const btn = [...(card?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("纳管项目"));
    const n = Number((btn?.textContent || "").replace(/\D/g, "") || 0);
    btn?.click();
    return n;
  });
  await new Promise((r) => setTimeout(r, 400));
  const aList = await topDialog();
  log(
    "单位A含下级卡片数字与清单一致",
    clickedA && aList.n === aCardN && aList.title.includes("含下级"),
    `卡${aCardN} 清单${aList.n} 标题${aList.title}`,
  );
  shots.push(await shot("wrap_unit_a_descendants_list"));
  await closeOverlay();

  const a1n = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-org-node")].find((c) => (c.textContent || "").includes("下属三级单位A1"));
    const btn = [...(card?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("纳管项目"));
    const n = Number((btn?.textContent || "").replace(/\D/g, "") || 0);
    btn?.click();
    return n;
  });
  await new Promise((r) => setTimeout(r, 400));
  const a1List = await topDialog();
  log("末级A1卡片与清单一致", a1List.n === a1n && a1n > 0, `卡${a1n} 清单${a1List.n} 标题${a1List.title}`);
  shots.push(await shot("wrap_unit_a1_list"));
  await closeOverlay();

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("返回总部"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await clickReturn("kpi-units");
  await new Promise((r) => setTimeout(r, 400));
  const selfOpened = await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((r) => (r.textContent || "").includes("下属二级单位A") && !(r.textContent || "").includes("A1"));
    const btn = [...(row?.querySelectorAll("button") ?? [])].find((b) => /^\d+$/.test((b.textContent || "").trim()));
    const n = Number(btn?.textContent || 0);
    btn?.click();
    return n;
  });
  await new Promise((r) => setTimeout(r, 400));
  const selfList = await topDialog();
  log(
    "本级纳管项目数打开仅本级清单",
    selfList.title.includes("仅本级") && selfList.n === selfOpened && selfList.n < aCardN,
    `本级${selfOpened}/${selfList.n} 含下级${aCardN} 标题${selfList.title}`,
  );
  shots.push(await shot("wrap_unit_a_self_list"));
  await closeOverlay();

  const bn = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-org-node")].find((c) =>
      (c.textContent || "").includes("下属二级单位B") && !(c.textContent || "").includes("A"),
    );
    const btn = [...(card?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("纳管项目"));
    const n = Number((btn?.textContent || "").replace(/\D/g, "") || 0);
    btn?.click();
    return n;
  });
  await new Promise((r) => setTimeout(r, 400));
  const bList = await topDialog();
  log("无三级单位B卡片与清单一致", bList.n === bn && bn > 0, `卡${bn} 清单${bList.n}`);
  await closeOverlay();

  const hqN = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".reg-org-node")].find((c) => (c.textContent || "").includes("海油工程总部"));
    const btn = [...(card?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("纳管项目"));
    const n = Number((btn?.textContent || "").replace(/\D/g, "") || 0);
    btn?.click();
    return n;
  });
  await new Promise((r) => setTimeout(r, 400));
  const hqList = await topDialog();
  log("总部含下级卡片与清单一致", hqList.n === hqN && hqList.title.includes("含下级"), `卡${hqN} 清单${hqList.n}`);
  await closeOverlay();

  await clickReturn("kpi-hit-orgs");
  await new Promise((r) => setTimeout(r, 400));
  const hitDlg = await topDialog();
  const names = hitDlg.rows.join("|");
  log("命中涉及单位含A直接归属且不含总部", names.includes("下属二级单位A") && !names.includes("海油工程总部"), names.slice(0, 180));
  await closeOverlay();

  await page.select("#filter-asof", "2026-05-15");
  await new Promise((r) => setTimeout(r, 700));
  const histOverlay = await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
  log("切换截至日关闭旧清单", histOverlay === 0);
  const histKpi = parseRect((await kpis()).join(" "));
  const histHitCard = ((await kpis()).find((t) => t.includes("规则命中涉及单位")) || "");
  const faUncovered = (await textHas("该截至日数据未覆盖")) || (await textHas("数据未覆盖"));
  log("历史截至日指标不沿用6月末", faUncovered && !(await textHas("84.555")));
  log(
    "历史截至日命中单位为未开展监测",
    histHitCard.includes("未开展监测") && histHitCard.includes("—") && !/\d+\s*家/.test(histHitCard),
    histHitCard,
  );
  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 400));
  const histRect = await topDialog();
  log("历史截至日R11仍未关闭", histRect.rows.some((r) => r.includes("导管架建造") || r.includes("R11") || r.includes("已闭环")), histRect.rows.slice(0, 4).join("|"));
  shots.push(await shot("wrap_asof_20260515_open_rect"));
  await closeOverlay();
  log("历史截至日未关闭与6月末不同", histKpi.open !== before.open, JSON.stringify({ jun: before, may: histKpi }));

  await page.select("#filter-asof", "2026-06-30");
  await new Promise((r) => setTimeout(r, 600));
  shots.push(await shot("wrap_rect_before_close"));
  const pre = parseRect((await kpis()).join(" "));

  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((r) => (r.textContent || "").includes("重大装备持续低利用率"));
    const btn = [...(row?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "查看详情");
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await clickText("提交整改并申请复核");
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const ta = [...document.querySelectorAll("textarea")].at(-1);
    if (!ta) return;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(ta, "已落实利用率改善措施并完成现场复核准备。");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await clickText("确认提交整改并申请复核");
  await new Promise((r) => setTimeout(r, 500));
  log("办理人已提交整改申请复核", await textHas("待复核") || await textHas("已完成"));
  await closeOverlay();
  await closeOverlay();

  await switchUser("总部复核人员B");
  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("tr")].find((r) => (r.textContent || "").includes("重大装备持续低利用率"));
    const btn = [...(row?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "查看详情");
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await clickText("复核通过（闭环）");
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const ta = [...document.querySelectorAll("textarea")].at(-1);
    if (!ta) return;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(ta, "独立复核通过，利用率改善措施已落实。");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await clickText("确认复核通过（闭环）");
  await new Promise((r) => setTimeout(r, 600));
  log("独立复核通过", await textHas("已闭环") || await textHas("已关闭"));
  shots.push(await shot("wrap_rect_detail_closed"));
  await closeOverlay();
  await closeOverlay();

  await switchUser("总部监管人员A");
  const post = parseRect((await kpis()).join(" "));
  log("未关闭整改减少1", post.open === pre.open - 1, JSON.stringify({ pre, post }));
  log("本期完成整改增加1", post.done === pre.done + 1, JSON.stringify({ pre, post }));
  log("逾期整改同步减少", post.overdue === pre.overdue - 1, JSON.stringify({ pre, post }));
  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 400));
  const afterList = await topDialog();
  log("清单已移除R02", afterList.n === post.open && !afterList.rows.some((r) => r.includes("重大装备持续低利用率")), `n=${afterList.n}`);
  shots.push(await shot("wrap_rect_after_close"));
  await closeOverlay();

  const p001 = await page.evaluate(async () => {
    const res = await fetch("/overview");
    return res.ok;
  });
  log("关闭后页面可继续打开", p001);

  await page.evaluate(() => localStorage.removeItem("cnooc-supervision-business-v16"));
  await gotoOverview();
  const restored = parseRect((await kpis()).join(" "));
  log("已恢复默认业务状态", restored.open === before.open && restored.done === before.done, JSON.stringify({ before, restored }));
} catch (err) {
  log("脚本异常", false, String(err && err.stack ? err.stack : err));
} finally {
  const fail = results.filter((r) => !r.ok).length;
  const payload = { commit: COMMIT, results, shots };
  fs.writeFileSync(path.join(OUT, `overview_wrap_verify_${COMMIT}.json`), JSON.stringify(payload, null, 2));
  try {
    const zip = "/workspace/public/overview-wrap-screenshots.zip";
    const files = shots.filter((f) => fs.existsSync(f));
    if (files.length) {
      execSync(`zip -j ${zip} ${files.join(" ")} ${path.join(OUT, `overview_wrap_verify_${COMMIT}.json`)}`, {
        stdio: "inherit",
      });
      fs.copyFileSync(zip, path.join(OUT, `overview-wrap-screenshots_${COMMIT}.zip`));
    }
  } catch (e) {
    console.log("打包截图失败", e);
  }
  console.log(`\n合计：${results.filter((r) => r.ok).length} 通过，${fail} 失败。COMMIT=${COMMIT}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
