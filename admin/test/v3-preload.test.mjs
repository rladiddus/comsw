// V3 index.html의 미리 받기(modulepreload) 목록 = 시작(main.mjs)과 첫 화면(대시보드)이 실제로 import하는 파일 전부.
// import를 바꾸고 목록을 안 고치면 실패한다(빠진 파일은 다시 단계마다 기다리고, 남은 파일은 괜히 받음).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const v3 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../admin-v3");

function graph(entries) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of fs.readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/gm)) {
      if (/^https?:/.test(m[1])) seen.add(m[1]); else walk(path.resolve(path.dirname(file), m[1]));
    }
  };
  entries.forEach((e) => walk(path.join(v3, e)));
  return seen;
}

test("V3 미리 받기 목록이 시작·대시보드 import와 같다", () => {
  const html = fs.readFileSync(path.join(v3, "index.html"), "utf8");
  const listed = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)]
    .map(([, h]) => (/^https?:/.test(h) ? h : path.resolve(v3, h))));
  const need = graph(["js/main.mjs", "js/pages/dashboard.mjs"]);
  assert.deepEqual([...need].filter((x) => !listed.has(x)), [], "목록에 빠진 파일");
  assert.deepEqual([...listed].filter((x) => !need.has(x)), [], "목록에만 있는 파일");
});
