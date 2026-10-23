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

test("학과: 카드(대표 이미지 왼쪽·내용 오른쪽, 처음엔 접힘)와 카테고리 표", async () => {
  const { c } = await renderPage("../js/pages/departments.mjs");
  assert.deepEqual(headings(c), ["학과", "카테고리"]);
  const cards = [...c.querySelectorAll(".card-item")];
  assert.equal(cards.length, 2);
  const kids = [...cards[0].children].map((x) => x.className);
  assert.deepEqual(kids, ["drag-handle", "card-stage", "card-side"], "이미지는 왼쪽");
  const labels = [...cards[0].querySelectorAll(".card-fields .card-line > span")].map((s) => s.textContent);
  assert.deepEqual(labels, ["학과명", "영문", "소개 문구"], "드라이브 폴더 ID는 숨김");
  assert.equal(cards[0].querySelector(".card-line input").value, "시각편집학과");
  assert.ok(cards.every((x) => x.classList.contains("collapsed")), "처음엔 접힘");
  buttons(cards[0], "펼치기")[0].click();
  assert.ok(!cards[0].classList.contains("collapsed"));
  assert.equal(tableOf(c, "카테고리").tagName, "TABLE");
});

test("학과 삭제 경고에 채용 공고 수", async () => {
  const { c } = await renderPage("../js/pages/departments.mjs");
  buttons(c.querySelectorAll(".card-item")[1], "삭제")[0].click();
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

test("과목: 단계 버튼으로 그 과목 단계만 연다", async () => {
  const { c } = await renderPage("../js/pages/subjects.mjs");
  buttons(tableOf(c, "전체수업 과목"), "단계")[0].click();
  await flush();
  const weeks = tableOf(c, "단계");
  assert.deepEqual([...weeks.querySelectorAll("tbody tr")].map(tr => tr.querySelector("input").value), ["1주차", "2주차"]);
});

test("과목 삭제 경고에 단계·강사 커리큘럼이 나온다", async () => {
  const { c } = await renderPage("../js/pages/subjects.mjs");
  buttons(tableOf(c, "전체수업 과목"), "삭제")[0].click();
  await flush();
  assert.equal(lastConfirm, "'포토샵' 과목을(를) 삭제하면 단계 2개, 강사 커리큘럼 1개도 함께 삭제됩니다. 삭제할까요?");
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
  subject_departments: [{ subject_id: "s1", department_id: "d1" }, { subject_id: "s2", department_id: "d2" }],
  instructors: [{ id: "i1", name: "김민주" }],
  instructor_curricula: [
    { id: "ic1", subject_id: "s1", instructor_id: "i1", step_label: "1단계", written: "포토샵 기초 원문", status: "approved", sort_order: 0 },
    { id: "ic2", subject_id: "s1", instructor_id: "i1", step_label: "2단계", written: "대기 중 원문", status: "pending", sort_order: 1 },
  ],
  course_prep_items: [{ id: "c1", subject_id: "s1", category: "textbook", content: "멘토 포토샵", sort_order: 0 }],
});
const pick = async (c, value) => {
  const select = c.querySelector(".picker select");
  select.value = value;
  select.dispatchEvent(new dom.window.Event("change"));
  await flush();
};



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

test("준비물: 과목 목록에는 준비물이 있는 과목만, 나머지는 '+ 다른 과목'에서 골라 시작", async () => {
  const { c } = await renderPage("../js/pages/prep.mjs", more());
  assert.deepEqual([...c.querySelector(".picker select").options].map(o => o.textContent), ["포토샵"]);
  const other = c.querySelector('select[aria-label="다른 과목"]');
  assert.deepEqual([...other.options].map(o => o.textContent), ["+ 다른 과목", "웹1", "캐드"]);
  other.value = "s3";
  other.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(c.querySelectorAll("table.editor tbody tr").length, 0, "캐드는 아직 준비물 없음");
});

test("채용 공고: 고른 학과의 공고만, 14칸", async () => {
  const { c } = await renderPage("../js/pages/recruitment.mjs", more());
  await pick(c, "d2");
  const table = c.querySelector("table.editor");
  assert.equal(table.querySelectorAll("tbody tr").length, 1);
  assert.equal(table.querySelectorAll("thead th").length, 15);
});


test("과목 삭제 경고에 강사 담당 과목 연결도 나온다", async () => {
  const tables = data();
  tables.instructor_subjects = [{ instructor_id: "i1", subject_id: "s2" }];
  const { c } = await renderPage("../js/pages/subjects.mjs", tables);
  buttons(tableOf(c, "전체수업 과목"), "삭제")[1].click();
  await flush();
  assert.equal(lastConfirm, "'웹1' 과목을(를) 삭제하면 단계 1개, 강사 담당 과목 1개도 함께 삭제됩니다. 삭제할까요?");
});

const tracksOf = (c) => [...c.querySelectorAll(".roadmap-track")];
const stepTitles = (track) => [...track.querySelectorAll(".roadmap-step-head strong")].map((x) => x.textContent);

test("로드맵: 줄마다 왼쪽 학과·이름, 오른쪽으로 단계 상자(번호순), 고른 과목·요약이 보인다", async () => {
  const tables = more();
  tables.roadmap_steps[1].summary = "포토샵 역량 강화";
  const { c } = await renderPage("../js/pages/roadmap.mjs", tables);
  const [web, office] = tracksOf(c);
  assert.equal(web.querySelector('select[aria-label="학과"]').value, "d2");
  assert.equal(office.querySelector('select[aria-label="학과"]').value, "", "학과 없음");
  assert.deepEqual(stepTitles(web), ["1단계", "2단계"]);
  const first = web.querySelector(".roadmap-step");
  assert.equal(first.querySelector("summary").textContent, "포토샵");
  assert.equal(first.querySelector("textarea").value, "포토샵 역량 강화");
});

test("로드맵: 과목 목록은 고른 학과의 과목만(이미 고른 학과 밖 과목은 표시), 체크하면 저장·해제하면 삭제", async () => {
  const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
  const step = tracksOf(c)[0].querySelectorAll(".roadmap-step")[1];
  const names = [...step.querySelectorAll(".multi-option span")].map((x) => x.textContent);
  assert.deepEqual(names, ["웹1"], "웹학과 과목만");
  const box = step.querySelector('.multi-option input[value="s2"]');
  box.checked = true;
  box.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.ok(tables.roadmap_step_subjects.some((x) => x.step_id === "p2" && x.subject_id === "s2"));
  assert.equal(step.querySelector("summary").textContent, "웹1");
  const outside = tracksOf(c)[0].querySelector(".roadmap-step");
  assert.match(outside.textContent, /포토샵 \(학과 밖\)/);
  const off = outside.querySelector('.multi-option input[value="s1"]');
  off.checked = false;
  off.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.ok(!tables.roadmap_step_subjects.some((x) => x.step_id === "p1"));
});

test("로드맵: '원문 보기'는 고른 과목의 승인된 커리큘럼을 모아 팝업, 바깥을 누르면 닫힌다", async () => {
  const { c } = await renderPage("../js/pages/roadmap.mjs", more());
  buttons(tracksOf(c)[0].querySelector(".roadmap-step"), "원문 보기")[0].click();
  const popup = c.querySelector("dialog.roadmap-source");
  assert.ok(popup.open);
  assert.match(popup.textContent, /포토샵[\s\S]*김민주 · 1단계[\s\S]*포토샵 기초 원문/);
  assert.doesNotMatch(popup.textContent, /대기 중 원문/, "승인된 것만");
  popup.querySelector("p").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  assert.ok(popup.open, "안쪽을 누르면 그대로");
  popup.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  assert.ok(!popup.open);
});

test("로드맵: 요약을 고치면 저장, '+ 과목 추가'는 다음 번호 단계, ◀ ▶는 단계 자리를 바꾼다", async () => {
  const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
  const summary = tracksOf(c)[0].querySelector(".roadmap-step textarea");
  summary.value = "새 요약";
  summary.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(tables.roadmap_steps.find((x) => x.id === "p1").summary, "새 요약");
  buttons(tracksOf(c)[0], "+ 과목 추가")[0].click();
  await flush();
  assert.deepEqual(stepTitles(tracksOf(c)[0]), ["1단계", "2단계", "3단계"]);
  buttons(tracksOf(c)[0].querySelector(".roadmap-step"), "▶")[0].click();
  await flush();
  const pos = (id) => tables.roadmap_steps.find((x) => x.id === id).position;
  assert.deepEqual([pos("p1"), pos("p2")], [2, 1]);
  assert.equal(tracksOf(c)[0].querySelectorAll(".roadmap-step")[1].querySelector("summary").textContent, "포토샵");
});

test("로드맵: 단계 삭제는 뒤 단계 번호를 당기고, ▲ ▼는 줄 순서, 줄 삭제 경고에 단계 수", async () => {
  globalThis.confirm = msg => { lastConfirm = msg; return true; };
  try {
    const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
    buttons(tracksOf(c)[0].querySelector(".roadmap-step"), "×")[0].click();
    await flush();
    assert.deepEqual(tables.roadmap_steps.filter((x) => x.track_id === "t1").map((x) => [x.id, x.position]), [["p2", 1]]);
    buttons(tracksOf(c)[1], "▲")[0].click();
    await flush();
    assert.deepEqual(tracksOf(c).map((t) => t.querySelector('input[aria-label="로드맵 이름"]').value), ["사무 자격증", "웹학과"]);
    buttons(tracksOf(c)[1], "삭제")[0].click();
    await flush();
    assert.equal(lastConfirm, "'웹학과' 로드맵을(를) 삭제하면 단계 1개도 함께 삭제됩니다. 삭제할까요?");
    assert.equal(tracksOf(c).length, 1);
  } finally {
    globalThis.confirm = msg => { lastConfirm = msg; return false; };
  }
});

test("로드맵 줄 추가를 두 번 눌러도 이름이 겹치지 않는다 (같은 이름 묶음은 사이트에서 합쳐져 사라짐)", async () => {
  const { c, supabase } = await renderPage("../js/pages/roadmap.mjs", more());
  const add = () => buttons(c, "+ 로드맵 줄 추가")[0].click();
  add(); await flush(); add(); await flush();
  const names = supabase.calls.filter(x => x[0] === "insert" && x[1] === "roadmap_tracks").map(x => x[2].name);
  assert.equal(names.length, 2);
  assert.notEqual(names[0], names[1]);
});
