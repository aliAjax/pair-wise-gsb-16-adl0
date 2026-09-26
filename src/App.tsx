import { useMemo, useState } from "react";
import "./styles.css";
import {
  EAR_LABEL,
  EarSide,
  FEEDBACK_LEVELS,
  FittingLedger,
  FittingRevision,
  formatRevisionNo,
  GAIN_BANDS,
  latestRevision,
  MAX_FEEDBACK_LEVEL,
  ReadjustDraft,
  REVISION_KIND_LABEL,
} from "./domain/types";
import {
  FittingInput,
  GAIN_REASON_THRESHOLD_DB,
  isUnchanged,
  reasonTriggersFor,
  validateInitial,
  validateReadjust,
} from "./domain/validation";
import * as store from "./storage/ledgerStore";

// ------------------------------------------------------------
// 表单状态：输入框统一用字符串，提交/暂存时才解析成数字
// ------------------------------------------------------------

interface FormState {
  air: string;
  bone: string;
  speech: string;
  aidModel: string;
  hz500: string;
  hz1000: string;
  hz2000: string;
  hz4000: string;
  feedbackLevel: string;
  reason: string;
  operator: string;
}

function emptyForm(): FormState {
  return {
    air: "",
    bone: "",
    speech: "",
    aidModel: "",
    hz500: "",
    hz1000: "",
    hz2000: "",
    hz4000: "",
    feedbackLevel: "0",
    reason: "",
    operator: "",
  };
}

function formFromRevision(rev: FittingRevision): FormState {
  return {
    air: String(rev.hearing.airConductionDb),
    bone: String(rev.hearing.boneConductionDb),
    speech: String(rev.hearing.speechRecognitionPct),
    aidModel: rev.aidModel,
    hz500: String(rev.gains.hz500),
    hz1000: String(rev.gains.hz1000),
    hz2000: String(rev.gains.hz2000),
    hz4000: String(rev.gains.hz4000),
    feedbackLevel: String(rev.feedbackLevel),
    reason: "",
    operator: rev.operator,
  };
}

function formFromDraft(draft: ReadjustDraft): FormState {
  return {
    air: String(draft.hearing.airConductionDb),
    bone: String(draft.hearing.boneConductionDb),
    speech: String(draft.hearing.speechRecognitionPct),
    aidModel: draft.aidModel,
    hz500: String(draft.gains.hz500),
    hz1000: String(draft.gains.hz1000),
    hz2000: String(draft.gains.hz2000),
    hz4000: String(draft.gains.hz4000),
    feedbackLevel: String(draft.feedbackLevel),
    reason: draft.reason,
    operator: draft.operator,
  };
}

