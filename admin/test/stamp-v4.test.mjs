// V4 화면 파일 주소의 버전(?v=)이 지금 파일 내용과 맞는지. 틀리면 node scripts/stamp-v4.mjs 실행.
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { stamped, read } from "../../scripts/stamp-v4.mjs";

test("admin-v4/index.html의 파일 버전이 최신이다(아니면 node scripts/stamp-v4.mjs)", () => {
  assert.ok(stamped() === read(fileURLToPath(new URL("../../admin-v4/index.html", import.meta.url))),
    "admin-v4/index.html 버전이 오래됐습니다. node scripts/stamp-v4.mjs 를 실행하세요.");
});
