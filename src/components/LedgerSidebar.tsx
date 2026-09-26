import { useMemo, useState } from "react";
import { EAR_LABEL, type EarSide } from "../domain/constants";
import { chainKey, formatDateTime, getLatestRevision } from "../domain/model";
import type { AdjustmentDraft, FittingChain, InitialDraft } from "../domain/types";
import { EarBadge, StatusPill } from "./ui";

type EarFilter = "ALL" | EarSide;

export interface SidebarProps {
  chains: FittingChain[];
  adjustmentDrafts: AdjustmentDraft[];
  initialDrafts: InitialDraft[];
  selectedKey: string | null;
  onSelectChain: (key: string) => void;
  onNewInitial: () => void;
  onOpenInitialDraft: (draftId: string) => void;
}

export function LedgerSidebar({
  chains,
  adjustmentDrafts,
  initialDrafts,
  selectedKey,
  onSelectChain,
  onNewInitial,
  onOpenInitialDraft,
}: SidebarProps) {
  const [keyword, setKeyword] = useState("");
  const [earFilter, setEarFilter] = useState<EarFilter>("ALL");

  const draftByKey = useMemo(() => {
    const m = new Map<string, AdjustmentDraft>();
    for (const d of adjustmentDrafts) m.set(d.key, d);
    return m;
  }, [adjustmentDrafts]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return chains
      .filter((c) => (earFilter === "ALL" ? true : c.ear === earFilter))
      .filter((c) => {
        if (!kw) return true;
        return (
          c.customerCode.toLowerCase().includes(kw) ||
          c.customerName.toLowerCase().includes(kw)
        );
      })
      .sort((a, b) => {
        const da = draftByKey.has(chainKey(a.customerCode, a.ear)) ? 1 : 0;
        const db = draftByKey.has(chainKey(b.customerCode, b.ear)) ? 1 : 0;
        if (da !== db) return db - da;
        return (
          getLatestRevision(b).createdAt.localeCompare(getLatestRevision(a).createdAt)
        );
      });
  }, [chains, keyword, earFilter, draftByKey]);

  return (
    <aside className="sidebar panel">
      <div className="sidebar-head">
        <h2>验配台账</h2>
        <button className="primary-action small" onClick={onNewInitial}>
          ＋ 初配录单
        </button>
      </div>

      <div className="search-box">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="按客户编号 / 姓名查找"
          aria-label="按客户编号或姓名查找"
        />
      </div>
      <div className="ear-filter" role="group" aria-label="按耳别筛选">
        {(["ALL", "L", "R"] as EarFilter[]).map((e) => (
          <button
            key={e}
            className={earFilter === e ? "active" : ""}
            onClick={() => setEarFilter(e)}
          >
            {e === "ALL" ? "全部耳别" : EAR_LABEL[e]}
          </button>
        ))}
      </div>

      {initialDrafts.length > 0 && (
        <div className="draft-group">
          <p className="group-title">初配草稿（{initialDrafts.length}）</p>
          {initialDrafts.map((d) => (
            <button
              key={d.draftId}
              className="chain-card initial-draft"
              onClick={() => onOpenInitialDraft(d.draftId)}
            >
              <span className="chain-top">
                <StatusPill tone="warn">待确认初配</StatusPill>
                <time>{formatDateTime(d.updatedAt)}</time>
              </span>
              <strong>
                {d.form.customerName.trim() || "未命名客户"}
                {d.form.customerCode ? ` · ${d.form.customerCode}` : ""}
              </strong>
              <small>
                {d.form.ear === "" ? "耳别未选" : EAR_LABEL[d.form.ear]} ·{" "}
                {d.form.aidModel.trim() || "机型未填"}
              </small>
            </button>
          ))}
        </div>
      )}

      <p className="group-title">
        台账链（{filtered.length}/{chains.length}）
      </p>
      <div className="chain-list">
        {filtered.length === 0 && <p className="empty-hint">没有匹配的客户</p>}
        {filtered.map((c) => {
          const key = chainKey(c.customerCode, c.ear);
          const latest = getLatestRevision(c);
          const draft = draftByKey.get(key);
          return (
            <button
              key={key}
              className={`chain-card${selectedKey === key ? " selected" : ""}`}
              onClick={() => onSelectChain(key)}
            >
              <span className="chain-top">
                <EarBadge ear={c.ear} />
                {draft ? (
                  <StatusPill tone="danger">有复调待确认</StatusPill>
                ) : (
                  <StatusPill tone="ok">第 {latest.revNo} 版</StatusPill>
                )}
              </span>
              <strong>
                {c.customerName} · {c.customerCode}
              </strong>
              <small>
                {c.aid.brand} {c.aid.model}
              </small>
              <time>最近调机 {formatDateTime(latest.createdAt)}</time>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
