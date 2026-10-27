import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";
import { configureServices } from "../js/services.mjs";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
globalThis.File = dom.window.File;
globalThis.confirm = () => true;
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
const button = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);

const data = () => ({
  departments: [{ id: "d1", name: "시각편집학과", sort_order: 0 }, { id: "d2", name: "웹학과", sort_order: 1 }],
  subjects: [
    { id: "s1", name: "포토샵", sort_order: 0, dept_curriculum: "01 포토샵 기초\n02 합성" },
    { id: "s2", name: "일러스트", sort_order: 1, dept_curriculum: "01 벡터" },
    { id: "s3", name: "웹1", sort_order: 2 },
  ],
  subject_departments: [{ subject_id: "s1", department_id: "d1" }, { subject_id: "s2", department_id: "d1" }, { subject_id: "s3", department_id: "d2" }],
  subject_weeks: [{ id: "w1", subject_id: "s1", week_label: "1단계", summary: "인터페이스와 레이어", sort_order: 0 }],
  instructors: [{ id: "i1", name: "김민주" }, { id: "i2", name: "조해리" }],
  curriculum_sets: [{ id: "set1", name: "시각편집학과", department_id: "d1" }],
  instructor_curricula: [
    { id: "c1", instructor_id: "i1", subject_id: "s1", set_id: "set1", step_label: "1단계", written: "포토샵 기초 원문", status: "pending", sort_order: 0, media_url: "https://img.example/a.webp" },
    { id: "c2", instructor_id: "i1", subject_id: "s1", set_id: "set1", step_label: "2단계", written: "합성 원문", status: "pending", sort_order: 1 },
    { id: "c3", instructor_id: "i2", subject_id: "s2", set_id: "set1", step_label: "1단계", written: "일러 원문", status: "pending", sort_order: 2 },
    { id: "c4", instructor_id: "i2", subject_id: "s2", set_id: "set1", step_label: "1단계", written: "승인된 것", status: "approved", sort_order: 3 },
  ],
  roadmap_tracks: [{ id: "t1", name: "디자인 로드맵" }],
  roadmap_steps: [{ id: "rs1", track_id: "t1", position: 1, source_text: "디자인 첫걸음", summary: "툴 기초\n편집" }],
  roadmap_step_subjects: [{ step_id: "rs1", subject_id: "s1" }],
});

test("메뉴 묶음: 제목·하위 탭, 첫 탭만 그리고 다른 탭은 처음 열 때 그린다", async () => {
  const { subpages } = await import("../js/subpages.mjs");
  const drawn = [];
  const render = subpages("기본 설정", [
    ["a", "메인 화면", async () => ({ render: (c) => { drawn.push("a"); c.append("메인"); } })],
    ["b", "로딩 화면", async () => ({ render: (c) => { drawn.push("b"); c.append("로딩"); } })],
  ]);
  const c = document.createElement("div");
  await render(c, {});
  assert.equal(c.querySelector(".page-head h2").textContent, "기본 설정");
  assert.deepEqual([...c.querySelectorAll(".tab-bar button")].map((b) => b.textContent), ["메인 화면", "로딩 화면"]);
  assert.deepEqual(drawn, ["a"]);
  button(c, "로딩 화면").click();
  await flush();
  assert.deepEqual(drawn, ["a", "b"]);
  button(c, "메인 화면").click();
  await flush();
  assert.deepEqual(drawn, ["a", "b"], "한 번 그린 탭은 다시 그리지 않는다");
});

