# 海油工程穿透式监管平台（系统业务原型）

版本：**V1.6.1**（界面）／业务口径 **V1.6**。

按 V1.6 业需增量改版的可交互系统业务原型，用于领导展示、业务需求确认及科技信息部实施调研。V1.6.1 只改共用侧栏、顶栏、主题与综合总览等视觉，不改变指标计算、授权范围、流程联动和整改闭环。

页面标题为「海油工程｜穿透式监管平台」。主体、人员、金额、交易、汇率、行情和分析为**合成样例**，用于功能验证，不代表海油工程真实经营数据。真实历史事件日期与样例行情分别标识。

本压缩包对应当前正在预览的生产构建（`next start`，端口 **43917**）。

## 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | 20 或以上（预览环境为 22.14.0） |
| 包管理器 | npm（附带 `package-lock.json`） |
| 操作系统 | macOS / Linux / Windows |
| 密钥 | **不需要**。无 `.env` 也可运行，见 `.env.example` |

## 安装

在解压后的项目根目录执行：

```bash
npm install
```

使用锁文件安装，不要改成随意的 `npm install <包名>` 来凑版本。

## 构建

```bash
npm run build
```

产物写在 `.next/`（已从源码包排除，需本地生成）。

## 启动

**推荐（与当前预览一致：先构建再生产启动）：**

```bash
npm run preview
```

