import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// hidden 속성은 .login-wrap(display:flex)·.app(display:grid) 같은 규칙보다 우선해야 한다.
// 아니면 로그인 뒤에도 로그인 카드가 위에 남고 관리 화면이 그 아래에 붙는다.
// (jsdom은 이 우선순위를 실제 브라우저와 다르게 처리해 CSS 규칙을 직접 확인한다.)
test("CSS가 hidden 속성을 항상 숨김으로 강제한다", () => {
  const css = readFileSync(new URL("../admin.css", import.meta.url), "utf8").replace(/\s+/g, "");
  assert.match(css, /\[hidden\]\{display:none!important;?\}/);
});