test("학과별 과목: 왼쪽은 학과 과목(순서대로), 오른쪽은 다른 과목(검색), 추가·빼기는 '저장'을 눌러야 연결표에 저장", async () => {
  const { render } = await import("../js/pages/department-subjects.mjs");
  const tables = data();
  tables.subjects.push({ id: "s4", name: "새과목", sort_order: null });
  tables.subject_departments.push({ subject_id: "s4", department_id: "d2" });
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const [left, right] = c.querySelectorAll(".dept-subject-list");
  const names = (box) => [...box.querySelectorAll(".dept-subject-row > span:not(.drag-handle)")].map((s) => s.textContent).filter(Boolean);
  assert.deepEqual(names(left), ["포토샵", "일러스트"]);
  assert.deepEqual(names(right), ["웹1"], "승인 전 신규 과목은 오른쪽에 없음");
  const dept = c.querySelector('select[aria-label="학과"]');
  dept.value = "d2";
  dept.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(names(left), ["웹1", "새과목 (승인 전 신규 과목)"]);
  const search = c.querySelector('input[aria-label="과목 검색"]');
  search.value = "포토";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.deepEqual(names(right), ["포토샵"]);
  button(right, "추가").click();
  await flush();
  assert.deepEqual(names(left).slice(0, 2), ["포토샵", "웹1"], "전체수업 순서대로");
  assert.ok(!tables.subject_departments.some((l) => l.subject_id === "s1" && l.department_id === "d2"), "저장 전에는 DB 그대로");
  assert.match(c.textContent, /저장 안 된 변경 1개/);
  button(c, "저장").click();
  await flush();
  assert.ok(tables.subject_departments.some((l) => l.subject_id === "s1" && l.department_id === "d2"));
  button(left.querySelector(".dept-subject-row"), "빼기").click();
  button(c, "되돌리기").click();
  assert.deepEqual(names(left).slice(0, 2), ["포토샵", "웹1"], "되돌리면 다시 보임");
  button(left.querySelector(".dept-subject-row"), "빼기").click();
  button(c, "저장").click();
  await flush();
  assert.ok(!tables.subject_departments.some((l) => l.subject_id === "s1" && l.department_id === "d2"));
});

test("학과별 과목: ⠿로 끈 순서를 저장하면 학과 커리큘럼과 같은 순서 값(전체수업 순서)이 바뀐다", async () => {
  const { render } = await import("../js/pages/department-subjects.mjs");
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const rows = () => [...c.querySelectorAll(".dept-subject-list")[0].querySelectorAll(".dept-subject-row")];
  rows()[1].querySelector(".drag-handle").dispatchEvent(new dom.window.Event("pointerdown"));
  rows()[1].dispatchEvent(new dom.window.Event("dragstart"));
  rows()[0].dispatchEvent(new dom.window.Event("drop", { cancelable: true }));
  await flush();
  assert.equal(tables.subjects.find((s) => s.id === "s2").sort_order, 1, "저장 전에는 그대로");
  button(c, "저장").click();
  await flush();
  assert.equal(tables.subjects.find((s) => s.id === "s2").sort_order, 0);
  assert.equal(tables.subjects.find((s) => s.id === "s1").sort_order, 1);
  assert.equal(tables.subjects.find((s) => s.id === "s3").sort_order, 2, "다른 학과 과목은 그대로");
});

test("신청 과목: '수정'·'학과 커리큘럼 생성'·'로드맵 문구 생성'은 박스 맨 아래가 아니라 제목 옆", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(data()), services: async () => ({}) });
  await flush();
  const titleOf = (text) => [...c.querySelectorAll("button")].find((b) => b.textContent === text)?.parentElement;
  assert.equal(titleOf("수정").className, "request-title");
  assert.equal(titleOf("학과 커리큘럼 생성").className, "box-title");
  for (const b of [...c.querySelectorAll("button")].filter((b) => b.textContent === "로드맵 문구 생성")) {
    assert.equal(b.parentElement.className, "box-title");
  }
  assert.equal(c.querySelector(".request-section > .form-actions"), null);
});

test("신청 과목: 강사·과목별 묶음, 강사명/과목명/단계/커리큘럼/이미지 순, 수정 → AI 요약 → 저장(승인)", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  const sb = fakeSupabase(tables);
  const rpcs = [];
  sb.rpc = async (name, args) => { rpcs.push([name, args]); return { data: null, error: null }; };
  const asked = [];
  configureServices({ summarize: async (kind, text) => { asked.push([kind, text]); return { text: `${kind} 결과` }; } });
  const c = document.createElement("div");
  await render(c, { supabase: sb });
  assert.deepEqual([...c.querySelectorAll(".subject-tabs button")].map((b) => b.textContent), ["김민주 · 포토샵 (2단계)", "조해리 · 일러스트 (1단계)"]);
  assert.deepEqual([...c.querySelectorAll(".request-head span")].map((s) => s.textContent), ["강사명", "과목명", "단계", "커리큘럼", "이미지"]);
  const rowsEl = [...c.querySelectorAll(".request-row:not(.request-head)")];
  assert.equal(rowsEl.length, 2);
  assert.equal(rowsEl[0].children[0].textContent, "김민주");
  assert.ok(rowsEl[0].querySelector("textarea").readOnly);
  button(c, "수정").click();
  button(rowsEl[0], "AI 요약").click();
  await flush();
  assert.equal(rowsEl[0].querySelectorAll("textarea")[1].value, "week 결과");
  rowsEl[1].querySelector("textarea").value = "합성 원문 다듬음";
  rowsEl[1].querySelectorAll("textarea")[1].value = "합성 요약";
  button(c, "저장").click();
  await flush();
  assert.equal(tables.instructor_curricula.find((r) => r.id === "c1").summary, "week 결과");
  assert.equal(tables.instructor_curricula.find((r) => r.id === "c2").written, "합성 원문 다듬음");
  assert.deepEqual(rpcs.map(([n, a]) => [n, a.p_id]), [["comsw_approve_curriculum", "c1"], ["comsw_approve_curriculum", "c2"]]);
  assert.match(c.textContent, /승인됨/);
});

