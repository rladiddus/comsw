import test from "node:test";
import assert from "node:assert/strict";
import { formatPublished, formatSeoul, deleteSeminarMessage } from "../js/format.mjs";

test("마지막 적용 표시는 서울 시간", () => {
  assert.equal(formatPublished(null), "아직 적용한 적 없음");
  assert.equal(formatPublished({ created_at: "2026-10-21T15:05:00Z" }), "2026-10-22 00:05 적용");
  assert.equal(formatSeoul("2026-01-02T03:04:00Z"), "2026-01-02 12:04");
});

test("특강 삭제 경고에 신청자 수", () => {
  assert.equal(deleteSeminarMessage("AI 특강", 0), "'AI 특강' 특강을 삭제할까요?");
  assert.equal(deleteSeminarMessage("AI 특강", 3), "'AI 특강' 특강을 삭제하면 신청자 3명의 명단도 함께 삭제됩니다. 삭제할까요?");
});
