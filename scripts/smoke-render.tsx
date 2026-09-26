// SSR 渲染冒烟：验证 App 组件树可无错误渲染，关键业务文案齐备
const storage: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (k in storage ? storage[k] : null),
    setItem: (k: string, v: string) => {
      storage[k] = v;
    },
    removeItem: (k: string) => delete storage[k],
  },
};

import React from "react";
import { renderToString } from "react-dom/server";
import "./css-stub";
import App from "../src/App";

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

const html = renderToString(React.createElement(App));

const expectTexts = [
  "听力验配修订台账",
  "初配录客户",
  "超 6dB",
  "反馈等级升高",
  "旧单不可覆盖",
  "验配台账",
  "刘建国",
  "陈雨桐",
  "赵桂芳",
  "发起复调",
  "按客户编号",
  "恢复示例数据",
  "听力数据",
  "验配修订链",
];

for (const t of expectTexts) {
  check(`首屏包含「${t}」`, html.includes(t));
}
check("渲染体量正常（>4KB）", html.length > 4_000);

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
