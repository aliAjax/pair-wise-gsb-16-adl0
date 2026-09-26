import { useState } from "react";
import "./styles.css";
import { AdjustmentEditor } from "./components/AdjustmentEditor";
import { ChainDetail } from "./components/ChainDetail";
import { Dashboard } from "./components/Dashboard";
import { InitialFormEditor } from "./components/InitialFormEditor";
import { LedgerSidebar } from "./components/LedgerSidebar";
import { chainKey, getLatestRevision } from "./domain/model";
import type { AdjustmentForm, InitialForm as InitialFormType } from "./domain/types";
import { useLedger } from "./state/useLedger";
import { evaluateAdjustment, validateInitial } from "./validation/validate";

type View =
  | { mode: "chain"; key: string }
  | { mode: "adjustment"; key: string }
  | { mode: "initial"; draftId: string };

function App() {
  const ledger = useLedger();
  const [view, setView] = useState<View | null>(() => {
    const first = ledger.chainList[0];
    return first
      ? { mode: "chain", key: chainKey(first.customerCode, first.ear) }
      : null;
  });
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const selectedKey = view && "key" in view ? view.key : null;

  const activeChain = selectedKey ? ledger.getChain(selectedKey) : undefined;
  const activeDraft = selectedKey
    ? ledger.getAdjustmentDraft(selectedKey)
    : undefined;
  const activeInitialDraft =
    view?.mode === "initial"
      ? ledger.initialDraftList.find((d) => d.draftId === view.draftId)
      : undefined;

  const handleNewInitial = () => {
    const draft = ledger.startInitial();
    setView({ mode: "initial", draftId: draft.draftId });
  };

  const handleConfirmInitial = (form: InitialFormType) => {
    if (view?.mode !== "initial") return;
    const draftId = view.draftId;
    const result = validateInitial(form);
    if (!result.parsed) return;
    const saved = ledger.confirmInitial(draftId, result.parsed);
    if (!saved.ok) {
      flash(saved.error ?? "初配确认失败");
      return;
    }
    const key = chainKey(result.parsed.customerCode, result.parsed.ear);
    setView({ mode: "chain", key });
    flash("初配已确认，台账建立为第 1 版");
  };

  const handleStartAdjustment = (key: string) => {
    ledger.openAdjustmentDraft(key);
    setView({ mode: "adjustment", key });
  };

  const handleConfirmAdjustment = (key: string, form: AdjustmentForm) => {
    const chain = ledger.getChain(key);
    if (!chain) return;
    const result = evaluateAdjustment(form, getLatestRevision(chain));
    if (!result.parsed) return;
    const saved = ledger.confirmAdjustment(key, result.parsed);
    if (!saved.ok) {
      flash(saved.error ?? "复调确认失败");
      return;
    }
    setView({ mode: "chain", key });
    flash(`复调已确认，旧单保留，已追加为第 ${getLatestRevision(chain).revNo + 1} 版`);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-01 · 验配台账</p>
          <h1>听力验配修订台账</h1>
          <p className="subtitle">
            初配录客户、耳别、听力数据与助听器；复调自动带出上次增益，增益变化超
            6dB 或反馈等级升高必须写明原因。确认后旧单不可覆盖，只接成编号修订。
          </p>
        </div>
        <div className="stack-card">
          <span>架构分层</span>
          <strong>
            资料（domain） · 校验（validation） · 存储（storage）
          </strong>
          <span>草稿分键存储：复调按客户+耳别唯一，初配按新单独立</span>
          <button
            className="reset-btn"
            onClick={() => {
              if (window.confirm("恢复为示例台账？当前草稿与确认记录将被清空。")) {
                ledger.resetToSeed();
                const first = ledger.chainList[0];
                setView(
                  first
                    ? { mode: "chain", key: chainKey(first.customerCode, first.ear) }
                    : null
                );
                flash("已恢复示例台账");
              }
            }}
          >
            恢复示例数据
          </button>
        </div>
      </section>

      <Dashboard
        chains={ledger.chainList}
        pendingAdjustments={ledger.adjustmentDraftList}
      />

      <section className="workspace">
        <LedgerSidebar
          chains={ledger.chainList}
          adjustmentDrafts={ledger.adjustmentDraftList}
          initialDrafts={ledger.initialDraftList}
          selectedKey={selectedKey}
          onSelectChain={(key) => setView({ mode: "chain", key })}
          onNewInitial={handleNewInitial}
          onOpenInitialDraft={(draftId) => setView({ mode: "initial", draftId })}
        />

        <div className="main-pane">
          {view?.mode === "initial" && activeInitialDraft ? (
            <InitialFormEditor
              draft={activeInitialDraft}
              onSaveDraft={(form) => ledger.saveInitialDraft(activeInitialDraft.draftId, form)}
              onConfirm={handleConfirmInitial}
              onDiscard={() => {
                if (window.confirm("放弃这份初配草稿？已填内容将删除。")) {
                  ledger.discardInitialDraft(activeInitialDraft.draftId);
                  setView(null);
                }
              }}
              onBack={() => {
                const first = ledger.chainList[0];
                setView(first ? { mode: "chain", key: chainKey(first.customerCode, first.ear) } : null);
              }}
              codeTaken={(code, ear) => Boolean(ledger.getChain(chainKey(code, ear)))}
            />
          ) : view?.mode === "adjustment" && activeChain ? (
            <AdjustmentEditor
              chain={activeChain}
              draft={activeDraft!}
              onSaveDraft={(form) =>
                ledger.saveAdjustmentDraft(
                  chainKey(activeChain.customerCode, activeChain.ear),
                  form
                )
              }
              onConfirm={(form) =>
                handleConfirmAdjustment(
                  chainKey(activeChain.customerCode, activeChain.ear),
                  form
                )
              }
              onDiscard={() => {
                const key = chainKey(activeChain.customerCode, activeChain.ear);
                if (window.confirm("放弃该耳待确认的复调草稿？")) {
                  ledger.discardAdjustmentDraft(key);
                  setView({ mode: "chain", key });
                }
              }}
            />
          ) : activeChain ? (
            <>
              <ChainDetail
                chain={activeChain}
                draft={activeDraft}
                onStartAdjustment={() =>
                  handleStartAdjustment(chainKey(activeChain.customerCode, activeChain.ear))
                }
                onResumeAdjustment={() =>
                  setView({
                    mode: "adjustment",
                    key: chainKey(activeChain.customerCode, activeChain.ear),
                  })
                }
                onCancelAdjustment={() => {
                  const key = chainKey(activeChain.customerCode, activeChain.ear);
                  if (window.confirm("放弃该耳待确认的复调草稿？")) {
                    ledger.discardAdjustmentDraft(key);
                  }
                }}
              />
            </>
          ) : (
            <section className="panel empty-state">
              <h2>还没有台账</h2>
              <p>从左侧「初配录单」开始建立客户档案。</p>
              <button className="primary-action" onClick={handleNewInitial}>
                新建初配
              </button>
            </section>
          )}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
