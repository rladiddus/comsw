#!/usr/bin/env node
/**
 * 배포 전 문법 검사 (의존성 없음, Node 내장 모듈만 사용)
 *
 *  1) assets/js/**.js  → node 파서로 구문 검사
 *  2) 모든 *.html 내부의 인라인 <script>(src 없는 것) → 구문 검사
 *
 * 구문 오류가 하나라도 있으면 종료 코드 1로 실패한다.
 * 로컬에서도 `node scripts/check-syntax.js`로 동일하게 돌릴 수 있다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let checked = 0;

function walk(dir, filter, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

// 1) 독립 .js 파일
const jsFiles = walk(ROOT, (f) => f.endsWith('.js') && rel(f) !== 'scripts/check-syntax.js', []);
for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.Script(code, { filename: file });
    checked++;
  } catch (err) {
    failures++;
    console.error(`  FAIL ${rel(file)}: ${err.message}`);
  }
}

// 2) HTML 내부 인라인 <script>
const htmlFiles = walk(ROOT, (f) => f.endsWith('.html'), []);
const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  let block = 0;
  while ((m = scriptRe.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue; // 외부 스크립트는 건너뜀
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    // JS가 아닌 <script>(예: application/json)는 건너뜀
    if (type && !/javascript|module|ecmascript/.test(type)) continue;
    block++;
    try {
      // 함수 본문으로 감싸 구문만 검사 (top-level return 허용)
      new Function(m[2]); // eslint-disable-line no-new-func
      checked++;
    } catch (err) {
      failures++;
      console.error(`  FAIL ${rel(file)} <script> #${block}: ${err.message}`);
    }
  }
}

if (failures) {
  console.error(`\n문법 검사 실패: ${failures}건 (검사 ${checked}건)`);
  process.exit(1);
}
console.log(`문법 검사 통과: ${checked}건 (JS ${jsFiles.length}개 파일 + HTML 인라인 스크립트)`);
