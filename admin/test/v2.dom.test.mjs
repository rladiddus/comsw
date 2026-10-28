// V2 시험판(admin-v2/): 시안 모양 화면이 운영 데이터를 맞게 묶어 보여 주는지 가짜 DB로 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/admin-v2/" });
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.location = dom.window.location;
globalThis.localStorage = dom.window.localStorage;
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };

const data = () => ({
  instructors: [
    { id: "i1", name: "김", is_listed: true, account_uid: "u1", photo_url: "p.webp", sort_order: 0 },
    { id: "i2", name: "이", is_listed: false, account_uid: null, sort_order: 1 },
  ],
  subjects: [
    { id: "s1", name: "포토샵", sort_order: 0, duration: "1개월" }, { id: "s2", name: "웹1", sort_order: 1 },
    { id: "s3", name: "캐드", sort_order: null }, { id: "s4", name: "방특AI", sort_order: null, is_vacation: true },
  ],
  departments: [{ id: "d1", name: "시각편집학과", sort_order: 0, is_active: true, description: "소개" }],
  site_categories: [{ id: "c1", is_active: true }],
  subject_departments: [{ subject_id: "s1", department_id: "d1" }, { subject_id: "s2", department_id: "d1" }],
  subject_weeks: [{ id: "w1", subject_id: "s1", week_label: "1단계", written: "원문", summary: "요약", sort_order: 0 }],
  curriculum_sets: [{ id: "set1", name: "시각편집학과", department_id: "d1" }, { id: "v1", name: "2026 겨울방학특강", is_vacation: true }],
  instructor_curricula: [
    { id: "c1", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "새 원문", summary: "", status: "pending", vacation: false, updated_at: "2026-10-27T01:00:00Z" },
    { id: "c2", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "2단계", written: "둘", summary: "요약", status: "pending", vacation: false, updated_at: "2026-10-27T02:00:00Z" },
    { id: "c5", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "옛 원문", summary: "옛 요약", status: "approved", vacation: false, updated_at: "2026-10-01T00:00:00Z" },
    { id: "c3", instructor_id: "i2", set_id: "set1", subject_id: "s4", step_label: "1단계", status: "pending", vacation: true, updated_at: "2026-10-26T00:00:00Z" },
    { id: "c4", instructor_id: "i2", set_id: "v1", subject_id: "s4", step_label: "1단계", summary: "", status: "approved", vacation: true, updated_at: "2026-10-20T00:00:00Z" },
  ],
  instructor_profile_drafts: [{ instructor_id: "i2", name: "이", career: "새 경력", status: "pending", updated_at: "2026-10-25T00:00:00Z" }],
  instructor_departments: [{ instructor_id: "i1", department_id: "d1" }],
  instructor_subjects: [{ instructor_id: "i1", subject_id: "s1" }],
  instructor_subject_materials: [{ instructor_id: "i1", subject_id: "s1", tools: "피그마" }],
  roadmap_tracks: [{ id: "t1", name: "디자인 로드맵", department_id: "d1", sort_order: 0 }],
  roadmap_steps: [{ id: "rs1", track_id: "t1", position: 1, summary: "기초" }, { id: "rs2", track_id: "t1", position: 2, summary: "실무" }],
  roadmap_step_subjects: [{ step_id: "rs1", subject_id: "s1" }, { step_id: "rs2", subject_id: "s2" }],
  course_prep_items: [
    { id: "p1", subject_id: "s1", category: "ai", content: "ChatGPT" }, { id: "p2", subject_id: "s2", category: "ai", content: "chat gpt" },
    { id: "p3", subject_id: "s1", category: "textbook", content: "교재A" },
  ],
  seminars: [{ id: "se1", title: "포트폴리오 특강", datetime_text: "2020년 1월 1일 14:00", capacity: 2, sort_order: 0 }],
  seminar_applications: [{ seminar_id: "se1", created_at: "2020-01-01T00:00:00Z" }],
  recruitment_posts: [{ id: "r1", department_id: "d1", company: "가상회사", job_title: "디자이너", deadline: "상시", sort_order: 0 }],
  site_settings: [{ key: "vacation_set_id", value: "v1" }],
  site_snapshots: [{ id: 7, created_at: "2026-10-27T03:00:00Z", published_by: "u1", rows: [{ source_id: "main", sheet_name: "로드맵", row_number: 1, data: { values: ["a"] } }] }],
  comsw_ai_jobs: [{ kind: "week", status: "failed", budget_krw: 10, month: "2026-10", created_at: "2026-10-27T00:00:00Z" }],
  media_assets: [{ kind: "curriculum", filename: "a.webp", byte_size: 2048, created_at: "2026-10-27T00:00:00Z" }],
});
const sb = () => {
  const s = fakeSupabase(data());
  s.rpc = async (name) => (name === "comsw_preview_rows" ? { data: [{ row_number: 1, data: { values: ["b"] } }], error: null }
    : name === "comsw_ai_budget" ? { data: { month: "2026-10", used: 10, limit: 3000, remaining: 2990 }, error: null } : { data: null, error: null });
  return s;
};
const page = async (file, ctx = {}) => {
  const { render } = await import(`../../admin-v2/js/pages/${file}.mjs`);
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  await render(c, { supabase: sb(), role: "admin", uid: "u1", email: "a@b", headActions: document.createElement("div"), ...ctx });
  await flush();
  return c;
};
const statNums = (c) => [...c.querySelectorAll(".v2-stat")].map((s) => `${s.querySelector(".v2-stat-label").textContent}=${s.querySelector(".v2-stat-num").textContent}`);
const rowsOf = (c) => [...c.querySelectorAll(".v2-table tbody tr")].map((r) => [...r.cells].map((td) => td.textContent).join("|"));

