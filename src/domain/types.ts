// 验配台账领域类型
import type { EarSide, NumberByFreq, NullableByFreq, StringByFreq } from "./constants";

export type FittingKind = "initial" | "adjustment";

export interface HearingAid {
  brand: string;
  model: string;
  serial: string;
}

export interface Audiogram {
  // 气导阈值 dB HL（初配必填）
  ac: NumberByFreq;
  // 骨导阈值 dB HL（可缺测，null 表示未测）
  bc: NullableByFreq;
  // 言语识别率 %
  speechScore: number;
}

/**
 * 一次已确认的验配单。
 * 修订单只追加、不可覆盖：revNo=1 为初配，之后每次复调接成 revNo+1。
 */
export interface FittingRevision {
  revNo: number;
  kind: FittingKind;
  createdAt: string;
  fitter: string;
  // 双耳各频率增益 dB
  gains: NumberByFreq;
  // 反馈等级 1-4
  feedbackLevel: number;
  // 改动原因：增益变化超 6dB 或反馈等级升高时必填
  reason?: string;
  // 普通备注
  note?: string;
}

/**
 * 同一客户同一耳别的验配链（台账行）。
 * 客户编号 + 耳别 唯一。
 */
export interface FittingChain {
  customerCode: string;
  customerName: string;
  ear: EarSide;
  aid: HearingAid;
  audiogram: Audiogram;
  createdAt: string;
  // 仅允许尾部追加修订，历史单永不改写
  revisions: FittingRevision[];
}

/** 复调表单（草稿态，输入框一律保留字符串） */
export interface AdjustmentForm {
  gains: StringByFreq;
  feedbackLevel: string;
  reason: string;
  fitter: string;
}

/** 初配表单（草稿态） */
export interface InitialForm {
  customerCode: string;
  customerName: string;
  ear: "" | EarSide;
  aidBrand: string;
  aidModel: string;
  aidSerial: string;
  ac: StringByFreq;
  bc: StringByFreq;
  speechScore: string;
  gains: StringByFreq;
  feedbackLevel: string;
  fitter: string;
  note: string;
}

/** 待确认的复调草稿：同一客户同耳只保留一份（按 chainKey 索引） */
export interface AdjustmentDraft {
  key: string;
  customerCode: string;
  ear: EarSide;
  updatedAt: string;
  form: AdjustmentForm;
}

/** 未建档的初配草稿：每份新单独立 draftId，换单不串台 */
export interface InitialDraft {
  draftId: string;
  updatedAt: string;
  form: InitialForm;
}

export interface LedgerState {
  version: 1;
  chains: Record<string, FittingChain>;
  adjustmentDrafts: Record<string, AdjustmentDraft>;
  initialDrafts: Record<string, InitialDraft>;
}
