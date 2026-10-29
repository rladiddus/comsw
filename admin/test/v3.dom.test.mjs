// V3 시험판(admin-v3/): 설계 정책(1A·3·5·6B·7B·9D)을 지금 데이터 위에서 맞게 보여 주는지 가짜 DB로 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/admin-v3/" });
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.location = dom.window.location;
globalThis.localStorage = dom.window.localStorage;
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };

const data = () => ({
  instructors: [{ id: "i1", name: "김", is_listed: true, account_uid: "u1", sort_order: 0 }, { id: "i2", name: "이", is_listed: false, sort_order: 1 }],
  subjects: [
    { id: "s1", name: "포토샵", sort_order: 0, tools: "포토샵", dept_curriculum: "문구" }, { id: "s2", name: "웹1", sort_order: 1 },
    { id: "s3", name: "캐드", sort_order: 2 }, { id: "s4", name: "방특AI", is_vacation: true },
  ],
  departments: [{ id: "d1", name: "시각편집학과", sort_order: 0, is_active: true }, { id: "d2", name: "건축학과", sort_order: 1, is_active: true }],
  subject_departments: [{ subject_id: "s1", department_id: "d1" }, { subject_id: "s2", department_id: "d1" }, { subject_id: "s1", department_id: "d2" }, { subject_id: "s3", department_id: "d2" }],
  subject_weeks: [{ subject_id: "s1", week_label: "1단계", sort_order: 0 }],
  curriculum_sets: [{ id: "set1", name: "시각편집학과", department_id: "d1" }, { id: "v1", name: "2026 겨울", is_vacation: true }, { id: "v2", name: "2026 여름", is_vacation: true }],
  instructor_curricula: [
    { id: "c1", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "새 원문", media_url: "https://example.com/a.png", status: "pending", vacation: false, updated_at: "2026-10-27T01:00:00Z" },
    { id: "c5", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "옛 원문", status: "approved", vacation: false, updated_at: "2026-10-01T00:00:00Z" },
    { id: "c6", instructor_id: "i2", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "이 원문", status: "approved", vacation: false, updated_at: "2026-10-02T00:00:00Z" },
    { id: "c4", instructor_id: "i2", set_id: "v1", subject_id: "s4", step_label: "1단계", status: "approved", vacation: true, updated_at: "2026-10-20T00:00:00Z" },
    { id: "c7", instructor_id: "i2", set_id: "v2", subject_id: "s4", step_label: "1단계", status: "approved", vacation: true, updated_at: "2026-07-20T00:00:00Z" },
  ],
  instructor_profile_drafts: [{ instructor_id: "i2", name: "이", career: "새 경력", status: "pending", updated_at: "2026-10-25T00:00:00Z" }],
  instructor_departments: [{ instructor_id: "i1", department_id: "d1" }, { instructor_id: "i2", department_id: "d1" }],
  instructor_subjects: [{ instructor_id: "i1", subject_id: "s1" }],
  instructor_subject_materials: [
    { instructor_id: "i1", subject_id: "s1", tools: "포토샵, ChatGPT", supplies: "노트북\n포토샵 교재" },
    { instructor_id: "i2", subject_id: "s1", supplies: "노트북" },
  ],
  roadmap_tracks: [{ id: "t1", name: "디자인", department_id: "d1" }],
  roadmap_steps: [{ id: "rs1", track_id: "t1", position: 1, summary: "기초" }],
  roadmap_step_subjects: [{ step_id: "rs1", subject_id: "s1" }, { step_id: "rs1", subject_id: "s2" }],
  course_prep_items: [{ subject_id: "s1", category: "textbook", content: "포토샵 교재" }, { subject_id: "s3", category: "textbook", content: "포토샵 교재" }],
  site_settings: [{ key: "vacation_set_id", value: "v1" }],
  site_snapshots: [{ id: 7, created_at: "2026-10-27T03:00:00Z", rows: [] }],
  comsw_ai_jobs: [{ kind: "department", status: "failed", created_at: "2026-10-27T00:00:00Z" }],
  seminars: [], seminar_applications: [], recruitment_posts: [], media_assets: [], site_categories: [],
});
const sb = () => {
  const s = fakeSupabase(data());
  s.rpc = async () => ({ data: [], error: null });
  return s;
};
const v3 = await import("../../admin-v3/js/v3.mjs");
const page = async (file, ctx = {}) => {
  const { render } = await import(`../../admin-v3/js/pages/${file}.mjs`);
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  await render(c, { supabase: sb(), role: "admin", uid: "u1", email: "a@b", headActions: document.createElement("div"), ...ctx });
  await flush();
  return c;
};
const button = (c, text) => [...c.querySelectorAll("button")].find((b) => b.textContent === text);

