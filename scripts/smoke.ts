// 纯逻辑冒烟测试：校验规则、修订追加、草稿键隔离
// 运行：npx tsc scripts/smoke.ts --outDir /tmp/smoke --target ES2020 --module commonjs --moduleResolution node --esModuleInterop && node /tmp/smoke/smoke.js
import { evaluateAdjustment, validateInitial } from "../src/validation/validate";
import {
  adjustmentFormFromRevision,
  chainKey,
  emptyInitialForm,
} from "../src/domain/model";
import type { FittingRevision } from "../src/domain/types";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeRevision(overrides: Partial<FittingRevision> = {}): FittingRevision {
  return {
    revNo: 1,
    kind: "initial",
    createdAt: "2026-09-01T00:00:00.000Z",
    fitter: "王听力师",
    gains: { "250": 30, "500": 30, "1000": 40, "2000": 50, "4000": 60, "8000": 60 },
    feedbackLevel: 2,
    ...overrides,
  };
}

const base = makeRevision();

console.log("复调规则：增益差阈值（超过 6dB，不含恰好 6dB）");
{
  const form = adjustmentFormFromRevision(base);
  form.gains["1000"] = "46";
  form.fitter = "李";
  const r = evaluateAdjustment(form, base);
  check("+6dB 不触发原因必填", !r.requiresReason && !r.errors.reason);
  check("+6dB 校验通过", Boolean(r.parsed));

  const form2 = adjustmentFormFromRevision(base);
  form2.gains["4000"] = "67";
  form2.fitter = "李";
  const r2 = evaluateAdjustment(form2, base);
  check("+7dB 触发 requiresReason", r2.requiresReason);
  check("+7dB 未写原因时阻断确认", Boolean(r2.errors.reason));
  form2.reason = "患者反映高频听不清，微调高频增益";
  const r3 = evaluateAdjustment(form2, base);
  check("+7dB 写明原因后通过", Boolean(r3.parsed));
  check("标出的超限频率为 4000", r3.exceededFreqs.join(",") === "4000");

  const form4 = adjustmentFormFromRevision(base);
  form4.gains["250"] = "23";
  form4.fitter = "李";
  const r4 = evaluateAdjustment(form4, base);
  check("|-7dB| 同样触发", r4.requiresReason);

  const form5 = adjustmentFormFromRevision(base);
  form5.gains["500"] = "abc";
  form5.fitter = "李";
  const r5 = evaluateAdjustment(form5, base);
  check("非数字增益报错", Boolean(r5.errors["gains.500"]));

  const form6 = adjustmentFormFromRevision(base);
  form6.gains["500"] = "999";
  form6.fitter = "李";
  const r6 = evaluateAdjustment(form6, base);
  check("超范围增益报错", Boolean(r6.errors["gains.500"]));
}

console.log("复调规则：反馈等级升高必须写原因");
{
  const form = adjustmentFormFromRevision(base);
  form.feedbackLevel = "3";
  form.fitter = "李";
  const r = evaluateAdjustment(form, base);
  check("反馈 2→3 升高触发", r.feedbackEscalated && r.requiresReason);
  check("反馈升高未写原因阻断", Boolean(r.errors.reason));
  form.reason = "外壳松动导致反馈，已更换耳塞并观察";
  const r2 = evaluateAdjustment(form, base);
  check("写明原因后通过", Boolean(r2.parsed));

  const down = adjustmentFormFromRevision(base);
  down.feedbackLevel = "1";
  down.fitter = "李";
  const r3 = evaluateAdjustment(down, base);
  check("反馈下降不要求原因", !r3.requiresReason && Boolean(r3.parsed));

  const same = adjustmentFormFromRevision(base);
  same.fitter = "李";
  const r4 = evaluateAdjustment(same, base);
  check("反馈持平不要求原因", !r4.requiresReason && Boolean(r4.parsed));
}

