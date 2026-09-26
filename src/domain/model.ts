// 领域纯函数：链键、上次增益带出、增益差值、修订构造、空白表单
// 只处理数据形态，不做校验、不碰存储。
import {
  FREQS,
  blankStringFreq,
  type EarSide,
  type Freq,
  type NumberByFreq,
  type StringByFreq,
} from "./constants";
import type {
  AdjustmentForm,
  FittingChain,
  FittingRevision,
  InitialForm,
} from "./types";

export function chainKey(customerCode: string, ear: EarSide): string {
  return `${customerCode.trim()}::${ear}`;
}

export function getLatestRevision(chain: FittingChain): FittingRevision {
  return chain.revisions[chain.revisions.length - 1];
}

/** 本次复调相对上一确认单的逐频率增益差（dB）；初配无对比返回 null */
export function gainDeltas(
  previous: NumberByFreq | undefined,
  current: NumberByFreq
): NumberByFreq | null {
  if (!previous) return null;
  const result = {} as NumberByFreq;
  for (const f of FREQS) {
    result[f] = current[f] - previous[f];
  }
  return result;
}

export function maxAbsGainDelta(deltas: NumberByFreq | null): number {
  if (!deltas) return 0;
  return Math.max(...FREQS.map((f) => Math.abs(deltas[f])));
}

export function isFeedbackEscalated(
  previousLevel: number | undefined,
  nextLevel: number
): boolean {
  return previousLevel !== undefined && nextLevel > previousLevel;
}

export function emptyInitialForm(): InitialForm {
  return {
    customerCode: "",
    customerName: "",
    ear: "",
    aidBrand: "",
    aidModel: "",
    aidSerial: "",
    ac: blankStringFreq(),
    bc: blankStringFreq(),
    speechScore: "",
    gains: blankStringFreq(),
    feedbackLevel: "1",
    fitter: "",
    note: "",
  };
}

/** 复调单默认带出上次已确认单的增益与反馈等级 */
export function adjustmentFormFromRevision(
  revision: FittingRevision,
  currentFitter = ""
): AdjustmentForm {
  const gains = {} as StringByFreq;
  for (const f of FREQS) {
    gains[f] = String(revision.gains[f]);
  }
  return {
    gains,
    feedbackLevel: String(revision.feedbackLevel),
    reason: "",
    fitter: currentFitter,
  };
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function pta(gains: NumberByFreq, freqs: Freq[] = ["500", "1000", "2000", "4000"]): number {
  const sum = freqs.reduce((acc, f) => acc + gains[f], 0);
  return Math.round(sum / freqs.length);
}