test("신청 과목: 사이트 문구(요약)가 비어 있으면 '저장' 대신 팝업 — [AI생성]은 빈 칸을 AI로 채우고, [직접 작성]은 그 칸에 커서", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  const sb = fakeSupabase(tables);
  const rpcs = [];
  sb.rpc = async (name, args) => { rpcs.push([name, args]); return { data: null, error: null }; };
  const asked = [];
  configureServices({ summarize: async (kind, text) => { asked.push(text); return { text: `${text} 요약` }; } });
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  await render(c, { supabase: sb });
  const rowsEl = [...c.querySelectorAll(".request-row:not(.request-head)")];
  const summaryOf = (i) => rowsEl[i].querySelectorAll("textarea")[1];
  button(c, "수정").click();
  summaryOf(0).value = "직접 쓴 요약";
  button(c, "저장").click();
  await flush();
  const dialog = () => document.querySelector("dialog.summary-dialog");
  assert.ok(dialog(), "빈 문구가 있으면 팝업");
  assert.match(dialog().textContent, /2단계 문구가 비어 있습니다\. AI생성 또는 직접 작성을 진행해주세요/);
  assert.deepEqual(rpcs, [], "저장(승인)하지 않음");
  assert.equal(tables.instructor_curricula.find((r) => r.id === "c2").summary, undefined);

  button(dialog(), "직접 작성").click();
  assert.equal(dialog(), null, "팝업 닫힘");
  assert.equal(document.activeElement, summaryOf(1), "빈 칸에 커서");

  button(c, "저장").click();
  await flush();
  button(dialog(), "AI생성").click();
  await flush();
  assert.equal(dialog(), null);
  assert.deepEqual(asked, ["합성 원문"], "빈 칸만 AI로");
  assert.equal(summaryOf(1).value, "합성 원문 요약");
  assert.equal(summaryOf(0).value, "직접 쓴 요약", "이미 쓴 칸은 그대로");
  assert.deepEqual(rpcs, [], "AI생성 뒤에도 확인하고 '저장'을 눌러야 승인");
  button(c, "저장").click();
  await flush();
  assert.deepEqual(rpcs.map(([n, a]) => [n, a.p_id]), [["comsw_approve_curriculum", "c1"], ["comsw_approve_curriculum", "c2"]]);
});

test("신청 과목: 학과 커리큘럼·로드맵 문구를 AI로 신규 칸에 만들고, 적용하면 실제로 반영", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  const asked = [];
  configureServices({ summarize: async (kind, text) => { asked.push([kind, text]); return { text: `${kind} 신규` }; } });
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  button(c, "학과 커리큘럼 생성").click();
  await flush();
  const [dept, roadmap] = [...c.querySelectorAll(".request-section")].slice(1);
  assert.equal(dept.querySelectorAll("textarea")[0].value, "01 포토샵 기초\n02 합성", "현재");
  assert.equal(dept.querySelectorAll("textarea")[1].value, "department 신규");
  assert.match(asked[0][1], /지금 학과 커리큘럼[\s\S]*김민주 선생님 신청 커리큘럼[\s\S]*포토샵 기초 원문/);
  assert.equal(roadmap.querySelector("h4").textContent, "디자인 로드맵 · 1단계 · 포토샵");
  button(roadmap, "로드맵 문구 생성").click();
  await flush();
  assert.equal(roadmap.querySelectorAll("textarea")[1].value, "roadmap 신규");
  button(c, "적용").click();
  await flush();
  assert.equal(tables.subjects.find((s) => s.id === "s1").dept_curriculum, "department 신규");
  assert.equal(tables.roadmap_steps[0].summary, "roadmap 신규");
  assert.equal(dept.querySelectorAll("textarea")[0].value, "department 신규", "현재 칸도 새 문구로");
});

