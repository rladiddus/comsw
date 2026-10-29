// V3 시험판(admin-v3/): 설계 정책(1A·3·5·6B·7·9D)을 지금 데이터 위에서 맞게 보여 주는지 가짜 DB로 확인한다.
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
  subject_weeks: [{ id: "w1", subject_id: "s1", week_label: "1단계", summary: "기초 단계", sort_order: 0 }],
  curriculum_sets: [{ id: "set1", name: "시각편집학과", department_id: "d1" }, { id: "v1", name: "2026 겨울", is_vacation: true }, { id: "v2", name: "2026 여름", is_vacation: true }, { id: "set2", name: "건축학과", department_id: "d2" }],
  instructor_curricula: [
    { id: "c1", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "새 원문", media_url: "https://example.com/a.png", status: "pending", vacation: false, updated_at: "2026-10-27T01:00:00Z" },
    { id: "c5", instructor_id: "i1", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "옛 원문", status: "approved", vacation: false, updated_at: "2026-10-01T00:00:00Z" },
    { id: "c6", instructor_id: "i2", set_id: "set1", subject_id: "s1", step_label: "1단계", written: "이 원문", media_url: "https://example.com/b.png", status: "approved", vacation: false, updated_at: "2026-10-02T00:00:00Z" },
    { id: "c8", instructor_id: "i1", set_id: "set2", subject_id: "s1", step_label: "1단계", status: "approved", vacation: false, updated_at: "2026-09-01T00:00:00Z" },
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
    "과목 통합 커리큘럼", "로드맵", "수업별 준비물", "방학 특강", "사이트 반영", "내 커리큘럼", "내 프로필", "기본 설정 등"]);
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