浏览器打开 [http://127.0.0.1:43917/overview](http://127.0.0.1:43917/overview)。默认进入综合总览。

分步启动：

```bash
npm run build
npm start
```

`npm start` 与 `npm run preview` 均监听 `0.0.0.0:43917`。

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run build` | 生产构建 |
| `npm start` | 启动已构建的生产服务（端口 43917） |
| `npm run preview` | 构建并启动，推荐检查方式 |
| `npm run serve` | 常驻服务：缺少产物时先构建，进程退出后自动拉起 |
| `npm run dev` | 开发服务。若反向代理拦截 HMR，页面可能无法点击，改用 preview |
| `npm run lint` | ESLint |
| `npm run verify` | 口径自检：指标、阶段与五数对照种子预期值 |

启动后无需登录。顶栏可切换本地身份，默认「总部监管人员A」，用于验证授权产品行为，不是正式单点登录。

## 数据与重置

业务办理状态保存在浏览器 `localStorage` 键 `cnooc-supervision-business-v16`；用户、场景、规则草稿与发布版本、指标、AI 与数据源等配置保存在 `cnooc-supervision-config-v16`。在「系统配置 → 数据与运行」分别执行「重置业务办理状态」和「重置配置」。前者不清除用户与配置目录。

- 业务截至日默认 **2026-06-30**，另可选 **2026-05-15**（按办理记录还原事项状态；该日无财务快照，金额指标显示未覆盖）。默认期间 2026-01-01 至 2026-06-30。金额默认万元人民币。
- 恢复种子后原典型未关闭 R01–R08 仍在；扩容后全局未关闭数由明细重算，待核查不计入未关闭整改。
- FA-P001 执行率 4800÷6000＝80%；FA-P001 EAC 偏差（11800−10000）÷10000＝18%。总部执行率按扩容后项目重算，不再锁死 84%。

样例与规则在 `data/demo_seed.json`、`data/overview_scale_seed.json`、`data/configuration_seed.json`、`data/investment_catalog.json`。公开披露参照与合成台账说明见 `docs/数据规模及来源说明.md`。

## 当前有效需求说明

检查时以这些文件为准（旧版 V1.3 仅作历史对照，不要按 V1.3 验收）：

| 文件 | 用途 |
| --- | --- |
| `docs/系统原型定位与实施调研说明_V1.6.md` | 产品定位与本轮范围 |
| `docs/海油工程穿透式监管平台_完整业需_V1.6.md` | 业务需求（计算、授权、流程、整改） |
| `docs/海油工程_UI视觉整改说明_V1.6.1.md` | 当前界面视觉与布局 |
| `docs/公开产品借鉴与页面设计_V1.6.md` | 页面设计补充 |
| `docs/投资底稿适配对照_V1.4.md` | 投资场景适配 |
| `docs/开发任务说明_Cursor与Codex.md` | 实现约束 |
| `AGENTS.md` | 仓库持续约束 |
| `docs/操作说明.md` | 演示操作路径 |
| `docs/数据规模及来源说明.md` | 公开披露参照与合成样例来源 |
| `docs/验收记录.md` | 已核对项与未宣称项 |
| `docs/资金产权专项改版/README.md` | 资金/产权专项改版（FP-20260916-R2，冲突项以 R3 为准） |
| `docs/资金产权专项改版/迁移与验收.md` | 新旧 ID 映射、首批可运行规则与未实现项 |
| `docs/FP-20260916-R3/README.md` | 资金/产权 R3：趋势、同分类穿透；与 R3.1 无冲突部分仍有效 |
| `docs/FP-20260916-R3.1/README.md` | 资金/产权 R3.1：产权无公式/趋势、11/10 一级目录；**业务区展示未启用子场景的要求已被 R3.2 替换** |
| `docs/FP-20260917-R3.2/README.md` | **本轮有效且已冻结**资金/产权执行区仅列可执行规则、21 项覆盖、产权下半区切换、场景详情业务化展示 |

## 本版能力摘要

- 七个业务入口 + 侧栏底部「系统配置」；顶部监管工作台汇聚待核查、整改、复核。
- 综合总览为监管主体全景 + 专项领域监管概况。四项总体数字为纳管单位、纳管项目、规则命中涉及单位、未关闭整改（附本期完成/逾期）。无适用监测执行记录时命中单位显示 —／未开展监测。固定资产卡以投资计划执行率为主、投资完成额为辅助字段。所属单位监管情况默认当前单位及直接下属。未启用指标完全隐藏。汇总由明细重算，不以原 6 单位 / 6 项目 / 84% 锁死。默认截至日 2026-06-30。
- 指标卡打开组织穿透浮层。总览始终围绕所点指标，不切换指标。抽屉取数=授权∩筛选，祖先路径不扩大范围；领域页切换仅限本领域已启用入口。计算依据绑定当前指标、对象、期间，不串用 EAC 公式。「只看异常」只跟当前指标评估，对象关联事项单独展示。
- 固定资产等流程领域用横向肩形箭头联动下区五数；资金管理为上区主体经营财务（盈利/资产负债/流动性，适用卡带小趋势、首页无完整单位表）+ 下区一张「场景执行情况」（默认全部专题，11 项一级各至少一条已启用可执行规则，不展示未启用占位行）；产权管理为上区法人股权全景（四卡仅名称/数值/单位/必要分类，无公式无趋势）+ 下区一张「场景执行情况」（默认产权交易并显式选中非上市企业产权转让及肩形流程；登记/标识/控制权及「全部场景（10）」隐藏交易流程并撤销其查询影响）。国际化用事件/地区。
- 右下「AI分析」为预置分析，未连接模型服务。资金/产权页绑定当前主体与领域任务，不套用 FA-P001。
- 系统配置六 Tab 提供列表操作列与表单抽屉：用户（编辑角色与数据范围、启用/停用）、监管场景（新增一级/子场景、编辑、启用/停用）、监测规则（草稿/试算/发布/版本，历史评估不覆盖）、指标（口径与展示、启用/停用）、AI（开关、任务与使用范围）、数据与运行（拟来源维护、导入校验、批次、两类重置）。保存后立即生效并写入本地配置；未接入数据源保存后连接状态不变。
- 本地身份切换验证授权：单位 A 看不到单位 B；配置管理员无业务数据；独立复核不得自审。配置权限与业务数据权限分离，只读身份不能经路由修改、发布或重置。
- 业务取数为授权范围与当前筛选的交集；总部仅本级与含下级口径一致；缺期间事实显示未覆盖，不当 0。
- R07 提供合成整改/复核材料，须办理人显式采用后另建记录；闭环后 8→7，资金/工程/国际化同步。

## 技术栈

Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS 4。无外部数据库与后端服务。

## 公网发布

当前固定 HTTPS 地址（GitHub Pages）：

- 站点根路径：<https://wang9429.github.io/-/>
- 综合总览：<https://wang9429.github.io/-/overview/>
- 资金管理：<https://wang9429.github.io/-/funds/>
- 产权管理：<https://wang9429.github.io/-/property-rights/>
- 系统配置：<https://wang9429.github.io/-/settings/>

**实现提交**（功能、配置与 R3.2 覆盖）：以本仓库 `main` 最新提交为准，Pages 构建会写入 [`r32-build.json`](https://wang9429.github.io/-/deliverables/r32-build.json)。  
**实际部署提交**：打开上述 JSON 的 `commit` 字段，应与本轮推送一致。工作流把静态导出写到 `gh-pages`；完成后刷新总览即可看到本轮页面。

本轮资金/产权 R3.2 界面截图与 21 项覆盖（可下载；Pages 工作流完成后生效）。**详情业务化截图必须打开核验表/专业核查/持股来源，不能只看对象清单或首页：**

- [S039 付款核验：批准 800 / 实付 1200 / 超出 400 / 上限 2000](https://wang9429.github.io/-/deliverables/r32_s039_payment_basis.png)
- [S039 正常未命中：实付 4200 = 批准 4200](https://wang9429.github.io/-/deliverables/r32_s039_clear_basis.png)
- [S039 关联事项办理入口（付款超批准）](https://wang9429.github.io/-/deliverables/r32_s039_hit_basis_entry.png)
- [S037 到期转让价款：应收 800 / 到账 480 / 未收 320](https://wang9429.github.io/-/deliverables/r32_s037_proceeds_basis.png)
- [S011 专业核查：材料、要点、责任人、结论（待核查≠已确认违规）](https://wang9429.github.io/-/deliverables/r32_s011_professional_review.png)
- [S011 场景详情五段结构](https://wang9429.github.io/-/deliverables/r32_s011_scenario_detail.png)
- [S032 治理核查：席位事实与专业核查结论栏](https://wang9429.github.io/-/deliverables/r32_s032_governance_review.png)
- [S032 场景详情](https://wang9429.github.io/-/deliverables/r32_s032_scenario_detail.png)
- [被投企业A 持股 60%／60%／55% 分行来源与基准日](https://wang9429.github.io/-/deliverables/r32_holdings_60_60_55.png)
- [综合总览统一入口](https://wang9429.github.io/-/deliverables/r32_overview_entry.png)
- [资金可执行 11 项一级（无未启用行）](https://wang9429.github.io/-/deliverables/r32_funds_executable_11.png)
- [S039 监测对象清单（P-PAY001 1200 万元）](https://wang9429.github.io/-/deliverables/r32_funds_s039_objects.png)
- [产权交易：经济行为、肩形流程与场景同框](https://wang9429.github.io/-/deliverables/r32_rights_trade_flow.png)
- [产权登记：隐藏交易流程，仅登记场景](https://wang9429.github.io/-/deliverables/r32_rights_registration.png)
- [标识与名称资质专题](https://wang9429.github.io/-/deliverables/r32_rights_identity.png)
- [全部场景（10）](https://wang9429.github.io/-/deliverables/r32_rights_all_10.png)
- [S037 命中对象 PTY-M002 未收 320 万元](https://wang9429.github.io/-/deliverables/r32_rights_s037_hit.png)
- [S011 专业核查事项（不自动认定隐匿）](https://wang9429.github.io/-/deliverables/r32_rights_s011_review.png)
- [系统配置仍保留完整目录](https://wang9429.github.io/-/deliverables/r32_settings_catalog.png)
- [21 项实际覆盖明细 JSON](https://wang9429.github.io/-/deliverables/coverage-r32.json)
- [21 项实际覆盖明细 Markdown](https://wang9429.github.io/-/deliverables/coverage-r32.md)
- [R3.2 截图打包 zip](https://wang9429.github.io/-/deliverables/fp-r32-screenshots.zip)

R3.1 对照截图仍保留：

- [资金全部专题 11 项一级目录](https://wang9429.github.io/-/deliverables/r31-funds-full-catalog.png)
- [产权全部专题 10 项一级目录](https://wang9429.github.io/-/deliverables/r31-rights-full-catalog.png)
- [产权四卡：无公式、无趋势](https://wang9429.github.io/-/deliverables/r31-rights-kpi-no-formula-trend.png)
- [资金盈利能力小趋势仍在](https://wang9429.github.io/-/deliverables/r3-funds-profit-sparks.png)

推送 `main` 会跑 `.github/workflows/github-pages.yml`：静态导出后写入 `gh-pages` 分支。仓库子路径为 `/-/`（仓库名为 `-`）。页面、样式与脚本均带此前缀；刷新上述路径应直接打开。

访客**不必**登录 GitHub / Cursor。关闭本机开发环境后，站点由 GitHub Pages 独立托管。

`GITHUB_PAGES=1` 时使用 `output: 'export'`；Vercel / Docker 仍用 `standalone`，业务页面不变。`/api/health` 与 `/api/source-package` 只存在于 Node 运行时，静态 Pages 不含这两条接口（访客 Demo 不调用它们）。

此前 GitHub 推送还会触发 Vercel Production（用户曾在大陆普通网络打开过）：<https://seven-ruddy-97.vercel.app>。本轮交付以 GitHub Pages 为准。

**大陆访问待用户实测。** 本环境不在中国大陆用户网络，不能仅因换成 GitHub Pages 就宣称大陆已通。请用手机流量和办公网打开上面的 Pages 地址。

独立运行包与国内云主机备用步骤见 [`docs/中国大陆部署说明.md`](docs/中国大陆部署说明.md)，本轮未使用。