test("신청 과목: '다시 자르기'는 원본은 두고 썸네일 영역만 다시 고르며, 드라이브 이미지는 안내만(새로 올리기·다듬기 버튼 없음)", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  let asked = null;
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables), crop: async (url) => { asked = url; return "#crop=0.2,0,0.6,1"; } });
  button(c, "수정").click();
  const row = c.querySelectorAll(".request-row:not(.request-head)")[0];
  button(row, "다시 자르기").click();
  await flush();
  assert.equal(asked, "https://img.example/a.webp");
  const img = row.querySelector(".submission-thumb img");
  assert.equal(img.getAttribute("src"), "https://img.example/a.webp#crop=0.2,0,0.6,1");
  assert.ok(img.classList.contains("thumb-cropped"), "썸네일은 고른 영역만");
  tables.instructor_curricula[0].media_url = "https://drive.google.com/file/d/x/view";
  const c2 = document.createElement("div");
  await render(c2, { supabase: fakeSupabase(tables) });
  button(c2, "수정").click();
  button(c2.querySelectorAll(".request-row:not(.request-head)")[0], "다시 자르기").click();
  await flush();
  assert.match(c2.textContent, /다시 자를 수 없습니다/);
  assert.equal(button(c2, "새로 올리기"), undefined);
  assert.equal(button(c2, "커리큘럼 다듬기"), undefined);
});

test("학과 커리큘럼: 요약은 보기만, '수정'은 과목명·기간·프로그램·준비물(따로)·학습 수준(별 다섯 단계), AI 생성 버튼 없음", async () => {
  const { render, LEVELS } = await import("../js/pages/department-curriculum.mjs");
  const tables = data();
  tables.subjects[0].level = "★★★☆☆";
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  assert.deepEqual([...c.querySelectorAll(".dept-curriculum-head span")].map((s) => s.textContent).filter(Boolean),
    ["과목명", "기간", "학과별 커리큘럼 요약", "프로그램", "준비물", "학습 수준"]);
  const items = [...c.querySelectorAll(".dept-curriculum-row:not(.dept-curriculum-head)")];
  assert.deepEqual(items.map((i) => i.querySelector(".cell-name input").value), ["포토샵", "일러스트"]);
  assert.equal(button(c, "AI 생성"), undefined);
  const level = items[0].querySelector(".cell-level select");
  assert.deepEqual([...level.options].map((o) => o.value), ["", ...LEVELS]);
  assert.equal(level.value, "★★★☆☆");
  button(items[0], "수정").click();
  assert.equal(items[0].querySelector(".cell-name input").readOnly, false, "과목명도 고친다");
  const type = (sel, value) => {
    const input = items[0].querySelector(sel);
    input.value = value;
    input.dispatchEvent(new dom.window.Event(input.tagName === "SELECT" ? "change" : "input"));
  };
  type(".cell-name input", "포토샵 기초");
  type(".cell-duration input", "3개월");
  assert.ok(items[0].querySelector(".cell-dept_curriculum textarea").readOnly, "요약은 고정");
  type(".cell-tools textarea", "포토샵 2024");
  type(".cell-supplies textarea", "멘토시리즈 포토샵");
  type(".cell-level select", "★★★★★");
  assert.equal(tables.subjects[0].name, "포토샵", "저장 전에는 DB 그대로");
  assert.match(c.textContent, /저장 안 된 변경 1개/);
  button(c.querySelector(".editor-bar"), "저장").click();
  await flush();
  assert.equal(tables.subjects[0].tools, "포토샵 2024");
  assert.equal(tables.subjects[0].supplies, "멘토시리즈 포토샵");
  assert.equal(tables.subjects[0].level, "★★★★★");
  assert.equal(tables.subjects[0].name, "포토샵 기초");
  assert.equal(tables.subjects[0].duration, "3개월");
  assert.equal(tables.subjects[0].dept_curriculum, "01 포토샵 기초\n02 합성");
});