test("V2 메뉴: 시안의 7묶음·16메뉴, 이름은 기존에 가까운 말", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../admin-v2/js/app.mjs", import.meta.url), "utf8");
  const labels = [...src.matchAll(/\["([a-z-]+)", "[^"]+", "([^"]+)",/g)].map((m) => m[2]);
  assert.deepEqual(labels, ["대시보드", "승인 대기", "학과 관리", "과목 관리", "커리큘럼 관리", "강사 관리", "로드맵", "수업별 준비물",
    "방학 특강", "특강·세미나", "채용 공고", "기본 설정", "사이트 반영", "시스템 설정", "내 커리큘럼", "내 프로필"]);
});

test("V2 대시보드: 승인 대기(묶음)·반영 전 변경·정리 필요 과목·마감 임박 행사", async () => {
  const c = await page("dashboard");
  assert.deepEqual(statNums(c), ["승인 대기=3", "반영 전 변경=1", "정리 필요 과목=3", "마감 임박 행사=0"]);
  assert.match(c.textContent, /커리큘럼 승인 요청 — 포토샵/);
  assert.match(c.textContent, /반영 전 변경 1곳 점검/);
  assert.match(c.textContent, /시각편집학과50% · 과목 2개/, "포토샵은 단계·문구 있음, 웹1은 단계 없음");
});

test("V2 선생님 대시보드: 내 담당 과목·승인 대기", async () => {
  const c = await page("dashboard", { role: "teacher" });
  assert.deepEqual(statNums(c), ["담당 과목=1", "승인된 커리큘럼=1", "승인 대기=1", "수정 요청=0"]);
});

test("V2 승인 대기: 목록·재제출 표시·기존 승인본 비교·커리큘럼 수정 요청은 잠금", async () => {
  const c = await page("reviews");
  const items = [...c.querySelectorAll(".v2-listitem")].map((x) => x.querySelector("b").textContent + "/" + x.querySelector(".v2-chip").textContent);
  assert.deepEqual(items, ["포토샵 커리큘럼/재제출", "방특AI 방학 특강/승인 대기", "강사 프로필 수정/승인 대기"]);
  assert.match(c.textContent, /옛 원문[\s\S]*새 원문/, "기존 승인본 vs 이번 제출본");
  assert.match(c.textContent, /1단계에 사이트 문구가 비어/);
  assert.match(c.textContent, /과목 공통 프로그램·준비물에 합쳐집니다/);
  const ask = [...c.querySelectorAll("button")].find((b) => b.textContent === "수정 요청");
  assert.equal(ask.disabled, true);
  c.querySelectorAll(".v2-listitem")[2].click();
  assert.equal([...c.querySelectorAll("button")].find((b) => b.textContent === "수정 요청").disabled, false, "프로필은 바로 수정 요청");
});

test("V2 학과·과목·강사·준비물: 시안 카드와 목록", async () => {
  let c = await page("departments");
  assert.deepEqual(statNums(c), ["운영 중 학과=1", "사이트 카테고리=1", "소개 미완성=0", "이미지 없음=1"]);
  assert.deepEqual(rowsOf(c), ["시각편집학과|—|2개|1명|운영 중"]);
  c = await page("subjects");
  assert.deepEqual(rowsOf(c).map((r) => r.split("|")[0] + ":" + r.split("|")[5]), ["포토샵:운영 중", "웹1:단계 없음", "캐드:학과 미연결", "방특AI:방학 특강"]);
  c = await page("instructors");
  assert.deepEqual(statNums(c), ["등록 강사=2", "계정 연결=1", "연결 필요=1", "프로필 검토=1"]);
  c = await page("materials");
  assert.deepEqual(rowsOf(c)[0].split("|").slice(0, 3), ["ChatGPT", "AI 도구", "2개 과목"], "띄어쓰기·대소문자가 달라도 같은 품목");
});

test("V2 커리큘럼·로드맵·방특·특강·채용·시스템·기본 설정이 그려진다", async () => {
  let c = await page("curricula");
  assert.match(c.textContent, /1단계/); assert.match(c.textContent, /김 강사/);
  c = await page("roadmaps");
  assert.match(c.textContent, /STEP 01[\s\S]*포토샵[\s\S]*STEP 02[\s\S]*웹1/);
  c = await page("vacations");
  assert.match(statNums(c).join(), /현재 기수=2026 겨울방학특강/);
  c = await page("seminars");
  assert.deepEqual(rowsOf(c), ["포트폴리오 특강|2020년 1월 1일 14:00|—|1 / 2|종료"]);
  c = await page("recruitment");
  assert.match(rowsOf(c)[0], /상시$/);
  c = await page("system");
  assert.deepEqual(statNums(c), ["AI 이번 달 예약액=₩10", "AI 작업=1", "올린 파일=1", "실패한 작업=1"]);
  c = await page("site-editor");
  assert.equal(c.querySelector("iframe").getAttribute("src"), "../index.html");
});

test("V2 사이트 반영: 바뀐 곳·검사·반영 기록", async () => {
  const c = await page("publishing");
  assert.deepEqual(statNums(c), ["현재 반영본=7번", "반영 전 바뀐 곳=1곳", "검사 경고=2건", "이전 반영본=없음"]);
  assert.match(c.textContent, /로드맵1줄/);
});

test("V2 날짜 읽기·특강/공고 상태·바뀐 줄 세기", async () => {
  const { parseDate, daysFrom } = await import("../../admin-v2/js/ui.mjs");
  const { seminarState } = await import("../../admin-v2/js/pages/seminars.mjs");
  const { postState } = await import("../../admin-v2/js/pages/recruitment.mjs");
  const { diffSheets } = await import("../../admin-v2/js/pages/publishing.mjs");
  const now = new Date(2026, 9, 28);
  assert.equal(daysFrom(parseDate("2026년 11월 3일 14:00", now), now), 6);
  assert.equal(daysFrom(parseDate("11.10", now), now), 13);
  assert.equal(parseDate("상시 채용", now), null);
  assert.deepEqual(seminarState(parseDate("2026.11.30", now), 5, 5, now), ["정원 마감", "red"]);
  assert.deepEqual(postState("2026-11-01", now), ["마감 임박", "warn"]);
  assert.deepEqual(postState("2026-10-01", now), ["마감", ""]);
  const snap = [{ source_id: "main", sheet_name: "로드맵", row_number: 1, data: { v: 1 } }, { source_id: "main", sheet_name: "로드맵", row_number: 2, data: { v: 2 } }];
  assert.deepEqual(diffSheets(snap, new Map([["main|로드맵", [{ row_number: 1, data: { v: 1 } }, { row_number: 2, data: { v: 3 } }]]])), [{ label: "로드맵", changed: 1, rows: 2 }]);
});
