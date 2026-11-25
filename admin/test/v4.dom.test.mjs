// V4(admin-v4/) 1단계: 규칙(기준 과목·4단계·학과 순서), 역할별 메뉴, 화면이 실제 자료(가짜 DB)를 읽어 그리는지.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body><main id=content></main></body>", { url: "http://localhost/admin-v4/" });
Object.assign(globalThis, { document: dom.window.document, Node: dom.window.Node, location: dom.window.location });
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

const rules = await import("../../admin-v4/js/rules.mjs");
const { menusFor } = await import("../../admin-v4/js/menus.mjs");
const data = await import("../../admin-v4/js/data.mjs");
const changes = await import("../../admin-v4/js/changes.mjs");
globalThis.confirm = () => true;
// 떠 있는 창(바뀐 설정) 버튼, 입력하기
const barBtn = (label) => [...document.querySelectorAll(".change-bar button")].find((b) => b.textContent === label);
const type = (el, v) => { el.value = v; el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); };

test("기준 과목: 끝 숫자(개월)만 뗀다", () => {
  assert.equal(rules.baseName("캐드1"), "캐드");
  assert.equal(rules.baseName("라이노 2"), "라이노");
  assert.equal(rules.baseName("AI웹툰6"), "AI웹툰");
  assert.equal(rules.baseName("3D맥스"), "3D맥스");
  assert.equal(rules.baseName("캐드"), "캐드");
  assert.equal(rules.baseName("디지털 드로잉 1~2"), "디지털 드로잉", "끝 범위도 뗀다");
  assert.equal(rules.baseName("캐드1~2"), "캐드");
});

test("단계 상태: 4단계만 정상, 6단계는 '4단계로 다시 정리 필요'(자르지 않음)", () => {
  assert.equal(rules.stepState(4).ok, true);
  assert.match(rules.stepState(6).label, /6단계 · 4단계로 다시 정리 필요/);
  assert.equal(rules.stepState(0).label, "단계 없음");
});

test("학과 순서: 학과별 순서가 있으면 그것, 없으면 과목 순서", () => {
  const subjects = [{ id: "a", name: "가", sort_order: 1 }, { id: "b", name: "나", sort_order: 2 }];
  assert.deepEqual(rules.deptOrder([{ subject_id: "a" }, { subject_id: "b" }], subjects).map((s) => s.id), ["a", "b"]);
  assert.deepEqual(rules.deptOrder([{ subject_id: "a", sort_order: 5 }, { subject_id: "b", sort_order: 0 }], subjects).map((s) => s.id), ["b", "a"]);
});

test("메뉴: 관리 8개 + 강사 2개, 선생님은 강사 2개만", () => {
  const ids = (role) => menusFor(role).flatMap(([, l]) => l.map(([id]) => id));
  assert.deepEqual(ids("head"), ["instructors", "courses", "roadmap", "vacation", "prep", "seminars", "site", "usage", "mine", "profile"]);
  assert.deepEqual(ids("teacher"), ["mine", "profile"]);
  assert.deepEqual(ids("guest"), []);
});

const db = () => fakeSupabase({
  departments: [{ id: "d1", name: "건축학과", sort_order: 0 }, { id: "d2", name: "시각학과", sort_order: 1 }],
  subjects: [{ id: "s1", name: "캐드1", sort_order: 0 }, { id: "s2", name: "캐드2", sort_order: 1 }, { id: "s3", name: "아트 드로잉", sort_order: 2 }],
  subject_departments: [{ subject_id: "s1", department_id: "d1" }, { subject_id: "s2", department_id: "d1" }, { subject_id: "s3", department_id: "d2" }],
  subject_weeks: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `w${n}`, subject_id: "s3", week_label: `${n}단계`, summary: `요약${n}`, sort_order: n })),
  curriculum_sets: [{ id: "set1", name: "건축학과" }, { id: "v1", name: "2026 겨울", is_vacation: true }],
  vacation_set_subjects: [{ set_id: "v1", subject_id: "s1" }],
  course_prep_items: [
    { id: "p1", subject_id: "s1", category: "supply", content: "삼각자" },
    { id: "p2", subject_id: "s2", category: "supply", content: "삼각자" },
    { id: "p3", subject_id: "s2", category: "ai", content: "ChatGPT", link_url: "javascript:alert(1)" },
  ],
  instructors: [{ id: "i1", name: "김강사", is_listed: true, account_uid: "u1" }],
  instructor_departments: [{ instructor_id: "i1", department_id: "d1" }],
  instructor_subjects: [{ instructor_id: "i1", subject_id: "s1" }],
  instructor_curricula: [
    { id: "c1", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "새 제출", status: "pending", sort_order: 0 },
    { id: "c2", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "검수본", status: "approved", sort_order: 0 },
  ],
  instructor_profile_drafts: [],
});

async function open(file, session = { uid: "u1", role: "head" }, fake = db()) {
  changes.resetTracking();
  data.useDb(fake);
  const main = document.getElementById("content");
  const { render } = await import(`../../admin-v4/js/pages/${file}.mjs`);
  await render({ main, session, params: [] });
  await flush();
  return main;
}

test("준비물: 캐드1·캐드2를 '캐드' 하나로 묶고 겹치는 것은 한 번, 확정은 기준 과목으로·http(s) 아닌 링크는 막음", async () => {
  globalThis.confirm = () => true;
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const main = await open("prep");
  // 강사 페이지처럼 표: 기준 과목 한 줄, 적용 과목·공통 준비물 개수
  const rows = [...main.querySelectorAll("tr.pick")];
  assert.deepEqual(rows.map((tr) => tr.querySelector(".subject-chip").textContent), ["아트 드로잉", "캐드"].sort((a, b) => a.localeCompare(b, "ko")));
  const cad = rows.find((tr) => tr.textContent.includes("캐드1, 캐드2"));
  assert.match(cad.textContent, /준비물 1 · AI 도구 1/);
  cad.click();
  await flush();
  const main2 = [...document.querySelectorAll("dialog.modal")].at(-1);
  assert.match(main2.textContent, /적용 과목: 캐드1, 캐드2/);
  const contents = [...main2.querySelectorAll("input[aria-label='내용']")].map((i) => i.value);
  assert.deepEqual(contents, ["삼각자", "ChatGPT"], "겹치는 삼각자는 한 번");
  assert.equal(document.querySelector(".change-bar")?.hidden ?? true, true, "바꾸기 전에는 창 없음");
  type(main2.querySelector("input[aria-label='내용']"), "삼각자 2개");
  await flush();
  assert.ok(barBtn("임시 저장") && barBtn("사이트 적용"), "바꾸면 [임시 저장]/[사이트 적용]");
  barBtn("사이트 적용").click();
  await flush();
  assert.match(document.querySelector(".change-bar").textContent, /http:\/\/ 또는 https:\/\/로 시작/);
  type(main2.querySelector("input[aria-label='내용']"), "삼각자");
  await flush();
  assert.equal(document.querySelector(".change-bar").hidden, true, "원래대로 돌아가면 창이 사라짐");
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("강사 준비물 칸을 항목으로(교재·물품은 쉼표·줄바꿈, AI는 이름 | 링크)", async () => {
  const { itemsFromMaterials } = await import("../../admin-v4/js/pages/prep.mjs");
  assert.deepEqual(itemsFromMaterials({ textbook: "교재A", supplies: "자, 펜\n노트", ai: "ChatGPT | chatgpt.com" }), [
    { category: "textbook", content: "교재A" }, { category: "supply", content: "자" }, { category: "supply", content: "펜" },
    { category: "supply", content: "노트" }, { category: "ai", content: "ChatGPT", link_url: "https://chatgpt.com" },
  ]);
});

test("공통 정리: 4단계 아닌 강사 자료는 4묶음으로 나눔", async () => {
  const { bucket } = await import("../../admin-v4/js/pages/common-editor.mjs");
  assert.deepEqual([0, 1, 2, 3].map((i) => bucket(i, 4)), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => bucket(i, 6)), [0, 0, 1, 2, 2, 3]);
  assert.deepEqual([0, 1].map((i) => bucket(i, 2)), [0, 2]);
});

test("공개 페이지 학과별 순서: 26번째 칸 순서대로, 없으면 시트 순서", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../Curriculum_onepage.html", import.meta.url), "utf8");
  const code = src.slice(src.indexOf("function _deptOrd"), src.indexOf("async function getCurriculumSimpleByDeptFromSupabase"));
  const { _deptOrd, _sortByDeptOrd } = new Function(`${code}; return { _deptOrd, _sortByDeptOrd };`)();
  assert.equal(_deptOrd('{"건축": 2, "시각 편집": 0}', "시각편집학과"), 0);
  assert.equal(_deptOrd("", "건축학과"), 1e9);
  const rows = [{ n: "a", c: '{"건축": 1}' }, { n: "b", c: "" }, { n: "c", c: '{"건축": 0}' }];
  assert.deepEqual(_sortByDeptOrd(rows, (r) => _deptOrd(r.c, "건축학과")).map((r) => r.n), ["c", "a", "b"]);
});

test("로드맵: [+]로 묶으면 한 단계, 이름 끝 숫자만 다르면 '캐드 1~2', 저장은 학과 구성 순서 그대로", async () => {
  const { roadmapLabel } = await import("../../admin-v4/js/rules.mjs");
  assert.equal(roadmapLabel(["AI웹툰1", "AI웹툰2", "AI웹툰3", "AI웹툰4", "AI웹툰5", "AI웹툰6"]), "AI웹툰 1~6");
  assert.equal(roadmapLabel(["AI포토샵", "AI일러스트"]), "AI포토샵\nAI일러스트");
  globalThis.confirm = () => true;
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: false, error: null }; };
  const main = await open("roadmap", undefined, fake);
  assert.match(main.textContent, /과목 2개 → 로드맵 2단계/);
  [...main.querySelectorAll("button")].find((b) => b.textContent === "+").click();
  assert.match(main.textContent, /로드맵 1단계/);
  assert.ok([...main.querySelectorAll(".step b")].some((b) => b.textContent === "캐드 1~2"));
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [name, args] = calls.find(([n]) => n === "comsw_v4_save_roadmap");
  assert.equal(name, "comsw_v4_save_roadmap");
  assert.deepEqual(args.p_groups.map((g) => g.subjects), [["s1", "s2"]]);
});

test("학과·과목: 학과 구성 순서, 6단계 과목은 '4단계로 다시 정리 필요'", async () => {
  const main = await open("courses");
  assert.match(main.textContent, /과목 2개/);
  assert.ok(main.textContent.indexOf("캐드1") < main.textContent.indexOf("캐드2"));
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  assert.match(main.textContent, /6단계 · 4단계로 다시 정리 필요/);
  assert.match(main.textContent, /2026 겨울/);
});

test("내 커리큘럼: 본인 학과만, 대기 줄이 있으면 '이번 제출'을 불러와 4단계 칸에 채움", async () => {
  const main = await open("mine", { uid: "u1", role: "teacher" });
  assert.match(main.textContent, /건축학과/);
  assert.doesNotMatch(main.textContent, /시각학과/);
  const areas = [...main.querySelectorAll("textarea[aria-label$='수업 내용']")];
  assert.equal(areas.length, 4, "언제나 4단계");
  assert.equal(areas[0].value, "새 제출");
  assert.match(main.textContent, /제출함 · 검수 전/);
});

test("내 커리큘럼: 고치면 [임시 저장]/[학과장에게 제출], 임시 저장하면 [되돌리기], 4단계를 다 써야 제출", async () => {
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: 4, error: null }; };
  const main = await open("mine", { uid: "u1", role: "teacher" }, fake);
  const areas = () => [...main.querySelectorAll("textarea[aria-label$='수업 내용']")];
  type(areas()[1], "내용 2");
  await flush();
  barBtn("임시 저장").click();
  await flush();
  assert.ok(fake.calls.some(([k, t]) => k === "upsert" && t === "v4_teacher_drafts"), "본인 저장함에 보관");
  assert.ok(barBtn("되돌리기"), "임시 저장 뒤 [되돌리기]");
  barBtn("학과장에게 제출").click();
  await flush();
  assert.match(document.querySelector(".change-bar").textContent, /3단계, 4단계 내용을 채워주세요/);
  assert.equal(calls.length, 0);
  type(areas()[2], "내용 3");
  type(areas()[3], "내용 4");
  await flush();
  barBtn("학과장에게 제출").click();
  await flush();
  const [name, args] = calls[0];
  assert.equal(name, "comsw_submit_curriculum");
  assert.equal(args.p_set_id, "set1");
  assert.deepEqual(args.p_subjects[0].steps.map((x) => x.written), ["새 제출", "내용 2", "내용 3", "내용 4"]);
});

