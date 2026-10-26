import test from "node:test";
import assert from "node:assert/strict";
import { NAV, navFor, routeFrom } from "../js/router.mjs";
import { SITE_PAGES } from "../js/preview.mjs";

test("메뉴 순서와 준비 상태", () => {
  assert.deepEqual(NAV.map(n => n.id), ["settings", "instructors", "departments", "curriculum-admin", "curricula", "roadmap", "prep", "seminars", "vacation", "recruitment", "mine", "profile"]);
  assert.ok(NAV.every(n => n.ready));
});

test("관리자·학과장은 두 개인 화면을 포함한 전체, 선생님은 두 화면만", () => {
  assert.equal(navFor("admin")[0].id, "settings");
  assert.equal(navFor("admin").length, 12);
  assert.ok(navFor("head").some(n => n.id === "mine"));
  assert.deepEqual(navFor("teacher").map(n => n.id), ["mine", "profile"]);
  assert.deepEqual(navFor(null), []);
});

test("주소의 페이지가 권한 밖이면 첫 메뉴로", () => {
  assert.equal(routeFrom("#/seminars", "head"), "seminars");
  assert.equal(routeFrom("#/main", "teacher"), "mine");
  assert.equal(routeFrom("", "admin"), "settings");
  assert.equal(routeFrom("#/없는페이지", "admin"), "settings");
});

test("관리 메뉴마다 미리볼 사이트 페이지가 있고, 그 이름은 미리보기 페이지 목록에 있다", () => {
  for (const n of NAV.filter((n) => n.manage)) {
    assert.ok(SITE_PAGES.some((p) => p.name === n.site), `${n.label}: ${n.site}`);
  }
});
