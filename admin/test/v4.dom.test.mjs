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

async function open(file, session = { uid: "u1", role: "head" }) {
  data.useDb(db());
  const main = document.getElementById("content");
  const { render } = await import(`../../admin-v4/js/pages/${file}.mjs`);
  await render({ main, session, params: [] });
  await flush();
  return main;
}

test("준비물: 캐드1·캐드2를 '캐드' 하나로 묶고 겹치는 것은 한 번, http(s) 아닌 링크는 걸지 않음", async () => {
  const main = await open("prep");
  const bases = [...main.querySelectorAll(".chips button")].map((b) => b.textContent);
  assert.deepEqual(bases, ["아트 드로잉", "캐드"].sort((a, b) => a.localeCompare(b, "ko")));
  [...main.querySelectorAll(".chips button")].find((b) => b.textContent === "캐드").click();
  assert.match(main.textContent, /적용 과목: 캐드1, 캐드2/);
  assert.equal(main.textContent.match(/삼각자/g).length, 1);
  assert.equal(main.querySelector("a[href^='javascript']"), null);
});

test("학과·과목: 학과 구성 순서, 6단계 과목은 '4단계로 다시 정리 필요'", async () => {
  const main = await open("courses");
  assert.match(main.textContent, /과목 2개/);
  assert.ok(main.textContent.indexOf("캐드1") < main.textContent.indexOf("캐드2"));
  [...main.querySelectorAll(".tabs button")].find((b) => b.textContent === "전체 과목").click();
  assert.match(main.textContent, /6단계 · 4단계로 다시 정리 필요/);
  assert.match(main.textContent, /2026 겨울/);
});

test("내 커리큘럼: 본인 학과만, 대기 줄이 있으면 '이번 제출'로 보여 줌", async () => {
  const main = await open("mine", { uid: "u1", role: "teacher" });
  assert.match(main.textContent, /건축학과/);
  assert.doesNotMatch(main.textContent, /시각학과/);
  assert.match(main.textContent, /새 제출/);
  assert.match(main.textContent, /제출함 · 검수 전/);
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
  [...main.querySelectorAll("button")].find((b) => b.textContent === "과목 삭제").click();
  await flush();
  assert.deepEqual(calls.find(([n]) => n === "comsw_v4_delete_subject"), ["comsw_v4_delete_subject", { p_id: "s2" }]);

  const people = await import("../../admin-v4/js/pages/instructors.mjs");
  await people.render({ main, params: [] });
  await flush();
  const btn = [...main.querySelectorAll("button")].find((b) => b.textContent === "노출");
  btn.click();
  await flush();
  assert.deepEqual(calls.at(-1), ["comsw_v4_set_instructor_listed", { p_id: "i1", p_listed: false }]);
  assert.match(main.textContent, /반영하지 않은 다른 변경/);
  assert.equal([...main.querySelectorAll("button")].find((b) => b.textContent === "노출")?.disabled, false, "실패하면 그대로(노출), 다시 누를 수 있음");
});
