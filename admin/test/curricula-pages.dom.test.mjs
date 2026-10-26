// 3-3단계 관리 페이지(강사·강사 커리큘럼·방학 특강)를 가짜 DB로 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
let lastConfirm = "";
globalThis.confirm = msg => { lastConfirm = msg; return true; };

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 0)); };
const data = () => ({
  departments: [{ id: "d1", name: "시각편집학과", sort_order: 0 }, { id: "d2", name: "웹학과", sort_order: 1 }],
  subjects: [{ id: "s1", name: "포토샵", sort_order: 0 }, { id: "s2", name: "웹1", sort_order: 1 }],
  instructors: [
    { id: "i1", name: "김민주", gender: "여자", is_listed: true, sort_order: 0 },
    { id: "i2", name: "조해리", gender: "여자", is_listed: true, sort_order: 1 },
  ],
  instructor_departments: [{ instructor_id: "i1", department_id: "d2" }],
  instructor_subjects: [{ instructor_id: "i1", subject_id: "s2", sort_order: 0 }],
  curriculum_sets: [
    { id: "set-web", name: "웹학과", department_id: "d2", sort_order: 0 },
    { id: "set-vac", name: "2026년 여름방학특강", department_id: null, sort_order: 1 },
  ],
  site_settings: [{ key: "vacation_set_id", value: "set-vac" }],
  instructor_curricula: [
    { id: "c1", set_id: "set-web", instructor_id: "i1", subject_id: "s2", step_label: "1주차", status: "approved", sort_order: 0 },
    { id: "c2", set_id: "set-web", instructor_id: "i2", subject_id: "s2", step_label: "1주차", status: "approved", sort_order: 1 },
    { id: "c3", set_id: "set-web", instructor_id: "i1", subject_id: "s2", step_label: "1주차", status: "pending", sort_order: 2 },
    { id: "c4", set_id: "set-vac", instructor_id: "i2", subject_id: "s1", step_label: "1단계", status: "approved",
      supplies: "교재", supplies_detail: "멘토 포토샵", class_time: "2시간 X 10일", sort_order: 0 },
  ],
});

async function renderPage(path, tables = data()) {
  const { render } = await import(path);
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const supabase = fakeSupabase(tables);
  supabase.rpcCalls = [];
  supabase.rpc = async (name, args) => { supabase.rpcCalls.push([name, args]); return { data: null, error: null }; };
  await render(container, { supabase });
  await flush();
  return { c: container, tables, supabase };
}
const tableOf = (c, title) => {
  const h = [...c.querySelectorAll("h3")].find(x => x.textContent.startsWith(title));
  let n = h?.nextElementSibling;
  while (n && n.tagName !== "TABLE") n = n.nextElementSibling;
  return n;
};
const rowsOf = (c, title) => [...(tableOf(c, title)?.querySelectorAll("tbody tr") ?? [])];
const button = (scope, text) => [...scope.querySelectorAll("button")].find(b => b.textContent === text);
const pick = async (c, label, value) => {
  const select = [...c.querySelectorAll(".picker")].find(p => p.querySelector("label").textContent === label).querySelector("select");
  select.value = value;
  select.dispatchEvent(new dom.window.Event("change"));
  await flush();
};

test("강사: 카드(사진 왼쪽, 처음엔 접힘)에 학과·담당 과목 칩과 사이트 표시", async () => {
  const { c } = await renderPage("../js/pages/instructors.mjs");
  const cards = [...c.querySelectorAll(".card-item")];
  assert.equal(cards.length, 2);
  assert.ok(cards.every(x => x.classList.contains("collapsed")));
  assert.deepEqual([...cards[0].children].map(x => x.className), ["drag-handle", "card-stage portrait", "card-side"]);
  assert.deepEqual([...cards[0].querySelectorAll(".chip span")].map(s => s.textContent), ["웹학과", "웹1"]);
  const show = cards[0].querySelector(".media-actions input[type=checkbox]");
  assert.ok(show.checked);
  assert.equal(show.closest("label").textContent, "사이트 표시");
});

test("강사: 수정 중에만 칩을 빼고 더하며, 저장할 때 연결표에 반영", async () => {
  const { c, tables } = await renderPage("../js/pages/instructors.mjs");
  const card = c.querySelectorAll(".card-item")[0];
  assert.equal(card.querySelector(".chip button"), null, "보기 중에는 × 없음");
  button(card, "수정").click();
  const subjects = [...card.querySelectorAll(".card-line")].find(l => l.firstElementChild.textContent === "담당 과목");
  button(subjects, "×").click();
  const add = subjects.querySelector(".link-pick");
  add.value = "s1";
  add.dispatchEvent(new dom.window.Event("change"));
  button(card, "저장").click();
  await flush();
  assert.deepEqual(tables.instructor_subjects.filter(r => r.instructor_id === "i1").map(r => r.subject_id), ["s1"]);
  assert.deepEqual([...subjects.querySelectorAll(".chip span")].map(s => s.textContent), ["포토샵"]);
});

