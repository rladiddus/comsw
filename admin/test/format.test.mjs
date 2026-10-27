import test from "node:test";
import assert from "node:assert/strict";
import { formatPublished, formatSeoul, deleteSeminarMessage, cascadeMessage } from "../js/format.mjs";

test("마지막 사이트 반영 표시는 서울 시간", () => {
  assert.equal(formatPublished(null), "아직 사이트에 반영한 적 없음");
  assert.equal(formatPublished({ created_at: "2026-10-21T15:05:00Z" }), "2026-10-22 00:05 사이트에 반영");
  assert.equal(formatSeoul("2026-01-02T03:04:00Z"), "2026-01-02 12:04");
});

test("특강 삭제 경고에 신청자 수", () => {
  assert.equal(deleteSeminarMessage("AI 특강", 0), "'AI 특강' 특강을 삭제할까요?");
  assert.equal(deleteSeminarMessage("AI 특강", 3), "'AI 특강' 특강을 삭제하면 신청자 3명의 명단도 함께 삭제됩니다. 삭제할까요?");
});

test("삭제 경고: 함께 지워지는 데이터 개수", () => {
  assert.equal(cascadeMessage("과목", "포토샵", [["주차", 4], ["강사 커리큘럼", 0], ["준비물", 2]]),
    "'포토샵' 과목을(를) 삭제하면 주차 4개, 준비물 2개도 함께 삭제됩니다. 삭제할까요?");
  assert.equal(cascadeMessage("로드맵", "웹학과", [["단계", 0]]), "'웹학과' 로드맵을(를) 삭제할까요?");
});