test("되돌리기: 임시 저장한 변경을 버리고 원래 설정으로, 창이 사라짐", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const page = await open("prep");
  [...page.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1, 캐드2")).click();
  await flush();
  const main = [...document.querySelectorAll("dialog.modal")].at(-1);
  type(main.querySelector("input[aria-label='내용']"), "자");
  await flush();
  barBtn("임시 저장").click();
  await flush();
  barBtn("되돌리기").click();
  await flush();
  assert.equal(main.querySelector("input[aria-label='내용']").value, "삼각자");
  assert.equal(document.querySelector(".change-bar").hidden, true);
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("강사 검수: 강사를 누르면 팝업, 커리큘럼은 왼쪽 과목·오른쪽 내용, 4단계가 아니면 확정 잠김", async () => {
  const main = await open("instructors");
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  assert.ok(dlg, "팝업");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  assert.ok(dlg.querySelector(".side-list .picks button"), "왼쪽 과목 목록");
  assert.match(dlg.textContent, /지금 1단계입니다\. \[\+ 단계 추가\]로 4단계를 채우면 확정할 수 있습니다/);
  assert.equal([...dlg.querySelectorAll("button")].find((b) => b.textContent === "확정").disabled, true);
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "닫기").click();
  assert.equal(document.querySelector("dialog.modal"), null);
});

test("읽기 실패는 '없음'이 아니라 실패로 보여 준다", async () => {
  const bad = db();
  const from = bad.from.bind(bad);
  bad.from = (t) => (t === "subjects" ? { select: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: "권한 없음" } }) }) }) } : from(t));
  data.useDb(bad);
  const main = document.getElementById("content");
  const { render } = await import("../../admin-v4/js/pages/roadmap.mjs");
  await render({ main, session: { role: "head" }, params: [] });
  assert.match(main.textContent, /불러오지 못했습니다: subjects: 권한 없음/);
});

test("과목 삭제·강사 노출은 DB 함수로(확인 후), 실패하면 이유를 보여 준다", async () => {
  globalThis.confirm = () => true;
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => {
    calls.push([name, args]);
    if (name === "comsw_v4_set_instructor_listed") return { data: null, error: { message: "사이트에 반영하지 않은 다른 변경이 있어 멈췄습니다" } };
    return { data: name === "comsw_v4_unpublished" ? false : null, error: null };
  };
  data.useDb(fake);
  const main = document.getElementById("content");
  const courses = await import("../../admin-v4/js/pages/courses.mjs");
  await courses.render({ main, params: ["subjects"] });
  await flush();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드2")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  assert.ok(dlg.querySelector(".side-list"), "과목 팝업: 왼쪽 강사, 오른쪽 공통 4단계");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "과목 삭제").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_delete_subject"), ["comsw_v4_delete_subject", { p_id: "s2" }]);

  const people = await import("../../admin-v4/js/pages/instructors.mjs");
  await people.render({ main, params: [] });
  await flush();
  const btn = main.querySelector("button[role=switch]");
  assert.equal(btn.getAttribute("aria-checked"), "true");
  btn.click();
  await flush();
  assert.equal(main.querySelector("button[role=switch]").getAttribute("aria-checked"), "false", "화면에서만 바뀜");
  assert.ok(!calls.some(([n]) => n === "comsw_v4_set_instructor_listed"), "[사이트 적용] 전에는 반영 안 함");
  barBtn("사이트 적용").click();
  await flush();
  assert.deepEqual(calls.at(-1), ["comsw_v4_set_instructor_listed", { p_id: "i1", p_listed: false }]);
  assert.match(document.querySelector(".change-bar").textContent, /\[같이 반영\]/, "실패하면 이유(같이 반영 안내), 바꾼 것은 그대로");
});

test("사이트 편집이 열리고, 방학 특강 과목 구성은 체크한 과목 그대로 저장 함수로", async () => {
  globalThis.confirm = () => true;
  const calls = [];
  const base = db();
  Object.assign(base, { rpc: async (name, args) => { calls.push([name, args]); return { data: "v-new", error: null }; } });
  data.useDb(base);
  const main = document.getElementById("content");
  const site = await import("../../admin-v4/js/pages/site.mjs");
  await site.render({ main });
  await flush();
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "하단 메뉴").click();
  assert.match(main.textContent, /여기로 끌어 놓기/);
  // 방학 특강: 후보는 방학 특강 과목(만든 곳이 방학 특강이거나 이미 특강에 든 과목)만
  const subs = (await base.from("subjects").select("*")).data;
  const local = fakeSupabase({ subjects: [...subs, { id: "s9", name: "캐드1", is_vacation: true }] });
  const from0 = base.from.bind(base);
  base.from = (t) => (t === "subjects" ? local.from(t) : from0(t));
  const vac = await import("../../admin-v4/js/pages/vacation.mjs");
  await vac.render({ main });
  await flush();
  assert.ok(!main.textContent.includes("null"), "'null' 글자 없음");
  const add = main.querySelector("select[aria-label='넣을 방학 특강 과목']");
  assert.deepEqual([...add.options].slice(1).map((o) => o.value), ["s9"], "일반 과목(캐드2·아트 드로잉)은 후보 아님, 같은 이름이라도 방학 특강 과목만");
  assert.match(main.querySelector(".vac-right").textContent, /캐드1 · 2026 겨울 공통 커리큘럼/, "넣은 과목을 고르면 오른쪽에 커리큘럼");
  add.value = "s9"; add.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [name, args] = calls.find(([n]) => n === "comsw_v4_save_vacation");
  assert.equal(name, "comsw_v4_save_vacation");
  assert.deepEqual([...args.p_subjects].sort(), ["s1", "s9"]);
  assert.equal(args.p_id, "v1");

  await vac.render({ main });
  await flush();
  [...main.querySelectorAll("button")].find((b) => b.textContent === "과목 생성").click();
  type(main.querySelector("input[aria-label='새 방학 특강 과목 이름']"), "여름 포토샵");
  [...main.querySelectorAll("button")].find((b) => b.textContent === "만들기").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_create_subject")[1], { p_name: "여름 포토샵", p_vacation: true });
  base.from = from0;
});

test("학과 구성: 끌어서 옮기기(moveItem), [+ 학과 추가] 팝업은 이름을 받아 DB 함수로", async () => {
  const { moveItem } = await import("../../admin-v4/js/pages/dept-layout.mjs");
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 3), ["b", "c", "a"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 1, 1), ["a", "b", "c"]);
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: "d9", error: null }; };
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "학과 구성").click();
  [...main.querySelectorAll("button")].find((b) => b.textContent === "+ 학과 추가").click();
  const dlg = document.querySelector("dialog.modal");
  type(dlg.querySelector("input[aria-label='학과 이름']"), "게임학과");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "추가").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_save_department"), ["comsw_v4_save_department", { p_id: null, p_name: "게임학과" }]);
  assert.ok(!main.querySelector("button[aria-label$='위로']"), "화살표 없음(끌어서 옮김)");
  assert.ok(main.querySelector(".dept-row .drag-handle"), "손잡이로 끌기");
});

test("로그아웃: 저장 안 한 변경은 조용히 임시 저장하고, 떠 있는 창은 숨긴다", async () => {
  changes.resetTracking();
  const saved = [];
  let state = { a: 1 };
  changes.track({ id: "t1", baseline: { a: 1 }, read: () => state, write: (x) => { state = x; }, apply: async () => {},
    store: { load: async () => null, save: async (x) => { saved.push(x); }, drop: async () => {} } });
  state = { a: 2 };
  changes.check();
  await flush();
  assert.equal(document.querySelector(".change-bar").hidden, false);
  await changes.stashAll();
  assert.deepEqual(saved, [{ a: 2 }]);
  changes.resetTracking();
  assert.equal(document.querySelector(".change-bar").hidden, true, "로그인 화면에 창이 남지 않음");
});

test("과목 팝업: 보기로 열리고 [닫기] 옆 [수정]으로 고침, [사이트 적용]은 오른쪽 아래 창에만, [AI 공통 정리]는 '공통 4단계' 옆", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : null, error: null }; };
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  assert.deepEqual([...dlg.querySelectorAll(".modal-head button")].map((b) => b.textContent), ["닫기", "수정"], "팝업 위 [사이트 적용] 없음");
  assert.equal(dlg.querySelectorAll("textarea").length, 0, "처음엔 보기");
  [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "수정").click();
  await flush();
  const right = [...dlg.querySelectorAll(".side-list > .box")][1];
  assert.match(right.textContent, /공통 4단계/);
  assert.ok([...right.querySelectorAll("button")].some((b) => b.textContent === "AI 공통 정리"), "AI 버튼은 오른쪽 '공통 4단계' 옆");
  assert.equal(dlg.querySelector(".side-list input[type=checkbox]").checked, true, "V4 반영 기록이 없으면 강사 모두 체크");
  dlg.querySelectorAll("textarea").forEach((t, i) => type(t, `문구${i + 1}`));
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const hit = calls.find(([n]) => n === "comsw_v4_confirm_common");
  assert.equal(hit?.[1].p_subject, "s1");
  assert.deepEqual(hit[1].p_steps.map((s) => s.summary), ["문구1", "문구2", "문구3", "문구4"]);
});

test("반영 안 된 변경: 위쪽 안내의 [같이 반영]으로 V4에서 바로 공개, 막힌 확정 오류는 그 버튼을 안내", async () => {
  const fake = db();
  const calls = [];
  let pending = true;
  fake.rpc = async (name, args) => {
    calls.push([name, args]);
    if (name === "comsw_v4_unpublished") return { data: pending, error: null };
    if (name === "comsw_publish") { pending = false; return { data: 9, error: null }; }
    return { data: null, error: { message: "사이트에 반영하지 않은 다른 변경이 있어 멈췄습니다. 기존 관리 화면에서 사이트에 반영한 뒤 다시 눌러주세요" } };
  };
  const main = await open("courses", undefined, fake);
  await assert.rejects(data.call("comsw_v4_confirm_common", {}), /\[같이 반영\]/);
  const btn = [...main.querySelectorAll("button")].find((b) => b.textContent === "같이 반영");
  assert.ok(btn, "안내에 [같이 반영]");
  btn.click();
  await flush();
  assert.ok(calls.some(([n]) => n === "comsw_publish"), "기존 화면과 같은 반영 함수");
  assert.match(main.textContent, /반영했습니다/);
  assert.ok(![...main.querySelectorAll("button")].some((b) => b.textContent === "같이 반영"));
});

test("과목 팝업: 지난번 반영에 쓴 강사는 처음부터 체크, 열자마자 '바뀐 설정' 창이 뜨지 않음", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const base = fake.from.bind(fake);
  const extra = {
    v4_common_meta: [{ subject_id: "s1", sources: [{ id: "c2" }] }],
    subject_weeks: [1, 2, 3, 4].map((n) => ({ id: `x${n}`, subject_id: "s1", week_label: `${n}단계`, summary: `공개${n}`, sort_order: n })),
  };
  const local = fakeSupabase({ ...extra });
  fake.from = (t) => (t in extra ? local.from(t) : base(t));
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  assert.equal(dlg.querySelector(".side-list input[type=checkbox]").checked, true, "반영에 쓴 강사는 체크");
  await flush();
  assert.ok(document.querySelector(".change-bar")?.hidden !== false, "열기만 하면 바뀐 설정 없음");
});

test("과목 팝업: [AI 공통 정리] 결과가 들어오면 '바뀐 설정' 창이 뜬다(클릭 뒤 기다린 변경도)", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { configureServices } = await import("../../admin/js/services.mjs");
  const kinds = [];
  configureServices({ summarize: async (kind) => { kinds.push(kind); await new Promise((r) => setTimeout(r, 30)); return { text: "AI 문구" }; } });
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "수정").click();
  await flush();
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "AI 공통 정리").click();
  await new Promise((r) => setTimeout(r, 80));
  await flush();
  assert.deepEqual([...new Set(kinds)], ["common"]);
  assert.ok(barBtn("임시 저장") && barBtn("사이트 적용"), "AI 결과 뒤 떠 있는 창");
  configureServices({});
});

test("과목 팝업: 체크한 단계만 AI로 문구, [공통 준비물]은 메뉴 이동 없이 준비물 팝업", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { configureServices } = await import("../../admin/js/services.mjs");
  let asked = 0;
  configureServices({ summarize: async () => { asked++; return { text: "AI 문구" }; } });
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "수정").click();
  await flush();
  dlg.querySelector("input[aria-label='1단계 AI로 문구 만들기']").click(); // 자료가 있는 1단계를 끔
  await flush();
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "AI 공통 정리").click();
  await flush();
  assert.equal(asked, 0, "끈 단계는 AI를 부르지 않음");
  assert.equal(dlg.querySelector("textarea[aria-label='1단계 공통 문구']").value, "검수본");
  configureServices({});

  const before = location.hash;
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "공통 준비물(캐드)").click();
  await flush();
  assert.equal(location.hash, before, "메뉴 이동 없음");
  const prep = [...document.querySelectorAll("dialog.modal")].at(-1);
  assert.notEqual(prep, dlg, "팝업 위에 준비물 팝업");
  assert.match(prep.textContent, /캐드 공통 준비물/);
  assert.match(prep.textContent, /적용 과목: 캐드1, 캐드2/);
  assert.ok([...prep.querySelectorAll("button")].some((b) => b.textContent === "강사 준비물 가져오기"));
});