/** 全部数字字段可解析时返回 FittingInput，否则 null */
function parseForm(form: FormState): FittingInput | null {
  const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const air = toNum(form.air);
  const bone = toNum(form.bone);
  const speech = toNum(form.speech);
  const hz500 = toNum(form.hz500);
  const hz1000 = toNum(form.hz1000);
  const hz2000 = toNum(form.hz2000);
  const hz4000 = toNum(form.hz4000);
  const feedbackLevel = toNum(form.feedbackLevel);
  const nums = [air, bone, speech, hz500, hz1000, hz2000, hz4000, feedbackLevel];
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return {
    hearing: {
      airConductionDb: air,
      boneConductionDb: bone,
      speechRecognitionPct: speech,
    },
    aidModel: form.aidModel,
    gains: { hz500, hz1000, hz2000, hz4000 },
    feedbackLevel,
    reason: form.reason,
    operator: form.operator,
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusColors = ["status-ok", "status-watch", "status-danger"];

// ------------------------------------------------------------
// 页面
// ------------------------------------------------------------

type Mode = "idle" | "initial" | "readjust";

function App() {
  const [ledgers, setLedgers] = useState<FittingLedger[]>(() => store.ensureSeeded());
  const [drafts, setDrafts] = useState<Record<string, ReadjustDraft>>(() =>
    store.loadAllDrafts(store.loadLedgers())
  );
  const [queryName, setQueryName] = useState("");
  const [queryEar, setQueryEar] = useState<EarSide | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [initialName, setInitialName] = useState("");
  const [initialEar, setInitialEar] = useState<EarSide>("left");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const selected = ledgers.find((l) => l.id === selectedId) ?? null;
  const results = store.searchLedgers(ledgers, queryName, queryEar);

  const patchForm = (patch: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  function commitLedgers(next: FittingLedger[]) {
    setLedgers(next);
    store.persistLedgers(next);
  }

  function removeDraftState(ledgerId: string) {
    setDrafts((prev) => {
      const copy = { ...prev };
      delete copy[ledgerId];
      return copy;
    });
  }

  /**
   * 换单前把当前复调表单暂存回本台账的草稿位。
   * 草稿按 ledgerId 存放，因此各客户/耳别之间不会串台。
   */
  function stashCurrentDraft(): string | null {
    if (mode !== "readjust" || !selected) return null;
    const parsed = parseForm(form);
    if (!parsed) return null;
    const last = latestRevision(selected);
    if (isUnchanged(parsed, last)) {
      // 没有实质改动：清掉旧草稿，不制造“待确认”
      if (drafts[selected.id]) {
        store.clearDraft(selected.id);
        removeDraftState(selected.id);
      }
      return null;
    }
    const draft: ReadjustDraft = {
      ledgerId: selected.id,
      ...parsed,
      updatedAt: new Date().toISOString(),
    };
    store.saveDraft(draft);
    setDrafts((prev) => ({ ...prev, [selected.id]: draft }));
    return `${selected.customerName} · ${EAR_LABEL[selected.ear]}`;
  }

  function openLedger(ledger: FittingLedger) {
    if (ledger.id === selectedId && mode === "readjust") return;
    const stashed = stashCurrentDraft();
    const draft = store.loadDraft(ledger.id);
    setSelectedId(ledger.id);
    setMode("readjust");
    setForm(draft ? formFromDraft(draft) : formFromRevision(latestRevision(ledger)));
    setErrors([]);
    setNotice(
      stashed
        ? `已自动暂存「${stashed}」的待确认草稿，各台账草稿互不串台`
        : draft
          ? `已载入「${ledger.customerName} · ${EAR_LABEL[ledger.ear]}」的待确认草稿`
          : ""
    );
  }

  function startInitial() {
    const stashed = stashCurrentDraft();
    setSelectedId(null);
    setMode("initial");
    setInitialName(queryName.trim());
    setInitialEar(queryEar === "all" ? "left" : queryEar);
    setForm(emptyForm());
    setErrors([]);
    setNotice(stashed ? `已自动暂存「${stashed}」的待确认草稿` : "");
  }

  function confirmInitial() {
    const parsed = parseForm(form);
    if (!parsed) {
      setErrors(["请完整填写听力数据与四频段增益（数字）后再确认"]);
      return;
    }
    const result = validateInitial(parsed, initialName);
    if (store.findLedger(ledgers, initialName, initialEar)) {
      result.errors.push("该客户此耳别已有台账，请从左侧打开后直接复调");
    }
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    const revision: FittingRevision = {
      revisionNo: 1,
      kind: "initial",
      ...parsed,
      reason: "",
      createdAt: new Date().toISOString(),
    };
    const ledger = store.createLedger(initialName, initialEar, revision);
    commitLedgers([...ledgers, ledger]);
    setSelectedId(ledger.id);
    setMode("readjust");
    setForm(formFromRevision(revision));
    setErrors([]);
    setNotice(
      `已建立「${ledger.customerName} · ${EAR_LABEL[ledger.ear]}」台账，初配单 R1 已确认`
    );
  }

  function confirmReadjust() {
    if (!selected) return;
    const parsed = parseForm(form);
    if (!parsed) {
      setErrors(["请完整填写听力数据与四频段增益（数字）后再确认"]);
      return;
    }
    const last = latestRevision(selected);
    const result = validateReadjust(parsed, last);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const revision: FittingRevision = {
      revisionNo: store.nextRevisionNo(selected),
      kind: "readjust",
      ...parsed,
      reason: parsed.reason.trim(),
      createdAt: new Date().toISOString(),
    };
    // 旧单不覆盖：新修订追加到末尾，历史单据原样保留
    const nextLedger = store.appendRevision(selected, revision);
    commitLedgers(ledgers.map((l) => (l.id === selected.id ? nextLedger : l)));
    store.clearDraft(selected.id);
    removeDraftState(selected.id);
    setForm(formFromRevision(revision));
    setErrors([]);
    setNotice(
      `已确认并生成修订 ${formatRevisionNo(revision.revisionNo)}，此前单据保留未改动`
    );
  }

  function saveDraftClick() {
    if (!selected) return;
    const parsed = parseForm(form);
    if (!parsed) {
      setErrors(["草稿也需把数字字段填写完整后才能暂存"]);
      return;
    }
    const draft: ReadjustDraft = {
      ledgerId: selected.id,
      ...parsed,
      updatedAt: new Date().toISOString(),
    };
    store.saveDraft(draft);
    setDrafts((prev) => ({ ...prev, [selected.id]: draft }));
    setErrors([]);
    setNotice(
      `已暂存「${selected.customerName} · ${EAR_LABEL[selected.ear]}」的复调草稿（同耳待确认只保留一份）`
    );
  }

  // 实时计算：本次复调是否已触发“原因必填”
  const liveTriggers = useMemo(() => {
    if (mode !== "readjust" || !selected) return [];
    const parsed = parseForm(form);
    if (!parsed) return [];
    return reasonTriggersFor(parsed, latestRevision(selected));
  }, [mode, selected, form]);

  const reasonRequired = liveTriggers.length > 0;

  const metrics = useMemo(() => {
    const all = ledgers.flatMap((l) => l.revisions);
    return [
      { label: "台账（客户×耳别）", value: String(ledgers.length) },
      { label: "待确认草稿", value: String(Object.keys(drafts).length) },
      { label: "累计修订", value: String(all.length) },
      {
        label: "复调次数",
        value: String(all.filter((r) => r.kind === "readjust").length),
      },
    ];
  }, [ledgers, drafts]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-01 · port 5101</p>
          <h1>验配台账</h1>
          <p className="subtitle">
            初配建档记录客户、耳别、听力数据与助听器；复调自动带出上次增益，
            变化超过 {GAIN_REASON_THRESHOLD_DB}dB 或反馈等级升高必须填写原因。
            确认后的单据只读不覆盖，新调整以编号修订接续。
          </p>
        </div>
        <div className="stack-card">
          <span>使用说明</span>
          <strong>左侧按客户姓名和耳别查找台账；找不到时可直接发起初配建档。</strong>
          <span>资料 model / 校验 validation / 存储 ledgerStore 分层实现</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m, index) => (
          <article className="metric-card" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={statusColors[index % statusColors.length]} />
          </article>
        ))}
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="workspace">
        <aside className="panel narrow">
          <h2>查找台账</h2>
          <div className="search-box">
            <label>
              <span>客户姓名</span>
              <input
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="如：刘淑芬"
              />
            </label>
            <label>
              <span>耳别</span>
              <select
                value={queryEar}
                onChange={(e) => setQueryEar(e.target.value as EarSide | "all")}
              >
                <option value="all">全部</option>
                <option value="left">左耳</option>
                <option value="right">右耳</option>
              </select>
            </label>
          </div>

          <h2>台账列表</h2>
          <div className="ledger-list">
            {results.length === 0 && (
              <p className="empty-hint">没有匹配的台账，可在下方发起初配。</p>
            )}
            {results.map((ledger) => {
              const last = latestRevision(ledger);
              return (
                <button
                  key={ledger.id}
                  className={
                    "ledger-item" + (ledger.id === selectedId ? " active" : "")
                  }
                  onClick={() => openLedger(ledger)}
                >
                  <strong>
                    {ledger.customerName} · {EAR_LABEL[ledger.ear]}
                  </strong>
                  <span>
                    {ledger.revisions.length} 份修订 · 最近 {formatTime(last.createdAt)}
                  </span>
                  {drafts[ledger.id] && <i className="badge-draft">待确认草稿</i>}
                </button>
              );
            })}
          </div>

          <button className="primary-action wide" onClick={startInitial}>
            ＋ 初配新单
          </button>
        </aside>

        <section className="panel">
          {mode === "idle" && (
            <div className="empty-state">
              <h2>从左侧选择一份台账</h2>
              <p>
                打开台账后可复调：表单自动带出上次确认的增益与反馈等级；也可以直接发起初配新单。
              </p>
            </div>
          )}

          {mode === "initial" && (
            <>
              <div className="section-heading">
                <div>
                  <p>初配建档</p>
                  <h2>新客户 / 新耳别</h2>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>客户姓名</span>
                  <input
                    value={initialName}
                    onChange={(e) => setInitialName(e.target.value)}
                    placeholder="客户姓名"
                  />
                </label>
                <label>
                  <span>耳别</span>
                  <select
                    value={initialEar}
                    onChange={(e) => setInitialEar(e.target.value as EarSide)}
                  >
                    <option value="left">左耳</option>
                    <option value="right">右耳</option>
                  </select>
                </label>
              </div>
              <FittingFields form={form} onChange={patchForm} />
              <ErrorList errors={errors} />
              <div className="action-row">
                <button className="primary-action" onClick={confirmInitial}>
                  确认初配（生成 R1）
                </button>
              </div>
            </>
          )}

          {mode === "readjust" && selected && (
            <>
              <div className="section-heading">
                <div>
                  <p>复调 · 当前最新 {formatRevisionNo(latestRevision(selected).revisionNo)}</p>
                  <h2>
                    {selected.customerName} · {EAR_LABEL[selected.ear]}
                    {drafts[selected.id] && <i className="badge-draft">待确认草稿</i>}
                  </h2>
                </div>
                <span className="readonly-note">已确认单据只读，不可覆盖</span>
              </div>
              <FittingFields
                form={form}
                onChange={patchForm}
                last={latestRevision(selected)}
              />
              <label className={"reason-field" + (reasonRequired ? " required" : "")}>
                <span>
                  调整原因
                  {reasonRequired
                    ? "（本次调整已超阈，必填）"
                    : `（变化超过 ${GAIN_REASON_THRESHOLD_DB}dB 或反馈升高时必填）`}
                </span>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => patchForm({ reason: e.target.value })}
                  placeholder="例如：顾客反映嘈杂环境听不清，2kHz 增益提高 8dB"
                />
              </label>
              {reasonRequired && (
                <div className="trigger-list">
                  <strong>本次调整触发原因必填：</strong>
                  <ul>
                    {liveTriggers.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ErrorList errors={errors} />
              <div className="action-row">
                <button onClick={saveDraftClick}>暂存草稿</button>
                <button className="primary-action" onClick={confirmReadjust}>
                  确认复调（生成 {formatRevisionNo(store.nextRevisionNo(selected))}）
                </button>
              </div>
            </>
          )}
        </section>
      </section>

      {selected && mode === "readjust" && (
        <section className="records panel">
          <div className="section-heading">
            <div>
              <p>编号修订 · 只读</p>
              <h2>
                {selected.customerName} · {EAR_LABEL[selected.ear]} 的修订历史
              </h2>
            </div>
            <span className="readonly-note">确认后不可覆盖，只能追加新修订</span>
          </div>
          <div className="record-list">
            {[...selected.revisions].reverse().map((rev) => (
              <article key={rev.revisionNo} className="record-card">
                <div className="record-index">{formatRevisionNo(rev.revisionNo)}</div>
                <div>
                  <h3>
                    {REVISION_KIND_LABEL[rev.kind]} · {formatTime(rev.createdAt)} ·{" "}
                    {rev.operator}
                  </h3>
                  <p>
                    增益 {GAIN_BANDS.map((b) => `${b.label} ${rev.gains[b.key]}dB`).join(" · ")}
                    {" ｜ 反馈 "}
                    {rev.feedbackLevel}·{FEEDBACK_LEVELS[rev.feedbackLevel]}
                    {" ｜ 机型 "}
                    {rev.aidModel}
                  </p>
                  <p>
                    听力：气导 {rev.hearing.airConductionDb}dB ／ 骨导{" "}
                    {rev.hearing.boneConductionDb}dB ／ 言语识别率{" "}
                    {rev.hearing.speechRecognitionPct}%
                  </p>
                  {rev.reason && <p className="reason-quote">原因:{rev.reason}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ------------------------------------------------------------
// 子组件
// ------------------------------------------------------------

function FittingFields({
  form,
  onChange,
  last,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  last?: FittingRevision;
}) {
  return (
    <>
      <h3 className="form-section">听力数据</h3>
      <div className="form-grid three">
        <NumField
          label="气导阈值 (dB)"
          value={form.air}
          onChange={(v) => onChange({ air: v })}
          hint={last ? `上次 ${last.hearing.airConductionDb} dB` : undefined}
        />
        <NumField
          label="骨导阈值 (dB)"
          value={form.bone}
          onChange={(v) => onChange({ bone: v })}
          hint={last ? `上次 ${last.hearing.boneConductionDb} dB` : undefined}
        />
        <NumField
          label="言语识别率 (%)"
          value={form.speech}
          onChange={(v) => onChange({ speech: v })}
          hint={last ? `上次 ${last.hearing.speechRecognitionPct}%` : undefined}
        />
      </div>

      <h3 className="form-section">助听器</h3>
      <div className="form-grid">
        <label>
          <span>助听器型号</span>
          <input
            value={form.aidModel}
            onChange={(e) => onChange({ aidModel: e.target.value })}
            placeholder="如：瑞声达 RIC-9"
          />
        </label>
        <label>
          <span>验配师</span>
          <input
            value={form.operator}
            onChange={(e) => onChange({ operator: e.target.value })}
            placeholder="本班验配师"
          />
        </label>
      </div>

      <h3 className="form-section">增益（复调时自动带出上次确认值）</h3>
      <div className="gain-grid">
        {GAIN_BANDS.map((band) => {
          const value = form[band.key];
          const delta =
            last && value.trim() !== "" && Number.isFinite(Number(value))
              ? Number(value) - last.gains[band.key]
              : null;
          const overThreshold =
            delta !== null && Math.abs(delta) > GAIN_REASON_THRESHOLD_DB;
          return (
            <label key={band.key}>
              <span>{band.label} 增益 (dB)</span>
              <input
                type="number"
                value={value}
                min={0}
                max={80}
                onChange={(e) => onChange({ [band.key]: e.target.value })}
              />
              {last && (
                <small className="field-hint">
                  上次 {last.gains[band.key]} dB
                  {delta !== null && delta !== 0 && (
                    <b className={overThreshold ? "delta over" : "delta"}>
                      {delta > 0 ? `+${delta}` : delta}
                    </b>
                  )}
                </small>
              )}
            </label>
          );
        })}
      </div>

      <h3 className="form-section">反馈（啸叫）等级</h3>
      <div className="form-grid">
        <label>
          <span>反馈等级</span>
          <select
            value={form.feedbackLevel}
            onChange={(e) => onChange({ feedbackLevel: e.target.value })}
          >
            {FEEDBACK_LEVELS.map((label, i) => (
              <option key={label} value={i}>
                {i} · {label}
              </option>
            ))}
          </select>
          {last && (
            <small className="field-hint">
              上次 {last.feedbackLevel}·{FEEDBACK_LEVELS[last.feedbackLevel]}
              {Number(form.feedbackLevel) > last.feedbackLevel && (
                <b className="delta over">升高</b>
              )}
            </small>
          )}
        </label>
        <p className="field-note">
          等级 0~{MAX_FEEDBACK_LEVEL}：{FEEDBACK_LEVELS.join("／")}。复调时等级升高需填写原因。
        </p>
      </div>
    </>
  );
}

function NumField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="error-list">
      <strong>请先处理以下问题：</strong>
      <ul>
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
