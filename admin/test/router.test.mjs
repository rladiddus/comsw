import test from "node:test";
import assert from "node:assert/strict";
import { NAV, navFor, routeFrom } from "../js/router.mjs";

test("메뉴 순서와 준비 상태", () => {
  assert.deepEqual(NAV.map(n => n.id), ["main", "loading", "seminars", "departments", "subjects", "roadmap", "prep", "instructors", "curricula", "recruitment", "vacation", "mine"]);
  assert.deepEqual(NAV.filter(n => n.ready).map(n => n.id), ["main", "loading", "seminars", "departments", "subjects", "roadmap", "prep", "recruitment"]);
});

test("관리자·학과장은 관리 메뉴 전체, 선생님은 내 커리큘럼만", () => {
  assert.equal(navFor("admin")[0].id, "main");
  assert.equal(navFor("admin").length, 11);
  assert.ok(!navFor("head").some(n => n.id === "mine"));
  assert.deepEqual(navFor("teacher").map(n => n.id), ["mine"]);
  assert.deepEqual(navFor(null), []);
});

test("주소의 페이지가 권한 밖이면 첫 메뉴로", () => {
  assert.equal(routeFrom("#/seminars", "head"), "seminars");
  assert.equal(routeFrom("#/main", "teacher"), "mine");
  assert.equal(routeFrom("", "admin"), "main");
  assert.equal(routeFrom("#/없는페이지", "admin"), "main");
});
