// 存储层：localStorage 持久化。台账与草稿使用独立键名，
// 读盘做结构校验，损坏或缺失时回退到示例数据 / 空集合。
import { FREQS } from "../domain/constants";
import { chainKey } from "../domain/model";
import { SEED_CHAINS } from "../domain/seed";
import type {
  AdjustmentDraft,
  FittingChain,
  InitialDraft,
  LedgerState,
} from "../domain/types";

const CHAINS_KEY = "fitting-ledger:chains:v1";
const ADJ_DRAFTS_KEY = "fitting-ledger:drafts:adjustment:v1";
const INIT_DRAFTS_KEY = "fitting-ledger:drafts:initial:v1";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function hasFreqNumbers(obj: unknown): boolean {
  if (!isRecord(obj)) return false;
  return FREQS.every((f) => typeof obj[f] === "number");
}

function hasFreqNullable(obj: unknown): boolean {
  if (!isRecord(obj)) return false;
  return FREQS.every((f) => obj[f] === null || typeof obj[f] === "number");
}

function isAudiogram(v: unknown): v is {
  ac: Record<string, number>;
  bc: Record<string, number | null>;
  speechScore: number;
} {
  if (!isRecord(v)) return false;
  return (
    hasFreqNumbers(v.ac) &&
    hasFreqNullable(v.bc) &&
    typeof v.speechScore === "number"
  );
}

function isAid(v: unknown): v is { brand: string; model: string; serial: string } {
  if (!isRecord(v)) return false;
  return (
    typeof v.brand === "string" &&
    typeof v.model === "string" &&
    typeof v.serial === "string"
  );
}

function isRevision(v: unknown): v is FittingChain["revisions"][number] {
  if (!isRecord(v)) return false;
  return (
    typeof v.revNo === "number" &&
    (v.kind === "initial" || v.kind === "adjustment") &&
    typeof v.createdAt === "string" &&
    typeof v.fitter === "string" &&
    hasFreqNumbers(v.gains) &&
    typeof v.feedbackLevel === "number" &&
    (v.reason === undefined || typeof v.reason === "string") &&
    (v.note === undefined || typeof v.note === "string")
  );
}

function isChain(v: unknown): v is FittingChain {
  if (!isRecord(v)) return false;
  return (
    typeof v.customerCode === "string" &&
    typeof v.customerName === "string" &&
    (v.ear === "L" || v.ear === "R") &&
    isAid(v.aid) &&
    isAudiogram(v.audiogram) &&
    Array.isArray(v.revisions) &&
    v.revisions.length >= 1 &&
    v.revisions.every(isRevision)
  );
}

interface DraftFormShape {
  gains: Record<string, string>;
  feedbackLevel: string;
  reason: string;
  fitter: string;
}

function isAdjustmentForm(v: unknown): v is DraftFormShape {
  return (
    isRecord(v) &&
    hasFreqStrings(v.gains) &&
    typeof v.feedbackLevel === "string" &&
    typeof v.reason === "string" &&
    typeof v.fitter === "string"
  );
}

function isAdjustmentDraft(v: unknown): v is AdjustmentDraft {
  return (
    isRecord(v) &&
    typeof v.key === "string" &&
    typeof v.customerCode === "string" &&
    (v.ear === "L" || v.ear === "R") &&
    typeof v.updatedAt === "string" &&
    isAdjustmentForm(v.form)
  );
}

interface InitialFormShape {
  customerCode: string;
  customerName: string;
  ear: "" | "L" | "R";
  ac: Record<string, string>;
  bc: Record<string, string>;
  gains: Record<string, string>;
}

function isInitialForm(v: unknown): v is InitialFormShape {
  return (
    isRecord(v) &&
    typeof v.customerCode === "string" &&
    typeof v.customerName === "string" &&
    (v.ear === "" || v.ear === "L" || v.ear === "R") &&
    hasFreqStrings(v.ac) &&
    hasFreqStrings(v.bc) &&
    hasFreqStrings(v.gains)
  );
}

function isInitialDraft(v: unknown): v is InitialDraft {
  return (
    isRecord(v) &&
    typeof v.draftId === "string" &&
    typeof v.updatedAt === "string" &&
    isInitialForm(v.form)
  );
}

function hasFreqStrings(obj: unknown): boolean {
  if (!isRecord(obj)) return false;
  return FREQS.every((f) => typeof obj[f] === "string");
}

function readJSON(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用（隐私模式/配额）时静默降级为仅内存态
  }
}

function seedChains(): Record<string, FittingChain> {
  const out: Record<string, FittingChain> = {};
  for (const c of SEED_CHAINS) {
    out[chainKey(c.customerCode, c.ear)] = c;
  }
  return out;
}

export function loadChains(): Record<string, FittingChain> {
  const data = readJSON(CHAINS_KEY);
  if (isRecord(data) && Object.values(data).every(isChain)) {
    return data as Record<string, FittingChain>;
  }
  const seeded = seedChains();
  writeJSON(CHAINS_KEY, seeded);
  return seeded;
}

export function saveChains(chains: Record<string, FittingChain>): void {
  writeJSON(CHAINS_KEY, chains);
}

export function loadAdjustmentDrafts(): Record<string, AdjustmentDraft> {
  const data = readJSON(ADJ_DRAFTS_KEY);
  if (isRecord(data) && Object.values(data).every(isAdjustmentDraft)) {
    return data as Record<string, AdjustmentDraft>;
  }
  return {};
}

export function saveAdjustmentDrafts(drafts: Record<string, AdjustmentDraft>): void {
  writeJSON(ADJ_DRAFTS_KEY, drafts);
}

export function loadInitialDrafts(): Record<string, InitialDraft> {
  const data = readJSON(INIT_DRAFTS_KEY);
  if (isRecord(data) && Object.values(data).every(isInitialDraft)) {
    return data as Record<string, InitialDraft>;
  }
  return {};
}

export function saveInitialDrafts(drafts: Record<string, InitialDraft>): void {
  writeJSON(INIT_DRAFTS_KEY, drafts);
}

export function loadLedgerState(): LedgerState {
  return {
    version: 1,
    chains: loadChains(),
    adjustmentDrafts: loadAdjustmentDrafts(),
    initialDrafts: loadInitialDrafts(),
  };
}

export function resetChainsToSeed(): Record<string, FittingChain> {
  const seeded = seedChains();
  saveChains(seeded);
  return seeded;
}