test("학과 구성: 끌어서·키보드로 순서를 바꾸면 클릭 없이 바로 '바뀐 설정' 창", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "학과 구성").click();
  await flush();
  assert.ok(!barBtn("사이트 적용"), "처음엔 없음");
  const Ev = dom.window.Event;
  let rows = main.querySelectorAll(".drag-row");
  rows[1].dispatchEvent(new Ev("dragstart", { bubbles: true }));
  rows[0].dispatchEvent(Object.assign(new Ev("dragover", { bubbles: true, cancelable: true }), { clientY: 0 }));
  rows[0].dispatchEvent(new Ev("drop", { bubbles: true, cancelable: true }));
  await flush();
  assert.ok(barBtn("사이트 적용"), "끌어서 놓으면 바로");
  assert.match(main.querySelector(".drag-row").textContent, /캐드2/);

  const main2 = await open("courses", undefined, fake);
  [...main2.querySelectorAll(".tabs button")].find((b) => b.textContent === "학과 구성").click();
  await flush();
  rows = main2.querySelectorAll(".drag-row");
  rows[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
  main2.dispatchEvent(new dom.window.KeyboardEvent("keyup", { key: "ArrowUp", bubbles: true }));
  await flush();
  assert.ok(barBtn("사이트 적용"), "Alt+↑로 옮겨도 바로");
});

test("사이트 적용 중: 화면 전체를 막는 '적용 중' 막, 끝나면(실패해도) 걷힘, 읽기만 하는 확인은 막지 않음", async () => {
  const seen = [];
  const fake = db();
  fake.rpc = async (name) => {
    seen.push([name, !!document.querySelector("dialog.blocker[open]")]);
    return name === "comsw_v4_save_site" ? { data: null, error: { message: "실패" } } : { data: false, error: null };
  };
  data.useDb(fake);
  await data.call("comsw_v4_save_roadmap", {});
  await data.call("comsw_v4_unpublished");
  await assert.rejects(data.call("comsw_v4_save_site", {}));
  assert.deepEqual(seen, [["comsw_v4_save_roadmap", true], ["comsw_v4_unpublished", false], ["comsw_v4_save_site", true]]);
  assert.equal(document.querySelector("dialog.blocker"), null, "끝나면 걷힘");
});

test("로드맵: 과목을 끌어서 순서 바꾸면 '학과·과목의 순서와 다릅니다'·[동기화], 적용은 p_custom, 동기화하면 원래대로", async () => {
  const { remapJoins } = await import("../../admin-v4/js/pages/roadmap.mjs");
  assert.deepEqual(remapJoins(["a", "c", "b"], ["a", "b", "c"], [true, false]), [false, false], "떨어지면 묶음 풀림");
  assert.deepEqual(remapJoins(["c", "a", "b"], ["a", "b", "c"], [true, false]), [false, true], "붙어 있으면 유지");
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: false, error: null }; };
  const main = await open("roadmap", undefined, fake);
  assert.ok(!main.textContent.includes("순서 수정(학과 구성)"), "옛 버튼 없음");
  assert.match(main.textContent, /학과·과목 순서/);
  const Ev = dom.window.Event;
  let boxes = main.querySelectorAll(".rm-subject");
  boxes[1].dispatchEvent(new Ev("dragstart", { bubbles: true }));
  boxes[0].dispatchEvent(Object.assign(new Ev("dragover", { bubbles: true, cancelable: true }), { clientX: 0 }));
  boxes[0].dispatchEvent(new Ev("drop", { bubbles: true, cancelable: true }));
  await flush();
  assert.deepEqual([...main.querySelectorAll(".rm-subject")].map((b) => b.textContent), ["캐드2", "캐드1"]);
  assert.match(main.textContent, /학과·과목의 순서와 다릅니다/);
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_save_roadmap");
  assert.equal(args.p_custom, true);
  assert.deepEqual(args.p_groups.map((g) => g.subjects), [["s2"], ["s1"]]);

  const main2 = await open("roadmap", undefined, fake);
  boxes = main2.querySelectorAll(".rm-subject");
  boxes[1].dispatchEvent(new Ev("dragstart", { bubbles: true }));
  boxes[0].dispatchEvent(Object.assign(new Ev("dragover", { bubbles: true, cancelable: true }), { clientX: 0 }));
  boxes[0].dispatchEvent(new Ev("drop", { bubbles: true, cancelable: true }));
  [...main2.querySelectorAll("button")].find((b) => b.textContent === "학과·과목의 순서와 동기화").click();
  await flush();
  assert.deepEqual([...main2.querySelectorAll(".rm-subject")].map((b) => b.textContent), ["캐드1", "캐드2"]);
  assert.ok(!barBtn("사이트 적용"), "동기화하면 바뀐 것 없음");
});

test("로드맵: 같은 과목 묶음이 다른 학과에도 있으면 [타학과 동기화], 체크해 적용하면 p_sync로 그 단계 번호", async () => {
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: false, error: null }; };
  const extra = {
    roadmap_tracks: [{ id: "t2", department_id: "d2", name: "시각학과" }],
    roadmap_steps: [{ id: "st2", track_id: "t2", position: 1, summary: "시각 문구" }],
    roadmap_step_subjects: [{ step_id: "st2", subject_id: "s1", sort_order: 1 }],
  };
  const local = fakeSupabase({ ...extra });
  const base = fake.from.bind(fake);
  fake.from = (t) => (t in extra ? local.from(t) : base(t));
  const main = await open("roadmap", undefined, fake);
  const syncs = main.querySelectorAll(".rm-sync input");
  assert.equal(syncs.length, 1, "캐드1 단계만(시각학과에도 있음)");
  assert.match(main.querySelector(".rm-sync").title, /시각학과/);
  syncs[0].click();
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_save_roadmap");
  assert.deepEqual(args.p_sync, [1]);
});

test("이미지 끌어다 놓기: 놓은 곳에서 가장 가까운 파일 칸 하나를 찾고, 이미지(accept)만 넣어 change로 올림", async () => {
  const ui = await import("../../admin-v4/js/ui.mjs");
  const { h } = ui;
  const one = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp" });
  const two = h("input", { type: "file" });
  const inner = h("span", {}, "사진");
  const wrap = h("div", {}, h("label", {}, inner, one), h("label", {}, two));
  document.body.append(wrap);
  assert.equal(ui.fileInputAt(inner), one, "가장 가까운 칸");
  assert.equal(ui.fileInputAt(wrap), null, "칸이 여럿이면 고르지 않음");
  globalThis.DataTransfer = class { constructor() { const list = []; this.items = { add: (f) => list.push(f) }; this.files = list; } };
  let changed = 0;
  Object.defineProperty(one, "files", { set(v) { this._f = v; }, get() { return this._f; } });
  one.addEventListener("change", () => { changed++; });
  assert.equal(ui.dropFiles(one, [{ type: "application/pdf" }]), false, "이미지 아니면 안 넣음");
  assert.equal(ui.dropFiles(one, [{ type: "text/plain" }, { type: "image/png", name: "a.png" }]), true);
  assert.equal(one.files[0].name, "a.png");
  assert.equal(changed, 1);
  delete globalThis.DataTransfer;
  wrap.remove();
});

test("강사 커리큘럼: 검수는 단계마다 AI 체크·오른쪽 끝 [AI 문장 다듬기][확정], 검수 완료는 [수정]으로 문구·빈 단계 이미지 고쳐 저장", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { configureServices } = await import("../../admin/js/services.mjs");
  const asked = [];
  configureServices({ summarize: async (kind, text) => { asked.push(text); return { text: `다듬은 ${text}` }; } });
  let main = await open("instructors");
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  let dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  const btns = [...dlg.querySelectorAll(".actions.end button")].map((b) => b.textContent);
  assert.deepEqual(btns, ["+ 단계 추가", "AI 문장 다듬기", "확정"], "확정이 오른쪽 끝, 그 왼쪽 AI, 4단계보다 적으면 [+ 단계 추가]");
  assert.ok(dlg.querySelector(".step-foot input[type=checkbox]"), "단계마다 AI 체크");
  dlg.querySelector(".step-foot input[type=checkbox]").click(); // 하나뿐인 단계를 끔
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "AI 문장 다듬기").click();
  await flush();
  assert.equal(asked.length, 0, "끈 단계는 AI 안 부름");
  configureServices({});
  dlg.remove();

  const fake = db();
  const base = fake.from.bind(fake);
  const local = fakeSupabase({ instructor_curricula: [1, 2, 3, 4].map((n) => ({ id: `a${n}`, instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: `${n}단계`,
    written: `원문${n}`, status: "approved", sort_order: n, updated_at: `2026-11-20T00:00:0${n}Z`, media_url: n === 1 ? "https://img/1.png" : null })) });
  fake.from = (t) => (t === "instructor_curricula" ? local.from(t) : base(t));
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: false, error: null }; };
  main = await open("instructors", undefined, fake);
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  const edit = [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "수정");
  assert.ok(edit && !edit.hidden, "[닫기] 옆 [수정]");
  edit.click();
  assert.equal(edit.textContent, "돌아가기");
  assert.equal(dlg.querySelectorAll(".img-pick").length, 4, "모든 단계 이미지(없으면 '이미지 없음')를 눌러 바꿈");
  assert.match(dlg.querySelectorAll(".img-pick")[1].textContent, /이미지 없음/);
  dlg.querySelectorAll(".img-pick")[1].click();
  const picker = [...document.querySelectorAll("dialog.modal")].at(-1);
  assert.match(picker.textContent, /끌어다 놓거나/);
  assert.ok(picker.querySelector("input[type=file]"));
  [...picker.querySelectorAll("button")].find((b) => b.textContent === "닫기").click();
  await flush();
  assert.equal(dlg.querySelectorAll(".actions.end button").length, 0, "아래 버튼 없음(저장은 오른쪽 아래 창)");
  assert.deepEqual([...dlg.querySelectorAll(".modal-head button")].filter((b) => !b.hidden).map((b) => b.textContent), ["닫기", "AI 문장 다듬기", "돌아가기"], "[AI 문장 다듬기]는 [수정] 왼쪽");
  type(dlg.querySelector("textarea[aria-label='2단계 홈페이지 문구']"), "고친 2");
  await flush();
  assert.ok(barBtn("임시 저장"), "고치자마자 오른쪽 아래 창");
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_edit_curriculum");
  assert.deepEqual(args.p_steps.map((x) => [x.id, x.summary, x.media_url]), [["a1", "", "https://img/1.png"], ["a2", "고친 2", ""], ["a3", "", ""], ["a4", "", ""]]);
  dlg.remove();
});

test("학과 구성 표: 기간(개월 숫자)·과정내용(비면 공통 4단계로 채움, 체크한 과목만 AI)·프로그램·학습수준(★ 선택) → 사이트 적용은 바뀐 과목만", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { months, linesFromSteps } = await import("../../admin-v4/js/pages/dept-layout.mjs");
  assert.equal(months("2개월"), "2");
  assert.equal(linesFromSteps([{ summary: "가" }, { written: "나" }]), "01 가\n02 나");
  const { configureServices } = await import("../../admin/js/services.mjs");
  const asked = [];
  configureServices({ summarize: async (kind, text) => { asked.push([kind, text]); return { text: "01 AI 하나\n02 AI 둘" }; } });
  const fake = db();
  const base = fake.from.bind(fake);
  const extra = { subject_weeks: [1, 2, 3, 4].map((n) => ({ id: `x${n}`, subject_id: "s1", week_label: `${n}단계`, summary: `요약${n}`, sort_order: n })) };
  const local = fakeSupabase({ ...extra });
  fake.from = (t) => (t in extra ? local.from(t) : base(t));
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : null, error: null }; };
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "학과 구성").click();
  await flush();
  const area = main.querySelector("textarea[aria-label='캐드1 과정내용']");
  assert.equal(area.value, "01 요약1\n02 요약2\n03 요약3\n04 요약4", "비어 있으면 공통 4단계로 먼저 채움");
  type(main.querySelector("input[aria-label='캐드1 기간(개월)']"), "2");
  const lv = main.querySelector("select[aria-label='캐드2 학습수준']");
  lv.value = "★★★☆☆"; lv.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  main.querySelector("input[aria-label='캐드2 AI 정리']").click(); // 캐드2는 AI 제외
  const counts = main.querySelectorAll(".dept-count");
  assert.deepEqual([...counts].map((c) => c.hidden), [false, true], "내용이 있는 캐드1만 줄 수 고르기");
  const c2 = main.querySelector("textarea[aria-label='캐드2 과정내용']");
  type(c2, "직접 쓴 글");
  assert.equal(counts[1].hidden, false, "공통 단계가 없어도 글을 쓰면 나타남");
  type(c2, "");
  assert.equal(counts[1].hidden, true);
  assert.equal(counts[0].querySelector("[aria-pressed=true]").textContent, "4", "처음 = 지금 줄 수");
  [...counts[0].children].find((b) => b.textContent === "2").click();
  [...main.querySelectorAll("button")].find((b) => b.textContent === "AI 정리").click();
  await flush();
  assert.deepEqual(asked.map(([k]) => k), ["department"], "체크한(공통 4단계 있는) 캐드1만");
  assert.match(asked[0][1], /모두 2줄로 정리\n1단계: 요약1 \/ 요약2\n2단계: 요약3 \/ 요약4/);
  assert.equal(main.querySelector("textarea[aria-label='캐드1 과정내용']").value, "01 AI 하나\n02 AI 둘");
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_save_subject_info");
  assert.deepEqual(args.p_items.map((x) => [x.id, x.duration, x.dept_curriculum, x.level]), [["s1", "2개월", "01 AI 하나\n02 AI 둘", ""], ["s2", "", "", "★★★☆☆"]]);
  configureServices({});
});