test("학과 커리큘럼 순서: 학과 과목만 옮기고 다른 학과 과목 자리와 순서 없는 과목은 그대로", async () => {
  const { deptReorderUpdates } = await import("../js/pages/department-curriculum.mjs");
  const subjects = [
    { id: "a", sort_order: 0 }, { id: "x", sort_order: 1 }, { id: "b", sort_order: 2 }, { id: "c", sort_order: 3 }, { id: "z", sort_order: null },
  ];
  assert.deepEqual(deptReorderUpdates(subjects, ["a", "b", "c"], 2, 0), [{ id: "c", sort_order: 0 }, { id: "a", sort_order: 2 }, { id: "b", sort_order: 3 }]);
  assert.deepEqual(deptReorderUpdates(subjects, ["a", "b", "c"], 1, 1), []);
});

test("학과 커리큘럼: ⠿로 끌어 놓으면 순서를 저장하고, 승인 전 신규 과목(순서 없음)은 보이지 않는다", async () => {
  const { render } = await import("../js/pages/department-curriculum.mjs");
  const tables = data();
  tables.subjects.push({ id: "s4", name: "기타과목", sort_order: null });
  tables.subject_departments.push({ subject_id: "s4", department_id: "d1" });
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const items = () => [...c.querySelectorAll(".dept-curriculum-row:not(.dept-curriculum-head)")];
  assert.equal(items().length, 2);
  assert.ok(![...c.querySelector('select[aria-label="추가할 과목"]').options].some((o) => o.value === "s4"), "추가 목록에도 없음");
  items()[1].querySelector(".drag-handle").dispatchEvent(new dom.window.Event("pointerdown"));
  items()[1].dispatchEvent(new dom.window.Event("dragstart"));
  items()[0].dispatchEvent(new dom.window.Event("drop", { cancelable: true }));
  await flush();
  assert.deepEqual(items().map((i) => i.querySelector(".cell-name input").value), ["일러스트", "포토샵"]);
  assert.equal(tables.subjects.find((s) => s.id === "s2").sort_order, 1, "저장 전에는 그대로");
  button(c.querySelector(".editor-bar"), "저장").click();
  await flush();
  assert.equal(tables.subjects.find((s) => s.id === "s2").sort_order, 0);
});

test("학과 커리큘럼 탭은 열 때마다 새로 그린다(신청 과목에서 적용한 문구가 바로 보이게)", async () => {
  const { subpages } = await import("../js/subpages.mjs");
  let n = 0;
  const render = subpages("커리큘럼 관리", [
    ["a", "신청 과목", async () => ({ render: () => {} })],
    ["b", "학과 커리큘럼", async () => ({ render: (p) => p.append(`그림${++n}`) }), { fresh: true }],
  ]);
  const c = document.createElement("div");
  await render(c, {});
  for (let i = 0; i < 2; i++) {
    button(c, "학과 커리큘럼").click();
    await flush();
    button(c, "신청 과목").click();
  }
  assert.equal(n, 2);
  assert.equal(c.querySelectorAll(".subpage")[1].textContent, "그림2");
});

test("로드맵: 두 과목이 묶인 단계는 신청 과목의 줄만 보여 주고, 생성·적용도 그 줄만 바꾼다", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  tables.roadmap_steps[0].summary = "포토샵 역량 강화\n일러스트 역량 강화";
  tables.roadmap_step_subjects = [
    { step_id: "rs1", subject_id: "s2", sort_order: 1 },
    { step_id: "rs1", subject_id: "s1", sort_order: 0 },
  ];
  configureServices({ summarize: async () => ({ text: "포토샵 실무 완성\n두 번째 줄" }) });
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const roadmap = [...c.querySelectorAll(".request-section")][2];
  assert.equal(roadmap.querySelector("h4").textContent, "디자인 로드맵 · 1단계 · 포토샵");
  const [now, next] = roadmap.querySelectorAll("textarea");
  assert.equal(now.value, "포토샵 역량 강화", "현재는 이 과목 줄만");
  assert.match(roadmap.textContent, /그대로 유지[\s\S]*일러스트: 일러스트 역량 강화/);
  button(roadmap, "로드맵 문구 생성").click();
  await flush();
  assert.equal(next.value, "포토샵 실무 완성", "이 과목 몫인 한 줄만");
  button(c, "적용").click();
  await flush();
  assert.equal(tables.roadmap_steps[0].summary, "포토샵 실무 완성\n일러스트 역량 강화", "다른 과목 줄은 그대로");
  assert.equal(now.value, "포토샵 실무 완성");
});

