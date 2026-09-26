import { FREQ_LABELS, FREQS, FEEDBACK_LABEL, LIMITS, type Freq } from "../domain/constants";
import {
  formatDateTime,
  formatDelta,
  getLatestRevision,
} from "../domain/model";
import type { FittingChain, FittingRevision } from "../domain/types";
import { StatusPill } from "./ui";

function RevisionBlock({
  revision,
  previous,
  isLast,
}: {
  revision: FittingRevision;
  previous?: FittingRevision;
  isLast: boolean;
}) {
  const deltas: Record<Freq, number | null> = {} as Record<Freq, number | null>;
  const flagged: Freq[] = [];
  if (previous) {
    for (const f of FREQS) {
      const d = revision.gains[f] - previous.gains[f];
      deltas[f] = d;
      if (Math.abs(d) > LIMITS.gainDeltaRule) flagged.push(f);
    }
  }
  const feedbackUp = previous
    ? revision.feedbackLevel > previous.feedbackLevel
    : false;
  const feedbackDown = previous
    ? revision.feedbackLevel < previous.feedbackLevel
    : false;

  return (
    <article className={`revision${isLast ? " latest" : ""}`}>
      <header className="revision-head">
        <div className="revision-title">
          <span className="rev-no">第 {revision.revNo} 版</span>
          {revision.kind === "initial" ? (
            <StatusPill tone="muted">初配</StatusPill>
          ) : (
            <StatusPill tone="warn">复调</StatusPill>
          )}
          {isLast && <StatusPill tone="ok">当前确认单</StatusPill>}
        </div>
        <time>{formatDateTime(revision.createdAt)}</time>
      </header>

      <div className="revision-meta">
        <span>验配师：{revision.fitter}</span>
        <span>
          反馈等级：{FEEDBACK_LABEL[revision.feedbackLevel] ?? revision.feedbackLevel}
          {feedbackUp && <em className="delta-up"> ↑ 升高（已记录原因）</em>}
          {feedbackDown && <em className="delta-down"> ↓ 下降</em>}
        </span>
      </div>

      <div className="gain-grid">
        {FREQS.map((f) => (
          <div className="gain-cell" key={f}>
            <small>{FREQ_LABELS[f]}</small>
            <strong>{revision.gains[f]}</strong>
            {previous && (
              <em
                className={
                  flagged.includes(f)
                    ? "delta-up"
                    : deltas[f] === 0
                      ? "delta-flat"
                      : deltas[f]! > 0
                        ? "delta-up"
                        : "delta-down"
                }
              >
                {formatDelta(deltas[f]!)}
              </em>
            )}
          </div>
        ))}
      </div>

      {flagged.length > 0 && (
        <p className="rule-flag">
          {flagged.map((f) => `${f}Hz`).join("、")} 增益变化超过 {LIMITS.gainDeltaRule}dB
        </p>
      )}
      {revision.reason && (
        <p className="revision-reason">
          <b>改动原因：</b>
          {revision.reason}
        </p>
      )}
      {revision.note && (
        <p className="revision-note">
          <b>备注：</b>
          {revision.note}
        </p>
      )}
    </article>
  );
}

export function RevisionTimeline({ chain }: { chain: FittingChain }) {
  const latest = getLatestRevision(chain);
  return (
    <div className="timeline">
      {chain.revisions.map((rev, i) => (
        <RevisionBlock
          key={`${chain.customerCode}-${rev.revNo}`}
          revision={rev}
          previous={i > 0 ? chain.revisions[i - 1] : undefined}
          isLast={rev.revNo === latest.revNo}
        />
      ))}
      <p className="immutable-hint">
        已确认单据只可追加编号修订，历史单不可覆盖或删除。
      </p>
    </div>
  );
}