test("학과·과목: [과목 생성]은 일반 과목으로 만들고, 방학 특강 과목(학과 없음)은 전체 과목에 안 보임", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const subs = (await fake.from("subjects").select("*")).data;
  const local = fakeSupabase({ subjects: [...subs, { id: "s9", name: "캐드1", is_vacation: true }] });
  const from0 = fake.from.bind(fake);
  fake.from = (t) => (t === "subjects" ? local.from(t) : from0(t));
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : "new", error: null }; };
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  assert.equal([...main.querySelectorAll("tr.pick")].filter((tr) => tr.textContent.includes("캐드1")).length, 1, "같은 이름 방학 특강 과목은 안 보임");
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "과목 생성").click();
  type(main.querySelector("input[aria-label='새 일반 과목 이름']"), "AI포토샵");
  [...main.querySelectorAll("button")].find((b) => b.textContent === "만들기").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_create_subject")[1], { p_name: "AI포토샵", p_vacation: false });
});

test("방학 특강: 설정 제목 오른쪽 '공개' 스위치로 켜고 끄기(체크박스 문구 없음), 바꾸면 오른쪽 아래 창", async () => {
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : "v1", error: null }; };
  const main = await open("vacation", undefined, fake);
  [...main.querySelectorAll("button")].find((b) => b.textContent.startsWith("2026 겨울")).click();
  await flush();
  assert.ok(!main.textContent.includes("보여 주기"), "예전 체크박스 문구 없음: " + main.textContent.slice(0, 300));
  const sw = main.querySelector("button[role=switch]");
  assert.ok(sw && sw.closest(".row").textContent.includes("공개"), main.textContent.slice(0, 400));
  const before = sw.getAttribute("aria-checked");
  sw.click();
  await flush();
  assert.notEqual(main.querySelector("button[role=switch]").getAttribute("aria-checked"), before);
  barBtn("사이트 적용").click();
  await flush();
  assert.equal(calls.find(([n]) => n === "comsw_v4_save_vacation")[1].p_show, before !== "true");
});

test("방학 특강: 탭에 '(홈페이지)' 없음, [이름 수정]·[+ 새 방학 특강]은 학과명 수정처럼 팝업으로 바로 반영", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : "v1", error: null }; };
  const main = await open("vacation", undefined, fake);
  [...main.querySelectorAll("button")].find((b) => b.textContent.startsWith("2026 겨울")).click();
  await flush();
  assert.ok(!main.textContent.includes("(홈페이지)"));
  assert.ok(!main.querySelector("input[aria-label='특강 이름']"), "설정 칸의 이름 입력 없음");
  [...main.querySelectorAll("button")].find((b) => b.textContent === "이름 수정").click();
  let dlg = document.querySelector("dialog.modal");
  assert.match(dlg.textContent, /방학 특강 이름 수정/);
  type(dlg.querySelector("input[aria-label='방학 특강 이름']"), "2026 겨울특강");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "수정").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_save_vacation")[1], { p_id: "v1", p_name: "2026 겨울특강", p_subjects: ["s1"], p_show: false });
  calls.length = 0;
  [...main.querySelectorAll("button")].find((b) => b.textContent === "+ 새 방학 특강").click();
  dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
  type(dlg.querySelector("input[aria-label='방학 특강 이름']"), "2027 여름");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "추가").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_save_vacation")[1], { p_id: null, p_name: "2027 여름", p_subjects: [], p_show: false });
});

test("목록 거르기: 강사(이름 검색·학과·홈페이지 노출), 준비물(기준·적용 과목 검색·학과·공통 준비물)", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const ppl = fakeSupabase({ instructors: [
    { id: "i1", name: "김강사", is_listed: true, account_uid: "u1" },
    { id: "i2", name: "이선생", is_listed: false },
  ] });
  const from0 = fake.from.bind(fake);
  fake.from = (t) => (t === "instructors" ? ppl.from(t) : from0(t));
  let main = await open("instructors", undefined, fake);
  const names = () => [...main.querySelectorAll("tr.pick")].map((tr) => tr.firstChild.textContent);
  assert.deepEqual(names(), ["김강사", "이선생"]);
  type(main.querySelector("input[aria-label='이름 검색']"), "이선");
  assert.deepEqual(names(), ["이선생"]);
  type(main.querySelector("input[aria-label='이름 검색']"), "");
  const sel = (label, v) => { const s = main.querySelector(`select[aria-label='${label} 거르기']`); s.value = v; s.dispatchEvent(new dom.window.Event("change", { bubbles: true })); };
  sel("학과", "건축학과");
  assert.deepEqual(names(), ["김강사"]);
  sel("학과", "");
  sel("홈페이지 노출", "off");
  assert.deepEqual(names(), ["이선생"]);
  assert.match(main.textContent, /강사 1명 \(전체 2명\)/);

  main = await open("prep");
  const bases = () => [...main.querySelectorAll("tr.pick .subject-chip")].map((x) => x.textContent);
  type(main.querySelector("input[aria-label='적용 과목 검색']"), "캐드2");
  assert.deepEqual(bases(), ["캐드"]);
  type(main.querySelector("input[aria-label='적용 과목 검색']"), "");
  sel("공통 준비물", "no");
  assert.deepEqual(bases(), ["아트 드로잉"]);
  sel("공통 준비물", "ai");
  assert.deepEqual(bases(), ["캐드"]);
  sel("공통 준비물", "");
  sel("학과", "시각학과");
  assert.deepEqual(bases(), ["아트 드로잉"]);
  type(main.querySelector("input[aria-label='기준 과목 검색']"), "캐");
  assert.match(main.textContent, /조건에 맞는 과목이 없습니다/);
});

test("사이트 편집: 학과 대표·로딩은 [수정] 팝업(주소 안 보임), 로딩 미리보기 정상, 하단 메뉴는 끌어서 좌우·순서, 이름은 팝업", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const extra = {
    loading_items: [{ id: "L1", image_url: "https://img/l1.png", text: "불러오는 중", is_active: true }],
    menus: [{ id: "m1", name: "로드맵", side: "left", sort_order: 0 }, { id: "m2", name: "학과 커리큘럼", side: "left", sort_order: 1 }, { id: "m3", name: "특강", side: "right", sort_order: 0 }],
  };
  const local = fakeSupabase({ ...extra });
  const from0 = fake.from.bind(fake);
  fake.from = (t) => (t in extra ? local.from(t) : from0(t));
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : null, error: null }; };
  const main = await open("site", undefined, fake);
  const tab = (t) => [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === t).click();
  tab("학과 대표 화면");
  assert.ok(!main.querySelector("input[aria-label$='주소']"), "주소 칸 없음");
  [...main.querySelectorAll("button")].find((b) => b.textContent === "수정").click();
  let dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
  assert.ok(dlg.querySelector(".img-pick"), "이미지는 눌러서 바꾸기");
  type(dlg.querySelector("input[aria-label='영문 이름']"), "ARCHI");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "확인").click();
  await flush();
  assert.match(main.textContent, /ARCHI/);
  assert.ok(barBtn("사이트 적용"), "팝업 [확인] 뒤 오른쪽 아래 창");
  barBtn("되돌리기")?.click();
  changes.resetTracking();

  tab("로딩 화면");
  assert.ok(!main.textContent.includes("[object"), "미리보기 정상");
  assert.ok(!main.textContent.includes("https://img/l1.png"), "링크 안 보임");
  assert.ok(![...main.querySelectorAll("button")].some((b) => b.textContent === "↑"), "순서 버튼 없음");

  tab("하단 메뉴");
  const chips = () => [...main.querySelectorAll(".menu-zone")].map((z) => [...z.querySelectorAll(".menu-chip b")].map((b) => b.textContent));
  assert.deepEqual(chips(), [["로드맵", "학과 커리큘럼"], ["특강"]]);
  const Ev = dom.window.Event;
  const c = main.querySelectorAll(".menu-chip");
  c[0].dispatchEvent(new Ev("dragstart", { bubbles: true }));
  const target = main.querySelectorAll(".menu-chip")[2];
  target.dispatchEvent(Object.assign(new Ev("dragover", { bubbles: true, cancelable: true }), { clientX: 999 }));
  target.dispatchEvent(new Ev("drop", { bubbles: true, cancelable: true }));
  await flush();
  assert.deepEqual(chips(), [["학과 커리큘럼"], ["특강", "로드맵"]], "왼쪽 로드맵을 오른쪽 특강 뒤로");
  [...main.querySelectorAll(".menu-chip button")].find((b) => b.textContent === "수정" && b.closest(".menu-chip").textContent.includes("특강")).click();
  dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
  type(dlg.querySelector("input[aria-label='보이는 이름']"), "특강·세미나");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "확인").click();
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_save_menus");
  assert.deepEqual(args.p_items.map((m) => [m.id, m.side, m.sort_order, m.label, m.is_active]), [["m2", "left", 0, "", true], ["m3", "right", 0, "특강·세미나", true], ["m1", "right", 1, "", true]]);
});

test("떠 있는 창 [취소]: 방금 바꾼 것만 되돌림(임시 저장 전이면 공개 상태로, 임시 저장 뒤면 그 상태로), 임시 저장 뒤엔 [되돌리기]", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const page = await open("prep");
  [...page.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1, 캐드2")).click();
  await flush();
  const dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
  const input = () => dlg.querySelector("input[aria-label='내용']");
  type(input(), "자");
  await flush();
  assert.deepEqual([...document.querySelectorAll(".change-bar .actions button")].map((b) => b.textContent), ["취소", "임시 저장", "사이트 적용"]);
  barBtn("취소").click();
  await flush();
  assert.equal(input().value, "삼각자", "공개 상태로");
  assert.equal(document.querySelector(".change-bar").hidden, true);
  type(input(), "자");
  await flush();
  barBtn("임시 저장").click();
  await flush();
  assert.deepEqual([...document.querySelectorAll(".change-bar .actions button")].map((b) => b.textContent), ["되돌리기", "사이트 적용"]);
  type(input(), "큰 자");
  await flush();
  barBtn("취소").click();
  await flush();
  assert.equal(input().value, "자", "임시 저장한 상태로");
  assert.ok(barBtn("되돌리기"));
  barBtn("되돌리기").click();
  await flush();
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("학과·과목 전체 과목 거르기: 과목 검색, 학과 드롭다운, 방학 특강 On/Off", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const main = await open("courses");
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  const names = () => [...main.querySelectorAll("tr.pick .subject-chip")].map((x) => x.textContent);
  assert.equal(names().length, 3);
  type(main.querySelector("input[aria-label='과목 검색']"), "캐드");
  assert.deepEqual(names(), ["캐드1", "캐드2"]);
  type(main.querySelector("input[aria-label='과목 검색']"), "");
  const sel = (label, v) => { const s = main.querySelector(`select[aria-label='${label} 거르기']`); s.value = v; s.dispatchEvent(new dom.window.Event("change", { bubbles: true })); };
  sel("방학 특강", "on");
  assert.deepEqual(names(), ["캐드1"]);
  sel("방학 특강", "off");
  sel("학과", "시각학과");
  assert.deepEqual(names(), ["아트 드로잉"]);
  assert.match(main.textContent, /과목 1개 \(전체 3개\)/);
});

test("방학 특강 과목 생성: 넣을 특강을 고르면 만들자마자 그 특강 구성에도(기존 과목 + 새 과목)", async () => {
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : name === "comsw_v4_create_subject" ? "s-new" : "v1", error: null }; };
  const main = await open("vacation", undefined, fake);
  [...main.querySelectorAll("button")].find((b) => b.textContent === "과목 생성").click();
  type(main.querySelector("input[aria-label='새 방학 특강 과목 이름']"), "블렌더(방학)");
  const into = main.querySelector("select[aria-label='넣을 방학 특강']");
  into.value = "v1";
  [...main.querySelectorAll("button")].find((b) => b.textContent === "만들기").click();
  await flush();
  assert.deepEqual(calls.filter(([n]) => n !== "comsw_v4_unpublished").map(([n]) => n), ["comsw_v4_create_subject", "comsw_v4_save_vacation"]);
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_save_vacation")[1].p_subjects, ["s1", "s-new"]);
});

test("내 커리큘럼 준비물: 한 줄 = 분류(드롭다운)+내용, 여러 개, 저장은 분류별 칸 그대로, 내 준비물에서 불러오기", async () => {
  const { parseMat, serializeMat } = await import("../../admin-v4/js/pages/mine.mjs");
  const items = parseMat({ textbook: "멘토 포토샵", supplies: "마우스, 이어폰", tools: "Photoshop", ai: "ChatGPT | https://chat.openai.com" });
  assert.deepEqual(items.map((i) => [i.cat, i.content, i.link]), [["textbook", "멘토 포토샵", ""], ["supplies", "마우스", ""], ["supplies", "이어폰", ""], ["tools", "Photoshop", ""], ["ai", "ChatGPT", "https://chat.openai.com"]]);
  assert.deepEqual(serializeMat(items), { textbook: "멘토 포토샵", supplies: "마우스\n이어폰", tools: "Photoshop", ai: "ChatGPT | https://chat.openai.com" });
  assert.deepEqual(serializeMat([{ cat: "supplies", content: "  ", link: "" }]).supplies, "", "빈 줄은 저장 안 함");

  const fake = db();
  const extra = { instructor_subject_materials: [{ instructor_id: "i1", subject_id: "s2", supplies: "삼각자", textbook: "", tools: "AutoCAD", ai: "" }] };
  const local = fakeSupabase({ ...extra });
  const from0 = fake.from.bind(fake);
  fake.from = (t) => (t in extra ? local.from(t) : from0(t));
  const main = await open("mine", { uid: "u1", role: "teacher" }, fake);
  assert.ok(!main.querySelector("textarea[aria-label='교재']"), "예전 4칸 입력 없음");
  [...main.querySelectorAll("button")].find((b) => b.textContent === "+ 준비물").click();
  const sel = main.querySelector("select[aria-label='준비물 1 분류']");
  sel.value = "tools"; sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  type(main.querySelector("input[aria-label='준비물 1 내용']"), "Illustrator");
  const load = main.querySelector("select[aria-label='내 준비물에서 불러오기']");
  const opts = [...load.options].slice(1).map((o) => o.textContent);
  assert.deepEqual(opts, ["준비물 · 삼각자", "사용 프로그램 · AutoCAD"], "다른 과목에 냈던 준비물");
  load.value = "1"; load.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.deepEqual([...main.querySelectorAll(".mat-row input[aria-label$='내용']")].map((i) => i.value), ["Illustrator", "AutoCAD"]);
});

