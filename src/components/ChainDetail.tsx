import { FREQS, type Freq } from "../domain/constants";
import { getLatestRevision, pta } from "../domain/model";
import type { AdjustmentDraft, FittingChain } from "../domain/types";
import { FreqTable } from "./FreqTable";
import { EarBadge, StatusPill } from "./ui";
import { RevisionTimeline } from "./RevisionTimeline";

export interface ChainDetailProps {
  chain: FittingChain;
  draft?: AdjustmentDraft;
  onStartAdjustment: () => void;
  onResumeAdjustment: () => void;
  onCancelAdjustment: () => void;
}

export function ChainDetail({
  chain,
  draft,
  onStartAdjustment,
  onResumeAdjustment,
  onCancelAdjustment,
}: ChainDetailProps) {
  const latest = getLatestRevision(chain);

  const acRow = (label: string, values: Record<Freq, number | null>) => ({
    label,
    values,
    suffix: "",
  });

  return (
    <section className="panel detail-panel">
      <header className="detail-head">
        <div>
          <p className="eyebrow">
            客户编号 {chain.customerCode} · 建档 {chain.createdAt.slice(0, 10)}
          </p>
          <h2>
            <EarBadge ear={chain.ear} /> {chain.customerName}
          </h2>
        </div>
        <div className="detail-actions">
          {draft ? (
            <>
              <StatusPill tone="danger">该耳有一份复调待确认</StatusPill>
              <button className="primary-action" onClick={onResumeAdjustment}>
                继续复调草稿
              </button>
              <button onClick={onCancelAdjustment}>放弃草稿</button>
            </>
          ) : (
            <button className="primary-action" onClick={onStartAdjustment}>
              发起复调（带出第 {latest.revNo} 版增益）
            </button>
          )}
        </div>
      </header>

      <div className="info-grid">
        <div className="info-block">
          <h3>助听器</h3>
          <dl>
            <dt>品牌</dt>
            <dd>{chain.aid.brand}</dd>
            <dt>型号</dt>
            <dd>{chain.aid.model}</dd>
            <dt>机身编号</dt>
            <dd>{chain.aid.serial || "—"}</dd>
          </dl>
        </div>
        <div className="info-block">
          <h3>听力摘要</h3>
          <dl>
            <dt>左耳/右耳</dt>
            <dd>{chain.ear === "L" ? "左耳" : "右耳"}</dd>
            <dt>气导 PTA</dt>
            <dd>{pta(chain.audiogram.ac as Record<Freq, number>)} dB HL</dd>
            <dt>言语识别率</dt>
            <dd>{chain.audiogram.speechScore}%</dd>
          </dl>
        </div>
      </div>

      <div className="audiogram-block">
        <h3>听力数据（初配录入，dB HL）</h3>
        <FreqTable
          rows={[
            acRow("气导", chain.audiogram.ac),
            acRow("骨导", chain.audiogram.bc),
          ]}
        />
      </div>

      <div className="timeline-block">
        <h3>
          验配修订链
          <span className="rev-count">共 {chain.revisions.length} 版</span>
        </h3>
        <RevisionTimeline chain={chain} />
      </div>
    </section>
  );
}
