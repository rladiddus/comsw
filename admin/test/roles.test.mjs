import test from "node:test";
import assert from "node:assert/strict";
import { roleLabel, canManage, canEnter } from "../js/roles.mjs";

test("역할 이름", () => {
  assert.equal(roleLabel("admin"), "관리자");
  assert.equal(roleLabel("head"), "학과장");
  assert.equal(roleLabel("teacher"), "선생님");
  assert.equal(roleLabel(null), null);
  assert.equal(roleLabel("member"), null);
});
test("관리 권한은 관리자·학과장만", () => {
  assert.equal(canManage("admin"), true);
  assert.equal(canManage("head"), true);
  assert.equal(canManage("teacher"), false);
  assert.equal(canManage(null), false);
});
test("입장은 세 역할만", () => {
  assert.equal(canEnter("teacher"), true);
  assert.equal(canEnter(null), false);
  assert.equal(canEnter(""), false);
});
test("객체 기본 속성 이름은 역할이 아니다", () => {
  assert.equal(canEnter("toString"), false);
  assert.equal(roleLabel("constructor"), null);
});