test("내 커리큘럼 단계 이미지: 눌러서 이미지 바꾸기 팝업, 카드에 끌어다 놓으면 그 단계 숨은 칸으로(보이는 파일 칸 없음)", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const ui = await import("../../admin-v4/js/ui.mjs");
  const main = await open("mine", { uid: "u1", role: "teacher" });
  const cards = [...main.querySelectorAll(".steps .step-col")];
  assert.equal(cards.length, 4);
  assert.ok(cards.every((c) => c.querySelector("input[type=file]").hidden), "파일 칸은 숨김");
  assert.equal(ui.fileInputAt(cards[2].querySelector(".img-pick")), cards[2].querySelector("input[type=file]"), "3단계 카드에 놓으면 3단계로");
  cards[0].querySelector(".img-pick").click();
  const picker = [...document.querySelectorAll("dialog.modal")].at(-1);
  assert.match(picker.textContent, /끌어다 놓거나/);
  picker.remove();
});

test("내 커리큘럼 고르기: 한 줄 드롭다운 — 수업 구분 → 학과(일반)/방학 특강 → 과목", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const main = await open("mine", { uid: "u1", role: "teacher" });
  const pick = (label, v) => { const s = main.querySelector(`select[aria-label='${label}']`); s.value = v; s.dispatchEvent(new dom.window.Event("change", { bubbles: true })); };
  const opts = (label) => [...(main.querySelector(`select[aria-label='${label}']`)?.options ?? [])].map((o) => o.textContent);
  const row = main.querySelector(".pick-row");
  assert.ok(row, "한 줄");
  assert.deepEqual(opts("수업 구분"), ["일반 수업", "방학 특강"]);
  assert.deepEqual(opts("학과"), ["건축학과"], "일반이면 내 학과");
  assert.deepEqual(opts("과목").map((t) => t.replace(" ✓", "")), ["캐드1", "캐드2"]);
  pick("수업 구분", "vacation");
  await flush();
  assert.equal(main.querySelector("select[aria-label='학과']"), null);
  assert.deepEqual(opts("방학 특강"), ["2026 겨울"]);
  assert.deepEqual(opts("과목").map((t) => t.replace(" ✓", "")), ["캐드1"], "그 특강에 든 과목만");
  assert.match(main.textContent, /캐드1 · 2026 겨울/);
  pick("수업 구분", "general");
  await flush();
});

test("내 커리큘럼: 예전 형식 임시 저장(쉼표 준비물)을 불러와도 '임시 저장한 변경'으로, 고르기를 바꾸면 묻지 않고 고치던 내용은 임시 저장", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const saved = [];
  const extra = { v4_teacher_drafts: [{ instructor_id: "i1", kind: "curriculum", target: "set1|s1",
    payload: { steps: [1, 2, 3, 4].map((n) => ({ written: `내용${n}`, media_url: "" })), mat: { textbook: "", supplies: "마우스, 이어폰", tools: "", ai: "" } } }] };
  const local = fakeSupabase({ ...extra });
  const from0 = fake.from.bind(fake);
  fake.from = (t) => {
    if (t !== "v4_teacher_drafts") return from0(t);
    const q = local.from(t);
    q.upsert = async (row) => { saved.push(row); return { error: null }; };
    return q;
  };
  const main = await open("mine", { uid: "u1", role: "teacher" }, fake);
  await flush();
  assert.ok(barBtn("되돌리기"), "임시 저장한 상태로 인식(쉼표·줄바꿈 차이는 변경 아님)");
  assert.ok(!barBtn("임시 저장"));
  type(main.querySelector("textarea[aria-label='1단계 수업 내용']"), "고친 내용");
  await flush();
  const prev = globalThis.confirm;
  globalThis.confirm = () => { throw new Error("묻지 않아야 함"); };
  const s = main.querySelector("select[aria-label='과목']");
  s.value = "s2"; s.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await flush();
  globalThis.confirm = prev;
  assert.match(main.textContent, /캐드2 · 일반 수업/);
  const mine = saved.filter((r) => r.target === "set1|s1").at(-1);
  assert.ok(mine, "고치던 캐드1은 조용히 임시 저장");
  assert.equal(mine.payload.steps[0].written, "고친 내용");
  assert.ok(saved.some((r) => r.target === "prep-library"), "준비물은 '내 준비물'에도 모임");
});

test("사용방법: 메뉴 바 아래 링크(새 탭), 강사는 강사 편으로", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../admin-v4/index.html", import.meta.url), "utf8");
  assert.match(html, /id="helpLink"[^>]*href="\.\/help\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  const help = readFileSync(new URL("../../admin-v4/help.html", import.meta.url), "utf8");
  assert.match(help, /id="head"/);
  assert.match(help, /id="teacher"/);
  assert.ok((help.match(/<summary>/g) ?? []).length >= 30, "상황별 설명");
});

test("사용방법: 학과장·관리자로 로그인한 브라우저는 두 편, 강사·로그인 안 함은 강사 편만", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../admin-v4/help.html", import.meta.url), "utf8");
  const view = (role, hash = "") => {
    const d = new JSDOM(html, { url: `https://x/comsw/admin-v4/help.html${hash}`, runScripts: "dangerously",
      beforeParse(w) { if (role) w.localStorage.setItem("comsw_v4_help_role", role); } });
    const doc = d.window.document;
    return { head: doc.getElementById("head"), teacherShown: !doc.getElementById("teacher").hidden, tabs: !doc.querySelector(".tabs").hidden, title: doc.querySelector("h1").textContent };
  };
  const h = view("head");
  assert.ok(h.head && !h.head.hidden && h.tabs, "학과장: 학과장 편 + 탭");
  assert.ok(view("head", "#teacher").teacherShown, "학과장도 강사 편 볼 수 있음");
  for (const r of ["teacher", null]) {
    const t = view(r, "#head");
    assert.equal(t.head, null, `${r ?? "로그인 안 함"}: 학과장 편 없음`);
    assert.ok(t.teacherShown && !t.tabs);
    assert.equal(t.title, "컴수원 강사 사용방법");
  }
});

test("하단 메뉴 켜기·끄기 스위치, 학과 알약 끌어서 순서·공개 스위치, 과목명 수정(수정 중에만), 강사 추가·정보 수정 팝업", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const extra = { menus: [{ id: "m1", name: "로드맵", side: "left", sort_order: 0, is_active: true }] };
  const local = fakeSupabase({ ...extra });
  const from0 = fake.from.bind(fake);
  fake.from = (t) => (t in extra ? local.from(t) : from0(t));
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : "new", error: null }; };
  let main = await open("site", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "하단 메뉴").click();
  main.querySelector(".menu-chip button[role=switch]").click();
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  assert.equal(calls.find(([n]) => n === "comsw_v4_save_menus")[1].p_items[0].is_active, false, "끄면 저장(홈페이지가 숨김)");

  main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "학과 구성").click();
  const chips = () => [...main.querySelectorAll(".dept-chips button[draggable]")].map((b) => b.textContent);
  assert.deepEqual(chips(), ["건축학과", "시각학과"]);
  const Ev = dom.window.Event;
  const bs = main.querySelectorAll(".dept-chips button[draggable]");
  bs[1].dispatchEvent(new Ev("dragstart", { bubbles: true }));
  bs[0].dispatchEvent(Object.assign(new Ev("dragover", { bubbles: true, cancelable: true }), { clientX: 0 }));
  bs[0].dispatchEvent(new Ev("drop", { bubbles: true, cancelable: true }));
  await flush();
  assert.deepEqual(chips(), ["시각학과", "건축학과"]);
  const sw = [...main.querySelectorAll("button[role=switch]")].find((b) => b.getAttribute("aria-label").includes("홈페이지 공개"));
  sw.click();
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const dep = calls.find(([n]) => n === "comsw_v4_save_departments")[1].p_items;
  assert.deepEqual(dep.map((x) => [x.id, x.sort_order, x.is_active]), [["d2", 0, true], ["d1", 1, false]], "고른 학과(건축학과) 비공개");

  main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  let dlg = document.querySelector("dialog.modal");
  const rn = () => [...dlg.querySelectorAll("button")].find((b) => b.textContent === "과목명 수정");
  assert.ok(rn().hidden, "보기 때는 숨김");
  [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "수정").click();
  await flush();
  assert.ok(!rn().hidden);
  rn().click();
  const rp = [...document.querySelectorAll("dialog.modal")].at(-1);
  type(rp.querySelector("input[aria-label='과목 이름']"), "캐드 기초");
  [...rp.querySelectorAll("button")].find((b) => b.textContent === "수정").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_rename_subject")[1], { p_id: "s1", p_name: "캐드 기초" });
  document.querySelectorAll("dialog").forEach((d) => d.remove());

  main = await open("instructors", undefined, fake);
  [...main.querySelectorAll("button")].find((b) => b.textContent === "+ 강사 추가").click();
  dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
  type(dlg.querySelector("input[aria-label='강사 이름']"), "새강사");
  [...dlg.querySelectorAll(".check-chip input")][0].click();
  const lsw = dlg.querySelector("button[role=switch]");
  lsw.click(); lsw.click(); lsw.click();
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "저장").click();
  await flush();
  const ins = calls.find(([n]) => n === "comsw_v4_save_instructor")[1];
  assert.equal(ins.p_id, null);
  assert.equal(ins.p.name, "새강사");
  assert.deepEqual(ins.p.departments, ["d1"]);
  assert.equal(ins.p.is_listed, true, "스위치 여러 번 눌러도 마지막 상태");
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  main = await open("instructors", undefined, fake);
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "프로필").click();
  const info = [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "정보 수정");
  assert.ok(info && !info.hidden, "프로필 탭에 [정보 수정]");
  info.click();
  const form = [...document.querySelectorAll("dialog.modal")].at(-1);
  assert.equal(form.querySelector("input[aria-label='강사 이름']").value, "김강사");
  assert.ok(form.querySelector(".check-chip input").checked, "연결된 학과 체크");
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("강사 정보 담당 과목: 고른 과목만 알약(× 빼기), [과목 검색] 팝업에서 거르고 골라 더함", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const main = await open("instructors");
  [...main.querySelectorAll("button")].find((b) => b.textContent === "+ 강사 추가").click();
  const form = [...document.querySelectorAll("dialog.modal")].at(-1);
  const chips = () => [...form.querySelectorAll(".pick-chip")].map((c) => c.firstChild.textContent);
  assert.deepEqual(chips(), []);
  [...form.querySelectorAll("button")].find((b) => b.textContent === "과목 검색").click();
  const pk = [...document.querySelectorAll("dialog.modal")].at(-1);
  const sel = pk.querySelector("select[aria-label='학과 거르기']");
  sel.value = "시각학과"; sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  const rows = [...pk.querySelectorAll("tr.pick")];
  assert.deepEqual(rows.map((tr) => tr.children[1].textContent), ["아트 드로잉"]);
  rows[0].click();
  assert.match(pk.textContent, /고른 과목 1개/);
  [...pk.querySelectorAll("button")].find((b) => b.textContent === "확인").click();
  assert.deepEqual(chips(), ["아트 드로잉"]);
  form.querySelector(".pick-chip button").click();
  assert.deepEqual(chips(), []);
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("떠 있는 창 옮기기: 버튼 아닌 곳을 끌면 옮겨지고 위치 기억, 제목 두 번 누르면 원래 자리", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const page = await open("prep");
  [...page.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1, 캐드2")).click();
  await flush();
  const dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
  type(dlg.querySelector("input[aria-label='내용']"), "자");
  await flush();
  const bar = document.querySelector(".change-bar");
  const M = dom.window.MouseEvent;
  bar.querySelector(".bar-title").dispatchEvent(new M("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
  bar.dispatchEvent(new M("pointermove", { bubbles: true, clientX: 210, clientY: 110 }));
  bar.dispatchEvent(new M("pointerup", { bubbles: true }));
  assert.equal(bar.style.left, "200px");
  assert.equal(bar.style.top, "100px");
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem("comsw_v4_bar_pos")), { x: 200, y: 100 });
  bar.querySelector("button").dispatchEvent(new M("pointerdown", { bubbles: true, button: 0, clientX: 0, clientY: 0 }));
  bar.dispatchEvent(new M("pointermove", { bubbles: true, clientX: 500, clientY: 500 }));
  assert.equal(bar.style.left, "200px", "버튼을 누를 땐 안 움직임");
  bar.querySelector(".bar-title").dispatchEvent(new M("dblclick", { bubbles: true }));
  assert.equal(bar.style.left, "");
  assert.equal(dom.window.localStorage.getItem("comsw_v4_bar_pos"), null);
  barBtn("취소").click();
  await flush();
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("강사 커리큘럼 수정: 원래 문구도 고치고, 4단계 넘는 단계는 오른쪽 위 ×로 지움(4단계까지만), 저장에 delete·written", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const base = fake.from.bind(fake);
  const local = fakeSupabase({ instructor_curricula: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `a${n}`, instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: `${n}단계`,
    written: `원문${n}`, status: "approved", sort_order: n, updated_at: `2026-11-23T00:00:0${n}Z` })) });
  fake.from = (t) => (t === "instructor_curricula" ? local.from(t) : base(t));
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: false, error: null }; };
  const main = await open("instructors", undefined, fake);
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "수정").click();
  assert.equal(dlg.querySelectorAll(".step-x").length, 6, "6단계면 모든 단계에 ×");
  dlg.querySelector("button[aria-label='2단계 지우기']").click();
  await flush();
  assert.equal(dlg.querySelectorAll(".steps .step-col").length, 5);
  dlg.querySelector("button[aria-label='4단계 지우기']").click(); // 화면 번호 4단계 = 원래 5단계
  await flush();
  assert.equal(dlg.querySelectorAll(".step-x").length, 0, "4단계가 되면 × 없음");
  assert.deepEqual([...dlg.querySelectorAll(".steps .step-col > b")].map((b) => b.textContent), ["1단계", "2단계", "3단계", "4단계"], "번호 다시");
  type(dlg.querySelector("textarea[aria-label='1단계 원래 문구']"), "고친 원문");
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_edit_curriculum");
  assert.deepEqual(args.p_steps.map((x) => [x.id, x.written ?? null, !!x.delete]), [["a1", "고친 원문", false], ["a3", "원문3", false], ["a4", "원문4", false], ["a6", "원문6", false], ["a2", null, true], ["a5", null, true]], "남길 단계는 화면 순서, 지운 단계는 뒤에");
  dlg.remove();
});