test("학과 커리큘럼: '+ 과목 추가'는 다른 과목을 이 학과에 넣고(전체 수업 맨 뒤), '제외'는 연결만 뺀다", async () => {
  const { render } = await import("../js/pages/department-curriculum.mjs");
  const tables = data();
  tables.subjects.push({ id: "s9", name: "인디자인", sort_order: null });
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const names = () => [...c.querySelectorAll(".dept-curriculum-row:not(.dept-curriculum-head) .cell-name input")].map((i) => i.value);
  const pick = c.querySelector('select[aria-label="추가할 과목"]');
  assert.ok(![...pick.options].some((o) => o.textContent === "포토샵"), "이미 든 과목은 목록에 없음");
  pick.value = "s9";
  button(c, "+ 과목 추가").click();
  await flush();
  assert.ok(!tables.subject_departments.some((l) => l.subject_id === "s9"), "저장 전에는 DB 그대로");
  button(c.querySelector(".editor-bar"), "저장").click();
  await flush();
  assert.ok(tables.subject_departments.some((l) => l.subject_id === "s9" && l.department_id === "d1"));
  assert.ok(tables.subjects.find((s) => s.id === "s9").sort_order > 1);
  assert.deepEqual(names(), ["포토샵", "일러스트", "인디자인"]);
  const row = [...c.querySelectorAll(".dept-curriculum-row")].find((r) => r.querySelector(".cell-name input")?.value === "포토샵");
  button(row, "제외").click();
  await flush();
  assert.deepEqual(names(), ["일러스트", "인디자인"]);
  assert.match(c.textContent, /'기타 과목'으로 옮겨집니다/, "마지막 학과에서 빼면 기타 과목으로");
  button(c.querySelector(".editor-bar"), "되돌리기").click();
  assert.deepEqual(names(), ["포토샵", "일러스트", "인디자인"], "되돌리기 = 마지막 저장 상태");
  button([...c.querySelectorAll(".dept-curriculum-row")].find((r) => r.querySelector(".cell-name input")?.value === "포토샵"), "제외").click();
  button(c.querySelector(".editor-bar"), "저장").click();
  await flush();
  assert.ok(tables.subjects.some((s) => s.id === "s1"), "과목은 그대로");
  assert.ok(!tables.subject_departments.some((l) => l.subject_id === "s1" && l.department_id === "d1"));
});

test("학과 커리큘럼: '단계'는 그 과목 단계를 카드(대표 이미지 왼쪽)로 열고, 수정 중에만 AI 요약", async () => {
  const { render } = await import("../js/pages/department-curriculum.mjs");
  const tables = data();
  tables.subject_weeks = [{ id: "w1", subject_id: "s1", week_label: "1단계", written: "포토샵 원문", sort_order: 0 }, { id: "w2", subject_id: "s2", week_label: "1단계", sort_order: 0 }];
  configureServices({ summarize: async (kind, text) => ({ text: `${kind}:${text}` }) });
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  button(c.querySelector(".dept-curriculum-row:not(.dept-curriculum-head)"), "단계").click();
  await flush();
  const weeks = c.querySelector(".subject-weeks");
  assert.match(weeks.querySelector("h3").textContent, /단계 — 포토샵/);
  const cards = [...weeks.querySelectorAll(".card-item")];
  assert.equal(cards.length, 1);
  assert.deepEqual([...cards[0].children].map((x) => x.className.split(" ")[0]), ["drag-handle", "card-stage", "card-side"]);
  const ai = button(cards[0], "AI 요약");
  assert.ok(ai.hidden, "보기 중에는 AI 요약 숨김");
  button(cards[0], "수정").click();
  assert.equal(ai.hidden, false);
  ai.click();
  await flush();
  button(cards[0], "저장").click();
  await flush();
  assert.equal(tables.subject_weeks[0].summary, "week:포토샵 원문");
});

test("학과 커리큘럼: '단계' 편집기는 그 과목 단계만", async () => {
  const { render } = await import("../js/pages/department-curriculum.mjs");
  const tables = data();
  tables.subject_weeks = [{ id: "w1", subject_id: "s1", week_label: "1단계", sort_order: 0 }, { id: "w2", subject_id: "s2", week_label: "1단계", sort_order: 0 }];
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  button(c.querySelector(".dept-curriculum-row:not(.dept-curriculum-head)"), "단계").click();
  await flush();
  const weeks = c.querySelector(".subject-weeks");
  assert.match(weeks.querySelector("h3").textContent, /단계 — 포토샵/);
  assert.equal(weeks.querySelectorAll(".card-item").length, 1);
});