test("강사 삭제 경고에 커리큘럼 수", async () => {
  const { c } = await renderPage("../js/pages/instructors.mjs");
  globalThis.confirm = msg => { lastConfirm = msg; return false; };
  button(c.querySelectorAll(".card-item")[0], "삭제").click();
  await flush();
  globalThis.confirm = msg => { lastConfirm = msg; return true; };
  assert.match(lastConfirm, /강사 커리큘럼 2개/);
});

test("강사: 학과·과목·이름 하나만 골라도 검색, 아무것도 안 고르면 전체", async () => {
  const { c } = await renderPage("../js/pages/instructors.mjs");
  const bar = c.querySelector(".search-bar");
  const names = () => [...c.querySelectorAll(".card-item")].map(x => x.querySelector(".card-side input[type=text]").value);
  const searchBy = async ({ dept = "", subj = "", name = "" } = {}) => {
    bar.querySelector('[aria-label="학과"]').value = dept;
    bar.querySelector('[aria-label="과목"]').value = subj;
    bar.querySelector('[aria-label="이름"]').value = name;
    button(bar, "검색").click();
    await flush();
  };
  await searchBy({ dept: "d2" });
  assert.deepEqual(names(), ["김민주"]);
  await searchBy({ subj: "s1" });
  assert.match(c.textContent, /검색 결과가 없습니다/);
  await searchBy({ name: "해리" });
  assert.deepEqual(names(), ["조해리"]);
  assert.match(bar.textContent, /1명/);
  await searchBy();
  assert.deepEqual(names(), ["김민주", "조해리"]);
});

test("강사 메뉴: 강사 / 승인 대기 / 계정 연결 탭, 승인 대기는 그 탭에만", async () => {
  const { c } = await renderPage("../js/pages/instructor-tabs.mjs", { ...data(), instructor_profile_drafts: [] });
  assert.deepEqual([...c.querySelectorAll("[role=tab]")].map(t => t.textContent), ["강사", "승인 대기", "계정 연결"]);
  const panels = c.querySelectorAll(".subpage");
  assert.doesNotMatch(panels[0].textContent, /승인 대기 프로필/);
  [...c.querySelectorAll("[role=tab]")][1].click();
  await flush();
  assert.match(panels[1].textContent, /승인 대기 프로필이 없습니다/);
});

const curData = () => {
  const t = data();
  t.curriculum_sets.unshift({ id: "set-ps", name: "시각편집학과", department_id: "d1", sort_order: -1 });
  t.instructor_curricula.push(
    { id: "c5", set_id: "set-ps", instructor_id: "i2", subject_id: "s1", step_label: "1단계", status: "approved", sort_order: 0 },
  );
  return t;
};
const cardIds = (c) => [...c.querySelectorAll(".card-item")].map(x => x.querySelector(".card-side input")?.value ?? "");
const searchBy = async (c, { set = "", inst = "", subj = "" } = {}) => {
  const sel = (label) => c.querySelector(`.search-bar select[aria-label="${label}"]`);
  sel("학과 탭").value = set; sel("강사").value = inst; sel("과목").value = subj;
  button(c.querySelector(".search-bar"), "검색").click();
  await flush();
};
const addCard = (c) => [...c.querySelectorAll("button")].filter(b => b.textContent === "+ 추가").at(-1).click();
const lines = (c) => [...c.querySelectorAll(".card-item")].map(card =>
  [...card.querySelectorAll(".card-line select")].map(s => s.value).join("/"));

test("강사 커리큘럼: 방학 특강·승인 대기는 빼고, 학과 탭 순서대로 카드(이미지 왼쪽, 접힘)", async () => {
  const { c } = await renderPage("../js/pages/curricula.mjs", curData());
  const setOptions = [...c.querySelector('.search-bar select[aria-label="학과 탭"]').options].map(o => o.textContent);
  assert.deepEqual(setOptions, ["전체", "시각편집학과", "웹학과"]);
  assert.deepEqual(lines(c), ["set-ps/i2/s1", "set-web/i1/s2", "set-web/i2/s2"]);
  const card = c.querySelector(".card-item");
  assert.ok(card.classList.contains("collapsed"));
  assert.deepEqual([...card.children].map(x => x.className.split(" ")[0]), ["card-stage", "card-side"]);
  assert.match(c.textContent, /3개/);
});

test("강사 커리큘럼: 학과 탭·강사·과목 하나만 골라도 검색, 아무것도 안 고르면 전체", async () => {
  const { c } = await renderPage("../js/pages/curricula.mjs", curData());
  await searchBy(c, { inst: "i2" });
  assert.deepEqual(lines(c), ["set-ps/i2/s1", "set-web/i2/s2"]);
  await searchBy(c, { subj: "s2" });
  assert.deepEqual(lines(c), ["set-web/i1/s2", "set-web/i2/s2"]);
  await searchBy(c, { set: "set-web", inst: "i1" });
  assert.deepEqual(lines(c), ["set-web/i1/s2"]);
  await searchBy(c, { set: "set-ps", subj: "s2" });
  assert.match(c.textContent, /검색 결과가 없습니다/);
  await searchBy(c);
  assert.deepEqual(lines(c), ["set-ps/i2/s1", "set-web/i1/s2", "set-web/i2/s2"]);
});

