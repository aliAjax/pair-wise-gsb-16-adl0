import { useEffect, useMemo, useRef, useState } from "react";
import {
  FREQ_LABELS,
  FREQS,
  FEEDBACK_LEVELS,
  LIMITS,
  type Freq,
} from "../domain/constants";
import { getLatestRevision } from "../domain/model";
import type { AdjustmentDraft, FittingChain } from "../domain/types";
import { evaluateAdjustment, type ErrorMap } from "../validation/validate";
import { FieldError, StatusPill } from "./ui";

interface AdjustmentEditorProps {
  chain: FittingChain;
  draft: AdjustmentDraft;
  onSaveDraft: (form: AdjustmentDraft["form"]) => void;
  onConfirm: (form: AdjustmentDraft["form"]) => void;
  onDiscard: () => void;
}

export function AdjustmentEditor({
  chain,
  draft,
  onSaveDraft,
  onConfirm,
  onDiscard,
}: AdjustmentEditorProps) {
  const previous = getLatestRevision(chain);
  const [form, setForm] = useState<AdjustmentDraft["form"]>(draft.form);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [saveHint, setSaveHint] = useState("");
  const saveTimer = useRef<number | null>(null);

  // 草稿以 chainKey 为键：切到别的客户/耳别时编辑器整体换挂，状态不会串台
  useEffect(() => {
    setForm(draft.form);
    setErrors({});
    // 只随单据切换换挂，不随 updatedAt 回传重置（否则会打断正在录入的表单）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.key]);

  // 输入即存草稿（同一客户同耳覆盖同一份），重开页面可继续
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      onSaveDraft(form);
      setSaveHint(`草稿已保存 ${new Date().toLocaleTimeString("zh-CN")}`);
    }, 350);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const live = useMemo(
    () => evaluateAdjustment(form, previous),
    [form, previous]
  );

  const setGain = (f: Freq, v: string) =>
    setForm((prev) => ({ ...prev, gains: { ...prev.gains, [f]: v } }));

  const handleConfirm = () => {
    const result = evaluateAdjustment(form, previous);
    setErrors(result.errors);
    if (result.parsed) {
      onConfirm(form);
    }
  };

  return (
    <section className="panel editor-panel">
      <header className="editor-head">
        <div>
          <p className="eyebrow">复调草稿 · {chain.customerCode} · {chain.ear === "L" ? "左耳" : "右耳"}</p>
          <h2>第 {previous.revNo + 1} 版调机单</h2>
          <p className="save-hint">
            <StatusPill tone="warn">待确认</StatusPill> {saveHint || "录入中自动保存草稿…"}
          </p>
        </div>
        <div className="detail-actions">
          <button onClick={onDiscard}>放弃草稿</button>
          <button className="primary-action" onClick={handleConfirm}>
            确认复调（追加为第 {previous.revNo + 1} 版）
          </button>
        </div>
      </header>

      <div className="rule-banner">
        规则：任一频率增益变化 <b>超过 {LIMITS.gainDeltaRule}dB</b>，或反馈等级<b>升高</b>，
        必须在下方写明改动原因；确认后旧单保留，本次接成编号修订。
      </div>

      <div className="prev-summary">
        <span>上一确认单（第 {previous.revNo} 版）反馈等级：{previous.feedbackLevel} 级</span>
        <span>
          上次增益：
          {FREQS.map((f) => `${FREQ_LABELS[f]} ${previous.gains[f]}`).join(" / ")} dB
        </span>
      </div>

      <div className="gain-edit-grid">
        {FREQS.map((f) => {
          const raw = form.gains[f].trim();
          const num = raw === "" ? NaN : Number(raw);
          const delta = Number.isFinite(num) ? num - previous.gains[f] : null;
          const over = delta !== null && Math.abs(delta) > LIMITS.gainDeltaRule;
          return (
            <label className={`gain-edit ${over ? "over" : ""}`} key={f}>
              <span>{FREQ_LABELS[f]}</span>
              <input
                inputMode="numeric"
                value={form.gains[f]}
                onChange={(e) => setGain(f, e.target.value)}
                aria-label={`${FREQ_LABELS[f]} 增益`}
              />
              <small className={over ? "delta-up" : delta !== null && delta < 0 ? "delta-down" : ""}>
                上次 {previous.gains[f]}
                {delta !== null && (
                  <em>
                    {" "}
                    本次差 {delta > 0 ? `+${delta}` : delta} dB{over ? " ⚠" : ""}
                  </em>
                )}
              </small>
              <FieldError message={errors[`gains.${f}`]} />
            </label>
          );
        })}
      </div>

      <div className="form-row-2">
        <label>
          <span>用户反馈等级（本次）</span>
          <select
            value={form.feedbackLevel}
            onChange={(e) => setForm((p) => ({ ...p, feedbackLevel: e.target.value }))}
          >
            {FEEDBACK_LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}（{opt.desc}）
              </option>
            ))}
          </select>
          <FieldError message={errors.feedbackLevel} />
        </label>
        <label>
          <span>验配师签名</span>
          <input
            value={form.fitter}
            onChange={(e) => setForm((p) => ({ ...p, fitter: e.target.value }))}
            placeholder="本次操作听力师姓名"
          />
          <FieldError message={errors.fitter} />
        </label>
      </div>

      <div className="rule-status">
        {live.requiresReason ? (
          <StatusPill tone="danger">
            需写原因：
            {live.exceededFreqs.length > 0 &&
              ` ${live.exceededFreqs.map((f) => FREQ_LABELS[f]).join("、")} Δ 超 ${LIMITS.gainDeltaRule}dB`}
            {live.exceededFreqs.length > 0 && live.feedbackEscalated && "；"}
            {live.feedbackEscalated && " 反馈等级升高"}
          </StatusPill>
        ) : (
          <StatusPill tone="ok">本次改动未触发强制原因规则</StatusPill>
        )}
      </div>

      <label className="reason-field">
        <span>
          改动原因{live.requiresReason ? "（必填）" : "（选填）"}
        </span>
        <textarea
          rows={3}
          value={form.reason}
          onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
          placeholder={
            live.requiresReason
              ? "说明为何要做此增益/反馈等级调整，以及针对的佩戴问题"
              : "无明显改动可留空"
          }
        />
        <FieldError message={errors.reason} />
      </label>
    </section>
  );
}
