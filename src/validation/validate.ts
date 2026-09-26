// 校验层：纯函数，负责录入数值解析、限值校验、复调规则判定
// 规则：任一频率增益变化超过 6dB（|Δ| > 6）或反馈等级升高，必须填写改动原因。
import {
  FREQS,
  LIMITS,
  type EarSide,
  type Freq,
  type NumberByFreq,
} from "../domain/constants";
import {
  gainDeltas,
  isFeedbackEscalated,
  maxAbsGainDelta,
} from "../domain/model";
import type {
  AdjustmentForm,
  Audiogram,
  FittingRevision,
  HearingAid,
  InitialForm,
} from "../domain/types";

export type ErrorMap = Record<string, string>;

export interface ParsedInitial {
  customerCode: string;
  customerName: string;
  ear: EarSide;
  aid: HearingAid;
  audiogram: Audiogram;
  gains: NumberByFreq;
  feedbackLevel: number;
  fitter: string;
  note: string;
}

export interface ParsedAdjustment {
  gains: NumberByFreq;
  feedbackLevel: number;
  reason: string;
  fitter: string;
}

interface NumberRule {
  min: number;
  max: number;
  integer?: boolean;
  label: string;
}

function parseNumber(raw: string, rule: NumberRule): { value?: number; error?: string } {
  const text = raw.trim();
  if (text === "") return { error: `${rule.label}必填` };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: `${rule.label}必须是数字` };
  if (rule.integer && !Number.isInteger(value)) {
    return { error: `${rule.label}必须为整数` };
  }
  if (value < rule.min || value > rule.max) {
    return { error: `${rule.label}须在 ${rule.min}~${rule.max} 之间` };
  }
  return { value };
}

function parseFreqRow(
  row: Record<Freq, string>,
  rule: NumberRule,
  prefix: string,
  errors: ErrorMap,
  allowEmpty = false
): NumberByFreq | null {
  const out = {} as NumberByFreq;
  let valid = true;
  for (const f of FREQS) {
    const text = row[f].trim();
    if (allowEmpty && text === "") {
      // 骨导可缺测，由调用方按 nullable 处理
      valid = false;
      break;
    }
    const r = parseNumber(text, { ...rule, label: `${rule.label}·${f}Hz` });
    if (r.error || r.value === undefined) {
      errors[`${prefix}.${f}`] = r.error ?? "数值无效";
      valid = false;
    } else {
      out[f] = r.value;
    }
  }
  return valid ? out : null;
}

export function validateInitial(form: InitialForm): {
  errors: ErrorMap;
  parsed?: ParsedInitial;
} {
  const errors: ErrorMap = {};

  const customerCode = form.customerCode.trim();
  if (!customerCode) errors.customerCode = "客户编号必填";
  const customerName = form.customerName.trim();
  if (!customerName) errors.customerName = "客户姓名必填";
  if (form.ear !== "L" && form.ear !== "R") errors.ear = "请选择耳别";

  const aidBrand = form.aidBrand.trim();
  const aidModel = form.aidModel.trim();
  if (!aidBrand) errors.aidBrand = "助听器品牌必填";
  if (!aidModel) errors.aidModel = "助听器型号必填";

  const ac = parseFreqRow(
    form.ac,
    { min: LIMITS.hlMin, max: LIMITS.hlMax, integer: true, label: "气导阈值" },
    "ac",
    errors
  );

  // 骨导：可缺测，空值存 null
  const bc = {} as Audiogram["bc"];
  let bcValid = true;
  for (const f of FREQS) {
    const text = form.bc[f].trim();
    if (text === "") {
      bc[f] = null;
      continue;
    }
    const r = parseNumber(text, {
      min: LIMITS.hlMin,
      max: LIMITS.hlMax,
      integer: true,
      label: `骨导阈值·${f}Hz`,
    });
    if (r.error || r.value === undefined) {
      errors[`bc.${f}`] = r.error ?? "数值无效";
      bcValid = false;
    } else {
      bc[f] = r.value;
    }
  }

  const speechRaw = parseNumber(form.speechScore, {
    min: LIMITS.speechMin,
    max: LIMITS.speechMax,
    label: "言语识别率",
  });
  if (speechRaw.error || speechRaw.value === undefined) {
    errors.speechScore = speechRaw.error ?? "数值无效";
  }

  const gains = parseFreqRow(
    form.gains,
    { min: LIMITS.gainMin, max: LIMITS.gainMax, integer: true, label: "增益" },
    "gains",
    errors
  );

  const feedbackRaw = parseNumber(form.feedbackLevel, {
    min: 1,
    max: 4,
    integer: true,
    label: "反馈等级",
  });
  if (feedbackRaw.error || feedbackRaw.value === undefined) {
    errors.feedbackLevel = feedbackRaw.error ?? "请选择反馈等级";
  }

  const fitter = form.fitter.trim();
  if (!fitter) errors.fitter = "验配师签名必填";

  if (
    Object.keys(errors).length > 0 ||
    !ac ||
    !gains ||
    !bcValid ||
    speechRaw.value === undefined ||
    feedbackRaw.value === undefined ||
    (form.ear !== "L" && form.ear !== "R")
  ) {
    return { errors };
  }

  return {
    errors,
    parsed: {
      customerCode,
      customerName,
      ear: form.ear,
      aid: { brand: aidBrand, model: aidModel, serial: form.aidSerial.trim() },
      audiogram: { ac, bc, speechScore: speechRaw.value },
      gains,
      feedbackLevel: feedbackRaw.value,
      fitter,
      note: form.note.trim(),
    },
  };
}

