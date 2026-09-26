import { useEffect, useRef, useState } from "react";
import {
  FREQ_LABELS,
  FREQS,
  FEEDBACK_LEVELS,
  LIMITS,
  type Freq,
} from "../domain/constants";
import { emptyInitialForm } from "../domain/model";
import type { InitialForm as InitialFormType, InitialDraft } from "../domain/types";
import { validateInitial, type ErrorMap } from "../validation/validate";
import { FieldError, StatusPill } from "./ui";

interface InitialFormEditorProps {
  draft: InitialDraft;
  onSaveDraft: (form: InitialFormType) => void;
  onConfirm: (form: InitialFormType) => void;
  onDiscard: () => void;
  onBack: () => void;
  codeTaken: (code: string, ear: "L" | "R") => boolean;
}

export function InitialFormEditor({
  draft,
  onSaveDraft,
  onConfirm,
  onDiscard,
  onBack,
  codeTaken,
}: InitialFormEditorProps) {
  const [form, setForm] = useState<InitialFormType>(draft.form ?? emptyInitialForm());
  const [errors, setErrors] = useState<ErrorMap>({});
  const [saveHint, setSaveHint] = useState("");
  const saveTimer = useRef<number | null>(null);

  // 换单（draftId 变化）时整体重置，初配草稿互不串台
  useEffect(() => {
    setForm(draft.form ?? emptyInitialForm());
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.draftId]);

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

  const set = <K extends keyof InitialFormType>(key: K, value: InitialFormType[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setFreq = (
    rowKey: "ac" | "bc" | "gains",
    f: Freq,
    value: string
  ) => setForm((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [f]: value } }));

  const handleConfirm = () => {
    const result = validateInitial(form);
    if (result.parsed && codeTaken(result.parsed.customerCode, result.parsed.ear)) {
      setErrors({ ...result.errors, customerCode: "该客户耳别已建档，不能重复初配" });
      return;
    }
    setErrors(result.errors);
    if (result.parsed) onConfirm(form);
  };

  return (
    <section className="panel editor-panel">
      <header className="editor-head">
        <div>
          <p className="eyebrow">初配录单 · 草稿 {draft.draftId.slice(-6)}</p>
          <h2>新建验配台账</h2>
          <p className="save-hint">
            <StatusPill tone="warn">待确认</StatusPill> {saveHint || "录入中自动保存…"}
          </p>
        </div>
        <div className="detail-actions">
          <button onClick={onBack}>返回台账</button>
          <button onClick={onDiscard}>放弃草稿</button>
          <button className="primary-action" onClick={handleConfirm}>
            确认初配（建为第 1 版）
          </button>
        </div>
      </header>

      <h3 className="form-section">客户与耳别</h3>
      <div className="form-row-3">
        <label>
          <span>客户编号 *</span>
          <input
            value={form.customerCode}
            onChange={(e) => set("customerCode", e.target.value)}
            placeholder="如 Liu-024"
          />
          <FieldError message={errors.customerCode} />
        </label>
        <label>
          <span>客户姓名 *</span>
          <input
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
          />
          <FieldError message={errors.customerName} />
        </label>
        <label>
          <span>耳别 *</span>
          <div className="ear-toggle">
            {(["L", "R"] as const).map((e) => (
              <button
                type="button"
                key={e}
                className={form.ear === e ? "active" : ""}
                onClick={() => set("ear", e)}
              >
                {e === "L" ? "左耳" : "右耳"}
              </button>
            ))}
          </div>
          <FieldError message={errors.ear} />
        </label>
      </div>

      <h3 className="form-section">助听器</h3>
      <div className="form-row-3">
        <label>
          <span>品牌 *</span>
          <input value={form.aidBrand} onChange={(e) => set("aidBrand", e.target.value)} />
          <FieldError message={errors.aidBrand} />
        </label>
        <label>
          <span>型号 *</span>
          <input value={form.aidModel} onChange={(e) => set("aidModel", e.target.value)} />
          <FieldError message={errors.aidModel} />
        </label>
        <label>
          <span>机身编号</span>
          <input value={form.aidSerial} onChange={(e) => set("aidSerial", e.target.value)} />
        </label>
      </div>

      <h3 className="form-section">听力数据（dB HL，骨导可留空表示未测）</h3>
      <div className="freq-edit-table">
        <div className="freq-row freq-head">
          <span>项目</span>
          {FREQS.map((f) => (
            <span key={f}>{FREQ_LABELS[f]}</span>
          ))}
        </div>
        {([
          ["ac", "气导 *"],
          ["bc", "骨导"],
        ] as const).map(([rowKey, label]) => (
          <div className="freq-row freq-input-row" key={rowKey}>
            <span className="freq-row-label">{label}</span>
            {FREQS.map((f) => (
              <span key={f} className="freq-cell-input">
                <input
                  inputMode="numeric"
                  value={form[rowKey][f]}
                  onChange={(e) => setFreq(rowKey, f, e.target.value)}
                  aria-label={`${label} ${FREQ_LABELS[f]}`}
                />
                <FieldError message={errors[`${rowKey}.${f}`]} />
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="form-row-3 form-section-inline">
        <label>
          <span>言语识别率（0-100%）*</span>
          <input
            inputMode="numeric"
            value={form.speechScore}
            onChange={(e) => set("speechScore", e.target.value)}
          />
          <FieldError message={errors.speechScore} />
        </label>
      </div>

      <h3 className="form-section">初配增益与反馈（dB）</h3>
      <div className="freq-edit-table">
        <div className="freq-row freq-head">
          <span>增益 *</span>
          {FREQS.map((f) => (
            <span key={f}>{FREQ_LABELS[f]}</span>
          ))}
        </div>
        <div className="freq-row freq-input-row">
          <span className="freq-row-label">增益 *（{LIMITS.gainMin}~{LIMITS.gainMax}）</span>
          {FREQS.map((f) => (
            <span key={f} className="freq-cell-input">
              <input
                inputMode="numeric"
                value={form.gains[f]}
                onChange={(e) => setFreq("gains", f, e.target.value)}
                aria-label={`增益 ${FREQ_LABELS[f]}`}
              />
              <FieldError message={errors[`gains.${f}`]} />
            </span>
          ))}
        </div>
      </div>

      <div className="form-row-2 form-section-inline">
        <label>
          <span>用户反馈等级 *</span>
          <select
            value={form.feedbackLevel}
            onChange={(e) => set("feedbackLevel", e.target.value)}
          >
            {FEEDBACK_LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}（{opt.desc}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>验配师签名 *</span>
          <input value={form.fitter} onChange={(e) => set("fitter", e.target.value)} />
          <FieldError message={errors.fitter} />
        </label>
      </div>

      <label className="reason-field">
        <span>备注</span>
        <textarea
          rows={2}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="初配情况、患者主观反馈等"
        />
      </label>
    </section>
  );
}
