// 관리 화면 파일 주소의 버전(?v=)이 지금 파일 내용과 맞는지. 틀리면 node scripts/stamp-admin.mjs 실행.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stamped } from "../../scripts/stamp-admin.mjs";

test("admin/index.html의 파일 버전이 최신이다(아니면 node scripts/stamp-admin.mjs)", () => {
  assert.ok(stamped() === readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    "admin/index.html 버전이 오래됐습니다. node scripts/stamp-admin.mjs 를 실행하세요.");
});
