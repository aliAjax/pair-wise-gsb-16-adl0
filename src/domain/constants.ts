// 领域常量：频率、耳别、反馈等级、录入限值
// 纯资料层，不包含校验逻辑与存储逻辑。

export const FREQS = ["250", "500", "1000", "2000", "4000", "8000"] as const;
export type Freq = (typeof FREQS)[number];

export type NumberByFreq = Record<Freq, number>;
export type StringByFreq = Record<Freq, string>;
export type NullableByFreq = Record<Freq, number | null>;

export const FREQ_LABELS: Record<Freq, string> = {
  "250": "250Hz",
  "500": "500Hz",
  "1000": "1kHz",
  "2000": "2kHz",
  "4000": "4kHz",
  "8000": "8kHz",
};

export type EarSide = "L" | "R";

export const EAR_LABEL: Record<EarSide, string> = {
  L: "左耳",
  R: "右耳",
};

export interface FeedbackOption {
  value: number;
  label: string;
  desc: string;
}

// 反馈等级：数字越大越严重
export const FEEDBACK_LEVELS: FeedbackOption[] = [
  { value: 1, label: "1 · 无反馈", desc: "佩戴安静，无啸叫" },
  { value: 2, label: "2 · 偶发轻微", desc: "贴近物体时偶发" },
  { value: 3, label: "3 · 明显反馈", desc: "日常场景可闻" },
  { value: 4, label: "4 · 持续啸叫", desc: "持续影响使用" },
];

export const FEEDBACK_LABEL: Record<number, string> = Object.fromEntries(
  FEEDBACK_LEVELS.map((item) => [item.value, item.label])
);

// 业务限值
export const LIMITS = {
  gainMin: -10,
  gainMax: 80,
  hlMin: -10,
  hlMax: 120,
  speechMin: 0,
  speechMax: 100,
  // 任一频率增益变化绝对值超过该阈值（dB）时，必须填写改动原因
  gainDeltaRule: 6,
};

export function blankStringFreq(): StringByFreq {
  return { "250": "", "500": "", "1000": "", "2000": "", "4000": "", "8000": "" };
}