console.log("初配校验");
{
  const f = emptyInitialForm();
  const empty = validateInitial(f);
  check("空表单不通过", !empty.parsed && Object.keys(empty.errors).length >= 6);

  const ok: typeof f = {
    ...f,
    customerCode: "Test-001",
    customerName: "测试人",
    ear: "L",
    aidBrand: "峰力",
    aidModel: "Audeo",
    aidSerial: "SN-1",
    ac: { "250": "30", "500": "35", "1000": "40", "2000": "50", "4000": "60", "8000": "65" },
    bc: { "250": "", "500": "30", "1000": "35", "2000": "", "4000": "", "8000": "" },
    speechScore: "88",
    gains: { "250": "26", "500": "30", "1000": "36", "2000": "44", "4000": "52", "8000": "56" },
    feedbackLevel: "1",
    fitter: "王听力师",
    note: "初配顺利",
  };
  const r = validateInitial(ok);
  check("完整初配通过", Boolean(r.parsed));
  check("骨导空值存为 null", r.parsed?.audiogram.bc["250"] === null);
  check("骨导有值为 number", r.parsed?.audiogram.bc["1000"] === 35);

  const badSpeech = { ...ok, speechScore: "120" };
  check("言语识别率超范围报错", Boolean(validateInitial(badSpeech).errors.speechScore));

  const noEar = { ...ok, ear: "" as const };
  check("耳别缺失报错", Boolean(validateInitial(noEar).errors.ear));
}

console.log("链键：同客户不同耳是两条台账");
{
  check("Liu-024::L ≠ Liu-024::R", chainKey("Liu-024", "L") !== chainKey("Liu-024", "R"));
  check("编号去空格后一致", chainKey("  Liu-024 ", "L") === chainKey("Liu-024", "L"));
}

console.log("修订追加规则（旧单不覆盖，编号接续）");
{
  // 模拟 useLedger.confirmAdjustment 的纯数据逻辑
  const chain: import("../src/domain/types").FittingChain = {
    customerCode: "Liu-024",
    customerName: "刘建国",
    ear: "L",
    aid: { brand: "b", model: "m", serial: "s" },
    audiogram: {
      ac: base.gains,
      bc: { "250": null, "500": null, "1000": null, "2000": null, "4000": null, "8000": null },
      speechScore: 70,
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    revisions: [makeRevision()],
  };
  const form = adjustmentFormFromRevision(base);
  form.gains["2000"] = "58"; // +8dB：超过 6dB，必须写原因
  form.fitter = "李听力师";
  form.reason = "清晰度诉求，2kHz 提升 8dB";
  const ev = evaluateAdjustment(form, chain.revisions[chain.revisions.length - 1]);
  check("+8dB 且已写原因，校验通过", Boolean(ev.parsed));
  if (!ev.parsed) throw new Error(JSON.stringify(ev.errors));
  const before = chain.revisions.length;
  const oldSnapshot = JSON.stringify(chain.revisions[0]);
  chain.revisions = [
    ...chain.revisions,
    {
      revNo: chain.revisions[chain.revisions.length - 1].revNo + 1,
      kind: "adjustment" as const,
      createdAt: "2026-09-20T00:00:00.000Z",
      fitter: ev.parsed.fitter,
      gains: ev.parsed.gains,
      feedbackLevel: ev.parsed.feedbackLevel,
      reason: ev.parsed.reason || undefined,
    },
  ];
  check("修订数量 +1", chain.revisions.length === before + 1);
  check("新单编号接续为 2", chain.revisions[chain.revisions.length - 1].revNo === 2);
  check("旧单仍为 revNo 1", chain.revisions[0].revNo === 1);
  check("旧单增益快照未被改动", JSON.stringify(chain.revisions[0]) === oldSnapshot);
  check("旧单 2000Hz 仍是 50", chain.revisions[0].gains["2000"] === 50);
  check("新单 2000Hz 为 58", chain.revisions[1].gains["2000"] === 58);
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
