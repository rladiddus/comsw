// V2 시험판(admin-v2/)의 새 화면: 운영 데이터를 시안 모양으로 묶어 보여 주는지 가짜 DB로 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;

const data = () => ({
  instructors: [{ id: "i1", name: "김", is_listed: true }, { id: "i2", name: "이", is_listed: false }],
  subjects: [{ id: "s1", name: "포토샵", sort_order: 0, duration: "1개월" }, { id: "s2", name: "웹1", sort_order: 1 },
    { id: "s3", name: "캐드", sort_order: null }, { id: "s4", name: "방특AI", sort_order: null, is_vacation: true }],
  departments: [{ id: "d1", name: "시각편집학과", sort_order: 0 }],
  subject_departments: [{ subject_id: "s1", department_id: "d1" }, { subject_id: "s2", department_id: "d1" }],
  subject_weeks: [{ subject_id: "s1" }],
  curriculum_sets: [{ id: "set1", name: "시각편집학과" }],
  instructor_curricula: [
    { id: "c1", instructor_id: "i1", set_id: "set1", subject_id: "s1", status: "pending", vacation: false, updated_at: "2026-10-27T01:00:00Z" },
    { id: "c2", instructor_id: "i1", set_id: "set1", subject_id: "s1", status: "pending", vacation: false, updated_at: "2026-10-27T02:00:00Z" },
    { id: "c3", instructor_id: "i2", set_id: "set1", subject_id: "s4", status: "pending", vacation: true, updated_at: "2026-10-26T00:00:00Z" },
    { id: "c4", instructor_id: "i2", set_id: "set1", subject_id: "s2", status: "approved", vacation: false, updated_at: "2026-10-20T00:00:00Z" },
  ],
  instructor_profile_drafts: [{ instructor_id: "i2", status: "pending", updated_at: "2026-10-25T00:00:00Z" }],
  roadmap_step_subjects: [{ subject_id: "s1" }],
  course_prep_items: [],
  site_snapshots: [{ id: 7, created_at: "2026-10-27T03:00:00Z", published_by: "me" }],
});

test("V2 대시보드: 승인 대기는 묶음 단위(커리큘럼 1·방특 1·프로필 1), 단계 없는 과목, 마지막 반영", async () => {
  const { render } = await import("../../admin-v2/js/pages/dashboard.mjs");
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(data()) });
  const stats = [...c.querySelectorAll(".v2-stat")].map((s) => [s.querySelector(".v2-stat-label").textContent, s.querySelector(".v2-stat-num").textContent]);
  assert.deepEqual(stats, [["승인 대기", "3건"], ["현재 강사", "1명"], ["과목", "4개"], ["마지막 사이트 반영", "2026-10-27"]]);
  assert.match(c.textContent, /단계 없는 과목 1개/, "학과에 있는데 단계가 없는 웹1");
  assert.match(c.textContent, /커리큘럼 승인 요청 — 포토샵/);
  assert.match(c.textContent, /2단계/, "같은 묶음의 두 단계는 한 건");
});

test("V2 승인 대기 › 전체: 종류별로 한 목록, 줄을 누르면 그 종류 탭을 연다", async () => {
  const { render } = await import("../../admin-v2/js/pages/reviews.mjs");
  const body = document.createElement("div");
  body.className = "v2-body";
  const bar = document.createElement("div");
  bar.className = "tab-bar";
  let opened = "";
  for (const t of ["curricula", "vacation", "profiles"]) {
    const b = document.createElement("button");
    b.dataset.tab = t;
    b.addEventListener("click", () => { opened = t; });
    bar.append(b);
  }
  const c = document.createElement("div");
  body.append(bar, c);
  await render(c, { supabase: fakeSupabase(data()) });
  const rows = [...c.querySelectorAll("tbody tr")];
  assert.deepEqual(rows.map((r) => r.cells[0].textContent), ["커리큘럼", "방학 특강", "프로필"], "최근 순");
  rows[1].click();
  assert.equal(opened, "vacation");
});

test("V2 과목 관리 › 전체 과목: 학과 수업·단계 없음·기타·방특 상태와 필터", async () => {
  const { render } = await import("../../admin-v2/js/pages/subjects.mjs");
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(data()) });
  const state = () => [...c.querySelectorAll("tbody tr")].map((r) => `${r.cells[0].textContent}:${r.cells[5].textContent}`);
  assert.deepEqual(state(), ["포토샵:학과 수업", "웹1:단계 없음", "캐드:기타(학과 없음)", "방특AI:방학 특강"]);
  const [deptPick] = c.querySelectorAll("select");
  deptPick.value = "none";
  deptPick.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(state(), ["캐드:기타(학과 없음)", "방특AI:방학 특강"]);
  assert.match(c.querySelector(".v2-panel:last-child, .v2-grid2 > div").textContent, /쓰이는 곳/);
});

test("V2 사이트 반영: 마지막 반영본과 지금 내용을 시트별로 비교해 바뀐 줄만 센다", async () => {
  const { diffSheets } = await import("../../admin-v2/js/pages/publishing.mjs");
  const snap = [
    { source_id: "main", sheet_name: "로드맵", row_number: 1, data: { values: ["a"] } },
    { source_id: "main", sheet_name: "로드맵", row_number: 2, data: { values: ["b"] } },
    { source_id: "recruitment", sheet_name: "웹학과", row_number: 1, data: { values: ["x"] } },
  ];
  const now = new Map([
    ["main|로드맵", [{ row_number: 1, data: { values: ["a"] } }, { row_number: 2, data: { values: ["B"] } }, { row_number: 3, data: { values: ["c"] } }]],
    ["recruitment|웹학과", [{ row_number: 1, data: { values: ["x"] } }]],
  ]);
  assert.deepEqual(diffSheets(snap, now), [{ label: "로드맵", changed: 2, rows: 3 }], "고친 줄 1 + 새 줄 1, 같은 시트는 빼기");
});
