// 3-2단계 관리 페이지(학과·과목·로드맵·준비물·채용)를 가짜 DB로 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
let lastConfirm = "";
globalThis.confirm = msg => { lastConfirm = msg; return false; };

const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0)); };
const data = () => ({
  departments: [{ id: "d1", name: "시각편집학과", sort_order: 0 }, { id: "d2", name: "웹학과", sort_order: 1 }],
  site_categories: [{ id: "c1", name: "커리큘럼", is_active: true, sort_order: 0 }],
  subjects: [
    { id: "s1", name: "포토샵", sort_order: 0 }, { id: "s2", name: "웹1", sort_order: 1 },
    { id: "s3", name: "캐드", sort_order: null },
  ],
  subject_departments: [{ subject_id: "s1", department_id: "d1" }],
  subject_weeks: [
    { id: "w1", subject_id: "s1", week_label: "1주차", sort_order: 0 }, { id: "w2", subject_id: "s1", week_label: "2주차", sort_order: 1 },
    { id: "w3", subject_id: "s2", week_label: "1주차", sort_order: 0 },
  ],
  instructor_curricula: [{ id: "ic1", subject_id: "s1" }],
  course_prep_items: [],
  roadmap_step_subjects: [],
  recruitment_posts: [{ id: "r1", department_id: "d2", company: "회사", sort_order: 0 }],
  instructor_departments: [],
});

async function renderPage(path, tables = data()) {
  const { render } = await import(path);
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const supabase = fakeSupabase(tables, { unique: { departments: "name", subjects: "name" } });
  await render(container, { supabase });
  await flush();
  return { c: container, tables, supabase };
}
const headings = c => [...c.querySelectorAll("h3")].map(h => h.textContent.split(" —")[0]);
const tableOf = (c, title) => {
  const h = [...c.querySelectorAll("h3")].find(x => x.textContent.startsWith(title));
  let n = h.nextElementSibling;
  while (n && n.tagName !== "TABLE") n = n.nextElementSibling;
  return n;
};
const buttons = (scope, text) => [...scope.querySelectorAll("button")].filter(b => b.textContent === text);

test("학과: 학과 표와 카테고리 표", async () => {
  const { c } = await renderPage("../js/pages/departments.mjs");
  assert.deepEqual(headings(c), ["학과", "카테고리"]);
  assert.equal(tableOf(c, "학과").querySelectorAll("tbody tr").length, 2);
});

test("학과 삭제 경고에 채용 공고 수", async () => {
  const { c } = await renderPage("../js/pages/departments.mjs");
  buttons(tableOf(c, "학과").querySelectorAll("tbody tr")[1], "삭제")[0].click();
  await flush();
  assert.equal(lastConfirm, "'웹학과' 학과을(를) 삭제하면 채용 공고 1개도 함께 삭제됩니다. 삭제할까요?");
});

test("과목: 전체수업 과목과 기타 과목으로 나뉘고 기타 과목엔 ↑↓가 없다", async () => {
  const { c } = await renderPage("../js/pages/subjects.mjs");
  assert.deepEqual(headings(c).slice(0, 2), ["전체수업 과목", "기타 과목"]);
  const main = tableOf(c, "전체수업 과목"), other = tableOf(c, "기타 과목");
  assert.equal(main.querySelectorAll("tbody tr").length, 2);
  assert.equal(other.querySelectorAll("tbody tr").length, 1);
  assert.ok(buttons(main, "↑").length > 0);
  assert.equal(buttons(other, "↑").length, 0);
  assert.equal(main.querySelector(".chip").firstChild.textContent, "시각편집학과");
});

test("과목: '전체수업에서 빼기'는 순서를 비우고 두 목록을 다시 읽는다", async () => {
  const { c, tables } = await renderPage("../js/pages/subjects.mjs");
  buttons(tableOf(c, "전체수업 과목"), "전체수업에서 빼기")[1].click();
  await flush();
  assert.equal(tables.subjects.find(s => s.id === "s2").sort_order, null);
  assert.equal(tableOf(c, "기타 과목").querySelectorAll("tbody tr").length, 2);
  buttons(tableOf(c, "기타 과목"), "전체수업에 넣기")[0].click();
  await flush();
  assert.equal(tableOf(c, "전체수업 과목").querySelectorAll("tbody tr").length, 2);
});

test("과목: 주차 버튼으로 그 과목 주차만 연다", async () => {
  const { c } = await renderPage("../js/pages/subjects.mjs");
  buttons(tableOf(c, "전체수업 과목"), "주차")[0].click();
  await flush();
  const weeks = tableOf(c, "주차");
  assert.deepEqual([...weeks.querySelectorAll("tbody tr")].map(tr => tr.querySelector("input").value), ["1주차", "2주차"]);
});

test("과목 삭제 경고에 주차·강사 커리큘럼이 나온다", async () => {
  const { c } = await renderPage("../js/pages/subjects.mjs");
  buttons(tableOf(c, "전체수업 과목"), "삭제")[0].click();
  await flush();
  assert.equal(lastConfirm, "'포토샵' 과목을(를) 삭제하면 주차 2개, 강사 커리큘럼 1개도 함께 삭제됩니다. 삭제할까요?");
});