test("이번 제출이 1단계여도 학과장이 원래 문구를 고치고 [+ 단계 추가]로 4단계를 채워 확정", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: false, error: null }; };
  const main = await open("instructors", undefined, fake);
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  type(dlg.querySelector("textarea[aria-label='1단계 원래 문구']"), "고친 1");
  for (let k = 0; k < 3; k++) [...dlg.querySelectorAll("button")].find((b) => b.textContent === "+ 단계 추가").click();
  assert.equal(dlg.querySelectorAll(".steps .step-col").length, 4);
  assert.ok(![...dlg.querySelectorAll("button")].some((b) => b.textContent === "+ 단계 추가"), "4단계면 추가 버튼 없음");
  ["2", "3", "4"].forEach((n) => type(dlg.querySelector(`textarea[aria-label='${n}단계 원래 문구']`), `새 ${n}`));
  const ok = [...dlg.querySelectorAll("button")].find((b) => b.textContent === "확정");
  assert.equal(ok.disabled, false);
  ok.click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_confirm_curriculum");
  assert.deepEqual(args.p_steps.map((x) => [x.id ?? null, x.written]), [["c1", "고친 1"], [null, "새 2"], [null, "새 3"], [null, "새 4"]]);
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("강사 담당 과목에 제출이 없어도 과목 목록에서 학과장이 4단계를 대신 작성해 제출", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const originalFrom = fake.from.bind(fake);
  const assignments = fakeSupabase({ instructor_subjects: [
    { instructor_id: "i1", subject_id: "s1" },
    { instructor_id: "i1", subject_id: "s2" },
    { instructor_id: "i1", subject_id: "s3" },
  ] });
  fake.from = (table) => table === "instructor_subjects" ? assignments.from(table) : originalFrom(table);
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: null, error: null }; };
  const main = await open("instructors", undefined, fake);
  main.querySelector("tr.pick").click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  const pick = [...dlg.querySelectorAll(".picks button")].find((b) => b.textContent.includes("캐드2 · 일반"));
  assert.ok(pick, "프로필에 지정된 미제출 과목도 보임");
  const unlinked = [...dlg.querySelectorAll(".picks button")].find((b) => b.textContent.includes("아트 드로잉"));
  assert.ok(unlinked, "학과 연결이 없는 담당 과목도 목록에 보임");
  unlinked.click();
  assert.match(dlg.textContent, /학과 구성에 과목을 넣은 뒤/);
  assert.equal(dlg.querySelectorAll(".steps .step-col").length, 0, "제출할 학과 탭 없이 작성하지 않음");
  pick.click();
  assert.equal(dlg.querySelectorAll(".steps .step-col").length, 4);
  [1, 2, 3, 4].forEach((n) => type(dlg.querySelector(`textarea[aria-label='${n}단계 원래 문구']`), `대신 쓴 ${n}단계`));
  await flush();
  [...dlg.querySelectorAll("button")].find((b) => b.textContent === "학과장에게 제출").click();
  await flush();
  const [, args] = calls.find(([name]) => name === "comsw_submit_curriculum");
  assert.equal(args.p_instructor_id, "i1");
  assert.equal(args.p_set_id, "set1");
  assert.deepEqual(args.p_subjects[0].steps.map((s) => s.written), [1, 2, 3, 4].map((n) => `대신 쓴 ${n}단계`));
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("미리보기: 구글 드라이브 링크는 드라이브 보기 화면(iframe)이 아니라 썸네일 사진", async () => {
  const { media } = await import("../../admin-v4/js/ui.mjs");
  const el = media("https://drive.google.com/file/d/ABC123/view?usp=sharing");
  assert.equal(el.querySelector("iframe"), null);
  assert.equal(el.querySelector("img").getAttribute("src"), "https://drive.google.com/thumbnail?id=ABC123&sz=w1000");
  assert.ok(media("https://img/1.png").querySelector("img"));
});

test("AI 결과 끝의 '~교육'·'~제안' 떼기: 실제로 나왔던 문장, 다른 끝말·사람이 쓸 만한 문장은 그대로", async () => {
  const cut = rules.trimEnding;
  for (const [from, to] of [
    ["생성형 AI 개념과 원리, 기본 기능 교육 진행", "생성형 AI 개념과 원리, 기본 기능"],
    ["AI 활용 정보 검색 및 자료 조사와 검증 교육 추진", "AI 활용 정보 검색 및 자료 조사와 검증"],
    ["프롬프트 응용을 위한 질문 개선과 템플릿 제작 방안 제안", "프롬프트 응용을 위한 질문 개선과 템플릿 제작 방안"],
    ["블렌딩 모드와 레이어 스타일 활용 타이포 배너 제작 교육 제안", "블렌딩 모드와 레이어 스타일 활용 타이포 배너 제작"],
    ["인터페이스 이해와 파일 관리, 레이어 조작 전문교육 실시", "인터페이스 이해와 파일 관리, 레이어 조작"],
    ["영상 편집 실무 역량 강화를 위한 교육.", "영상 편집 실무 역량 강화"],
    ["01 도구 사용법 교육\n02 배너 제작 실습", "01 도구 사용법\n02 배너 제작 실습"],
  ]) assert.equal(cut(from), to);
  for (const keep of ["마스크 활용 영상 합성과 색보정 실습", "완성도 향상에 중점 두어 프로젝트 진행", "디지털 교육", "기획 제안서 작성법", ""]) assert.equal(cut(keep), keep);
  const { configureServices } = await import("../../admin/js/services.mjs");
  configureServices({ summarize: async () => ({ text: "레이어 마스크 활용 합성 교육 제안" }) });
  assert.equal(await data.ai("week", "원문"), "레이어 마스크 활용 합성");
  assert.equal(await data.ai("roadmap", "원문"), "레이어 마스크 활용 합성 교육 제안", "로드맵 요약은 그대로");
  configureServices({});
});

test("과정내용 줄 수: AI가 줄 수를 어기면 묶음마다 다시 받아 꼭 그 줄 수로, 번호는 다시 매김", async () => {
  const { aiLines, plainLines, lineCountOf, groupSteps } = await import("../../admin-v4/js/pages/dept-layout.mjs");
  assert.deepEqual(plainLines("01 가\n2. 나\n3단계: 다\n3D 모델링 실습"), ["가", "나", "다", "3D 모델링 실습"]);
  assert.deepEqual([lineCountOf("01 가\n02 나"), lineCountOf("01 가\n02 나\n03 다"), lineCountOf(""), lineCountOf("한 줄")], [2, 3, 4, 4]);
  const t = (n) => Array.from({ length: n }, (_, i) => `s${i + 1}`);
  assert.deepEqual(groupSteps(t(4), 2), [["s1", "s2"], ["s3", "s4"]]);
  assert.deepEqual(groupSteps(t(4), 3), [["s1", "s2"], ["s3"], ["s4"]]);
  assert.deepEqual(groupSteps(t(6), 4), [["s1", "s2"], ["s3"], ["s4", "s5"], ["s6"]], "6단계도 4줄로");
  assert.deepEqual(groupSteps(t(6), 2), [["s1", "s2", "s3"], ["s4", "s5", "s6"]]);
  const { materialOf } = await import("../../admin-v4/js/pages/dept-layout.mjs");
  assert.deepEqual(materialOf([{ summary: "가" }, { summary: " " }, { written: "나" }], "01 글"), ["가", "나"], "공통 단계가 먼저(빈 단계 빼고)");
  assert.deepEqual(materialOf([], "01 하나\n02 둘"), ["하나", "둘"], "공통 단계가 없으면 적힌 글");
  assert.deepEqual(materialOf([], "01 글", [{ summary: "초1" }, { summary: "" }]), ["초1"], "적용한 공통이 없으면 강사 자료 초안이 적힌 글보다 먼저");
  assert.deepEqual(materialOf([{ summary: "가" }], "01 글", [{ summary: "초1" }]), ["가"], "적용한 공통이 초안보다 먼저");
  assert.deepEqual(materialOf([], "", [{ summary: "가1\n나1" }]), ["가1 / 나1"], "강사 여럿의 글은 한 단계로");
  const asked = [];
  const ai = async (kind, text) => { asked.push(kind); return kind === "department" ? "01 하나\n02 둘" : `정리 ${text.replace(/[-\s]+/g, "")}`; };
  assert.equal(await aiLines("캐드", t(4), 4, ai), "01 정리 s1\n02 정리 s2\n03 정리 s3\n04 정리 s4");
  assert.deepEqual(asked, ["department", "common", "common", "common", "common"]);
  assert.equal(await aiLines("모션", t(6), 2, ai), "01 하나\n02 둘");
  await assert.rejects(aiLines("캐드", t(2), 4, ai), /2개라 4줄로 나눌 수 없습니다/);
});

