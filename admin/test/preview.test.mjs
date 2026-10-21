import test from "node:test";
import assert from "node:assert/strict";
import { SITE_PAGES, previewUrl, openPreview } from "../js/preview.mjs";

test("메뉴 이름·기기로 미리보기 주소를 만든다", () => {
  assert.equal(previewUrl("메인", false), "../index.html?preview=1");
  assert.equal(previewUrl("특강/세미나", true), "../seminar_tablet.html?preview=1");
  assert.equal(previewUrl(" 방학특강 ", false), "../vacation.html?preview=1", "띄어쓰기 달라도");
  assert.equal(previewUrl("새 메뉴", false), null);
  assert.deepEqual(SITE_PAGES.map(p => p.name),
    ["메인", "전체 수업", "학과별 자료", "학과 커리큘럼", "특강/세미나", "수업별 준비물", "방학 특강"]);
});

test("새 탭을 먼저 열고(팝업 차단 방지) 토큰을 남긴 뒤 주소로 보낸다", async () => {
  const store = {};
  const tab = { location: {} };
  const win = { open: () => tab, localStorage: { setItem: (k, v) => { store[k] = v; } } };
  await openPreview("../index.html?preview=1", async () => "tok", win);
  assert.equal(store.comsw_preview_token, "tok");
  assert.equal(tab.location.href, "../index.html?preview=1");
});

test("토큰을 못 받으면 열린 탭을 닫고 오류", async () => {
  let closed = false;
  const tab = { location: {}, close: () => { closed = true; } };
  const win = { open: () => tab, localStorage: { setItem() {} } };
  await assert.rejects(openPreview("../index.html?preview=1", async () => { throw new Error("로그인 만료"); }, win), /로그인 만료/);
  assert.equal(closed, true);
});
