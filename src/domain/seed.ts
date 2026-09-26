// 示例台账数据（资料层）：三条客户验配链 + 一份待确认复调草稿
import type { FittingChain } from "./types";

function chain(
  customerCode: string,
  customerName: string,
  ear: "L" | "R",
  data: Omit<FittingChain, "customerCode" | "customerName" | "ear">
): FittingChain {
  return { customerCode, customerName, ear, ...data };
}

export const SEED_CHAINS: FittingChain[] = [
  chain("Liu-024", "刘建国", "L", {
    createdAt: "2026-08-12T02:30:00.000Z",
    aid: { brand: "峰力 Phonak", model: "Audeo Lumity L50-RIC", serial: "PK-LM-773201" },
    audiogram: {
      ac: { "250": 35, "500": 40, "1000": 45, "2000": 60, "4000": 70, "8000": 75 },
      bc: { "250": 30, "500": 35, "1000": 40, "2000": 55, "4000": null, "8000": null },
      speechScore: 72,
    },
    revisions: [
      {
        revNo: 1,
        kind: "initial",
        createdAt: "2026-08-12T02:30:00.000Z",
        fitter: "王听力师",
        gains: { "250": 30, "500": 34, "1000": 40, "2000": 52, "4000": 60, "8000": 62 },
        feedbackLevel: 1,
        note: "双耳高频下降，RIC 机型初配，患者主观清晰度可接受。",
      },
      {
        revNo: 2,
        kind: "adjustment",
        createdAt: "2026-08-26T06:10:00.000Z",
        fitter: "李听力师",
        gains: { "250": 30, "500": 34, "1000": 40, "2000": 56, "4000": 64, "8000": 62 },
        feedbackLevel: 1,
        note: "2kHz 后增益 +4dB，复诊反馈良好，无啸叫。",
      },
    ],
  }),
  chain("Chen-118", "陈雨桐", "R", {
    createdAt: "2026-07-03T01:20:00.000Z",
    aid: { brand: "瑞声达 GN", model: "Omia 6-RIE", serial: "GN-OM-451188" },
    audiogram: {
      ac: { "250": 50, "500": 55, "1000": 45, "2000": 35, "4000": 30, "8000": 28 },
      bc: { "250": 25, "500": 28, "1000": 26, "2000": 25, "4000": 25, "8000": 24 },
      speechScore: 81,
    },
    revisions: [
      {
        revNo: 1,
        kind: "initial",
        createdAt: "2026-07-03T01:20:00.000Z",
        fitter: "王听力师",
        gains: { "250": 44, "500": 48, "1000": 40, "2000": 30, "4000": 26, "8000": 24 },
        feedbackLevel: 3,
        note: "单侧传导性损失，初配低频增益偏保守，佩戴有明显反馈。",
      },
      {
        revNo: 2,
        kind: "adjustment",
        createdAt: "2026-07-18T03:40:00.000Z",
        fitter: "周听力师",
        gains: { "250": 40, "500": 44, "1000": 38, "2000": 30, "4000": 26, "8000": 24 },
        feedbackLevel: 2,
        reason: "低频压缩略降（250/500Hz 各 -4dB），重新制作耳塞后复测，反馈由 3 级降为 2 级。",
        note: "反馈啸叫基本消失，患者接受度提高。",
      },
    ],
  }),
  chain("Zhao-077", "赵桂芳", "R", {
    createdAt: "2026-09-05T05:00:00.000Z",
    aid: { brand: "奥迪康 Oticon", model: "Zircon 2-BTE", serial: "OT-ZR-228940" },
    audiogram: {
      ac: { "250": 30, "500": 35, "1000": 50, "2000": 55, "4000": 48, "8000": 45 },
      bc: { "250": null, "500": 32, "1000": 46, "2000": 50, "4000": 44, "8000": null },
      speechScore: 64,
    },
    revisions: [
      {
        revNo: 1,
        kind: "initial",
        createdAt: "2026-09-05T05:00:00.000Z",
        fitter: "李听力师",
        gains: { "250": 26, "500": 30, "1000": 44, "2000": 48, "4000": 42, "8000": 38 },
        feedbackLevel: 1,
        note: "老年语频区下降初配，言语识别率 64%，已预约四周后复测。",
      },
    ],
  }),
];
