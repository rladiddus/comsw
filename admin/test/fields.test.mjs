import test from "node:test";
import assert from "node:assert/strict";
import { toDbValue, dbErrorMessage } from "../js/fields.mjs";

test("값 변환과 필수 칸", () => {
  assert.deepEqual(toDbValue({ key: "is_active", label: "사용", type: "checkbox" }, true), { value: true });
  assert.deepEqual(toDbValue({ key: "capacity", label: "정원", type: "number" }, ""), { value: null });
  assert.deepEqual(toDbValue({ key: "capacity", label: "정원", type: "number" }, "25"), { value: 25 });
  assert.deepEqual(toDbValue({ key: "capacity", label: "정원", type: "number" }, "25명"), { error: "정원에는 숫자만 입력할 수 있습니다" });
  assert.deepEqual(toDbValue({ key: "name", label: "메뉴 이름", type: "text", required: true }, "  "), { error: "메뉴 이름을(를) 입력해주세요" });
  assert.deepEqual(toDbValue({ key: "caption", label: "문구", type: "textarea" }, " 첫 줄\n둘째 줄 "), { value: "첫 줄\n둘째 줄" });
  assert.deepEqual(toDbValue({ key: "side", label: "위치", type: "select" }, "left"), { value: "left" });
});

test("DB 오류 문구", () => {
  assert.equal(dbErrorMessage({ code: "23505", message: "dup" }), "같은 이름이 이미 있습니다");
  assert.equal(dbErrorMessage({ code: "23502", message: "null" }), "필수 칸이 비어 있습니다");
  assert.equal(dbErrorMessage({ code: "42501" }), "권한이 없습니다. 다시 로그인해주세요");
  assert.equal(dbErrorMessage({ status: 401 }), "권한이 없습니다. 다시 로그인해주세요");
  assert.equal(dbErrorMessage({ code: "XX", message: "boom" }), "저장하지 못했습니다: boom");
});

test("중복 오류 문구를 표마다 바꿀 수 있다", () => {
  assert.equal(dbErrorMessage({ code: "23505" }, { duplicate: "이미 있는 단계 번호입니다" }), "이미 있는 단계 번호입니다");
  assert.equal(dbErrorMessage({ code: "23505" }, {}), "같은 이름이 이미 있습니다");
});