test("강사 프로필 검수: 사진 탭 홈페이지·강사업로드·AI 수정, [이 사진으로 공개]로 고른 사진만 확정 때 공개", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { configureServices } = await import("../../admin/js/services.mjs");
  const asked = [];
  const calls = [], uploads = [];
  let fresh = null;
  configureServices({ source: async (id) => { asked.push(id); return { dataUrl: "data:image/png;base64,AA" }; },
    upload: async (file, kind) => { uploads.push([kind, file.type]); return { id: "m1", url: "https://x.test/public.webp" }; } });
  const openWith = async (draft) => {
    document.querySelectorAll("dialog").forEach((d) => d.remove());
    const fake = db();
    const local = fakeSupabase({
      instructors: [{ id: "i1", name: "김강사", is_listed: true, account_uid: "u1", photo_url: "https://x.test/home.webp" }],
      instructor_profile_drafts: [{ instructor_id: "i1", name: "김강사", status: "pending", updated_at: "t1", ...draft }],
    });
    const from0 = fake.from.bind(fake);
    fake.from = (t) => (["instructors", "instructor_profile_drafts"].includes(t) ? (fresh ?? local).from(t) : from0(t));
    fake.rpc = async (n, a) => { calls.push([n, a]); return { data: null, error: null }; };
    const main = await open("instructors", undefined, fake);
    if (!document.querySelector("dialog.modal")) main.querySelector("tr.pick").click();
    await flush();
    const dlg = document.querySelector("dialog.modal");
    [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "프로필").click();
    await flush();
    return dlg;
  };
  const tab = (dlg, t) => [...dlg.querySelectorAll(".photo-tabs button")].find((b) => b.textContent === t);
  const img = (dlg) => dlg.querySelector(".profile-photo .media img")?.getAttribute("src") ?? null;

  let dlg = await openWith({ source_asset_id: "a1", source_consent: true, photo_url: null });
  assert.deepEqual([...dlg.querySelectorAll(".photo-tabs button")].map((b) => b.textContent), ["홈페이지", "강사업로드", "AI 수정"]);
  assert.equal(img(dlg), "https://x.test/home.webp");
  assert.deepEqual(asked, [], "원본은 탭을 열 때만 불러옴");
  tab(dlg, "강사업로드").click();
  await flush();
  assert.equal(img(dlg), "data:image/png;base64,AA");
  tab(dlg, "AI 수정").click();
  assert.equal(img(dlg), null);
  assert.match(dlg.querySelector(".profile-photo").textContent, /아직 만들지 않았습니다/);
  tab(dlg, "강사업로드").click();
  await flush();
  assert.deepEqual(asked, ["a1"], "한 번만 불러옴");
  const prev = globalThis.confirm;
  let said = "";
  globalThis.confirm = (t) => { said = t; return true; };
  const btn = (t) => [...dlg.querySelectorAll("button")].find((x) => x.textContent === t);
  const confirmed = async () => { calls.length = 0; btn("확정").click(); await flush(); await flush(); return calls.find(([n]) => n === "comsw_v4_confirm_profile")?.[1].p_photo_url; };
  tab(dlg, "홈페이지").click();
  assert.ok(!btn("이 사진으로 공개"), "홈페이지 탭에는 버튼 없음");
  assert.equal(await confirmed(), null, "고르지 않으면 그대로");
  assert.match(said, /사진은 바뀌지 않습니다[\s\S]*이 사진으로 공개/);

  dlg = await openWith({ source_asset_id: "a1", source_consent: true, photo_url: "https://x.test/ai.png" });
  assert.equal(tab(dlg, "AI 수정").getAttribute("aria-pressed"), "true", "AI 사진이 있으면 그 탭부터");
  assert.equal(img(dlg), "https://x.test/ai.png");
  btn("이 사진으로 공개").click();
  btn("✓ 이 사진으로 공개").click();
  assert.equal(btn("이 사진으로 공개").getAttribute("aria-pressed"), "false", "다시 누르면 고르지 않음");
  btn("이 사진으로 공개").click();
  assert.ok(tab(dlg, "✓ AI 수정"), "고른 탭에 표시");
  assert.equal(await confirmed(), "https://x.test/ai.png");
  assert.match(said, /AI로 만든 사진을 공개/);

  dlg = await openWith({ source_asset_id: "a1", source_consent: true, photo_url: "https://x.test/ai.png" });
  tab(dlg, "강사업로드").click();
  await flush();
  btn("이 사진으로 공개").click();
  assert.equal(await confirmed(), "https://x.test/public.webp", "원본은 공개용으로 올린 주소로");
  assert.deepEqual(uploads, [["image", "image/png"]]);
  assert.match(said, /강사가 올린 원본을 그대로 공개합니다[\s\S]*강사에게 확인/);

  // 확정·저장 뒤: 예전 팝업이 밑에 남지 않고, 새로 읽은 사진이 바로 보인다
  const after = fakeSupabase({
    instructors: [{ id: "i1", name: "김강사", is_listed: true, account_uid: "u1", photo_url: "https://x.test/new.webp" }],
    instructor_profile_drafts: [],
  });
  dlg = await openWith({ source_asset_id: "a1", source_consent: true, photo_url: "https://x.test/ai.png" });
  btn("이 사진으로 공개").click();
  fresh = after;
  btn("확정").click();
  for (let n = 0; n < 6; n++) await flush();
  const left = [...document.querySelectorAll("dialog.modal")];
  assert.equal(left.length, 1, "팝업은 하나만");
  assert.equal(left[0].querySelector(".profile-photo img").getAttribute("src"), "https://x.test/new.webp");
  left[0].querySelector(".modal-head button").click();
  await flush();
  assert.equal(document.querySelector("dialog.modal"), null, "닫으면 예전 팝업이 남지 않음");
  fresh = null;

  dlg = await openWith({ source_asset_id: "a1", source_consent: false, photo_url: null });
  tab(dlg, "강사업로드").click();
  await flush();
  assert.equal(btn("이 사진으로 공개").disabled, true, "동의하지 않은 사진은 못 씀");
  globalThis.confirm = prev;
  configureServices({});
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("내 프로필: 확정 전에는 제출한 사진이 보이고, 글만 고쳐 다시 제출해도 사진이 빠지지 않음", async () => {
  const { configureServices } = await import("../../admin/js/services.mjs");
  configureServices({ source: async () => ({ dataUrl: "data:image/png;base64,BB" }) });
  const submit = async (status) => {
    const fake = db();
    const calls = [];
    const local = fakeSupabase({ instructor_profile_drafts: [{ instructor_id: "i1", name: "김강사", career: "경력", status, source_asset_id: "a1", source_consent: true }] });
    const from0 = fake.from.bind(fake);
    fake.from = (t) => (t === "instructor_profile_drafts" ? local.from(t) : from0(t));
    fake.rpc = async (n, a) => { calls.push([n, a]); return { data: null, error: null }; };
    const main = await open("profile", { uid: "u1", role: "teacher" }, fake);
    await flush();
    const src = main.querySelector(".photo-drop img")?.getAttribute("src") ?? null;
    type(main.querySelector(".form-field textarea"), "새 경력");
    await flush();
    barBtn("학과장에게 제출").click();
    await flush();
    const a = calls.find(([n]) => n === "comsw_save_my_profile")[1];
    return [src, a.p_career, a.p_source_asset_id, a.p_source_consent];
  };
  assert.deepEqual(await submit("pending"), ["data:image/png;base64,BB", "새 경력", "a1", true]);
  assert.deepEqual(await submit("approved"), [null, "새 경력", null, false], "확정된 뒤에는 새로 올린 사진만");
  configureServices({});
});

test("AI 사용량: 사용액·한도·종류별·작업 기록, 관리자만 [한도 바꾸기]·실패한 작업 [사용액에서 빼기]", async () => {
  globalThis.confirm = () => true;
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const calls = [];
  const fake = fakeSupabase({ comsw_ai_jobs: [
    { id: "j1", kind: "profile", status: "failed", budget_krw: 2800, month: "2026-11", created_at: "2026-11-24T05:00:00Z" },
    { id: "j2", kind: "profile", status: "completed", budget_krw: 120, month: "2026-11", created_at: "2026-11-23T05:00:00Z" },
    { id: "j3", kind: "week", status: "completed", budget_krw: 11, month: "2026-11", created_at: "2026-11-22T05:00:00Z" },
    { id: "j4", kind: "week", status: "completed", budget_krw: 9, month: "2026-10", created_at: "2026-10-22T05:00:00Z" },
  ] });
  fake.rpc = async (n, a) => { calls.push([n, a]); return { data: n === "comsw_ai_budget" ? { month: "2026-11", used: 2931, limit: 3000, remaining: 69 } : null, error: null }; };
  let main = await open("usage", { uid: "u1", role: "head" }, fake);
  assert.match(main.textContent, /2,931원[\s\S]*69원[\s\S]*3,000원/);
  assert.match(main.textContent, /프로필 사진2건2,920원120원1건/, "종류별: 평균은 성공한 것만");
  assert.match(main.textContent, /작업 기록 4건 · 2,940원/);
  assert.ok(![...main.querySelectorAll("button")].some((b) => /한도 바꾸기|사용액에서 빼기/.test(b.textContent)), "학과장은 보기만");
  const sel = main.querySelector("select[aria-label='달 거르기']");
  sel.value = "2026-10"; sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.match(main.textContent, /작업 기록 1건 · 9원/);

  main = await open("usage", { uid: "u1", role: "admin" }, fake);
  const btn = (t, root = main) => [...root.querySelectorAll("button")].filter((b) => b.textContent === t);
  assert.equal(btn("사용액에서 빼기").length, 1, "실패한 작업만");
  btn("사용액에서 빼기")[0].click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_release_ai")[1], { p_id: "j1" });
  btn("한도 바꾸기")[0].click();
  const dlg = document.querySelector("dialog.modal");
  type(dlg.querySelector("input"), "-1");
  btn("저장", dlg)[0].click();
  await flush();
  assert.ok(!calls.some(([n]) => n === "comsw_set_ai_limit"), "잘못된 금액은 막음");
  type(dlg.querySelector("input"), "20000");
  btn("저장", dlg)[0].click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_set_ai_limit")[1], { p_limit: 20000 });
  assert.equal(document.querySelector("dialog.modal"), null);
  assert.match(main.textContent, /공통 4단계 정리0건0원/, "안 쓴 종류도 보임");
  const { stuck } = await import("../../admin-v4/js/pages/usage.mjs");
  const at = Date.parse("2026-11-24T05:11:00Z");
  assert.deepEqual(["2026-11-24T05:00:00Z", "2026-11-24T05:05:00Z"].map((t) => stuck({ status: "reserved", created_at: t }, at)), [true, false]);
});

test("AI 사용량: 종류를 누르면 프롬프트 팝업 — 지금 글 보기, [수정]→[저장], [기본 프롬프트로]는 저장값을 비움", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { PROMPTS } = await import("../../supabase/functions/comsw-tools/policy.mjs");
  const fake = fakeSupabase({ comsw_ai_jobs: [], site_settings: [{ key: "ai_prompt_roadmap", value: "직접 쓴 글" }] });
  fake.rpc = async () => ({ data: { month: "2026-11", used: 0, limit: 3000, remaining: 3000 }, error: null });
  const saves = () => fake.calls.filter(([k, t]) => k === "upsert" && t === "site_settings").map((c) => c[2]);
  const main = await open("usage", { uid: "u1", role: "head" }, fake);
  const pop = async (name) => {
    [...main.querySelectorAll("tr.pick")].find((tr) => tr.firstChild.textContent === name).click();
    await flush();
    const dlg = [...document.querySelectorAll("dialog.modal")].at(-1);
    return { dlg, area: dlg.querySelector("textarea"), btn: (t) => [...dlg.querySelectorAll("button")].find((b) => b.textContent === t) };
  };
  assert.deepEqual([...main.querySelectorAll("tr.pick")].map((tr) => tr.firstChild.textContent).sort(), ["강사 단계 문구", "공통 4단계 정리", "과정내용 정리", "로드맵 문구", "프로필 사진"]);

  let p = await pop("프로필 사진");
  assert.equal(p.area.value, PROMPTS.profile, "저장한 글이 없으면 기본");
  assert.equal(p.area.readOnly, true, "보기로 열림");
  assert.match(p.dlg.textContent, /기본 프롬프트/);
  p.btn("수정").click();
  type(p.area, "  새 사진 지시  ");
  const prev = globalThis.confirm;
  globalThis.confirm = () => false;
  p.btn("닫기").click();
  assert.ok(p.dlg.isConnected, "저장 안 한 글이 있으면 묻는다");
  globalThis.confirm = prev;
  p.btn("저장").click();
  await flush();
  assert.deepEqual(saves().at(-1), { key: "ai_prompt_profile", value: "새 사진 지시" });
  assert.equal(p.area.readOnly, true);
  assert.match(p.dlg.textContent, /직접 저장한 프롬프트[\s\S]*/);
  p.btn("닫기").click();

  p = await pop("로드맵 문구");
  assert.equal(p.area.value, "직접 쓴 글", "지금 적용된 글");
  p.btn("수정").click();
  type(p.area, " ");
  p.btn("저장").click();
  await flush();
  assert.equal(saves().length, 1, "빈 글은 저장 안 함");
  p.btn("기본 프롬프트로").click();
  p.btn("저장").click();
  await flush();
  assert.deepEqual(saves().at(-1), { key: "ai_prompt_roadmap", value: null });
  p.btn("닫기").click();
});

test("공통 4단계 초안 채우기: 한 명이면 그 강사 글·이미지, 여럿이면 글은 모두·이미지는 먼저 작성한 강사(없으면 다음)", async () => {
  const { fillFrom } = await import("../../admin-v4/js/pages/common-editor.mjs");
  const unit = (who, day, n, img = () => true) => ({ key: who, approved: Array.from({ length: n }, (_, i) => ({ summary: `${who}${i + 1}`, media_url: img(i) ? `https://x/${who}${i + 1}` : null, updated_at: `2026-11-${day}T00:00:00Z` })) });
  const a = unit("가", "20", 4, (i) => i !== 1), b = unit("나", "10", 4, (i) => i !== 0);
  assert.deepEqual(fillFrom([a])[0], { summary: "가1", image_url: "https://x/가1" });
  assert.deepEqual(fillFrom([a, b]).map((s) => s.summary), ["나1\n가1", "나2\n가2", "나3\n가3", "나4\n가4"]);
  assert.deepEqual(fillFrom([a, b]).map((s) => s.image_url), ["https://x/가1", "https://x/나2", "https://x/나3", "https://x/나4"], "먼저 작성한 '나', 없으면 '가'");
  assert.equal(fillFrom([unit("다", "01", 8)])[0].summary, "다1\n다2", "8단계는 둘씩 묶음");
  assert.deepEqual(fillFrom([])[0], { summary: "", image_url: "" });
});

