import { FREQS, FREQ_LABELS, type Freq } from "../domain/constants";

export interface FreqRow {
  label: string;
  values: Record<Freq, number | null>;
  /** 需要重点标记的频率（如 Δ 超过 6dB） */
  flagged?: Freq[];
  suffix?: string;
  strong?: boolean;
}

/** 听力数据 / 增益的频率横向表格（只读展示） */
export function FreqTable({ rows }: { rows: FreqRow[] }) {
  return (
    <div className="freq-table">
      <div className="freq-row freq-head">
        <span>项目</span>
        {FREQS.map((f) => (
          <span key={f}>{FREQ_LABELS[f]}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div className={`freq-row${row.strong ? " strong" : ""}`} key={row.label}>
          <span className="freq-row-label">{row.label}</span>
          {FREQS.map((f) => {
            const v = row.values[f];
            const flagged = row.flagged?.includes(f);
            return (
              <span
                key={f}
                className={flagged ? "cell-flag" : v === null ? "cell-empty" : undefined}
              >
                {v === null ? "未测" : `${v}${row.suffix ?? ""}`}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
