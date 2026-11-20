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

test("메뉴: 관리 7개 + 강사 2개, 선생님은 강사 2개만", () => {
  const ids = (role) => menusFor(role).flatMap(([, l]) => l.map(([id]) => id));
  assert.deepEqual(ids("head"), ["instructors", "courses", "roadmap", "vacation", "prep", "seminars", "site", "mine", "profile"]);
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
  const main = await open("prep");
  const bases = [...main.querySelectorAll(".chips button")].map((b) => b.textContent);
  assert.deepEqual(bases, ["아트 드로잉", "캐드"].sort((a, b) => a.localeCompare(b, "ko")));
  [...main.querySelectorAll(".chips button")].find((b) => b.textContent === "캐드").click();
  assert.match(main.textContent, /적용 과목: 캐드1, 캐드2/);
  const contents = [...main.querySelectorAll("input[aria-label='내용']")].map((i) => i.value);
  assert.deepEqual(contents, ["삼각자", "ChatGPT"], "겹치는 삼각자는 한 번");
  assert.equal(document.querySelector(".change-bar")?.hidden ?? true, true, "바꾸기 전에는 창 없음");
  type(main.querySelector("input[aria-label='내용']"), "삼각자 2개");
  await flush();
  assert.ok(barBtn("임시 저장") && barBtn("사이트 적용"), "바꾸면 [임시 저장]/[사이트 적용]");
  barBtn("사이트 적용").click();
  await flush();
  assert.match(document.querySelector(".change-bar").textContent, /http:\/\/ 또는 https:\/\/로 시작/);
  type(main.querySelector("input[aria-label='내용']"), "삼각자");
  await flush();
  assert.equal(document.querySelector(".change-bar").hidden, true, "원래대로 돌아가면 창이 사라짐");
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
  const main = await open("prep");
  [...main.querySelectorAll(".chips button")].find((b) => b.textContent === "캐드").click();
  type(main.querySelector("input[aria-label='내용']"), "자");
  await flush();
  barBtn("임시 저장").click();
  await flush();
  barBtn("되돌리기").click();
  await flush();
  assert.equal(main.querySelector("input[aria-label='내용']").value, "삼각자");
  assert.equal(document.querySelector(".change-bar").hidden, true);
});

test("강사 검수: 강사를 누르면 팝업, 커리큘럼은 왼쪽 과목·오른쪽 내용, 4단계가 아니면 확정 잠김", async () => {
  const main = await open("instructors");
  [...main.querySelectorAll("tr.pick")][0].click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  assert.ok(dlg, "팝업");
  [...dlg.querySelectorAll(".tabs button")].find((b) => b.textContent === "커리큘럼").click();
  assert.ok(dlg.querySelector(".side-list .picks button"), "왼쪽 과목 목록");
  assert.match(dlg.textContent, /4단계가 모두 있어야 확정할 수 있습니다\(지금 1단계\)/);
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
  assert.match(main.textContent, /메뉴 없음/);
  const vac = await import("../../admin-v4/js/pages/vacation.mjs");
  await vac.render({ main });
  await flush();
  const box = [...main.querySelectorAll("label")].find((l) => l.textContent.includes("캐드2"));
  box.querySelector("input").click();
  await flush();
  barBtn("사이트 적용").click();
  await flush();
  const [name, args] = calls.find(([n]) => n === "comsw_v4_save_vacation");
  assert.equal(name, "comsw_v4_save_vacation");
  assert.deepEqual([...args.p_subjects].sort(), ["s1", "s2"]);
  assert.equal(args.p_id, "v1");
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
  assert.ok(main.querySelector(".drag-row[draggable]"));
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

test("과목 팝업: [AI 공통 정리]는 '공통 4단계' 옆, [닫기] 옆 [사이트 적용]은 그 과목만 바로 반영", async () => {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const fake = db();
  const calls = [];
  fake.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_v4_unpublished" ? false : null, error: null }; };
  const main = await open("courses", undefined, fake);
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  [...main.querySelectorAll("tr.pick")].find((tr) => tr.textContent.includes("캐드1")).click();
  await flush();
  const dlg = document.querySelector("dialog.modal");
  const right = [...dlg.querySelectorAll(".side-list > .box")][1];
  assert.match(right.textContent, /공통 4단계/);
  assert.ok([...right.querySelectorAll("button")].some((b) => b.textContent === "AI 공통 정리"), "AI 버튼은 오른쪽 '공통 4단계' 옆");
  const apply = [...dlg.querySelectorAll(".modal-head button")].find((b) => b.textContent === "사이트 적용");
  assert.ok(apply, "[닫기] 옆 [사이트 적용]");
  apply.click();
  await flush();
  assert.match(dlg.textContent, /바뀐 내용이 없습니다/);
  dlg.querySelector(".side-list input[type=checkbox]").click();
  dlg.querySelectorAll("textarea").forEach((t, i) => type(t, `문구${i + 1}`));
  apply.click();
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
