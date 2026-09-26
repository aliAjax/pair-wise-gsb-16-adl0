// ============================================================
// 校验层：验配单的业务规则
// 只依赖资料层的类型，不关心数据存在哪里、页面怎么渲染
// ============================================================

import {
  FEEDBACK_LEVELS,
  FittingRevision,
  GAIN_BANDS,
  HearingData,
  GainSettings,
  MAX_FEEDBACK_LEVEL,
} from "./types";

/** 任一频段增益变化超过该值（不含）即触发原因必填 */
export const GAIN_REASON_THRESHOLD_DB = 6;
export const GAIN_MIN_DB = 0;
export const GAIN_MAX_DB = 80;
export const HEARING_MAX_DB = 120;

/** 一份待校验的验配输入（初配、复调共用） */
export interface FittingInput {
  hearing: HearingData;
  aidModel: string;
  gains: GainSettings;
  feedbackLevel: number;
  reason: string;
  operator: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** 本次复调是否触发「原因必填」 */
  reasonRequired: boolean;
  /** 触发原因必填的具体条目，用于页面提示 */
  reasonTriggers: string[];
}

function checkCommon(input: FittingInput): string[] {
  const errors: string[] = [];
  const { airConductionDb, boneConductionDb, speechRecognitionPct } = input.hearing;

  if (!inRange(airConductionDb, 0, HEARING_MAX_DB)) {
    errors.push(`气导阈值需在 0~${HEARING_MAX_DB} dB 之间`);
  }
  if (!inRange(boneConductionDb, 0, HEARING_MAX_DB)) {
    errors.push(`骨导阈值需在 0~${HEARING_MAX_DB} dB 之间`);
  }
  if (!inRange(speechRecognitionPct, 0, 100)) {
    errors.push("言语识别率需在 0~100% 之间");
  }
  for (const band of GAIN_BANDS) {
    if (!inRange(input.gains[band.key], GAIN_MIN_DB, GAIN_MAX_DB)) {
      errors.push(`${band.label} 增益需在 ${GAIN_MIN_DB}~${GAIN_MAX_DB} dB 之间`);
    }
  }
  if (
    !Number.isInteger(input.feedbackLevel) ||
    input.feedbackLevel < 0 ||
    input.feedbackLevel > MAX_FEEDBACK_LEVEL
  ) {
    errors.push(`反馈等级需在 0~${MAX_FEEDBACK_LEVEL} 之间`);
  }
  if (!input.aidModel.trim()) {
    errors.push("请填写助听器型号");
  }
  if (!input.operator.trim()) {
    errors.push("请填写验配师");
  }
  return errors;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** 本次输入与上次确认单相比，触发「原因必填」的条目 */
export function reasonTriggersFor(input: FittingInput, last: FittingRevision): string[] {
  const triggers: string[] = [];
  for (const band of GAIN_BANDS) {
    const before = last.gains[band.key];
    const after = input.gains[band.key];
    const delta = after - before;
    if (Math.abs(delta) > GAIN_REASON_THRESHOLD_DB) {
      triggers.push(
        `${band.label} 增益 ${before}→${after} dB，变化 ${Math.abs(delta)} dB 超过 ${GAIN_REASON_THRESHOLD_DB} dB`
      );
    }
  }
  if (input.feedbackLevel > last.feedbackLevel) {
    triggers.push(
      `反馈等级由「${FEEDBACK_LEVELS[last.feedbackLevel]}」升高为「${FEEDBACK_LEVELS[input.feedbackLevel]}」`
    );
  }
  return triggers;
}

/** 与上次确认单完全一致（验配师、原因不纳入比较） */
export function isUnchanged(input: FittingInput, last: FittingRevision): boolean {
  return (
    input.hearing.airConductionDb === last.hearing.airConductionDb &&
    input.hearing.boneConductionDb === last.hearing.boneConductionDb &&
    input.hearing.speechRecognitionPct === last.hearing.speechRecognitionPct &&
    input.aidModel.trim() === last.aidModel &&
    GAIN_BANDS.every((band) => input.gains[band.key] === last.gains[band.key]) &&
    input.feedbackLevel === last.feedbackLevel
  );
}

/** 初配校验：只查基础字段，不涉及与上次的比较 */
export function validateInitial(input: FittingInput, customerName: string): ValidationResult {
  const errors = checkCommon(input);
  if (!customerName.trim()) {
    errors.unshift("请填写客户姓名");
  }
  return { ok: errors.length === 0, errors, reasonRequired: false, reasonTriggers: [] };
}

/** 复调校验：基础字段 + 与上次确认单比较，超阈必须写原因 */
export function validateReadjust(input: FittingInput, last: FittingRevision): ValidationResult {
  const errors = checkCommon(input);
  const reasonTriggers = reasonTriggersFor(input, last);
  const reasonRequired = reasonTriggers.length > 0;

  if (reasonRequired && !input.reason.trim()) {
    errors.push(
      `增益变化超过 ${GAIN_REASON_THRESHOLD_DB} dB 或反馈等级升高，必须填写调整原因`
    );
  }
  if (isUnchanged(input, last)) {
    errors.push("与上次确认值完全一致，没有需要记录的改动");
  }
  return { ok: errors.length === 0, errors, reasonRequired, reasonTriggers };
}