test("강사 커리큘럼: 순서 바꾸기 손잡이(⠿)가 없고 끌어도 순서가 그대로", async () => {
  const { c, tables } = await renderPage("../js/pages/curricula.mjs", curData());
  await searchBy(c, { set: "set-web" });
  assert.equal(c.querySelector(".drag-handle"), null);
  const cards = [...c.querySelectorAll(".card-item")];
  assert.ok(cards.every(x => x.classList.contains("no-sort")));
  const ev = (type) => Object.assign(new dom.window.Event(type), { dataTransfer: { setData() {} } });
  cards[1].dispatchEvent(ev("dragstart"));
  cards[0].dispatchEvent(ev("drop"));
  await flush();
  assert.equal(tables.instructor_curricula.find(r => r.id === "c1").sort_order, 0);
  assert.deepEqual(lines(c), ["set-web/i1/s2", "set-web/i2/s2"]);
});

test("새 커리큘럼은 학과 탭을 골라 검색해야 추가되고, 고른 탭·강사·승인 상태로 들어간다", async () => {
  const { c, tables } = await renderPage("../js/pages/curricula.mjs", curData());
  const before = tables.instructor_curricula.length;
  addCard(c);
  await flush();
  assert.equal(tables.instructor_curricula.length, before);
  assert.match(c.textContent, /학과 탭을 고르고 검색/);
  await searchBy(c, { set: "set-web", inst: "i2" });
  addCard(c);
  await flush();
  const added = tables.instructor_curricula.at(-1);
  assert.equal(added.set_id, "set-web");
  assert.equal(added.instructor_id, "i2");
  assert.equal(added.status, "approved");
  assert.equal("is_active" in added, false);
});

test("방학 특강: 메인 화면에서 고른 세트의 승인된 강의를 카드(이미지 오른쪽, 접힘, 끌기)로, 교재·수업 시간 칸 포함", async () => {
  const { c } = await renderPage("../js/pages/vacation.mjs");
  assert.match(c.textContent, /2026년 여름방학특강/);
  const cards = [...c.querySelectorAll(".card-item")];
  assert.equal(cards.length, 1);
  assert.ok(cards[0].classList.contains("image-right") && cards[0].classList.contains("collapsed"));
  assert.deepEqual([...cards[0].children].map(x => x.className.split(" ")[0]), ["drag-handle", "card-side", "card-stage"]);
  const labels = [...cards[0].querySelectorAll(".card-line > span")].map(s => s.textContent);
  assert.ok(["교재·준비물", "교재 설명", "수업 시간"].every(h => labels.includes(h)), labels.join(","));
  assert.equal(cards[0].querySelector('.card-line textarea').value, "", "원문");
});

test("방학 특강: 세트를 고르지 않았으면 안내", async () => {
  const tables = data();
  tables.site_settings = [];
  const { c } = await renderPage("../js/pages/vacation.mjs", tables);
  assert.match(c.textContent, /메인 화면 > 기타 설정/);
  assert.equal(c.querySelector(".card-item"), null);
});

test("끌어 놓기: 줄 아래쪽 절반이면 뒤 경계에 점선, 제자리엔 점선 없음, 놓으면 그 경계로 옮긴다", async () => {
  const { dropTarget } = await import("../js/card-list.mjs");
  const box = document.createElement("div");
  box.getBoundingClientRect = () => ({ top: 100, height: 40 });
  const moves = [];
  let from = 0;
  dropTarget(box, 1, () => from, (f, t) => moves.push([f, t]));
  const at = (type, clientY) => box.dispatchEvent(Object.assign(new dom.window.Event(type, { cancelable: true }), { clientY }));
  at("dragover", 130);
  assert.ok(box.classList.contains("drop-after"));
  at("dragover", 105);
  assert.ok(!box.classList.contains("drop-before"), "0번을 1번 앞에 놓으면 제자리");
  at("drop", 130);
  assert.deepEqual(moves, [[0, 1]]);
  assert.ok(!box.classList.contains("drop-after"));
  from = 3;
  at("drop", 105);
  assert.deepEqual(moves.at(-1), [3, 1]);
});

test("강사 커리큘럼: 줄이 많으면 30개씩 그리고 '더 보기'로 이어서, 검색하면 처음부터", async () => {
  const t = curData();
  for (let k = 0; k < 70; k++) {
    t.instructor_curricula.push({ id: `m${k}`, set_id: "set-web", instructor_id: "i1", subject_id: "s1", step_label: `${k}단계`, status: "approved", sort_order: 10 + k });
  }
  const { c } = await renderPage("../js/pages/curricula.mjs", t);
  assert.equal(c.querySelectorAll(".card-item").length, 30);
  button(c, "더 보기 (43개 남음)").click();
  assert.equal(c.querySelectorAll(".card-item").length, 60);
  await searchBy(c, { subj: "s1" });
  assert.equal(c.querySelectorAll(".card-item").length, 30);
  assert.match(c.textContent, /71개/);
});
