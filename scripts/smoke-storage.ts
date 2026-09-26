// 存储层冒烟测试：localStorage shim 下验证分键读写、结构损坏回退
/* eslint-disable @typescript-eslint/no-explicit-any */
const mem: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
  },
};

import {
  loadAdjustmentDrafts,
  loadChains,
  loadInitialDrafts,
  resetChainsToSeed,
  saveAdjustmentDrafts,
  saveInitialDrafts,
} from "../src/storage/storage";
import { chainKey } from "../src/domain/model";
import { SEED_CHAINS } from "../src/domain/seed";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

console.log("存储：首次加载回退到示例台账");
{
  const chains = loadChains();
  check("载入 3 条示例链", Object.keys(chains).length === SEED_CHAINS.length);
  check(
    "示例链按 客户::耳别 建键",
    Boolean(chains[chainKey("Liu-024", "L")] && chains[chainKey("Chen-118", "R")])
  );
  check("草稿首次为空", Object.keys(loadAdjustmentDrafts()).length === 0);
  check("初配草稿首次为空", Object.keys(loadInitialDrafts()).length === 0);
}

console.log("存储：草稿分键保存后回读");
{
  const key = chainKey("Liu-024", "L");
  saveAdjustmentDrafts({
    [key]: {
      key,
      customerCode: "Liu-024",
      ear: "L",
      updatedAt: "2026-09-26T01:00:00.000Z",
      form: {
        gains: { "250": "30", "500": "34", "1000": "40", "2000": "56", "4000": "64", "8000": "62" },
        feedbackLevel: "1",
        reason: "",
        fitter: "王",
      },
    },
  });
  const loaded = loadAdjustmentDrafts();
  check("复调草稿回读 1 份", Object.keys(loaded).length === 1);
  check("草稿键即客户+耳别", Boolean(loaded[key]));

  saveInitialDrafts({
    "init-abc": {
      draftId: "init-abc",
      updatedAt: "2026-09-26T02:00:00.000Z",
      form: {
        customerCode: "",
        customerName: "",
        ear: "",
        aidBrand: "",
        aidModel: "",
        aidSerial: "",
        ac: { "250": "", "500": "", "1000": "", "2000": "", "4000": "", "8000": "" },
        bc: { "250": "", "500": "", "1000": "", "2000": "", "4000": "", "8000": "" },
        speechScore: "",
        gains: { "250": "", "500": "", "1000": "", "2000": "", "4000": "", "8000": "" },
        feedbackLevel: "1",
        fitter: "",
        note: "",
      },
    },
  });
  check("初配草稿回读 1 份", Object.keys(loadInitialDrafts()).length === 1);
  check("复调草稿不受初配草稿影响", Object.keys(loadAdjustmentDrafts()).length === 1);
}

console.log("存储：结构损坏时安全回退");
{
  mem["fitting-ledger:chains:v1"] = "{ not json";
  const chains = loadChains();
  check("台账损坏 → 回退示例", Object.keys(chains).length === SEED_CHAINS.length);

  mem["fitting-ledger:drafts:adjustment:v1"] = JSON.stringify({ evil: { key: 1 } });
  check("复调草稿损坏 → 空集合", Object.keys(loadAdjustmentDrafts()).length === 0);

  mem["fitting-ledger:drafts:initial:v1"] = "garbage";
  check("初配草稿损坏 → 空集合", Object.keys(loadInitialDrafts()).length === 0);
}

console.log("存储：恢复示例数据");
{
  const chains = resetChainsToSeed();
  check("reset 后仍为 3 条", Object.keys(chains).length === SEED_CHAINS.length);
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
