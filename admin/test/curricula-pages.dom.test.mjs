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

test("강사: 학과·담당 과목 칩과 사이트 표시 체크", async () => {
  const { c } = await renderPage("../js/pages/instructors.mjs");
  const rows = rowsOf(c, "강사");
  assert.equal(rows.length, 2);
  assert.deepEqual([...rows[0].querySelectorAll(".chip span")].map(s => s.textContent), ["웹학과", "웹1"]);
  assert.ok(rows[0].querySelector("input[type=checkbox]").checked);
});

test("강사 삭제 경고에 커리큘럼 수", async () => {
  const { c } = await renderPage("../js/pages/instructors.mjs");
  globalThis.confirm = msg => { lastConfirm = msg; return false; };
  button(rowsOf(c, "강사")[0], "삭제").click();
  await flush();
  globalThis.confirm = msg => { lastConfirm = msg; return true; };
  assert.match(lastConfirm, /강사 커리큘럼 2개/);
});

test("강사 커리큘럼: 방학 특강 세트는 빼고, 승인된 줄과 승인 대기를 나눠 보여 준다", async () => {
  const { c } = await renderPage("../js/pages/curricula.mjs");
  const setOptions = [...c.querySelector(".picker select").options].map(o => o.textContent);
  assert.deepEqual(setOptions, ["웹학과"]);
  assert.equal(rowsOf(c, "승인된 커리큘럼").length, 2);
  assert.equal(rowsOf(c, "승인 대기").length, 1);
});

test("강사 커리큘럼: 강사로 좁혀 보기", async () => {
  const { c } = await renderPage("../js/pages/curricula.mjs");
  await pick(c, "강사", "i2");
  const rows = rowsOf(c, "승인된 커리큘럼");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].querySelector("select").value, "i2");
});

test("승인 대기 줄을 승인하면 승인 함수를 부르고 다시 그린다", async () => {
  const { c, supabase, tables } = await renderPage("../js/pages/curricula.mjs");
  supabase.rpc = async (name, args) => {
    supabase.rpcCalls.push([name, args]);
    tables.instructor_curricula = tables.instructor_curricula.filter(r => r.id !== "c1");
    tables.instructor_curricula.find(r => r.id === "c3").status = "approved";
    return { data: null, error: null };
  };
  button(rowsOf(c, "승인 대기")[0], "승인").click();
  await flush();
  assert.deepEqual(supabase.rpcCalls, [["comsw_approve_curriculum", { p_id: "c3" }]]);
  assert.match(lastConfirm, /예전 내용은 지워집니다/);
  assert.equal(rowsOf(c, "승인 대기").length, 0);
});

test("새 줄은 고른 세트·강사로, 승인 상태로 추가된다", async () => {
  const { c, tables } = await renderPage("../js/pages/curricula.mjs");
  await pick(c, "강사", "i2");
  button(tableOf(c, "승인된 커리큘럼").previousElementSibling, "+ 추가").click();
  await flush();
  const added = tables.instructor_curricula.at(-1);
  assert.equal(added.set_id, "set-web");
  assert.equal(added.instructor_id, "i2");
  assert.equal(added.status, "approved");
});

test("방학 특강: 메인 화면에서 고른 세트를 교재·수업 시간 칸과 함께 편집", async () => {
  const { c } = await renderPage("../js/pages/vacation.mjs");
  assert.match(c.textContent, /2026년 여름방학특강/);
  const headers = [...tableOf(c, "승인된 커리큘럼").querySelectorAll("th")].map(th => th.textContent);
  assert.ok(["교재·준비물", "교재 설명", "수업 시간"].every(h => headers.includes(h)), headers.join(","));
  assert.equal(rowsOf(c, "승인된 커리큘럼").length, 1);
});

test("방학 특강: 세트를 고르지 않았으면 안내", async () => {
  const tables = data();
  tables.site_settings = [];
  const { c } = await renderPage("../js/pages/vacation.mjs", tables);
  assert.match(c.textContent, /메인 화면 > 기타 설정/);
  assert.equal(tableOf(c, "승인된 커리큘럼"), undefined);
});
