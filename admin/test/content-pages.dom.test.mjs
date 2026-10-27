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

const otherRows = (c) => [...c.querySelectorAll(".other-subject-row")];
const otherNames = (c) => otherRows(c).map(r => r.querySelector("input").value);

test("기타 과목: 학과 없는 과목만 이름순, '수정'으로 과목명·기간 저장", async () => {
  const { c, tables } = await renderPage("../js/pages/other-subjects.mjs");
  assert.deepEqual(otherNames(c), ["웹1", "캐드"]);
  const r = otherRows(c)[1];
  buttons(r, "수정")[0].click();
  r.querySelector('[aria-label="과목명"]').value = "오토캐드";
  r.querySelector('[aria-label="기간"]').value = "2개월";
  buttons(r, "저장")[0].click();
  await flush();
  assert.deepEqual([tables.subjects.find(x => x.id === "s3").name, tables.subjects.find(x => x.id === "s3").duration], ["오토캐드", "2개월"]);
});

test("기타 과목: '단계'로 그 과목 단계만 열고, '학과에 넣기'는 학과 연결 + 전체수업 맨 뒤", async () => {
  const { c, tables } = await renderPage("../js/pages/other-subjects.mjs");
  buttons(otherRows(c)[0], "단계")[0].click();
  await flush();
  assert.deepEqual([...c.querySelectorAll(".subject-weeks .card-item")].map(x => x.querySelector(".card-side input").value), ["1주차"]);
  const r = otherRows(c)[1];
  r.querySelector('[aria-label="넣을 학과"]').value = "d2";
  buttons(r, "학과에 넣기")[0].click();
  await flush();
  assert.ok(tables.subject_departments.some(l => l.subject_id === "s3" && l.department_id === "d2"));
  assert.equal(tables.subjects.find(x => x.id === "s3").sort_order, 2);
  assert.deepEqual(otherNames(c), ["웹1"]);
});

test("기타 과목 삭제 경고에 단계·강사 담당 과목 연결이 나온다", async () => {
  const tables = data();
  tables.instructor_subjects = [{ instructor_id: "i1", subject_id: "s2" }];
  const { c } = await renderPage("../js/pages/other-subjects.mjs", tables);
  buttons(otherRows(c)[0], "삭제")[0].click();
  await flush();
  assert.equal(lastConfirm, "'웹1' 과목을(를) 삭제하면 단계 1개, 강사 담당 과목 1개도 함께 삭제됩니다. 삭제할까요?");
});

test("기타 과목 삭제는 확인창에 보여 준 개수로 DB 함수가 다시 센다(그 사이 바뀌면 안내만)", async () => {
  globalThis.confirm = (msg) => { lastConfirm = msg; return true; };
  const tables = data();
  tables.instructor_subjects = [{ instructor_id: "i1", subject_id: "s2" }];
  const { c, supabase, tables: t } = await renderPage("../js/pages/other-subjects.mjs", tables);
  const calls = [];
  supabase.rpc = async (name, args) => (calls.push([name, args]), { data: null, error: { message: "그 사이 이 과목을 쓰는 곳이 바뀌었습니다" } });
  buttons(otherRows(c)[0], "삭제")[0].click();
  await flush();
  assert.deepEqual(calls, [["comsw_delete_subjects", { p_ids: ["s2"], p_seen: 2 }]]);
  assert.match(c.textContent, /쓰는 곳이 바뀌었습니다/);
  assert.ok(t.subjects.some((x) => x.id === "s2"), "지우지 않음");
  assert.deepEqual(otherNames(c), ["웹1", "캐드"]);
});

test("신규 과목 추가: 과목명·학과를 정해 만들면 DB 함수 한 번으로 바로 학과 커리큘럼에 들어간다", async () => {
  const { c, supabase } = await renderPage("../js/pages/new-subjects.mjs");
  const calls = [];
  supabase.rpc = async (name, args) => (calls.push([name, args]), { data: "new", error: null });
  const make = buttons(c, "과목 만들기")[0];
  c.querySelector('[aria-label="과목명"]').value = "블렌더";
  make.click();
  await flush();
  assert.match(c.textContent, /학과를 하나 이상 골라주세요/);
  c.querySelector('.dept-choice input[value="d2"]').checked = true;
  const fields = [...c.querySelectorAll(".form-field > span:first-child")].map(s => s.textContent);
  assert.deepEqual(fields.slice(0, 2), ["학과", "과목명"], "학과가 먼저");
  assert.equal(c.querySelectorAll(".dept-choices > .dept-choice").length, 2, "학과마다 상자 하나");
  make.click();
  await flush();
  assert.deepEqual(calls, [["comsw_create_subject", { p_name: "블렌더", p_department_ids: ["d2"] }]]);
  assert.match(c.textContent, /학과 커리큘럼 맨 뒤에 들어갔습니다/);
  assert.equal(c.textContent.includes("승인 기다리는 과목"), false, "승인 대기 목록은 과목 관리로");
});

