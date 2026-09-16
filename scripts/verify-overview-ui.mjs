/**
 * 综合总览浏览器交互核对。
 * 运行：node scripts/verify-overview-ui.mjs
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

async function gotoOverview() {
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1, .reg-kpis");
}

async function resetStorage() {
  await page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("cnooc-supervision-business-v16");
    localStorage.removeItem("cnooc-supervision-config-v16");
  });
  await gotoOverview();
}

async function shot(name, width = 1440, height = 900) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 400));
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

async function clickText(selectorOrText, exact = false) {
  const clicked = await page.evaluate(
    (t, exactMatch) => {
      const nodes = [...document.querySelectorAll("button, a, [role='button']")];
      const el = nodes.find((n) => {
        const s = (n.textContent || "").replace(/\s+/g, " ").trim();
        return exactMatch ? s === t : s.includes(t);
      });
      if (!el) return false;
      el.click();
      return true;
    },
    selectorOrText,
    exact,
  );
  return clicked;
}

async function topDialog() {
  return page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const d = dialogs.at(-1);
    if (!d) return { open: false, title: "", text: "", rows: [], n: 0, hasDept: false };
    const title = (d.querySelector("h3, h2")?.textContent || "").trim();
    const text = d.innerText;
    const rows = [...d.querySelectorAll("tbody tr")].map((r) => r.innerText.replace(/\s+/g, " ").trim());
    const n = Number((text.match(/共\s+(\d+)\s+(家|条)/) || [])[1] || 0);
    const hasDept = rows.some((t) => t.includes("总部财务部") || t.includes("单位A项目部") || t.includes("总部投资部"));
    return { open: true, title, text: text.replace(/\s+/g, " ").slice(0, 240), rows, n, hasDept };
  });
}

async function closeOverlay() {
  const closed = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const d = dialogs.at(-1);
    if (!d) return false;
    const btn = d.querySelector('button[aria-label="关闭"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (!closed) await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
}

async function kpiMap() {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".reg-kpis > *")];
    return cards.map((c) => ({
      name: c.innerText.split("\n")[0].trim(),
      text: c.innerText.replace(/\s+/g, " "),
    }));
  });
}

async function orgFilterLabel() {
  return page.evaluate(() => {
    const sel = document.querySelector("#filter-org");
    return sel?.selectedOptions?.[0]?.textContent?.trim() ?? "";
  });
}

async function switchUser(name) {
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").includes("本地身份"));
    if (!btn) return "no-menu";
    btn.click();
    return "opened";
  });
  await new Promise((r) => setTimeout(r, 200));
  const clicked = await page.evaluate((n) => {
    const item = [...document.querySelectorAll("button, [role='menuitem']")].find((b) => (b.textContent || "").includes(n));
    if (!item) {
      const sel = document.querySelector("select");
      if (sel) {
        const opt = [...sel.options].find((o) => o.textContent.includes(n));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return "select";
        }
      }
      return "missing";
    }
    item.click();
    return "ok";
  }, name);
  await new Promise((r) => setTimeout(r, 500));
  return `${opened}/${clicked}`;
}

async function clickPagedAction(idText, action) {
  for (let i = 0; i < 25; i++) {
    const found = await page.evaluate(
      (id, act) => {
        const rows = [...document.querySelectorAll("tr")];
        const row = rows.find((r) => (r.textContent || "").includes(id));
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
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

page.on("dialog", async (d) => {
  await d.accept();
});

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await resetStorage();

  const hqHasTitle = await textHas("综合总览");
  const hasPanorama = await textHas("监管主体全景");
  const hasDomain = await textHas("专项领域监管概况");
  const hasUnits = await textHas("所属单位监管情况");
  const noIntro = !(await textHas("用于海油工程领导查看")) && !(await textHas("名词解释"));
  const noDemo = !(await textHas("演示数据")) && !(await textHas("本页为演示"));
  log("首页两区块与标题", hqHasTitle && hasPanorama && hasDomain && hasUnits, `${hasPanorama}/${hasUnits}`);
  log("无介绍摘要/名词解释/演示字样", noIntro && noDemo);

  const kpis = await kpiMap();
  const unitKpi = kpis.find((k) => k.text.includes("纳管单位"));
  const projectKpi = kpis.find((k) => k.text.includes("纳管项目"));
  const hitKpi = kpis.find((k) => k.text.includes("规则命中涉及单位"));
  const rectKpi = kpis.find((k) => k.text.includes("未关闭整改"));
  log("四项新指标存在", Boolean(unitKpi && projectKpi && hitKpi && rectKpi), JSON.stringify(kpis.map((k) => k.text.slice(0, 40))));
  log("未沿用高风险主指标名称", !(await textHas("未关闭高风险事项数")) && !(await textHas("未关闭监管事项")));
  log("股权隐藏未启用现金回报", !(await textHas("现金回报目标偏差")) && !(await textHas("指标未启用")));

  const unitCount = Number((unitKpi?.text.match(/(\d+)\s*家/) || [])[1] || 0);
  const projectCount = Number((projectKpi?.text.match(/(\d+)\s*个/) || [])[1] || 0);
  const hitCount = Number((hitKpi?.text.match(/(\d+)\s*家/) || [])[1] || 0);
  const rectCount = Number((rectKpi?.text.match(/(\d+)\s*件/) || [])[1] || 0);
  log("扩容后单位/项目大于原6", unitCount > 6 && projectCount > 6, `单位${unitCount} 项目${projectCount}`);
  log("未关闭整改辅助字段", (await textHas("本期完成整改")) && (await textHas("逾期整改")));

  await clickReturn("kpi-units");
  await new Promise((r) => setTimeout(r, 400));
  const unitList = await topDialog();
  log(
    "单位清单与数字一致且不含部门",
    unitList.open && unitList.n === unitCount && !unitList.hasDept && unitList.title.includes("纳管单位"),
    JSON.stringify({ n: unitList.n, hasDept: unitList.hasDept, title: unitList.title, rows: unitList.rows.length }),
  );
  await shot("overview_hq_unit_list_1440");
  await closeOverlay();

  await clickReturn("kpi-projects");
  await new Promise((r) => setTimeout(r, 400));
  const projList = await topDialog();
  const hasFilter = projList.text.includes("固定资产投资") && projList.text.includes("工程项目");
  log("项目清单与数字一致且可筛选类型", projList.n === projectCount && hasFilter, JSON.stringify({ n: projList.n, hasFilter }));
  await closeOverlay();

  await clickReturn("kpi-hit-orgs");
  await new Promise((r) => setTimeout(r, 400));
  const hitList = await topDialog();
  log("命中单位清单与数字一致", hitList.n === hitCount, JSON.stringify({ n: hitList.n, rows: hitList.rows }));
  log(
    "命中单位不把总部/单位A当祖先重复计",
    !hitList.rows.some((t) => t.includes("海油工程总部") || t === "下属二级单位A"),
    hitList.rows.slice(0, 8).join("|"),
  );
  const openedHit = await clickText("查看命中");
  await new Promise((r) => setTimeout(r, 400));
  const hitDetail = await topDialog();
  log("可从涉及单位查看命中规则与对象", openedHit && (hitDetail.text.includes("命中规则") || hitDetail.text.includes("命中对象")));
  await shot("overview_monitoring_list_1440");
  await closeOverlay();
  await closeOverlay();

  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 500));
  const rectModal = await topDialog();
  const hasPending = rectModal.rows.some((s) => s.includes("待核查"));
  const hasExcluded = rectModal.rows.some((s) => s.includes("已排除"));
  log("整改清单与数字一致", rectModal.open && rectModal.n === rectCount, JSON.stringify({ n: rectModal.n, sample: rectModal.rows.slice(0, 5) }));
  log("待核查/已排除不在未关闭整改清单", !hasPending && !hasExcluded, JSON.stringify(rectModal.rows.slice(0, 8)));
  const openedDetail = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => (b.textContent || "").trim() === "查看详情");
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 600));
  const detailDlg = await topDialog();
  log(
    "打开整改详情",
    openedDetail && (detailDlg.text.includes("主责") || detailDlg.text.includes("办理") || detailDlg.text.includes("期限") || detailDlg.text.includes("整改")),
    detailDlg.title,
  );
  await shot("overview_rectification_detail_1440");
  await closeOverlay();
  await closeOverlay();

  const hqShot = await shot("overview_hq_1440", 1440);
  const overflow1440 = await page.evaluate(() => {
    const box = document.querySelector(".reg-org-children");
    return {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      clientH: box?.clientHeight || 0,
      scrollH: box?.scrollHeight || 0,
      maxH: box ? getComputedStyle(box).maxHeight : "",
    };
  });
  log("1440无整页横溢", overflow1440.sw <= overflow1440.cw + 2, JSON.stringify(overflow1440));
  log(
    "组织区域未无限铺开",
    overflow1440.clientH > 0 && overflow1440.clientH <= 430,
    JSON.stringify(overflow1440),
  );

  const clickedA = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下属二级单位A");
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 700));
  const orgA = await orgFilterLabel();
  const onA = orgA.includes("下属二级单位A") || (await textHas("下属三级单位A1"));
  log("点击单位名称切换组织范围", clickedA && onA, orgA);
  await shot("overview_unit_a_1440", 1440);

  const openedChildProjects = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".reg-org-node")];
    const a1 = cards.find((c) => (c.textContent || "").includes("下属三级单位A1"));
    if (!a1) return "no-a1";
    const proj = [...a1.querySelectorAll("button")].find((b) => (b.textContent || "").includes("纳管项目"));
    if (!proj) return "no-proj";
    proj.click();
    return "ok";
  });
  await new Promise((r) => setTimeout(r, 400));
  const stillA = await orgFilterLabel();
  log("点击项目数字只开清单不切换组织", openedChildProjects === "ok" && stillA.includes("下属二级单位A"), `${openedChildProjects}/${stillA}`);
  await closeOverlay();

  const toA1 = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下属三级单位A1");
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 600));
  const related = await clickText("查看关联对象");
  await new Promise((r) => setTimeout(r, 400));
  const hasP001 = await textHas("基地能力提升项目");
  log("末级单位查看关联对象", toA1 && related && hasP001);
  if (hasP001) {
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("tr")].find((r) => (r.textContent || "").includes("基地能力提升项目"));
      row?.querySelector("button")?.click() || row?.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    log("对象档案可打开", (await textHas("基地能力提升")) || (await textHas("档案")));
    await closeOverlay();
  }
  await closeOverlay();

  const domainHit = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("命中规则") && (b.textContent || "").includes("条"));
    if (!btn) return false;
    btn.click();
    return btn.textContent.trim();
  });
  await new Promise((r) => setTimeout(r, 400));
  const domainHitDlg = await topDialog();
  log("领域命中规则打开监测结果", Boolean(domainHit) && (domainHitDlg.text.includes("命中对象") || domainHitDlg.text.includes("命中规则")));
  log("命中对象按类型分列而非混合总数", !domainHitDlg.text.includes("总部命中对象总数"));
  await closeOverlay();

  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  const disabled = await clickPagedAction("FA-I06", "停用");
  log("停用FA-I06", disabled);
  await gotoOverview();
  const faHidden = !(await textHas("投资计划执行率")) && !(await textHas("投资完成额"));
  log("停用指标后首页完全隐藏", faHidden, faHidden ? "" : "仍见投资指标");
  await page.goto(`${BASE}/settings?tab=indicators`, { waitUntil: "networkidle0" });
  const enabled = await clickPagedAction("FA-I06", "启用");
  log("重新启用FA-I06", enabled);
  await gotoOverview();
  log("重新启用后指标恢复", (await textHas("投资计划执行率")) && (await textHas("投资完成额")));

  await page.goto(`${BASE}/settings?tab=rules`, { waitUntil: "networkidle0" });
  const ruleOff = await clickPagedAction("预计完工投资与有效概算偏差", "停用");
  log("停用规则FA-R20-01", ruleOff);
  await gotoOverview();
  await clickReturn("kpi-open-rect");
  await new Promise((r) => setTimeout(r, 400));
  const stillOpenRect = await topDialog();
  const stillR02 = stillOpenRect.text.includes("重大装备") || stillOpenRect.n > 0;
  await closeOverlay();
  await clickReturn("kpi-hit-orgs");
  await new Promise((r) => setTimeout(r, 400));
  await clickText("查看命中");
  await new Promise((r) => setTimeout(r, 400));
  const stillHitDlg = await topDialog();
  const stillHit = stillHitDlg.text.includes("FA-R20-01") || stillHitDlg.text.includes("预计完工投资");
  log("规则停用后历史命中及未关闭整改仍可查询", stillR02 && stillHit, `整改${stillOpenRect.n} 命中层${stillHit}`);
  await closeOverlay();
  await closeOverlay();
  await page.goto(`${BASE}/settings?tab=rules`, { waitUntil: "networkidle0" });
  await clickPagedAction("预计完工投资与有效概算偏差", "启用");

  await gotoOverview();
  const userA = await switchUser("二级单位A管理人员");
  await new Promise((r) => setTimeout(r, 600));
  const aScope = await page.evaluate(() => document.body.innerText.includes("下属二级单位D") === false);
  log("切换单位A身份后看不到其他二级单位D", aScope, userA);
  const userCfg = await switchUser("配置管理员A");
  await new Promise((r) => setTimeout(r, 600));
  log("配置管理员无业务数据", (await textHas("当前身份无业务数据权限")) || (await textHas("无业务数据")), userCfg);
  await switchUser("总部监管人员A");
  await new Promise((r) => setTimeout(r, 500));

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await gotoOverview();
  await shot("overview_hq_1280", 1280);
  const overflow1280 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log("1280无整页横溢", overflow1280.sw <= overflow1280.cw + 2, JSON.stringify(overflow1280));
  log("截图已保存", fs.existsSync(hqShot), hqShot);
} catch (err) {
  log("脚本异常", false, String(err && err.stack ? err.stack : err));
} finally {
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n合计：${results.filter((r) => r.ok).length} 通过，${fail} 失败。COMMIT=${COMMIT}`);
  fs.writeFileSync(path.join(OUT, `overview_ui_verify_${COMMIT}.json`), JSON.stringify({ commit: COMMIT, results }, null, 2));
  await browser.close();
  process.exit(fail ? 1 : 0);
}
