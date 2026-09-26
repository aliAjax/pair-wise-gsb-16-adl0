// ============================================================
// 存储层：台账与草稿的持久化（localStorage）
// - 台账整体一个 key，已确认修订只追加、不覆盖
// - 复调草稿按 ledgerId 一个 key：同一客户同耳只留一份，换单不串台
// ============================================================

import {
  EarSide,
  FittingLedger,
  FittingRevision,
  ReadjustDraft,
} from "../domain/types";

const LEDGER_KEY = "hxwl01.ledgers.v1";
const DRAFT_PREFIX = "hxwl01.draft.v1.";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用（隐私模式等）时静默降级，页面仍可用内存态
  }
}

// ---------- 台账 ----------

export function loadLedgers(): FittingLedger[] {
  return read<FittingLedger[]>(LEDGER_KEY) ?? [];
}

export function persistLedgers(ledgers: FittingLedger[]): void {
  write(LEDGER_KEY, ledgers);
}

export function findLedger(
  ledgers: FittingLedger[],
  customerName: string,
  ear: EarSide
): FittingLedger | undefined {
  const name = customerName.trim();
  return ledgers.find((l) => l.customerName === name && l.ear === ear);
}

/** 按客户姓名（模糊）+ 耳别查找，重开页面后即用 */
export function searchLedgers(
  ledgers: FittingLedger[],
  customerName: string,
  ear: EarSide | "all"
): FittingLedger[] {
  const name = customerName.trim();
  return ledgers.filter(
    (l) =>
      (ear === "all" || l.ear === ear) &&
      (name === "" || l.customerName.includes(name))
  );
}

export function createLedger(
  customerName: string,
  ear: EarSide,
  first: FittingRevision
): FittingLedger {
  return {
    id: `ldg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    customerName: customerName.trim(),
    ear,
    createdAt: first.createdAt,
    revisions: [first],
  };
}

/**
 * 追加一份编号修订。
 * 旧单不可覆盖：返回新台账对象，原 revisions 数组与历史单据保持不动。
 */
export function appendRevision(
  ledger: FittingLedger,
  revision: FittingRevision
): FittingLedger {
  return { ...ledger, revisions: [...ledger.revisions, revision] };
}

export function nextRevisionNo(ledger: FittingLedger): number {
  return ledger.revisions.length + 1;
}

// ---------- 复调草稿（每台账一份，互不串台） ----------

export function loadDraft(ledgerId: string): ReadjustDraft | null {
  return read<ReadjustDraft>(DRAFT_PREFIX + ledgerId);
}

/** 暂存草稿：同一台账重复暂存会覆盖同一份，保证「待确认只留一份」 */
export function saveDraft(draft: ReadjustDraft): void {
  write(DRAFT_PREFIX + draft.ledgerId, draft);
}

export function clearDraft(ledgerId: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + ledgerId);
  } catch {
    // 同上，静默降级
  }
}

export function loadAllDrafts(ledgers: FittingLedger[]): Record<string, ReadjustDraft> {
  const map: Record<string, ReadjustDraft> = {};
  for (const ledger of ledgers) {
    const draft = loadDraft(ledger.id);
    if (draft) map[ledger.id] = draft;
  }
  return map;
}

// ---------- 首次打开的示例台账 ----------

export function ensureSeeded(): FittingLedger[] {
  const existing = loadLedgers();
  if (existing.length > 0) return existing;
  const seeded = buildSeedLedgers();
  persistLedgers(seeded);
  return seeded;
}

function buildSeedLedgers(): FittingLedger[] {
  const liuR1: FittingRevision = {
    revisionNo: 1,
    kind: "initial",
    hearing: { airConductionDb: 55, boneConductionDb: 40, speechRecognitionPct: 76 },
    aidModel: "瑞声达 RIC-9",
    gains: { hz500: 18, hz1000: 22, hz2000: 28, hz4000: 32 },
    feedbackLevel: 1,
    reason: "",
    operator: "王验配师",
    createdAt: "2026-08-20T09:30:00.000Z",
  };
  const liuR2: FittingRevision = {
    revisionNo: 2,
    kind: "readjust",
    hearing: { airConductionDb: 55, boneConductionDb: 40, speechRecognitionPct: 78 },
    aidModel: "瑞声达 RIC-9",
    gains: { hz500: 18, hz1000: 24, hz2000: 30, hz4000: 34 },
    feedbackLevel: 1,
    reason: "",
    operator: "王验配师",
    createdAt: "2026-09-10T02:10:00.000Z",
  };
  const chenR1: FittingRevision = {
    revisionNo: 1,
    kind: "initial",
    hearing: { airConductionDb: 60, boneConductionDb: 45, speechRecognitionPct: 64 },
    aidModel: "峰力 BTE-5",
    gains: { hz500: 20, hz1000: 26, hz2000: 30, hz4000: 36 },
    feedbackLevel: 0,
    reason: "",
    operator: "李验配师",
    createdAt: "2026-09-05T06:00:00.000Z",
  };
  const zhaoR1: FittingRevision = {
    revisionNo: 1,
    kind: "initial",
    hearing: { airConductionDb: 50, boneConductionDb: 38, speechRecognitionPct: 70 },
    aidModel: "奥迪康 mini-3",
    gains: { hz500: 16, hz1000: 20, hz2000: 24, hz4000: 28 },
    feedbackLevel: 0,
    reason: "",
    operator: "王验配师",
    createdAt: "2026-08-28T03:20:00.000Z",
  };
  const zhaoR2: FittingRevision = {
    revisionNo: 2,
    kind: "readjust",
    hearing: { airConductionDb: 50, boneConductionDb: 38, speechRecognitionPct: 74 },
    aidModel: "奥迪康 mini-3",
    gains: { hz500: 16, hz1000: 20, hz2000: 32, hz4000: 30 },
    feedbackLevel: 1,
    reason: "顾客反映对话清晰度不足，2kHz 增益提高 8dB，并确认轻微啸叫可接受",
    operator: "王验配师",
    createdAt: "2026-09-18T07:45:00.000Z",
  };
  return [
    {
      id: "ldg-seed-liu-l",
      customerName: "刘淑芬",
      ear: "left",
      createdAt: liuR1.createdAt,
      revisions: [liuR1, liuR2],
    },
    {
      id: "ldg-seed-chen-r",
      customerName: "陈建军",
      ear: "right",
      createdAt: chenR1.createdAt,
      revisions: [chenR1],
    },
    {
      id: "ldg-seed-zhao-l",
      customerName: "赵桂兰",
      ear: "left",
      createdAt: zhaoR1.createdAt,
      revisions: [zhaoR1, zhaoR2],
    },
  ];
}