test("과목 관리: 학과별 보기와 정리 필요(승인 전·커리큘럼 없음), 넣기·삭제는 DB 함수로", async () => {
  const { render } = await import("../js/pages/subject-manage.mjs");
  const tables = data();
  tables.subjects.push({ id: "s4", name: "웹툰2", sort_order: null });
  tables.subject_departments.push({ subject_id: "s2", department_id: "d2" }, { subject_id: "s4", department_id: "d2" });
  const sb = fakeSupabase(tables);
  const calls = [];
  const usage = [{ subject_id: "s1", departments: 1, weeks: 2, approved: 1, pending: 0, vacation: 0, instructors: 0, materials: 0, prep: 0, roadmap: 0 },
    { subject_id: "s2", departments: 1, weeks: 0, approved: 0, pending: 0, vacation: 0, instructors: 1, materials: 0, prep: 0, roadmap: 0 }];
  sb.rpc = async (name, args) => (calls.push([name, args]), { data: name === "comsw_subject_usage" ? usage : 1, error: null });
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  await render(c, { supabase: sb });
  await flush();
  const sections = [...c.querySelectorAll(".manage-dept h3")].map(h => h.textContent);
  assert.deepEqual(sections, ["시각편집학과 · 1개", "웹학과 · 2개"]);
  assert.match(c.querySelector(".manage-dept").textContent, /포토샵학과 커리큘럼 단계 2 · 승인된 강사 커리큘럼 1/);
  assert.match(c.textContent, /웹툰2승인 전/);
  buttons(c, "정리 필요")[0].click();
  const rowsOf = () => [...c.querySelectorAll(".manage-row strong")].map(x => x.textContent);
  assert.deepEqual(rowsOf(), ["웹1", "웹툰2"], "커리큘럼 있는 포토샵·학과 없는 캐드는 빠짐");
  const [web1, webtoon] = c.querySelectorAll(".manage-row");
  assert.match(webtoon.textContent, /승인 전.*커리큘럼 없음/);
  assert.equal(buttons(web1, "학과 커리큘럼에 넣기").length, 0, "이미 들어간 과목은 넣기 없음");
  buttons(webtoon, "학과 커리큘럼에 넣기")[0].click();
  await flush();
  assert.deepEqual(calls.at(-1), ["comsw_activate_subject", { p_id: "s4" }]);
  globalThis.confirm = msg => { lastConfirm = msg; return true; };
  buttons(c.querySelectorAll(".manage-row")[0], "삭제")[0].click();
  await flush();
  globalThis.confirm = msg => { lastConfirm = msg; return false; };
  assert.equal(lastConfirm, "'웹1' 과목을(를) 삭제하면 담당 강사 연결 1개도 함께 삭제됩니다. 삭제할까요?");
  assert.deepEqual(calls.at(-1), ["comsw_delete_subjects", { p_ids: ["s2"], p_seen: 1 }]);
  assert.match(c.textContent, /'적용' 후 빠집니다/);
  buttons(c.querySelectorAll(".manage-row")[0], "삭제")[0].click();
  await flush();
  assert.equal(calls.filter(([n]) => n === "comsw_delete_subjects").length, 1, "확인창 취소면 지우지 않음");
  assert.deepEqual(rowsOf(), ["웹툰2"]);
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



const prepData = () => Object.assign(more(), {
  course_prep_items: [
    { id: "c1", subject_id: "s1", category: "textbook", content: "멘토 포토샵", sort_order: 0 },
    { id: "c2", subject_id: "s1", category: "supply", content: "이어폰", sort_order: 1 },
    { id: "c3", subject_id: "s2", category: "supply", content: "마우스", sort_order: 0 },
    { id: "c4", subject_id: "s2", category: "supply", content: "USB", sort_order: 1 },
    { id: "c5", subject_id: "s3", category: "supply", content: "삼각자", sort_order: 0, department_id: "d2" },
  ],
});
const openTab = async (c, label) => {
  [...c.querySelectorAll("[role=tab]")].find(t => t.textContent === label).click();
  await flush();
};
const shownPanel = (c) => [...c.querySelectorAll(".subpage")].find(p => !p.hidden);
const prepCards = (c) => [...shownPanel(c).querySelectorAll(".card-item")].map(x => x.querySelector("textarea").value);

const prepSubjects = (c) => [...shownPanel(c).querySelectorAll(".prep-subject")].map(s => s.dataset.subject);
const prepDepts = (c) => [...shownPanel(c).querySelectorAll(".prep-dept > h3")].map(h => h.textContent);

test("준비물: 교재 / 준비물 / AI 툴 탭, 그 분류가 있는 과목을 학과별로 묶어 모두", async () => {
  const { c } = await renderPage("../js/pages/prep.mjs", prepData());
  assert.deepEqual([...c.querySelectorAll("[role=tab]")].map(t => t.textContent), ["교재", "준비물", "AI 툴"]);
  assert.equal(c.querySelector(".picker"), null);
  assert.deepEqual(prepSubjects(c), ["포토샵"]);
  assert.deepEqual(prepCards(c), ["멘토 포토샵"]);
  await openTab(c, "준비물");
  assert.deepEqual(prepDepts(c), ["시각편집학과", "웹학과"]);
  assert.deepEqual(prepSubjects(c), ["포토샵", "웹1", "캐드"], "학과 없는 캐드도 항목에 고른 학과(웹학과) 아래");
  assert.deepEqual(prepCards(c), ["이어폰", "마우스", "USB", "삼각자"]);
  assert.equal([...shownPanel(c).querySelectorAll("button")].filter(b => b.textContent === "+ 추가").length, 1, "추가는 탭에 하나");
  assert.equal([...shownPanel(c).querySelectorAll("button")].filter(b => b.textContent === "모두 펼치기").length, 1, "모두 펼치기도 탭에 하나");
  [...shownPanel(c).querySelectorAll("button")].find(b => b.textContent === "모두 펼치기").click();
  assert.equal(shownPanel(c).querySelectorAll(".card-item.collapsed").length, 0, "모든 과목 카드가 펼쳐짐");
  await openTab(c, "AI 툴");
  assert.match(shownPanel(c).textContent, /AI 툴 항목이 있는 과목이 없습니다/);
});

test("준비물: 카드는 분류·내용·링크·정가·설명(분류 잠김), 탭의 '+ 추가'는 과목을 고르고 내용을 써서 그 분류로", async () => {
  const { c, supabase } = await renderPage("../js/pages/prep.mjs", prepData());
  const card = shownPanel(c).querySelector(".card-item");
  assert.deepEqual([...card.querySelectorAll(".card-line > span")].map(s => s.textContent).slice(0, 5), ["과목", "분류", "내용", "링크", "정가·설명"]);
  assert.equal(card.querySelector(".card-line select").selectedOptions[0].textContent, "포토샵", "과목명은 카드 안");
  assert.deepEqual([...card.querySelectorAll(".card-fields > .card-line")].map(l => l.style.gridColumn),
    ["span 2", "span 1", "span 4", "span 3", "span 2"], "카드마다 같은 칸 너비(한 줄)");
  assert.equal(shownPanel(c).querySelector(".prep-subject h4"), null);
  [...card.querySelectorAll("button")].find(b => b.textContent === "수정").click();
  assert.ok([...card.querySelectorAll(".card-line select")].every(s => s.disabled), "과목·분류는 잠김");
  assert.equal(card.querySelector("textarea").readOnly, false);
  const panel = shownPanel(c);
  [...panel.querySelectorAll("button")].find(b => b.textContent === "+ 추가").click();
  const form = panel.querySelector(".prep-add");
  assert.equal(form.hidden, false);
  assert.ok(form.querySelector('[aria-label="과목"]').disabled, "학과를 먼저");
  [...form.querySelectorAll("button")].find(b => b.textContent === "저장").click();
  await flush();
  assert.match(panel.textContent, /학과를 골라주세요/);
  const deptPick = form.querySelector('[aria-label="학과"]');
  deptPick.value = "d2";
  deptPick.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual([...form.querySelectorAll("optgroup")].map(g => [g.label, [...g.children].map(o => o.textContent)]),
    [["웹학과", ["웹1"]], ["다른 과목", ["캐드", "포토샵"]]]);
  form.querySelector('[aria-label="과목"]').value = "s2";
  form.querySelector('[aria-label="내용"]').value = "멘토 웹";
  [...form.querySelectorAll("button")].find(b => b.textContent === "저장").click();
  await flush();
  const ins = supabase.calls.filter(x => x[0] === "insert").at(-1);
  assert.equal(ins[1], "course_prep_items");
  assert.deepEqual([ins[2].subject_id, ins[2].department_id, ins[2].category, ins[2].content, ins[2].sort_order], ["s2", "d2", "textbook", "멘토 웹", 0]);
  assert.deepEqual(prepSubjects(c), ["포토샵", "웹1"], "새 과목이 학과 묶음에 나타남");
});

test("준비물: 과목의 항목을 다 지우면 그 과목은 탭에서 빠진다", async () => {
  const { c } = await renderPage("../js/pages/prep.mjs", prepData());
  await openTab(c, "준비물");
  globalThis.confirm = () => true;
  [...shownPanel(c).querySelectorAll(".prep-subject")[0].querySelectorAll("button")].find(b => b.textContent === "삭제").click();
  await flush();
  assert.deepEqual(prepSubjects(c), ["웹1", "캐드"]);
  assert.deepEqual(prepDepts(c), ["웹학과"], "과목이 없는 학과 제목도 빠짐");
  await openTab(c, "교재");
  globalThis.confirm = () => true;
  [...shownPanel(c).querySelectorAll("button")].find(b => b.textContent === "삭제").click();
  await flush();
  globalThis.confirm = msg => { lastConfirm = msg; return false; };
  assert.match(shownPanel(c).textContent, /교재 항목이 있는 과목이 없습니다/);
});

test("채용 공고: 고른 학과의 공고만, 14칸", async () => {
  const { c } = await renderPage("../js/pages/recruitment.mjs", more());
  await pick(c, "d2");
  const table = c.querySelector("table.editor");
  assert.equal(table.querySelectorAll("tbody tr").length, 1);
  assert.equal(table.querySelectorAll("thead th").length, 15);
});


const tracksOf = (c) => [...c.querySelectorAll(".roadmap-track")];
const stepTitles = (track) => [...track.querySelectorAll(".roadmap-step-head strong")].map((x) => x.textContent);
const editTrack = async (c, i) => { buttons(tracksOf(c)[i], "수정")[0].click(); await flush(); };
const drag = async (from, to) => {
  from.dispatchEvent(new dom.window.Event("dragstart", { bubbles: true }));
  to.dispatchEvent(new dom.window.Event("drop", { bubbles: true, cancelable: true }));
  from.dispatchEvent(new dom.window.Event("dragend", { bubbles: true }));
  await flush();
};

test("로드맵: 처음엔 보기(학과·이름·요약 잠김, 과목은 글자로), 단계는 번호순", async () => {
  const tables = more();
  tables.roadmap_steps[1].summary = "포토샵 역량 강화";
  const { c } = await renderPage("../js/pages/roadmap.mjs", tables);
  const [web, office] = tracksOf(c);
  assert.equal(web.querySelector('select[aria-label="학과"]').value, "d2");
  assert.ok(web.querySelector('select[aria-label="학과"]').disabled);
  assert.ok(web.querySelector('input[aria-label="로드맵 이름"]').readOnly);
  assert.equal(office.querySelector('select[aria-label="학과"]').value, "", "학과 없음");
  assert.deepEqual(stepTitles(web), ["1단계", "2단계"]);
  const first = web.querySelector(".roadmap-step");
  assert.equal(first.querySelector(".multi-view").textContent, "포토샵");
  assert.equal(first.querySelector("details"), null, "보기에서는 과목 목록 없음");
  assert.ok(first.querySelector("textarea").readOnly);
  assert.equal(first.querySelector("textarea").value, "포토샵 역량 강화");
  assert.equal(buttons(web, "+ 과목 추가").length, 0);
});

test("로드맵: '수정' 뒤 과목 목록은 고른 학과 과목만(학과 밖은 표시), 체크·요약은 '저장' 때 저장", async () => {
  const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
  await editTrack(c, 0);
  const step = tracksOf(c)[0].querySelectorAll(".roadmap-step")[1];
  assert.deepEqual([...step.querySelectorAll(".multi-option span")].map((x) => x.textContent), ["웹1"], "웹학과 과목만");
  const box = step.querySelector('.multi-option input[value="s2"]');
  box.checked = true;
  box.dispatchEvent(new dom.window.Event("change"));
  assert.equal(step.querySelector("summary").textContent, "웹1");
  const outside = tracksOf(c)[0].querySelector(".roadmap-step");
  assert.match(outside.textContent, /포토샵 \(학과 밖\)/);
  const off = outside.querySelector('.multi-option input[value="s1"]');
  off.checked = false;
  off.dispatchEvent(new dom.window.Event("change"));
  const summary = outside.querySelector("textarea");
  summary.value = "새 요약";
  summary.dispatchEvent(new dom.window.Event("input"));
  assert.ok(tables.roadmap_step_subjects.some((x) => x.step_id === "p1"), "저장 전에는 그대로");
  buttons(tracksOf(c)[0], "저장")[0].click();
  await flush();
  assert.ok(tables.roadmap_step_subjects.some((x) => x.step_id === "p2" && x.subject_id === "s2"));
  assert.ok(!tables.roadmap_step_subjects.some((x) => x.step_id === "p1"));
  assert.equal(tables.roadmap_steps.find((x) => x.id === "p1").summary, "새 요약");
  assert.equal(buttons(tracksOf(c)[0], "수정").length, 1, "저장하면 보기로");
});

test("로드맵: '취소'는 고친 것을 버리고, 학과를 바꾸면 과목 목록이 그 학과로", async () => {
  const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
  await editTrack(c, 0);
  const dept = tracksOf(c)[0].querySelector('select[aria-label="학과"]');
  dept.value = "d1";
  dept.dispatchEvent(new dom.window.Event("change"));
  await flush();
  const step = tracksOf(c)[0].querySelectorAll(".roadmap-step")[1];
  assert.deepEqual([...step.querySelectorAll(".multi-option span")].map((x) => x.textContent), ["포토샵"]);
  buttons(tracksOf(c)[0], "되돌리기")[0].click();
  await flush();
  assert.equal(tables.roadmap_tracks[0].department_id, "d2");
  assert.equal(tracksOf(c)[0].querySelector('select[aria-label="학과"]').value, "d2");
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

test("로드맵: 단계는 끌어서 좌우 순서, 줄은 끌어서 위아래 순서(점선 미리보기는 공용 dropTarget)", async () => {
  const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
  const stepsBox = () => [...tracksOf(c)[0].querySelectorAll(".roadmap-step")];
  assert.ok(stepsBox()[0].classList.contains("drop-x"), "단계는 세로 점선");
  await drag(stepsBox()[1], stepsBox()[0]);
  const pos = (id) => tables.roadmap_steps.find((x) => x.id === id).position;
  assert.deepEqual([pos("p1"), pos("p2")], [2, 1]);
  assert.equal(stepsBox()[1].querySelector(".multi-view").textContent, "포토샵");
  await drag(tracksOf(c)[1], tracksOf(c)[0]);
  assert.deepEqual(tracksOf(c).map((t) => t.querySelector('input[aria-label="로드맵 이름"]').value), ["사무 자격증", "웹학과"]);
  assert.deepEqual(stepTitles(tracksOf(c)[1]), ["1단계", "2단계"], "단계를 끌어도 줄은 안 움직임");
});

test("로드맵: 수정 중 '+ 과목 추가'는 다음 번호 단계, × 삭제는 뒤 번호를 당기고, 줄 삭제 경고에 단계 수", async () => {
  globalThis.confirm = msg => { lastConfirm = msg; return true; };
  try {
    const { c, tables } = await renderPage("../js/pages/roadmap.mjs", more());
    await editTrack(c, 0);
    buttons(tracksOf(c)[0], "+ 과목 추가")[0].click();
    await flush();
    assert.deepEqual(stepTitles(tracksOf(c)[0]), ["1단계", "2단계", "3단계"]);
    buttons(tracksOf(c)[0].querySelector(".roadmap-step"), "×")[0].click();
    await flush();
    assert.deepEqual(tables.roadmap_steps.filter((x) => x.track_id === "t1").sort((a, b) => a.position - b.position).map((x) => x.position), [1, 2]);
    assert.equal(tables.roadmap_steps.find((x) => x.id === "p2").position, 1);
    buttons(tracksOf(c)[0], "삭제")[0].click();
    await flush();
    assert.equal(lastConfirm, "'웹학과' 로드맵을(를) 삭제하면 단계 2개도 함께 삭제됩니다. 삭제할까요?");
    assert.equal(tracksOf(c).length, 1);
  } finally {
    globalThis.confirm = msg => { lastConfirm = msg; return false; };
  }
});

test("로드맵 줄 추가를 두 번 눌러도 이름이 겹치지 않고, 새 줄은 바로 수정 상태", async () => {
  const { c, supabase } = await renderPage("../js/pages/roadmap.mjs", more());
  const add = () => buttons(c, "+ 로드맵 줄 추가")[0].click();
  add(); await flush(); add(); await flush();
  const names = supabase.calls.filter(x => x[0] === "insert" && x[1] === "roadmap_tracks").map(x => x[2].name);
  assert.equal(names.length, 2);
  assert.notEqual(names[0], names[1]);
  assert.equal(buttons(tracksOf(c).at(-1), "저장").length, 1);
});