export interface AdjustmentEvaluation {
  errors: ErrorMap;
  parsed?: ParsedAdjustment;
  deltas: NumberByFreq | null;
  exceededFreqs: Freq[];
  maxDelta: number;
  feedbackEscalated: boolean;
  requiresReason: boolean;
}

/** 复调校验：基于上一确认单（不可用草稿对比） */
export function evaluateAdjustment(
  form: AdjustmentForm,
  previous: FittingRevision
): AdjustmentEvaluation {
  const errors: ErrorMap = {};

  const gains = parseFreqRow(
    form.gains,
    { min: LIMITS.gainMin, max: LIMITS.gainMax, integer: true, label: "增益" },
    "gains",
    errors
  );

  const feedbackRaw = parseNumber(form.feedbackLevel, {
    min: 1,
    max: 4,
    integer: true,
    label: "反馈等级",
  });
  if (feedbackRaw.error || feedbackRaw.value === undefined) {
    errors.feedbackLevel = feedbackRaw.error ?? "请选择反馈等级";
  }

  const fitter = form.fitter.trim();
  if (!fitter) errors.fitter = "验配师签名必填";

  const feedbackLevel = feedbackRaw.value;
  const deltas = gains ? gainDeltas(previous.gains, gains) : null;
  const exceededFreqs: Freq[] = deltas
    ? FREQS.filter((f) => Math.abs(deltas[f]) > LIMITS.gainDeltaRule)
    : [];
  const maxDelta = deltas ? maxAbsGainDelta(deltas) : 0;
  const feedbackEscalated =
    feedbackLevel !== undefined
      ? isFeedbackEscalated(previous.feedbackLevel, feedbackLevel)
      : false;
  const requiresReason = exceededFreqs.length > 0 || feedbackEscalated;

  const reason = form.reason.trim();
  if (requiresReason && !reason) {
    const parts: string[] = [];
    if (exceededFreqs.length > 0) {
      parts.push(
        `${exceededFreqs.map((f) => `${f}Hz`).join("、")} 增益变化超过 ${LIMITS.gainDeltaRule}dB（最大 ${maxDelta}dB）`
      );
    }
    if (feedbackEscalated) {
      parts.push(`反馈等级由 ${previous.feedbackLevel} 级升至 ${feedbackLevel} 级`);
    }
    errors.reason = `必须填写改动原因：${parts.join("；")}`;
  }
  // 注意：绝不向 previous 上挂载任何字段，旧确认单必须保持原样。

  if (Object.keys(errors).length > 0 || !gains || feedbackLevel === undefined) {
    return {
      errors,
      deltas,
      exceededFreqs,
      maxDelta,
      feedbackEscalated,
      requiresReason,
    };
  }

  return {
    errors,
    parsed: { gains, feedbackLevel, reason, fitter },
    deltas,
    exceededFreqs,
    maxDelta,
    feedbackEscalated,
    requiresReason,
  };
}
