// V3 index.html의 미리 받기(modulepreload) 목록 = 시작(main.mjs)과 첫 화면이 실제로 import하는 파일 전부.
// 첫 화면(주소 없이 열 때): 관리자·학과장 = 첫 메뉴 '기본 설정 등'(legacy → 첫 탭 site.mjs), 선생님 = '내 프로필'(profile → admin 내 프로필).
// 화면은 동적 import라 따라가지 못하므로 아래 entries에 적고, 그 연결이 코드에 그대로 있는지도 확인한다.
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

test("V3 미리 받기 목록이 시작·첫 화면 import와 같다", () => {
  const src = (f) => fs.readFileSync(path.join(v3, f), "utf8");
  assert.match(src("js/app.mjs"), /export const GROUPS = \[\s*(\/\/.*\s*)*\["운영 메뉴", \[\s*\["legacy"/, "관리자 첫 메뉴 = 기본 설정 등");
  assert.match(src("js/pages/legacy.mjs"), /const TABS = \[\["기본 설정", "\.\/site\.mjs"\]/, "기본 설정 등 첫 탭 = site.mjs");
  assert.match(src("js/app.mjs"), /const TEACHER = \["mine", "profile"\]/);
  assert.match(src("js/pages/profile.mjs"), /import\("\.\.\/\.\.\/\.\.\/admin\/js\/pages\/profile\.mjs"\)/);
  const html = fs.readFileSync(path.join(v3, "index.html"), "utf8");
  const listed = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)]
    .map(([, h]) => (/^https?:/.test(h) ? h : path.resolve(v3, h))));
  const need = graph(["js/main.mjs", "js/pages/legacy.mjs", "js/pages/site.mjs", "js/pages/profile.mjs", "../admin/js/pages/profile.mjs"]);
  assert.deepEqual([...need].filter((x) => !listed.has(x)), [], "목록에 빠진 파일");
  assert.deepEqual([...listed].filter((x) => !need.has(x)), [], "목록에만 있는 파일");
});