test("V3 메뉴: 시안의 16메뉴(이름은 기존에 가까운 말)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../admin-v3/js/app.mjs", import.meta.url), "utf8");
  const labels = [...src.matchAll(/\["([a-z-]+)", "[^"]+", "([^"]+)",/g)].map((m) => m[2]);
  assert.deepEqual(labels, ["대시보드", "승인 대기", "준비물 검토", "학과 관리", "과목 관리", "학과별 과목 순서", "강사 관리", "강사 커리큘럼",
    "학과 커리큘럼", "로드맵", "수업별 준비물", "방학 특강", "사이트 반영", "내 커리큘럼", "내 프로필", "기본 설정 등"]);
});

test("V3 재료 검사: 칸 나누기·분류 제안·같은 과목 안 중복만", () => {
  assert.deepEqual(v3.splitItems("포토샵, ChatGPT\n- 노트북 · 1) 펜"), ["포토샵", "ChatGPT", "노트북", "펜"]);
  assert.equal(v3.guessCategory("ChatGPT"), "ai");
  assert.equal(v3.guessCategory("포토샵 교재"), "textbook");
  assert.equal(v3.guessCategory("노트북"), null);
  const out = v3.checkMaterials(v3.materialsOf(data().instructor_subject_materials[0]), ["노트북"]);
  assert.deepEqual(out.map((m) => `${m.label}:${m.teacher}>${m.suggested}:${m.issues.map((i) => i[0]).join("+")}`),
    ["포토샵:software>software:", "ChatGPT:software>ai:분류 확인", "노트북:supply>supply:중복 후보", "포토샵 교재:supply>textbook:분류 확인"]);
});

test("V3 전환 점검: 여러 학과 과목(7B)·여러 기수 방특(6B), 여러 과목 로드맵 단계는 허용", async () => {
  const list = await v3.audit(sb());
  assert.deepEqual(list.map(([t, , l]) => `${t}=${l.join(",")}`), [
    "여러 학과가 같이 쓰는 과목=포토샵", "여러 방특 기수에 쓰인 과목=방특AI", "정규·방특에 함께 쓰인 과목=",
  ]);
});

test("V3 승인 대기 → 재료 검토: 다 확인하기 전엔 승인으로 못 감, 프로필은 따로", async () => {
  v3.state.reviews.clear();
  location.hash = "#/inbox";
  let c = await page("inbox");
  const items = [...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent);
  assert.deepEqual(items, ["김 · 포토샵", "이 · 프로필"]);
  assert.match(c.textContent, /옛 원문[\s\S]*새 원문/);
  assert.match(c.textContent, /검토 0\/4/);
  assert.equal(c.querySelectorAll(".v2-diff button.submission-thumb img").length, 1, "새 제출본 이미지 미리보기");
  assert.equal(c.querySelectorAll(".v2-diff .submission-thumb.empty").length, 1, "이전 승인본은 이미지 없음");
  c.querySelector(".v2-diff button.submission-thumb").click();
  assert.ok(c.querySelector("dialog.image-zoom img"), "누르면 크게 보기");
  button(c, "과목 전체 승인").click();
  assert.match(decodeURIComponent(location.hash), /^#\/validation\/i1\|set1\|s1$/, "검토 전이면 재료 검토로 보냄");

  c = await page("validation");
  assert.match(c.textContent, /검토 0\/4/);
  button(c, "제안 수용").click();
  button(c, "전체 원본 유지로 검토 확정").click();
  assert.match(c.textContent, /검토 4\/4/);
  assert.equal(v3.state.reviews.get("i1|set1|s1").get("t1"), "ai", "ChatGPT는 제안대로 AI 도구");

  // 승인 대기에서 바로 승인: 빈 사이트 문구는 막고, 채우면 단계마다 문구 저장 + 기존 단계 승인 함수
  globalThis.confirm = () => true;
  location.hash = "#/inbox";
  const db = sb();
  const approvals = [];
  db.rpc = async (name, args) => { approvals.push([name, args]); return { data: null, error: null }; };
  c = await page("inbox", { supabase: db });
  assert.match(c.textContent, /준비물 검토 완료/);
  assert.ok(!/기존 승인 화면|방학 특강 승인 화면/.test(c.textContent), "기존 승인 화면은 없음");
  button(c, "과목 전체 승인").click();
  await flush();
  assert.match(c.textContent, /1단계 사이트 문구가 비어 있습니다/);
  assert.equal(approvals.length, 0);
  c.querySelector(".v2-panel textarea").value = "포토샵 기초";
  button(c, "과목 전체 승인").click();
  await flush();
  assert.deepEqual(approvals, [["comsw_approve_curriculum", { p_id: "c1" }]]);
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "instructor_curricula" && patch.summary === "포토샵 기초"));
  assert.match(c.textContent, /승인했습니다/);
});

