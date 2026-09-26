import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adjustmentFormFromRevision,
  chainKey,
  emptyInitialForm,
  getLatestRevision,
  makeId,
  nowIso,
} from "../domain/model";
import type {
  AdjustmentDraft,
  AdjustmentForm,
  FittingChain,
  InitialDraft,
  InitialForm,
  LedgerState,
} from "../domain/types";
import {
  loadLedgerState,
  resetChainsToSeed,
  saveAdjustmentDrafts,
  saveChains,
  saveInitialDrafts,
} from "../storage/storage";
import type { ParsedAdjustment, ParsedInitial } from "../validation/validate";

export function useLedger() {
  const [state, setState] = useState<LedgerState>(() => loadLedgerState());

  // 分键持久化：台账、复调草稿、初配草稿互不覆盖
  useEffect(() => {
    saveChains(state.chains);
  }, [state.chains]);
  useEffect(() => {
    saveAdjustmentDrafts(state.adjustmentDrafts);
  }, [state.adjustmentDrafts]);
  useEffect(() => {
    saveInitialDrafts(state.initialDrafts);
  }, [state.initialDrafts]);

  const chainList = useMemo(() => Object.values(state.chains), [state.chains]);

  const adjustmentDraftList = useMemo(
    () =>
      Object.values(state.adjustmentDrafts).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      ),
    [state.adjustmentDrafts]
  );

  const getChain = useCallback(
    (key: string): FittingChain | undefined => state.chains[key],
    [state.chains]
  );

  const getAdjustmentDraft = useCallback(
    (key: string): AdjustmentDraft | undefined => state.adjustmentDrafts[key],
    [state.adjustmentDrafts]
  );

  // ---- 初配草稿：每份新单独立 draftId，换单不串台 ----
  // ---- 初配草稿：每份新单独立 draftId，换单不串台 ----
  const startInitial = useCallback((draftId?: string): InitialDraft => {
    let draft: InitialDraft | undefined;
    setState((prev) => {
      if (draftId && prev.initialDrafts[draftId]) {
        draft = prev.initialDrafts[draftId];
        return prev;
      }
      draft = { draftId: draftId ?? makeId("init"), updatedAt: nowIso(), form: emptyInitialForm() };
      return {
        ...prev,
        initialDrafts: { ...prev.initialDrafts, [draft.draftId]: draft },
      };
    });
    return draft!;
  }, []);

  const saveInitialDraft = useCallback((draftId: string, form: InitialForm) => {
    setState((prev) => {
      // 内容未变则不更新，避免编辑器自动保存形成 updatedAt 回环
      if (
        prev.initialDrafts[draftId] &&
        JSON.stringify(prev.initialDrafts[draftId].form) === JSON.stringify(form)
      ) {
        return prev;
      }
      return {
        ...prev,
        initialDrafts: {
          ...prev.initialDrafts,
          [draftId]: { draftId, updatedAt: nowIso(), form },
        },
      };
    });
  }, []);

  /** 确认初配：建档 revNo=1；同客户同耳已存在台账则拒绝 */
  const confirmInitial = useCallback(
    (draftId: string, parsed: ParsedInitial): { ok: boolean; error?: string } => {
      const key = chainKey(parsed.customerCode, parsed.ear);
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        if (prev.chains[key]) {
          result = { ok: false, error: "该客户耳别已存在台账，请在原台账上发起复调" };
          return prev;
        }
        const newChain: FittingChain = {
          customerCode: parsed.customerCode,
          customerName: parsed.customerName,
          ear: parsed.ear,
          aid: parsed.aid,
          audiogram: parsed.audiogram,
          createdAt: nowIso(),
          revisions: [
            {
              revNo: 1,
              kind: "initial",
              createdAt: nowIso(),
              fitter: parsed.fitter,
              gains: parsed.gains,
              feedbackLevel: parsed.feedbackLevel,
              note: parsed.note || undefined,
            },
          ],
        };
        const { [draftId]: _removed, ...restInitial } = prev.initialDrafts;
        result = { ok: true };
        return {
          ...prev,
          chains: { ...prev.chains, [key]: newChain },
          initialDrafts: restInitial,
        };
      });
      return result;
    },
    []
  );

  const discardInitialDraft = useCallback((draftId: string) => {
    setState((prev) => {
      const { [draftId]: _removed, ...rest } = prev.initialDrafts;
      return { ...prev, initialDrafts: rest };
    });
  }, []);

  // ---- 复调草稿：同一客户同耳待确认的只留一份（按 chainKey 覆盖式保存） ----
  const openAdjustmentDraft = useCallback(
    (key: string): AdjustmentDraft => {
      const existing = state.adjustmentDrafts[key];
      if (existing) return existing;
      const chain = state.chains[key];
      if (!chain) throw new Error("台账不存在，无法发起复调");
      const draft: AdjustmentDraft = {
        key,
        customerCode: chain.customerCode,
        ear: chain.ear,
        updatedAt: nowIso(),
        form: adjustmentFormFromRevision(getLatestRevision(chain)),
      };
      setState((prev) => ({
        ...prev,
        adjustmentDrafts: { ...prev.adjustmentDrafts, [key]: draft },
      }));
      return draft;
    },
    [state.adjustmentDrafts, state.chains]
  );

  const saveAdjustmentDraft = useCallback((key: string, form: AdjustmentForm) => {
    setState((prev) => {
      const chain = prev.chains[key];
      if (!chain) return prev;
      const existing = prev.adjustmentDrafts[key];
      // 内容未变则不更新，避免自动保存形成 updatedAt 回环
      if (existing && JSON.stringify(existing.form) === JSON.stringify(form)) {
        return prev;
      }
      const next: AdjustmentDraft = {
        key,
        customerCode: chain.customerCode,
        ear: chain.ear,
        updatedAt: nowIso(),
        form,
      };
      return {
        ...prev,
        adjustmentDrafts: { ...prev.adjustmentDrafts, [key]: next },
      };
    });
  }, []);

  /**
   * 确认复调：旧单不覆盖，只在 revisions 尾部接成下一编号修订；
   * 随后删除该耳待确认草稿。
   */
  const confirmAdjustment = useCallback(
    (key: string, parsed: ParsedAdjustment): { ok: boolean; error?: string } => {
      let result: { ok: boolean; error?: string } = { ok: true };
      setState((prev) => {
        const chain = prev.chains[key];
        if (!chain) {
          result = { ok: false, error: "台账不存在" };
          return prev;
        }
        const latest = getLatestRevision(chain);
        const revision = {
          revNo: latest.revNo + 1,
          kind: "adjustment" as const,
          createdAt: nowIso(),
          fitter: parsed.fitter,
          gains: parsed.gains,
          feedbackLevel: parsed.feedbackLevel,
          reason: parsed.reason || undefined,
        };
        const { [key]: _removed, ...restDrafts } = prev.adjustmentDrafts;
        result = { ok: true };
        return {
          ...prev,
          chains: {
            ...prev.chains,
            [key]: { ...chain, revisions: [...chain.revisions, revision] },
          },
          adjustmentDrafts: restDrafts,
        };
      });
      return result;
    },
    []
  );

  const discardAdjustmentDraft = useCallback((key: string) => {
    setState((prev) => {
      const { [key]: _removed, ...rest } = prev.adjustmentDrafts;
      return { ...prev, adjustmentDrafts: rest };
    });
  }, []);

  const resetToSeed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      chains: resetChainsToSeed(),
      adjustmentDrafts: {},
      initialDrafts: {},
    }));
  }, []);

  const initialDraftList = useMemo(
    () =>
      Object.values(state.initialDrafts).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      ),
    [state.initialDrafts]
  );

  return {
    chainList,
    adjustmentDraftList,
    getChain,
    getAdjustmentDraft,
    initialDraftList,
    startInitial,
    saveInitialDraft,
    confirmInitial,
    discardInitialDraft,
    openAdjustmentDraft,
    saveAdjustmentDraft,
    confirmAdjustment,
    discardAdjustmentDraft,
    resetToSeed,
  };
}
