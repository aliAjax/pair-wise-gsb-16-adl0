import { useMemo } from "react";
import type { Freq } from "../domain/constants";
import { getLatestRevision } from "../domain/model";
import type { AdjustmentDraft, FittingChain } from "../domain/types";

interface DashboardProps {
  chains: FittingChain[];
  pendingAdjustments: AdjustmentDraft[];
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function meanAcPta(chain: FittingChain): number {
  const freqs: Freq[] = ["500", "1000", "2000", "4000"];
  return average(freqs.map((f) => chain.audiogram.ac[f]));
}

export function Dashboard({ chains, pendingAdjustments }: DashboardProps) {
  const metrics = useMemo(() => {
    const totalRevisions = chains.reduce((n, c) => n + c.revisions.length, 0);
    const avgPta = average(chains.map(meanAcPta));
    const avgSpeech = average(chains.map((c) => c.audiogram.speechScore));
    const latestDates = chains.map((c) => getLatestRevision(c).createdAt);
    return {
      customers: chains.length,
      revisions: totalRevisions,
      pending: pendingAdjustments.length,
      avgPta,
      avgSpeech,
      latestDate: latestDates.length ? latestDates[latestDates.length - 1] : undefined,
    };
  }, [chains, pendingAdjustments]);

  const cards = [
    { label: "在档客户（按耳）", value: String(metrics.customers), tone: "status-ok" },
    { label: "累计确认单据", value: String(metrics.revisions), tone: "status-ok" },
    { label: "待确认复调草稿", value: String(metrics.pending), tone: metrics.pending > 0 ? "status-danger" : "status-ok" },
    { label: "平均气导 PTA", value: `${metrics.avgPta} dB`, tone: "status-watch" },
    { label: "平均言语识别率", value: `${metrics.avgSpeech}%`, tone: "status-watch" },
  ];

  return (
    <section className="metrics-grid">
      {cards.map((c) => (
        <article className="metric-card" key={c.label}>
          <span>{c.label}</span>
          <strong>{c.value}</strong>
          <i className={c.tone} />
        </article>
      ))}
    </section>
  );
}