test("V3 승인 대기 방특: 기수를 골라야 승인, 고른 기수로 옮겨 승인", async () => {
  const d = data();
  d.instructor_curricula = [{ id: "c9", instructor_id: "i1", set_id: "set1", subject_id: "s4", step_label: "1단계", written: "방특 원문", summary: "요약", status: "pending", vacation: true, updated_at: "2026-10-28T00:00:00Z" }];
  d.instructor_subject_materials = [];
  d.instructor_profile_drafts = [];
  d.site_settings = [];
  const db = fakeSupabase(d);
  const approvals = [];
  db.rpc = async (name, args) => { approvals.push([name, args]); return { data: null, error: null }; };
  v3.state.reviews.clear();
  v3.state.reviews.set("i1|set1|s4", new Map([["none", "none"]]));
  location.hash = "#/inbox";
  const c = await page("inbox", { supabase: db });
  button(c, "과목 전체 승인").click();
  await flush();
  assert.match(c.textContent, /담을 방특 기수를 골라주세요/);
  const pickCohort = [...c.querySelectorAll("select")].at(-1);
  pickCohort.value = "v2";
  button(c, "과목 전체 승인").click();
  await flush();
  assert.ok(db.calls.some(([k, , , patch]) => k === "update" && patch.set_id === "v2"));
  assert.deepEqual(approvals, [["comsw_approve_curriculum", { p_id: "c9" }]]);
});

test("V3 학과별 순서 → 로드맵·학과 커리큘럼이 같은 순서, 퇴사 시험은 출처에서 빠짐", async () => {
  v3.state.dept = "d1"; v3.state.mode = "regular"; v3.state.orders.clear(); v3.state.employed.clear(); v3.state.steps.clear();
  let c = await page("order");
  assert.deepEqual([...c.querySelectorAll(".v3-orderrow b")].map((b) => b.textContent), ["포토샵", "웹1"]);
  c.querySelector(".v3-orderrow").querySelectorAll("button")[1].click(); // 포토샵 ↓
  assert.deepEqual(v3.state.orders.get("d1:regular"), ["s2", "s1"]);
  c = await page("roadmap");
  const heads = () => [...c.querySelectorAll(".v2-panel-head h3")].map((h) => h.textContent);
  assert.deepEqual(heads(), ["STEP 1  웹1 + 포토샵"], "지금 로드맵에서 한 단계인 두 과목은 그대로 한 단계");
  assert.match(c.textContent, /로드맵 문구 있음/);
  button(c, "여기서 나누기").click();
  assert.deepEqual(heads(), ["STEP 1  웹1", "STEP 2  포토샵"]);
  assert.match(c.textContent, /묶음 바뀜 · 다시 요약 필요/);
  button(c, "다음 과목(포토샵)도 이 단계에").click();
  assert.deepEqual(heads(), ["STEP 1  웹1 + 포토샵"]);

  const { affected } = await import("../../admin-v3/js/pages/instructors.mjs");
  assert.equal(affected("i2", data().instructor_curricula.filter((x) => x.status === "approved"), data().curriculum_sets).length, 3);
  location.hash = "#/aggregate/s1";
  c = await page("aggregate");
  assert.match(c.textContent, /재직 강사 승인본 2명/);
  v3.state.employed.set("i2", false);
  c = await page("aggregate");
  assert.match(c.textContent, /재직 강사 승인본 1명/);
  assert.match(c.textContent, /다시 만들기 필요/);
  assert.match(c.textContent, /통합 제외\(퇴사\)/);
  v3.state.employed.clear(); v3.state.orders.clear(); v3.state.steps.clear();
});

test("V3 준비물: 과목 ID별로만 묶고 4분류 탭", async () => {
  const { catalog } = await import("../../admin-v3/js/pages/materials.mjs");
  const d = data();
  const rows = catalog("textbook", ["s1", "s3"], { prep: d.course_prep_items, subjects: d.subjects, teacherMats: d.instructor_subject_materials, dept: "d1" });
  assert.equal(rows.length, 2, "다른 과목의 같은 이름 교재는 합치지 않음");
  assert.equal(rows.find((r) => r.subject_id === "s1").teachers, 1);
  const c = await page("materials");
  assert.deepEqual([...c.querySelectorAll(".v2-tab")].map((t) => t.textContent), ["교재", "물품", "사용 프로그램", "AI 도구"]);
});

test("V3 모든 화면이 오류 없이 그려진다", async () => {
  for (const f of ["dashboard", "inbox", "validation", "depts", "subjects", "order", "instructors", "teachers", "aggregate", "roadmap", "materials", "vacation", "release", "legacy"]) { // mine·profile은 기존 화면이 Firebase(CDN)를 불러 테스트에서 못 염(V2 테스트와 같음)
    location.hash = `#/${f}`;
    const c = await page(f);
    assert.ok(!c.querySelector(".save-state.err"), `${f}: ${c.querySelector(".save-state.err")?.textContent}`);
    assert.ok(c.textContent.length > 20, f);
  }
  const c = await page("dashboard");
  assert.match(c.textContent, /데이터 검증 경고2/);
  const s = await page("subjects");
  assert.match(s.textContent, /학과별 분리 필요/);
});