test("V3 전환 점검: 같은 과목을 여러 학과에 따로 낸 강사(7)·여러 기수 방특(6B), 공용 과목·여러 과목 로드맵 단계는 정상", async () => {
  const list = await v3.audit(sb());
  assert.deepEqual(list.map(([t, , l]) => `${t}=${l.join(",")}`), [
    "같은 과목을 여러 학과에 따로 낸 강사=김 · 포토샵", "여러 방특 기수에 쓰인 과목=방특AI", "정규·방특에 함께 쓰인 과목=",
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
  assert.ok(![...c.querySelectorAll("button")].some((b) => /^[↑↓]$/.test(b.textContent)), "위·아래 화살표 없음");
  const q = c.querySelector('input[type="search"]');
  q.value = "캐"; q.dispatchEvent(new dom.window.Event("input"));
  assert.match(c.textContent, /캐드/);
  q.value = "없는과목"; q.dispatchEvent(new dom.window.Event("input"));
  assert.match(c.textContent, /검색한 과목이 없습니다/);
  // 웹1을 끌어 포토샵 위쪽 절반에 놓으면 포토샵 앞(점선은 포토샵 위 경계)
  const [r1, r2] = c.querySelectorAll(".v3-orderrow");
  const drag = (node, type) => node.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: 0 }));
  drag(r2, "dragstart"); drag(r1, "dragover");
  assert.ok(r1.classList.contains("drop-before"));
  drag(r1, "drop");
  assert.deepEqual(v3.state.orders.get("d1:regular"), ["s2", "s1"]);
  c = await page("roadmap");
  const heads = () => [...c.querySelectorAll(".v2-panel-head h3")].map((h) => h.textContent);
  assert.deepEqual(heads(), ["STEP 1  웹1 + 포토샵"], "지금 로드맵에서 한 단계인 두 과목은 그대로 한 단계");
  assert.match(c.textContent, /묶은 단계 문구 \(과목 문구 2개를 요약\)기초/);
  button(c, "여기서 나누기").click();
  assert.deepEqual(heads(), ["STEP 1  웹1", "STEP 2  포토샵"]);
  assert.match(c.textContent, /과목 문구 없음/, "과목 하나만 든 단계가 없으면 과목 문구 없음");
  button(c, "다음 과목(포토샵)도 이 단계에").click();
  assert.deepEqual(heads(), ["STEP 1  웹1 + 포토샵"]);

  const { affected } = await import("../../admin-v3/js/pages/instructors.mjs");
  assert.equal(affected("i2", data().instructor_curricula.filter((x) => x.status === "approved"), data().curriculum_sets).length, 3);
  location.hash = "#/aggregate/s1";
  c = await page("aggregate");
  assert.ok(!c.textContent.includes("기여 강사와 출처"));
  assert.match(c.textContent, /통합 강사: 김, 이/);
  assert.equal(c.querySelector(".v3-aggtabs").hidden, false, "정규면 주차별·과목별 탭");
  // 왼쪽 과목의 '강사' 팝업: 수정 → × 빼기, 추가, 끌어서 순서, 완료
  c.querySelector(".v2-listitem.active button").click(); // 고른 과목(포토샵)의 강사
  const dlg = document.querySelector("dialog.v3-modal");
  const names = () => [...dlg.querySelectorAll(".v3-orderrow b")].map((b) => b.textContent);
  assert.deepEqual(names(), ["김", "이"]);
  assert.equal(dlg.querySelectorAll(".v3-x").length, 0);
  button(dlg, "수정").click();
  dlg.querySelector('.v3-x[title="이 빼기"]').click();
  assert.deepEqual(names(), ["김"]);
  const add = dlg.querySelector('select[aria-label="강사 추가"]');
  add.value = "i2"; add.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(names(), ["김", "이"]);
  const [t1, t2] = dlg.querySelectorAll(".v3-orderrow");
  drag(t2, "dragstart"); drag(t1, "dragover"); drag(t1, "drop");
  assert.deepEqual(names(), ["이", "김"]);
  button(dlg, "완료").click();
  assert.deepEqual(v3.state.picks.get("s1|regular"), ["i2", "i1"]);
  assert.match(c.textContent, /통합 강사: 이, 김/);
  assert.match(c.textContent, /다시 만들기 필요/);
  // AI생성: 3줄 고르면 01, 02, 03 지시 + 명단 강사 원문, '저장'은 과목 문구
  const { configureServices } = await import("../../admin/js/services.mjs");
  let asked = null;
  const out = "01 가\n02 나\n03 다";
  configureServices({ summarize: async (kind, text) => { asked = [kind, text]; return { text: out }; } });
  const db = sb();
  location.hash = "#/aggregate/s1";
  c = await page("aggregate", { supabase: db });
  [...c.querySelectorAll(".v3-lines button")].find((b) => b.textContent === "3").click();
  button(c, "AI생성").click();
  await flush();
  assert.equal(asked[0], "department");
  assert.match(asked[1], /3줄로 정리: 각 줄은 01, 02, 03로 시작/);
  assert.match(asked[1], /- 이 원문\n- 옛 원문/);
  assert.equal(c.querySelector("textarea").value, out);
  button(c, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "subjects" && patch.dept_curriculum === out));
  configureServices();
  // 대표 이미지: 팝업에서 강사 이미지를 고르면 사이트 단계 이미지로 저장
  button(c, "대표 이미지 수정").click();
  document.querySelector("dialog.v3-modal .v3-imgpick").click();
  await flush();
  assert.ok(db.calls.some(([k, t, id, patch]) => k === "update" && t === "subject_weeks" && patch.image_url === "https://example.com/b.png"));
  // 과목별 커리큘럼: 학과 순서대로 표, 수정 → 저장(실제), 제외(V3 순서에서만)
  v3.state.orders.clear();
  [...c.querySelectorAll(".v3-aggtabs button")][1].click();
  const rowsOf = () => [...c.querySelectorAll(".dept-curriculum-row:not(.v3-headrow)")];
  assert.deepEqual(rowsOf().map((r) => r.querySelector("input").value), ["포토샵", "웹1"]);
  assert.match(c.textContent, /학과별 커리큘럼 요약/);
  const first = rowsOf()[0];
  button(first, "수정").click();
  first.querySelector(".cell-duration input").value = "2개월";
  button(first, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "subjects" && patch.duration === "2개월" && patch.name === "포토샵"));
  button(rowsOf()[1], "제외").click();
  assert.deepEqual(v3.state.orders.get("d1:regular"), ["s1"]);
  v3.state.orders.clear(); v3.state.aggTab = "weeks";
  v3.state.mode = "vacation";
  c = await page("aggregate");
  assert.equal(c.querySelector(".v3-aggtabs").hidden, true, "방특이면 탭 없음");
  v3.state.mode = "regular";
  v3.state.picks.clear(); v3.state.aiLines = 2;
  v3.state.employed.set("i2", false);
  c = await page("aggregate");
  assert.match(c.textContent, /통합 강사: 김(?!,)/);
  assert.match(c.textContent, /다시 만들기 필요/);
  v3.state.employed.clear(); v3.state.orders.clear(); v3.state.steps.clear();
});

test("V3 준비물: 4분류 탭 안에서 바로 등록·수정, 사용 프로그램은 과목 칸 저장", async () => {
  v3.state.dept = "d1"; v3.state.mode = "regular";
  const db = sb();
  const c = await page("materials", { supabase: db });
  assert.deepEqual([...c.querySelectorAll(".v2-tab")].map((t) => t.textContent), ["교재", "물품", "사용 프로그램", "AI 도구"]);
  assert.ok(!/품목 등록·수정/.test(c.textContent), "아래 따로 있던 기존 화면 없음");
  assert.ok(button(c, "+ 추가"), "교재 탭 안에 등록");
  assert.ok(c.querySelector(".prep-subject"), "이 학과 과목(포토샵)의 교재 카드");
  c.querySelectorAll(".v2-tab")[1].click();
  await flush();
  assert.ok(c.querySelector('textarea[placeholder="물품 내용"]'), "물품 탭은 '물품' 이름으로");
  c.querySelectorAll(".v2-tab")[2].click();
  const box = c.querySelector(".v2-mini-card textarea");
  assert.equal(box.value, "포토샵");
  box.value = "포토샵, 라이트룸";
  button(c, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "subjects" && patch.tools === "포토샵, 라이트룸"));
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
  assert.match(s.textContent, /여러 학과 공용/);
  assert.ok(!/학과별 분리|고유 ID/.test(s.textContent));
});