test("신청 과목: 선생님이 적은 프로그램·준비물을 신청 내용 아래에 보여 준다", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  tables.instructor_subject_materials = [{ instructor_id: "i1", subject_id: "s1", tools: "Lightroom", supplies: "이어폰" }];
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  assert.match(c.querySelector(".request-materials").textContent, /프로그램: Lightroom · 준비물: 이어폰/);
});

test("신청 과목: '+ 개월 추가'는 다음 달 과목에 빈 1단계 신청을 만들고, '이 개월 빼기'는 이 묶음 신청을 지운다", async () => {
  const { render } = await import("../js/pages/curriculum-requests.mjs");
  const tables = data();
  tables.subjects.push({ id: "w1", name: "웹툰1", sort_order: 5 });
  tables.instructor_curricula = [
    { id: "p1", instructor_id: "i1", subject_id: "w1", set_id: "set1", step_label: "1단계", written: "웹툰1 원문", status: "pending", sort_order: 0 },
  ];
  const sb = fakeSupabase(tables);
  const rpcs = [];
  sb.rpc = async (name, args) => {
    rpcs.push([name, args]);
    if (name === "comsw_add_month_request") {
      tables.subjects.push({ id: "w2", name: args.p_name });
      tables.instructor_curricula.push({ id: "p2", instructor_id: args.p_instructor_id, subject_id: "w2", set_id: args.p_set_id, step_label: "1단계", written: "", status: "pending", sort_order: 1 });
      return { data: "w2", error: null };
    }
    if (name === "comsw_drop_requests") {
      tables.instructor_curricula = tables.instructor_curricula.filter((r) => !args.p_ids.includes(r.id));
      return { data: args.p_ids.length, error: null };
    }
    return { data: null, error: null };
  };
  globalThis.confirm = () => true;
  const c = document.createElement("div");
  await render(c, { supabase: sb });
  button(c, "+ 개월 추가").click();
  await flush();
  assert.deepEqual(rpcs[0], ["comsw_add_month_request", { p_from: "w1", p_name: "웹툰2", p_set_id: "set1", p_instructor_id: "i1" }]);
  const made = tables.instructor_curricula.find((r) => r.subject_id === "w2");
  assert.deepEqual([made.instructor_id, made.set_id, made.step_label, made.status], ["i1", "set1", "1단계", "pending"]);
  assert.match(c.querySelector(".subject-tabs button.active").textContent, /웹툰2/, "새 달 묶음이 열림");
  button(c, "이 개월 빼기").click();
  await flush();
  assert.equal(tables.instructor_curricula.some((r) => r.subject_id === "w2"), false);
  assert.match(c.querySelector(".subject-tabs button.active").textContent, /웹툰1/);
});

test("학과 커리큘럼 저장이 실패하면 아무것도 안 바뀌고 고침은 남아, 다시 저장하면 한 번에 들어간다", async () => {
  const { render } = await import("../js/pages/department-curriculum.mjs");
  const tables = data();
  tables.subjects.push({ id: "s9", name: "인디자인", sort_order: null });
  const sb = fakeSupabase(tables);
  const real = sb.rpc;
  let fail = true;
  sb.rpc = async (name, args) => (fail ? { data: null, error: { code: "23505", message: "duplicate" } } : real(name, args));
  const c = document.createElement("div");
  await render(c, { supabase: sb });
  const pick = c.querySelector('select[aria-label="추가할 과목"]');
  pick.value = "s9";
  button(c, "+ 과목 추가").click();
  button(c.querySelector(".editor-bar"), "저장").click();
  await flush();
  assert.match(c.textContent, /아무것도 저장되지 않았습니다/);
  assert.ok(!tables.subject_departments.some((l) => l.subject_id === "s9"));
  assert.match(c.textContent, /저장 안 된 변경 2개/, "고침(연결·순서)은 남아 있다");
  fail = false;
  button(c.querySelector(".editor-bar"), "저장").click();
  await flush();
  assert.ok(tables.subject_departments.some((l) => l.subject_id === "s9" && l.department_id === "d1"));
  assert.match(c.textContent, /저장했습니다/);
});