test("기타 과목 '+ 추가'는 전체수업 과목과 겹치지 않는 이름, 순서 없음으로 넣는다", async () => {
  const tables = data();
  tables.subjects.push({ id: "s9", name: "새 과목 1", sort_order: 2 });
  const { c, supabase } = await renderPage("../js/pages/subjects.mjs", tables);
  const addBtns = [...c.querySelectorAll(".editor-bar button")].filter(b => b.textContent === "+ 추가");
  addBtns[1].click();
  await flush();
  assert.deepEqual(supabase.calls.filter(x => x[0] === "insert").at(-1), ["insert", "subjects", { sort_order: null, name: "새 과목 2" }]);
});

const more = () => Object.assign(data(), {
  roadmap_tracks: [{ id: "t1", name: "웹학과", department_id: "d2", sort_order: 0 }, { id: "t2", name: "사무 자격증", department_id: null, sort_order: 1 }],
  roadmap_steps: [{ id: "p2", track_id: "t1", position: 2 }, { id: "p1", track_id: "t1", position: 1 }],
  roadmap_step_subjects: [{ step_id: "p1", subject_id: "s1", sort_order: 0 }],
  course_prep_items: [{ id: "c1", subject_id: "s1", category: "textbook", content: "멘토 포토샵", sort_order: 0 }],
});
const pick = async (c, value) => {
  const select = c.querySelector(".picker select");
  select.value = value;
  select.dispatchEvent(new dom.window.Event("change"));
  await flush();
};

test("로드맵: 묶음 표, 단계는 단계 번호순·↑↓ 없음·과목 칩, 학과 없음은 빈 값", async () => {
  const { c } = await renderPage("../js/pages/roadmap.mjs", more());
  const tracks = tableOf(c, "로드맵 묶음");
  assert.equal(tracks.querySelectorAll("tbody tr").length, 2);
  assert.equal(tracks.querySelectorAll("tbody tr")[1].querySelector("select").value, "");
  buttons(tracks, "단계")[0].click();
  await flush();
  const steps = tableOf(c, "단계");
  assert.deepEqual([...steps.querySelectorAll("tbody tr")].map(tr => tr.querySelector("input").value), ["1", "2"]);
  assert.equal(buttons(steps, "↑").length, 0);
  assert.equal(steps.querySelector(".chip").firstChild.textContent, "포토샵");
});

test("로드맵 삭제 경고에 단계 수", async () => {
  const { c } = await renderPage("../js/pages/roadmap.mjs", more());
  buttons(tableOf(c, "로드맵 묶음"), "삭제")[0].click();
  await flush();
  assert.equal(lastConfirm, "'웹학과' 로드맵을(를) 삭제하면 단계 2개도 함께 삭제됩니다. 삭제할까요?");
});

test("준비물: 고른 과목의 준비물만 보이고 새 줄은 그 과목으로", async () => {
  const { c, supabase } = await renderPage("../js/pages/prep.mjs", more());
  await pick(c, "s1");
  assert.equal(c.querySelectorAll("table.editor tbody tr").length, 1);
  assert.equal(c.querySelector("table.editor tbody textarea").value, "멘토 포토샵");
  [...c.querySelectorAll(".editor-bar button")].find(b => b.textContent === "+ 추가").click();
  await flush();
  const ins = supabase.calls.filter(x => x[0] === "insert").at(-1);
  assert.equal(ins[1], "course_prep_items");
  assert.equal(ins[2].subject_id, "s1");
  assert.equal(ins[2].category, "textbook");
});

test("채용 공고: 고른 학과의 공고만, 14칸", async () => {
  const { c } = await renderPage("../js/pages/recruitment.mjs", more());
  await pick(c, "d2");
  const table = c.querySelector("table.editor");
  assert.equal(table.querySelectorAll("tbody tr").length, 1);
  assert.equal(table.querySelectorAll("thead th").length, 15);
});

test("로드맵 '+ 추가'를 두 번 눌러도 이름이 겹치지 않는다 (같은 이름 묶음은 사이트에서 합쳐져 사라짐)", async () => {
  const { c, supabase } = await renderPage("../js/pages/roadmap.mjs", more());
  const add = () => [...c.querySelectorAll(".editor-bar button")].find(b => b.textContent === "+ 추가").click();
  add(); await flush(); add(); await flush();
  const names = supabase.calls.filter(x => x[0] === "insert" && x[1] === "roadmap_tracks").map(x => x[2].name);
  assert.equal(names.length, 2);
  assert.notEqual(names[0], names[1]);
});

test("과목 삭제 경고에 강사 담당 과목 연결도 나온다", async () => {
  const tables = data();
  tables.instructor_subjects = [{ instructor_id: "i1", subject_id: "s2" }];
  const { c } = await renderPage("../js/pages/subjects.mjs", tables);
  buttons(tableOf(c, "전체수업 과목"), "삭제")[1].click();
  await flush();
  assert.equal(lastConfirm, "'웹1' 과목을(를) 삭제하면 주차 1개, 강사 담당 과목 1개도 함께 삭제됩니다. 삭제할까요?");
});
