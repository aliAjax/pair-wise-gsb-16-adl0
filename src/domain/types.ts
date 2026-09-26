// ============================================================
// 资料层：验配台账的数据模型
// 只描述「数据长什么样」，不含校验规则和存储细节
// ============================================================

export type EarSide = "left" | "right";

export const EAR_LABEL: Record<EarSide, string> = {
  left: "左耳",
  right: "右耳",
};

/** 听力数据（初配/复调时记录） */
export interface HearingData {
  airConductionDb: number; // 气导阈值 dB
  boneConductionDb: number; // 骨导阈值 dB
  speechRecognitionPct: number; // 言语识别率 %
}

/** 四频段增益（dB） */
export interface GainSettings {
  hz500: number;
  hz1000: number;
  hz2000: number;
  hz4000: number;
}

export const GAIN_BANDS = [
  { key: "hz500", label: "500Hz" },
  { key: "hz1000", label: "1kHz" },
  { key: "hz2000", label: "2kHz" },
  { key: "hz4000", label: "4kHz" },
] as const;

export type GainBandKey = (typeof GAIN_BANDS)[number]["key"];

/** 反馈（啸叫）等级 0~3 */
export const FEEDBACK_LEVELS = ["无啸叫", "轻微", "明显", "严重"] as const;
export const MAX_FEEDBACK_LEVEL = FEEDBACK_LEVELS.length - 1;

export type RevisionKind = "initial" | "readjust";

export const REVISION_KIND_LABEL: Record<RevisionKind, string> = {
  initial: "初配",
  readjust: "复调",
};

/**
 * 一份已确认的验配单。
 * 确认后即为只读：任何改动都只能以新的编号修订追加，不允许覆盖。
 */
export interface FittingRevision {
  revisionNo: number; // 台账内编号，从 1 开始递增
  kind: RevisionKind;
  hearing: HearingData;
  aidModel: string; // 助听器型号
  gains: GainSettings;
  feedbackLevel: number; // 0~3
  reason: string; // 复调触发超阈时必填，否则为 ""
  operator: string; // 验配师
  createdAt: string; // ISO 时间
}

/** 一位客户一侧耳朵的台账，revisions 只增不改 */
export interface FittingLedger {
  id: string;
  customerName: string;
  ear: EarSide;
  createdAt: string;
  revisions: FittingRevision[];
}

/**
 * 待确认的复调草稿。
 * 每个台账（客户×耳别）最多一份，按 ledgerId 独立存放，换单互不串台。
 */
export interface ReadjustDraft {
  ledgerId: string;
  hearing: HearingData;
  aidModel: string;
  gains: GainSettings;
  feedbackLevel: number;
  reason: string;
  operator: string;
  updatedAt: string;
}

export function latestRevision(ledger: FittingLedger): FittingRevision {
  return ledger.revisions[ledger.revisions.length - 1];
}

export function formatRevisionNo(no: number): string {
  return `R${no}`;
}
