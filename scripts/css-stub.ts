// Node 环境下忽略 CSS 导入（仅测试用）：解析时把 .css 指向一个真实的空文件
import { writeFileSync } from "fs";
import { join } from "path";

const emptyFile = join(__dirname, "__empty.css");
writeFileSync(emptyFile, "");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeModule = require("module");
const origResolve = nodeModule._resolveFilename;
nodeModule._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request.endsWith(".css")) return emptyFile;
  return origResolve.call(this, request, ...rest);
};
export {};
