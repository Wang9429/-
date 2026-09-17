/** R07 合成整改/复核材料草稿。初始不是证据，须由办理人显式采用后另建记录。 */

export interface DraftMaterial {
  id: string;
  riskId: string;
  title: string;
  kind: "rectification" | "verification";
  dataNature: string;
  pages: { title: string; body: string }[];
}

export const R07_MATERIALS: DraftMaterial[] = [
  {
    id: "MAT-R07-RECT",
    riskId: "R07",
    title: "付款审批控制核查及措施执行记录",
    kind: "rectification",
    dataNature: "合成样例，仅供办理演练，不是海油工程真实证明",
    pages: [
      {
        title: "核查对象与差额",
        body: "核查对象为付款 P-PAY001。原始匹配记录显示实际付款 1200 万元、有效批准 800 万元、合同累计可支付业务上限 2000 万元。本次合成案例的补充核查设定（仅在办理人明确采用后形成记录）：未发现可覆盖 400 万元差额的当时有效批准，确认付款审核对批准金额的核对存在控制缺陷；未因事后补签改变对原批准口径的判断。当前材料未证明存在 400 万元损失，也未证明发生追回或退款。",
      },
      {
        title: "审核清单修订",
        body: "已形成付款审核清单，增加批准文件、有效版本、可用批准金额及付款金额四项必核字段。上述金额用于验证清单，不发生真实付款。",
      },
      {
        title: "责任分工",
        body: "已明确经办、复核两类责任，不得由同一人完成两步确认；已形成差异付款暂停提交、转授权人员处理的作业要求。",
      },
      {
        title: "桌面验证记录",
        body: "①有效批准 800、拟付款 1200 时，清单识别 400 差额并要求暂停提交；②批准 800、拟付款 800 时，清单检查通过后仍须进入正常授权复核；③无批准文件时，清单要求补齐有效依据。结论：本次设置的审批核对缺陷已落实上述流程措施，提交总部独立复核；原支付、批准和业务应付记录保持不变。是否有其他责任或损失事项应另据真实调查处理，本材料不作免责结论。",
      },
    ],
  },
  {
    id: "MAT-R07-VERIFY",
    riskId: "R07",
    title: "付款审批控制整改复核记录",
    kind: "verification",
    dataNature: "合成样例，仅供独立复核演练，不构成真实系统改造或真实付款验证证明",
    pages: [
      {
        title: "复核范围",
        body: "复核人员与单位办理人员分离。复核范围为本事项已经确认的付款审批核对缺陷及对应整改措施。已检查单位提交的审核清单修订页、责任分工页与三项桌面验证记录。",
      },
      {
        title: "复核意见",
        body: "确认四项必核字段齐全，差额识别和缺失批准的处理要求明确，经办与复核分离，并逐项复演三项清单验证，结果与提交记录一致。在该合成案例所设定的核查范围内，措施已有执行证明且验证通过，同意关闭本监管事项，保留原 1200 万元付款、800 万元有效批准、2000 万元业务可支付上限及 400 万元差额记录。本结论不表示原付款因此转为合规，不表示资金损失已认定或追回，也不替代独立的责任调查。",
      },
    ],
  },
];

export function draftsForRisk(riskId: string, kind?: DraftMaterial["kind"]): DraftMaterial[] {
  const extra: DraftMaterial[] = [
    {
      id: "MAT-FP-033-RECT",
      riskId: "R-FP-033",
      title: "中小企业账款到期依据与未付余额核查记录",
      kind: "rectification",
      dataNature: "合成样例",
      pages: [
        {
          title: "到期依据",
          body: "合同CT-SME-01：验收合格日2026-03-21起60日，到期日2026-05-20。不以发票日加60日计算。无争议应付90万元，已付0万元。",
        },
        {
          title: "拟采取措施",
          body: "按有效合同清偿无争议到期余额，争议部分另案。本材料不构成真实付款指令。",
        },
      ],
    },
    {
      id: "MAT-FP-033-VERIFY",
      riskId: "R-FP-033",
      title: "中小企业账款整改复核记录",
      kind: "verification",
      dataNature: "合成样例",
      pages: [
        {
          title: "复核意见",
          body: "到期依据与合同条款一致，未采用发票日+60日。原90万元未付记录保留。",
        },
      ],
    },
    {
      id: "MAT-FP-032-GOV",
      riskId: "R-FP-032",
      title: "章程与董事到任对照及专业核查结论稿",
      kind: "rectification",
      dataNature: "合成样例",
      pages: [
        {
          title: "治理依据",
          body: "章程董事会5席，控股股东应派3席，实际到任2席；重大事项表决连续两期缺席。不能仅凭51%股比认定已控权。",
        },
        {
          title: "结论栏",
          body: "须由核查人记录专业结论后再决定是否关联整改。本页不是自动命中结果。",
        },
      ],
    },
    {
      id: "MAT-FP-011-SCOPE",
      riskId: "R-FP-011",
      title: "审计评估范围与账簿资产对照及专业核查结论稿",
      kind: "rectification",
      dataNature: "合成样例",
      pages: [
        {
          title: "范围材料",
          body: "PTY-M002 对应事项「被投企业A部分股权协议转让」。账簿在册生产设备、配套设施均列入评估清单；已合法剥离资产有合法剥离依据〔2026〕2号。先排除时点、重复登记和合法剥离。",
        },
        {
          title: "结论栏",
          body: "须由核查人逐项确认后记录「范围一致/未发现需整改问题」或转入整改。不得把资产数量差值包装成自动违法判断。",
        },
      ],
    },
  ];
  return [...R07_MATERIALS, ...extra].filter((m) => m.riskId === riskId && (!kind || m.kind === kind));
}
