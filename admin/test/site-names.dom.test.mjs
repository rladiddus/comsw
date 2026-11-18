// 사이트 메뉴 이름 따라가기(site-names.mjs): 고친 메뉴 이름(menus.label)이 안내 문구에 보인다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renameText, siteNames } from "../js/site-names.mjs";

const flush = () => new Promise((r) => setTimeout(r, 0));
const L = [["전체 수업", "로드맵"], ["학과 커리큘럼", "학과 전체"]];

test("사이트에만 있는 이름은 어디서나, 관리 메뉴와 같은 이름은 사이트 'X' 꼴만", () => {
  assert.equal(renameText("사이트 '전체 수업'의 단계", L), "사이트 '로드맵'의 단계");
  assert.equal(renameText("전체 수업 순서", L), "로드맵 순서");
  assert.equal(renameText("사이트 '학과 커리큘럼'에 나옵니다", L), "사이트 '학과 전체'에 나옵니다");
  assert.equal(renameText("운영 관리 화면의 '학과 커리큘럼 > 단계'", L), "운영 관리 화면의 '학과 커리큘럼 > 단계'", "관리 메뉴 안내는 그대로");
});

test("관리 화면: 이후 그려지는 글자·title·선택칸을 바꾸고 입력칸은 그대로, 선생님은 공개된 이름", async () => {
  const { window } = new JSDOM("<!doctype html><body><p id=a>사이트 '전체 수업'</p></body>");
  const doc = window.document;
  const sb = { from: () => ({ select: async () => ({ data: [{ name: "전체 수업", label: "로드맵" }, { name: "방학 특강", label: null }] }) }) };
  await siteNames(sb, doc);
  assert.equal(doc.getElementById("a").textContent, "사이트 '로드맵'", "이미 있던 글자");
  doc.body.insertAdjacentHTML("beforeend", "<div title=\"사이트 '전체 수업' 미리보기\"><span>전체 수업</span><input value='전체 수업'><select><option value='전체 수업'>전체 수업</option></select></div>");
  await flush();
  const d = doc.body.lastElementChild;
  assert.equal(d.title, "사이트 '로드맵' 미리보기");
  assert.equal(d.querySelector("span").textContent, "로드맵");
  assert.equal(d.querySelector("input").value, "전체 수업");
  assert.equal(d.querySelector("option").textContent, "로드맵");
  assert.equal(d.querySelector("option").value, "전체 수업", "고르는 값은 원래 이름");

  const t = new JSDOM("<!doctype html><body><p>학과별 자료</p></body>").window.document;
  const rows = [{ data: { values: ["", "", "", "", "학과별 자료", "true", "왼쪽", "1", "", "", "학과별 커리큘럼"] } }];
  const teacher = { from: () => ({ select: async () => ({ data: [] }) }), rpc: async () => ({ data: rows }) };
  await siteNames(teacher, t);
  assert.equal(t.querySelector("p").textContent, "학과별 커리큘럼");
});