test("과목 팝업: 공통이 비면 강사 자료 초안이 바로 보이고(창은 안 뜸), [수정]→[사이트 적용]으로 그대로 반영, 체크를 바꾸면 초안만 다시 채움", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : null, error: null }; };
  const row = (who, n, day) => ({ id: `${who}${n}`, instructor_id: who, set_id: "set1", subject_id: "s1", step_label: `${n}단계`, summary: `${who}글${n}`, media_url: `https://x/${who}${n}.png`, status: "approved", sort_order: n, updated_at: `2026-11-${day}T00:00:0${n}Z` });
  const local = fakeSupabase({
    instructors: [{ id: "i1", name: "김강사" }, { id: "i2", name: "이강사" }],
    instructor_subjects: [{ instructor_id: "i1", subject_id: "s1" }, { instructor_id: "i2", subject_id: "s1" }],
    instructor_curricula: [1, 2, 3, 4].flatMap((n) => [row("i1", n, "20"), row("i2", n, "10")]),
  });
  const base = fake.from.bind(fake);
  fake.from = (t) => (["instructors", "instructor_subjects", "instructor_curricula"].includes(t) ? local.from(t) : base(t));
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  const btn = (t) => [...dlg.querySelectorAll("button")].find((b) => b.textContent === t);
  assert.match(dlg.textContent, /강사 2명의 내용으로 채운 초안입니다\(아직 홈페이지에 공개되지 않음\)/);
  assert.match(dlg.querySelector(".step").textContent, /i2글1\ni1글1/);
  assert.equal(dlg.querySelector(".step img").getAttribute("src"), "https://x/i21.png", "먼저 작성한 강사 이미지");
  await flush();
  assert.ok(document.querySelector(".change-bar")?.hidden !== false, "열기만 하면 창 없음");
  btn("수정").click();
  await flush();
  const areas = () => [...dlg.querySelectorAll("textarea")];
  type(areas()[3], "직접 쓴 4");
  const check = (name) => [...dlg.querySelectorAll(".side-list label")].find((l) => l.textContent.includes(name)).querySelector("input");
  check("이강사").click();
  await flush();
  assert.deepEqual(areas().map((a) => a.value), ["i1글1", "i1글2", "i1글3", "직접 쓴 4"], "자동으로 채운 칸만 다시");
  barBtn("사이트 적용").click();
  await flush();
  const [, args] = calls.find(([n]) => n === "comsw_v4_confirm_common");
  assert.deepEqual(args.p_steps.map((s) => [s.summary, s.image_url]), [["i1글1", "https://x/i11.png"], ["i1글2", "https://x/i12.png"], ["i1글3", "https://x/i13.png"], ["직접 쓴 4", "https://x/i14.png"]]);
  assert.deepEqual(args.p_sources.map((s) => s.id), ["i11", "i12", "i13", "i14"]);
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("과목 팝업: 공통이 이미 있으면 덮지 않고, [강사 내용 가져오기]는 체크한 단계만 바꿈", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const local = fakeSupabase({
    subject_weeks: [1, 2, 3, 4].map((n) => ({ id: `x${n}`, subject_id: "s1", week_label: `${n}단계`, summary: `공개${n}`, image_url: "", sort_order: n })),
    instructor_curricula: [1, 2, 3, 4].map((n) => ({ id: `c${n}`, instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: `${n}단계`, summary: `강사글${n}`, media_url: `https://x/${n}.png`, status: "approved", sort_order: n, updated_at: "2026-11-20T00:00:00Z" })),
  });
  const base = fake.from.bind(fake);
  fake.from = (t) => (["subject_weeks", "instructor_curricula"].includes(t) ? local.from(t) : base(t));
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  const btn = (t) => [...dlg.querySelectorAll("button")].find((b) => b.textContent === t);
  assert.ok(!/초안/.test(dlg.textContent));
  btn("수정").click();
  await flush();
  assert.deepEqual([...dlg.querySelectorAll("textarea")].map((a) => a.value), ["공개1", "공개2", "공개3", "공개4"]);
  assert.ok(document.querySelector(".change-bar")?.hidden !== false, "[수정]만으로는 바뀐 설정 없음");
  dlg.querySelector("input[aria-label='1단계 AI로 문구 만들기']").click();
  btn("강사 내용 가져오기").click();
  await flush();
  assert.deepEqual([...dlg.querySelectorAll("textarea")].map((a) => a.value), ["공개1", "강사글2", "강사글3", "강사글4"]);
  assert.ok(barBtn("사이트 적용"));
  barBtn("취소").click();
  await flush();
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("학과 구성: 공통을 적용하기 전이면 강사 자료 초안으로 [AI 정리]·2·3·4 숫자·'초안 4단계 · 적용 전' 표시, 방학 특강 자료는 안 씀", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const { configureServices } = await import("../../admin/js/services.mjs");
  const asked = [];
  configureServices({ summarize: async (...args) => { asked.push(args); return { text: "01 하나\n02 둘\n03 셋\n04 넷" }; } });
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const row = (set, n, text) => ({ id: `${set}${n}`, instructor_id: "i1", set_id: set, subject_id: "s1", step_label: `${n}단계`, summary: `${text}${n}`, status: "approved", sort_order: n, updated_at: "2026-11-20T00:00:00Z" });
  const vac = "v1"; // 방학 특강
  const local = fakeSupabase({
    subject_weeks: [],
    instructor_curricula: [1, 2, 3, 4].flatMap((n) => [row("set1", n, "일반글"), row(vac, n, "방학글")]),
  });
  const base = fake.from.bind(fake);
  fake.from = (t) => (["subject_weeks", "instructor_curricula"].includes(t) ? local.from(t) : base(t));
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "학과 구성").click();
  const line = [...main.querySelectorAll(".dept-row")].find((r) => r.querySelector(".subject-chip").textContent === "캐드1");
  assert.match(line.querySelector(".dept-name").textContent, /초안 4단계 · 적용 전/);
  assert.equal(line.querySelector(".dept-count").hidden, false);
  assert.ok(document.querySelector(".change-bar")?.hidden !== false, "초안은 '바뀐 설정'이 아님");
  for (const c of main.querySelectorAll(".dept-ai")) if (c.checked !== (c.getAttribute("aria-label") === "캐드1 AI 정리")) c.click();
  [...main.querySelectorAll("button")].find((b) => b.textContent === "AI 정리").click();
  await flush();
  await flush();
  assert.equal(asked.length, 1);
  assert.match(String(asked[0].map((x) => x?.text ?? x)), /1단계: 일반글1\n2단계: 일반글2\n3단계: 일반글3\n4단계: 일반글4/);
  assert.ok(!JSON.stringify(asked).includes("방학글"));
  const now = [...main.querySelectorAll(".dept-row")].find((r) => r.querySelector(".subject-chip").textContent === "캐드1");
  assert.equal(now.querySelector("textarea").value, "01 하나\n02 둘\n03 셋\n04 넷");
  configureServices({});
});

test("강사 커리큘럼 탭: 담당에서 뺀 일반 과목은 맨 아래 '담당 아님', 담당에 넣으면 위로, 검수할 제출·방학 특강은 그대로", async () => {
  const row = (set, subject, status = "approved") => ({ id: `${set}${subject}${status}`, instructor_id: "i1", set_id: set, subject_id: subject, step_label: "1단계", summary: "글", status, sort_order: 0 });
  const openTab = async (mine, rows) => {
    document.querySelectorAll("dialog").forEach((d) => d.remove());
    const fake = db();
    const local = fakeSupabase({ instructor_subjects: mine.map((s) => ({ instructor_id: "i1", subject_id: s })), instructor_curricula: rows });
    const base = fake.from.bind(fake);
    fake.from = (t) => (["instructor_subjects", "instructor_curricula"].includes(t) ? local.from(t) : base(t));
    const main = await open("instructors", undefined, fake);
    main.querySelector("tr.pick").click();
    await flush();
    const dlg = document.querySelector("dialog.modal");
    [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
    return dlg;
  };
  const list = (dlg) => [...dlg.querySelector(".picks").children].map((x) => x.textContent.trim());
  const rows = [row("set1", "s1"), row("set1", "s2"), row("v1", "s1")];
  let dlg = await openTab(["s2"], rows);
  assert.deepEqual(list(dlg), ["캐드2 · 일반", "캐드1 · 2026 겨울", "담당 아님 1개 강사 소개에 안 나옴", "캐드1 · 일반"]);
  [...dlg.querySelectorAll(".picks button")].at(-1).click();
  assert.match(dlg.textContent, /담당 과목이 아니라서 홈페이지 강사 소개에 나오지 않습니다/);
  dlg = await openTab(["s1", "s2"], rows);
  assert.ok(!/담당 아님/.test(dlg.textContent), "담당에 넣으면 돌아옴");
  dlg = await openTab(["s2"], [...rows, row("set1", "s1", "pending")]);
  assert.ok(!/담당 아님/.test(list(dlg).join()), "검수할 제출이 있으면 아래로 내리지 않음");
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("공통 초안: 담당 강사만 처음 체크, 담당 강사 자료가 없으면 모두", async () => {
  const { assignedFirst } = await import("../../admin-v4/js/pages/common-editor.mjs");
  const a = { instructor_id: "i1" }, b = { instructor_id: "i2" };
  assert.deepEqual(assignedFirst([a, b], new Set(["i2"])), [b]);
  assert.deepEqual(assignedFirst([a, b], new Set(["i9"])), [a, b]);
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  fake.rpc = async (name) => ({ data: name === "comsw_v4_unpublished" ? false : null, error: null });
  const row = (who, n) => ({ id: `${who}${n}`, instructor_id: who, set_id: "set1", subject_id: "s1", step_label: `${n}단계`, summary: `${who}글${n}`, status: "approved", sort_order: n });
  const local = fakeSupabase({
    instructors: [{ id: "i1", name: "김강사" }, { id: "i2", name: "이강사" }],
    instructor_subjects: [{ instructor_id: "i2", subject_id: "s1" }],
    instructor_curricula: [1, 2, 3, 4].flatMap((n) => [row("i1", n), row("i2", n)]),
  });
  const base = fake.from.bind(fake);
  fake.from = (t) => (["instructors", "instructor_subjects", "instructor_curricula"].includes(t) ? local.from(t) : base(t));
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((x) => x.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  const label = (n) => [...dlg.querySelectorAll(".side-list label")].find((l) => l.textContent.includes(n));
  assert.equal(label("김강사").querySelector("input").checked, false);
  assert.match(label("김강사").textContent, /담당 아님/);
  assert.equal(label("이강사").querySelector("input").checked, true);
  assert.match(dlg.querySelector(".step").textContent, /i2글1/);
  assert.ok(!/i1글1/.test(dlg.querySelector(".step").textContent));
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

test("학생 사이트 강사 단계 크게 보기: 담당 과목의 단계만 넘겨 봄(PC·태블릿)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const file of ["Curriculum_full.html", "Curriculum_full_tablet.html"]) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    const fn = src.match(/async function getAllInstructorCurriculumFromSupabase[\s\S]*?return \{ items: items \};\s*\}/)[0];
    const run = new Function("fetchSupabaseRowsForSheet", "getSupabaseSourceId", "curriculumMatchKey", "buildInstructorCurriculumRecords", "getInstructorListFromSupabase", `${fn}; return getAllInstructorCurriculumFromSupabase("건축학과", "김강사");`);
    const rec = (instructor, subjectName) => ({ instructor, subjectName, title: "1단계" });
    const out = await run(async () => [], () => "", (x) => x.replace(/\s+/g, ""), () => [rec("김강사", "캐드 1"), rec("김강사", "뺀 과목"), rec("이강사", "캐드1")],
      async () => [{ name: "김강사", subjects: ["캐드1"] }, { name: "이강사", subjects: ["뺀 과목"] }]);
    assert.deepEqual(out.items.map((x) => x.subjectName), ["캐드 1"], file);
  }
});

test("학생 사이트 강사 소개: 과목 버튼은 보고 있는 학과의 과목만(PC·태블릿), 다른 학과를 고르면 강사 상세 닫힘", async () => {
  const { readFileSync } = await import("node:fs");
  for (const file of ["Curriculum_full.html", "Curriculum_full_tablet.html"]) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    const pick = (re) => src.match(re)[0];
    const code = [/function normalizeText\(v\)[\s\S]*?\n    \}/, /function splitMultiValue[\s\S]*?\n    \}/, /function curriculumMatchKey[\s\S]*?\n    \}/,
      /async function getInstructorListFromSupabase[\s\S]*?return instructors;\s*\}/].map(pick).join("\n");
    const lesson = (dept, name) => ["", dept, name, "1단계"];
    const sheets = {
      강사페이지: [["최강사", "모션그래픽학과, CG학과, AI학과", "CG1, 2D 모션1, AI자격증, 학과없음", "", "", ""], ["박강사", "CG학과", "CG1", "", "", ""]],
      전체: [lesson("CG", "CG1"), lesson("모션그래픽, CG", "2D모션1"), lesson("디자인·IT·AI 자격증", "AI자격증")],
    };
    const run = (dept) => new Function("fetchSupabaseRowsForSheet", "getRawValues", "convertDriveUrl", "INSTRUCTOR_SHEET_NAME", "CURRICULUM_SHEET_NAME",
      `${code}; return getInstructorListFromSupabase(${JSON.stringify(dept)});`)(async (s) => sheets[s], (r) => r, (x) => x, "강사페이지", "전체");
    const subjects = async (dept) => Object.fromEntries((await run(dept)).map((x) => [x.name, x.subjects]));
    assert.deepEqual(await subjects("모션그래픽학과"), { 최강사: ["2D 모션1"] }, file);
    assert.deepEqual(await subjects("CG학과"), { 최강사: ["CG1", "2D 모션1"], 박강사: ["CG1"] }, file);
    assert.deepEqual(await subjects("AI학과"), { 최강사: [] }, "'디자인·IT·AI 자격증'은 AI학과가 아님");
    assert.match(src, /function openPanel\(dept\) \{\s*closeInstructorLightbox\(true\);/);
  }
});
