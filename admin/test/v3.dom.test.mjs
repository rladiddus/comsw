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
  v3.state.dept = "d1"; v3.state.mode = "regular"; v3.state.orders.clear(); v3.state.employed.clear(); v3.state.roadmap.clear();
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
  v3.state.mode = "vacation"; // 로드맵은 정규만 → 들어가면 정규
  c = await page("roadmap");
  assert.equal(v3.state.mode, "regular");
  assert.ok(!button(c, "정규") && !button(c, "방특"), "정규·방특 버튼 없음");
  const left = () => [...c.querySelectorAll(".v3-dragsrc b")].map((b) => b.textContent);
  assert.deepEqual(left(), ["1. 웹1", "2. 포토샵"], "왼쪽 과목은 과목 통합 커리큘럼 순서");
  const boxesOf = () => [...c.querySelectorAll(".v3-step:not(.v3-stepadd)")];
  const stepSubs = () => boxesOf().map((b) => [...b.querySelectorAll(".v3-stepsub .v2-grow")].map((x) => x.textContent));
  assert.deepEqual(stepSubs(), [["포토샵", "웹1"]], "처음 = 지금 로드맵 단계");
  // 스텝 안 과목 위아래 끌기: 웹1을 포토샵 위로
  const [k1, k2] = boxesOf()[0].querySelectorAll(".v3-stepsub");
  drag(k2, "dragstart"); drag(k1, "dragover"); drag(k1, "drop");
  assert.deepEqual(stepSubs(), [["웹1", "포토샵"]]);
  assert.match(boxesOf()[0].textContent, /기초/);
  assert.ok(!c.textContent.includes("요약 있음"));
  assert.ok(!c.textContent.includes("로드맵 문구 고치기"), "아래 기존 화면 없음");
  assert.equal(button(boxesOf()[0], "AI 요약").disabled, true, "문구가 있고 바뀐 것이 없으면 AI 요약 꺼짐");
  assert.ok(c.querySelector("button.v3-step.v3-stepadd"), "스텝 추가는 스텝 박스 모양(점선)");
  button(c, "+ 스텝 추가").click();
  assert.deepEqual(stepSubs(), [["웹1", "포토샵"], []]);
  assert.equal(button(boxesOf()[1], "AI 요약").disabled, true, "과목이 없으면 꺼짐");
  // 왼쪽 웹1을 끌어 STEP 2에 놓으면 STEP 1에서 옮겨 감
  const src = c.querySelectorAll(".v3-dragsrc")[0];
  const box2 = boxesOf()[1];
  drag(src, "dragstart"); drag(box2, "dragover");
  assert.ok(box2.classList.contains("drop-on"));
  drag(box2, "drop");
  assert.deepEqual(stepSubs(), [["포토샵"], ["웹1"]]);
  assert.match(c.textContent, /STEP 2/);
  // 스텝 끌어서 순서 바꾸기
  drag(boxesOf()[1], "dragstart"); drag(boxesOf()[0], "dragover"); drag(boxesOf()[0], "drop");
  assert.deepEqual(stepSubs(), [["웹1"], ["포토샵"]]);
  drag(boxesOf()[1], "dragstart"); drag(boxesOf()[0], "dragover"); drag(boxesOf()[0], "drop");
  assert.deepEqual(stepSubs(), [["포토샵"], ["웹1"]]);
  assert.equal(button(boxesOf()[0], "AI 요약").disabled, false, "과목이 바뀌면 AI 요약 켜짐");
  // AI 요약: 스텝 과목의 문구로 roadmap 요약
  const { configureServices: cfg } = await import("../../admin/js/services.mjs");
  let askedR = null;
  cfg({ summarize: async (kind, text) => { askedR = [kind, text]; return { text: "로드맵 요약" }; } });
  button(boxesOf()[1], "AI 요약").click();
  await flush();
  assert.deepEqual(askedR, ["roadmap", "웹1:"]);
  assert.match(boxesOf()[1].textContent, /로드맵 요약/);
  assert.equal(button(boxesOf()[1], "AI 요약").disabled, true);
  cfg();
  // 과목 삭제 → − 로 빼기, 스텝 삭제
  assert.equal(boxesOf()[0].querySelectorAll(".v3-x").length, 0);
  button(boxesOf()[0], "과목 삭제").click();
  boxesOf()[0].querySelector('.v3-x[title="포토샵 빼기"]').click();
  assert.deepEqual(stepSubs(), [[], ["웹1"]]);
  button(boxesOf()[0], "스텝 삭제").click();
  assert.deepEqual(stepSubs(), [[], ["웹1"]], "확인 전에는 그대로");
  const del = document.querySelector("dialog.v3-modal");
  assert.match(del.textContent, /정말 STEP 1을 삭제하시나요\?/);
  button(del, "삭제").click();
  assert.ok(c.querySelector(".v3-steplist"), "스텝 박스만 스크롤되는 칸");
  assert.deepEqual(stepSubs(), [["웹1"]]);

  const { affected } = await import("../../admin-v3/js/pages/instructors.mjs");
  assert.equal(affected("i2", data().instructor_curricula.filter((x) => x.status === "approved"), data().curriculum_sets).length, 3);
  location.hash = "#/aggregate/s1";
  c = await page("aggregate");
  assert.ok(!c.textContent.includes("기여 강사와 출처"));
  assert.ok(!c.textContent.includes("통합 강사:"), "주차별 오른쪽 위 강사 줄 없음");
  assert.ok(!c.textContent.includes("과목 통합 커리큘럼 고치기"), "아래 기존 화면 없음");
  assert.match(c.querySelector(".v2-listitem.active").textContent, /통합 강사 2명/);
  assert.ok(c.querySelector(".v3-splitter"), "가운데 경계 끌기");
  assert.equal(c.querySelector(".v3-aggtabs").hidden, false, "정규면 주차별·과목별 탭");
  // 왼쪽 과목의 '강사' 팝업: 두 명씩, '−'로 바로 빼기, [추가]는 더 넣을 강사가 있을 때만, 완료
  c.querySelector(".v2-listitem.active button").click(); // 고른 과목(포토샵)의 강사
  let dlg = document.querySelector("dialog.v3-modal");
  const names = () => [...dlg.querySelectorAll(".v3-tchip b")].map((b) => b.textContent);
  assert.deepEqual(names(), ["김", "이"]);
  assert.ok(!button(dlg, "수정"), "수정 버튼 없음");
  assert.ok(!dlg.querySelector(".v3-orderrow, .v2-num"), "순서·번호 없음");
  assert.deepEqual([...dlg.querySelectorAll(".v2-actions button")].map((b) => b.textContent), ["취소", "추가", "완료"]);
  assert.equal(button(dlg, "추가").disabled, true, "더 넣을 강사가 없으면 추가 꺼짐");
  dlg.querySelector('.v3-x[title="김 빼기"]').click();
  assert.deepEqual(names(), ["이"]);
  assert.equal(button(dlg, "추가").disabled, false);
  button(dlg, "추가").click();
  button(dlg, "+ 김").click();
  assert.deepEqual(names(), ["이", "김"]);
  const saveBtn = () => button(c.querySelector(".v3-gridagg > .v2-panel"), "저장"); // 왼쪽 '과목' 칸의 저장
  assert.equal(saveBtn().disabled, true, "바꾼 것이 없으면 저장 꺼짐");
  button(dlg, "완료").click();
  assert.equal(v3.state.picks.has("s1|regular"), false, "저장 전에는 그대로");
  assert.equal(saveBtn().disabled, false);
  saveBtn().click();
  assert.deepEqual(v3.state.picks.get("s1|regular"), ["i2", "i1"]);
  assert.deepEqual(JSON.parse(localStorage.getItem("v3.picks")), [["s1|regular", ["i2", "i1"]]], "이 브라우저에 저장");
  assert.equal(saveBtn().disabled, true);
  // 창 밖을 누르면 닫힘
  c.querySelector(".v2-listitem.active button").click();
  dlg = document.querySelector("dialog.v3-modal");
  dlg.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, clientX: 5000, clientY: 5000 }));
  assert.equal(document.querySelector("dialog.v3-modal"), null);
  // 주차별 탭: 통합 문구는 없고(과목별 탭으로), 단계 카드마다 대표 이미지 수정 · AI생성 · 저장
  assert.ok(!c.textContent.includes("과목 통합본"));
  assert.ok(!c.textContent.includes("과목 통합 커리큘럼 문구"));
  const { configureServices } = await import("../../admin/js/services.mjs");
  let asked = null;
  const out = "01 가\n02 나\n03 다";
  configureServices({ summarize: async (kind, text) => { asked = [kind, text]; return { text: kind === "week" ? "단계 요약" : out }; } });
  const db = sb();
  location.hash = "#/aggregate/s1";
  c = await page("aggregate", { supabase: db });
  const week = c.querySelector(".v3-week");
  button(week, "AI생성").click();
  await flush();
  assert.deepEqual(asked, ["week", "이 원문\n옛 원문"], "강사 팝업 순서대로 이 단계 원문");
  assert.equal(week.querySelector("textarea").value, "단계 요약");
  week.querySelector("textarea").value = "직접 고친 문구";
  button(week, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, id, patch]) => k === "update" && t === "subject_weeks" && patch.summary === "직접 고친 문구"));
  // 대표 이미지: 그 단계 강사 이미지만, 고르면 사이트 단계 이미지로 저장
  button(week, "대표 이미지 수정").click();
  let dlgImg = document.querySelector("dialog.v3-modal");
  assert.equal(dlgImg.querySelectorAll(".v3-imgpick").length, 1);
  dlgImg.querySelector(".v3-imgpick").click();
  await flush();
  assert.ok(db.calls.some(([k, t, id, patch]) => k === "update" && t === "subject_weeks" && patch.image_url === "https://example.com/b.png"));
  v3.state.picks.set("s1|regular", ["i1"]);
  c = await page("aggregate", { supabase: db });
  button(c.querySelector(".v3-week"), "대표 이미지 수정").click();
  assert.equal(document.querySelectorAll("dialog.v3-modal .v3-imgpick").length, 0, "뺀 강사의 이미지는 후보에 없음");
  document.querySelector("dialog.v3-modal").remove();
  v3.state.orders.clear(); // 앞의 학과별 순서 시험(웹1·포토샵)을 지운 뒤 다시 그림
  v3.state.picks.set("s1|regular", ["i2", "i1"]);
  c = await page("aggregate", { supabase: db });
  // 왼쪽 과목 목록: '수정' 없이 [+ 과목 추가](검색 팝업) [저장], 늘 끌어서 순서, 과목마다 [강사][삭제]
  v3.state.orders.clear();
  assert.ok(!button(c, "수정"), "왼쪽 수정 버튼 없음");
  button(c, "+ 과목 추가").click();
  let addDlg = document.querySelector("dialog.v3-modal");
  const addNames = () => [...addDlg.querySelectorAll(".v3-addlist .v2-grow")].map((x) => x.textContent);
  assert.deepEqual(addNames(), ["캐드"], "정규: 이미 있는 과목·방특 표시 과목은 후보에 없음");
  const sq = addDlg.querySelector('input[type="search"]');
  sq.value = "없는"; sq.dispatchEvent(new dom.window.Event("input"));
  assert.match(addDlg.textContent, /검색한 과목이 없습니다/);
  sq.value = "캐"; sq.dispatchEvent(new dom.window.Event("input"));
  button(addDlg, "추가").click();
  button(addDlg, "완료").click();
  const listNames = () => [...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent);
  assert.deepEqual(listNames(), ["1. 포토샵", "2. 웹1", "3. 캐드"]);
  assert.equal(v3.state.orders.has("d1:regular"), false, "저장 전에는 그대로");
  const items = c.querySelectorAll(".v2-listitem");
  drag(items[2], "dragstart"); drag(items[0], "dragover"); drag(items[0], "drop");
  assert.deepEqual(listNames(), ["1. 캐드", "2. 포토샵", "3. 웹1"]);
  button(c.querySelectorAll(".v2-listitem")[2], "삭제").click();
  assert.deepEqual(listNames(), ["1. 캐드", "2. 포토샵"]);
  saveBtn().click();
  assert.deepEqual(v3.state.orders.get("d1:regular"), ["s3", "s1"]);
  assert.deepEqual(JSON.parse(localStorage.getItem("v3.orders")), [["d1:regular", ["s3", "s1"]]]);
  // 방특: 정규 과목도 추가 후보(방특 제출은 정규 과목을 그대로 쓴다)
  v3.state.mode = "vacation";
  c = await page("aggregate", { supabase: db });
  button(c, "+ 과목 추가").click();
  addDlg = document.querySelector("dialog.v3-modal");
  assert.deepEqual(addNames(), ["웹1", "캐드", "포토샵"]);
  button(addDlg, "추가").click();
  button(addDlg, "완료").click();
  assert.deepEqual(listNames(), ["1. 방특AI", "2. 웹1"]);
  saveBtn().click();
  assert.deepEqual(v3.state.orders.get("v1:vacation"), ["s4", "s2"], "방특 순서는 기수(v1)마다");
  v3.state.mode = "regular";
  v3.state.orders.clear();
  c = await page("aggregate", { supabase: db });
  // 과목별 커리큘럼: 학과 순서대로 표, 수정 → AI생성(3줄)·저장(실제), 제외(V3 순서에서만)
  [...c.querySelectorAll(".v3-aggtabs button")][1].click();
  const rowsOf = () => [...c.querySelectorAll(".dept-curriculum-row:not(.v3-headrow)")];
  assert.deepEqual(rowsOf().map((r) => r.querySelector("input").value), ["포토샵", "웹1"]);
  assert.match(c.textContent, /학과별 커리큘럼 요약/);
  const first = rowsOf()[0];
  assert.equal(first.querySelector(".v3-aicontrols").hidden, true, "수정 전에는 AI생성 없음");
  button(first, "수정").click();
  assert.equal(first.querySelector(".v3-aicontrols").hidden, false);
  [...first.querySelectorAll(".v3-lines button")].find((b) => b.textContent === "3").click();
  button(first, "AI생성").click();
  await flush();
  assert.equal(asked[0], "department");
  assert.match(asked[1], /3줄로 정리: 각 줄은 01, 02, 03로 시작/);
  assert.match(asked[1], /- 이 원문\n- 옛 원문/);
  assert.equal(first.querySelector(".cell-dept_curriculum textarea").value, out);
  first.querySelector(".cell-duration input").value = "2개월";
  button(first, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "subjects" && patch.duration === "2개월" && patch.name === "포토샵" && patch.dept_curriculum === out));
  configureServices();
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
  assert.match(c.querySelector(".v2-listitem.active").textContent, /통합 강사 1명/);
  [...c.querySelectorAll(".v3-aggtabs button")][1].click();
  assert.match(c.textContent, /다시 만들기 필요/);
  v3.state.aggTab = "weeks";
  v3.state.employed.clear(); v3.state.orders.clear(); v3.state.roadmap.clear();
});

test("V3 준비물: 학과·정규/방특 없이 4분류 탭, 탭마다 학과별 묶음, 사용 프로그램도 같은 카드 목록", async () => {
  const db = sb();
  const c = await page("materials", { supabase: db });
  assert.ok(!c.querySelector(".v2-bar"), "학과·정규/방특 칸 없음");
  assert.ok(!/9D|과목별로 확정/.test(c.textContent), "9D 설명 없음");
  assert.deepEqual([...c.querySelectorAll(".v2-tab")].map((t) => t.textContent), ["교재", "물품", "사용 프로그램", "AI 도구"]);
  assert.ok(button(c, "+ 추가"), "교재 탭 안에 등록");
  await flush();
  assert.deepEqual([...c.querySelectorAll(".prep-dept h3")].map((h) => h.textContent), ["시각편집학과", "건축학과"], "모든 학과를 학과별로 한 번에");
  c.querySelectorAll(".v2-tab")[1].click();
  await flush();
  assert.ok(c.querySelector('textarea[placeholder="물품 내용"]'), "물품 탭은 '물품' 이름으로");
  // 사용 프로그램: 과목 '프로그램' 칸을 같은 카드 목록으로
  c.querySelectorAll(".v2-tab")[2].click();
  await flush();
  assert.ok(c.querySelector(".prep-dept .prep-subject .card-item"), "교재·물품과 같은 카드");
  assert.ok(!c.querySelector(".v2-mini-card textarea"), "예전 글칸 모양 없음");
  const card = c.querySelector(".card-item");
  assert.ok([...card.querySelectorAll("input, textarea")].some((x) => x.value === "포토샵"));
  button(card, "수정").click();
  const input = [...card.querySelectorAll("input, textarea")].find((x) => x.value === "포토샵");
  input.value = "라이트룸"; input.dispatchEvent(new dom.window.Event("input"));
  button(card, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, id, patch]) => k === "update" && t === "subjects" && id === "s1" && patch.tools === "라이트룸"));
  // + 추가: 학과 > 과목 고르고 내용 → 과목 프로그램 칸 끝에 붙임
  button(c, "+ 추가").click();
  const form = c.querySelector(".prep-add");
  const dsel = form.querySelector('select[aria-label="학과"]'); dsel.value = "d1"; dsel.dispatchEvent(new dom.window.Event("change"));
  const ssel = form.querySelector('select[aria-label="과목"]'); ssel.value = "s2";
  form.querySelector('textarea[aria-label="내용"]').value = "피그마";
  button(form, "저장").click();
  await flush();
  assert.ok(db.calls.some(([k, t, id, patch]) => k === "update" && t === "subjects" && id === "s2" && patch.tools === "피그마"));
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

test("V3 방특 과목 목록: 정규 과목으로 낸 방특 커리큘럼도 방특에 나온다", () => {
  v3.state.orders.clear();
  const list = v3.deptSubjects("d1", "vacation", {
    subjects: [{ id: "x", name: "포토샵" }, { id: "y", name: "캐드" }], links: [{ subject_id: "y", department_id: "d1" }],
    curricula: [{ vacation: true, instructor_id: "i1", subject_id: "x" }], idepts: [{ instructor_id: "i1", department_id: "d1" }],
  });
  assert.deepEqual(list.map((s) => s.name), ["포토샵"], "학과 연결만 된 정규 과목(캐드)은 방특에 없음");
  assert.deepEqual(v3.addableSubjects([{ id: "x", name: "포토샵" }, { id: "z", name: "방특AI", is_vacation: true }], [], "regular").map((s) => s.id), ["x"]);
});

test("V3 강사 커리큘럼: 강사별 과목 / 과목별 강사 탭, 고르면 단계별 커리큘럼", async () => {
  v3.state.dept = "d1"; v3.state.mode = "regular"; v3.state.teacherTab = "teacher"; v3.state.employed.clear();
  const tables = data();
  tables.instructor_curricula.push({ id: "c10", instructor_id: "i2", set_id: "set1", subject_id: "s2", step_label: "웹 1단계", written: "웹 원문", status: "approved", vacation: false, sort_order: 0 });
  const s = fakeSupabase(tables); s.rpc = async () => ({ data: [], error: null });
  const c = await page("teachers", { supabase: s });
  const tabs = [...c.querySelectorAll(".v3-teachtabs button")];
  assert.deepEqual(tabs.map((b) => b.textContent), ["강사별 과목 커리큘럼", "과목별 강사 커리큘럼"]);
  const leftNames = () => [...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent);
  const picks = () => [...c.querySelectorAll(".v3-picks button")].map((b) => b.textContent);
  assert.deepEqual(leftNames(), ["김", "이"]);
  assert.deepEqual(picks(), ["포토샵"]);
  assert.match(c.textContent, /김 · 포토샵 커리큘럼/);
  assert.match(c.textContent, /옛 원문/);
  assert.match(c.textContent, /수정 대기/, "김 · 포토샵에 수정 제출이 있음");
  c.querySelectorAll(".v2-listitem")[1].click();
  assert.deepEqual(picks(), ["포토샵", "웹1"]);
  button(c.querySelector(".v3-picks"), "웹1").click();
  assert.match(c.textContent, /이 · 웹1 커리큘럼/);
  assert.match(c.textContent, /웹 원문/);
  tabs[1].click();
  assert.deepEqual(leftNames(), ["포토샵", "웹1"]);
  assert.deepEqual(picks(), ["김", "이"]);
  button(c.querySelector(".v3-picks"), "이").click();
  assert.match(c.textContent, /이 · 포토샵 커리큘럼/);
  assert.match(c.textContent, /이 원문/);
  assert.ok(c.querySelector(".v3-splitter"));
  assert.ok(!/고치기|승인본이 있는/.test(c.textContent), "기존 화면 영역·설명 없음");
  // 과목 순서는 과목 통합 커리큘럼(학과별 과목 순서)을 따른다
  v3.state.orders.set("d1:regular", ["s2", "s1"]);
  const c2 = await page("teachers", { supabase: s });
  assert.deepEqual([...c2.querySelectorAll(".v2-listitem b")].map((b) => b.textContent), ["웹1", "포토샵"]);
  v3.state.teacherTab = "teacher";
  const c3 = await page("teachers", { supabase: s });
  c3.querySelectorAll(".v2-listitem")[1].click();
  assert.deepEqual([...c3.querySelectorAll(".v3-picks button")].map((b) => b.textContent), ["웹1", "포토샵"]);
  v3.state.orders.clear();
});

test("V3 방특은 학과 대신 기수: 그 기수에 담긴 커리큘럼(방특 체크 없이 담긴 것도)의 과목·단계", async () => {
  v3.state.dept = "d1"; v3.state.mode = "vacation"; v3.state.cohort = ""; v3.state.orders.clear(); v3.state.picks.clear(); v3.state.employed.clear();
  const tables = data();
  // 방특 체크 칸이 생기기 전에 기수에 담긴 정규 과목 커리큘럼(vacation=false)
  tables.instructor_curricula.push({ id: "c11", instructor_id: "i1", set_id: "v2", subject_id: "s1", step_label: "1단계", written: "여름 포토샵", media_url: "https://example.com/v.png", status: "approved", vacation: false, sort_order: 0 });
  const s = fakeSupabase(tables); s.rpc = async () => ({ data: [], error: null });
  let c = await page("aggregate", { supabase: s });
  const scope = () => c.querySelector(".v2-bar select");
  assert.match(c.querySelector(".v2-bar").textContent, /기수/);
  assert.equal(v3.state.cohort, "v1", "처음 기수 = 사이트에 걸린 기수");
  const leftNames = () => [...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent);
  assert.deepEqual(leftNames(), ["1. 방특AI"]);
  scope().value = "v2"; scope().dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(leftNames(), ["1. 포토샵", "2. 방특AI"]);
  assert.match(c.textContent, /2026 여름 기수에 담긴 강사 커리큘럼의 단계/);
  c.querySelectorAll(".v2-listitem")[0].click(); // 포토샵
  assert.match(c.textContent, /김 · 여름 포토샵/);
  assert.ok(!c.textContent.includes("기초 단계"), "정규 '전체 수업' 단계는 안 나옴");
  assert.ok(!c.textContent.includes("과목 통합 커리큘럼 문구"), "정규와 같이 쓰는 과목은 문구 고치기 없음");
  // 정규로 돌아가면 다시 학과
  button(c, "정규").click();
  assert.match(c.querySelector(".v2-bar").textContent, /학과/);
  // 강사 커리큘럼도 같은 기수
  v3.state.mode = "vacation"; v3.state.teacherTab = "subject";
  c = await page("teachers", { supabase: s });
  assert.match(c.querySelector(".v2-bar").textContent, /기수/);
  assert.deepEqual(leftNames(), ["포토샵", "방특AI"]);
  assert.match(c.textContent, /여름 포토샵/);
  v3.state.mode = "regular"; v3.state.teacherTab = "teacher"; v3.state.cohort = "";
});

test("V3 화면마다 학과·정규/방특·기수를 따로 기억", () => {
  v3.usePage("aggregate"); v3.state.mode = "vacation"; v3.state.cohort = "v2";
  v3.usePage("teachers");
  assert.equal(v3.state.mode, "regular", "다른 화면은 처음 그대로");
  v3.state.dept = "d2";
  v3.usePage("aggregate");
  assert.deepEqual([v3.state.mode, v3.state.cohort], ["vacation", "v2"], "돌아오면 떠날 때 고른 그대로");
  v3.usePage("teachers");
  assert.equal(v3.state.dept, "d2");
  v3.state.dept = "d1"; v3.state.mode = "regular"; v3.state.cohort = "";
});

test("V3 기본 설정: 페이지 속성 없이 [페이지 편집], 메뉴는 알약으로 고쳐 저장, 방학 특강·기타 설정은 팝업", async () => {
  const db = sb();
  const t = (name) => db.from(name);
  await t("menus").insert([
    { id: "m1", name: "전체 수업", is_active: true, side: "left", sort_order: 1 },
    { id: "m2", name: "방학 특강", is_active: false, side: "left", sort_order: 2 },
    { id: "m3", name: "특강/세미나", is_active: true, side: "right", sort_order: 3 },
  ]);
  const c = await page("site", { supabase: db, getToken: async () => "tok" });
  assert.ok(!/페이지 속성/.test(c.textContent));
  assert.ok(button(c, "페이지 편집"), "사이트 화면 옆 버튼");
  const item = (name) => [...c.querySelectorAll(".v2-listitem")].find((x) => x.querySelector("b").textContent.includes(name));
  assert.deepEqual([...c.querySelectorAll(".v2-listitem b")].slice(0, 2).map((b) => b.textContent.trim()), ["▤  메인·로딩화면", "▤  메뉴"].map((s) => s.trim()));
  item("메뉴").click();
  await flush();
  const pills = () => [...c.querySelectorAll(".v3-pill:not(.v3-pilladd)")];
  assert.equal(c.querySelectorAll(".v3-pills.left .v3-pill:not(.v3-pilladd)").length, 2);
  assert.ok(pills()[1].classList.contains("off"), "꺼 둔 메뉴는 흐리게");
  const save = button(c, "저장");
  assert.ok(save.disabled);
  // 이름 고치기·삭제·추가는 없고, 체크와 끌어 옮기기만
  assert.ok(!c.querySelector(".v3-menustage input[type=text], .v3-pillx, .v3-pilladd"));
  const use = pills()[1].querySelector("input[type=checkbox]");
  use.checked = true; use.dispatchEvent(new dom.window.Event("change"));
  // '전체 수업'을 오른쪽 빈 자리로 끌어 놓기
  const fire = (node, type) => node.dispatchEvent(Object.assign(new dom.window.Event(type, { bubbles: true, cancelable: true }), { clientX: 0 }));
  fire(pills()[0], "dragstart");
  fire(c.querySelector(".v3-pills.right"), "drop");
  assert.deepEqual([...c.querySelectorAll(".v3-pills.right .v3-pillname")].map((x) => x.textContent), ["특강/세미나", "전체 수업"]);
  assert.ok(!save.disabled);
  save.click();
  await flush();
  const up = (id) => db.calls.find(([k, tb, i]) => k === "update" && tb === "menus" && i === id)?.[3];
  assert.deepEqual(up("m2"), { is_active: true, side: "left", sort_order: 1 });
  assert.deepEqual(up("m1"), { is_active: true, side: "right", sort_order: 3 });
  await t("menus").delete().eq("id", "m2"); // 아래 방학 특강 미리보기 확인용으로 다시 넣는다
  // 학과별 자료 → 학과 관리 팝업
  item("학과별 자료").click();
  await flush();
  button(c, "페이지 편집").click();
  await flush();
  const dd = document.querySelector("dialog.v3-modal");
  assert.match(dd.querySelector("h3").textContent, /학과 소개/);
  assert.ok(dd.querySelector(".v3-popscroll").children.length, "기존 학과 화면");
  dd.remove();
  // 방학 특강: 메뉴에서 꺼져 있으면 미리보기로 설정된 모습, 팝업에 기수·배경
  await t("menus").insert({ id: "m9", name: "방학 특강", is_active: false, side: "left", sort_order: 9 }); // 위에서 지운 것을 다시(꺼 둔 메뉴)
  item("방학 특강").click();
  await flush();
  assert.match(c.querySelector("iframe").src, /vacation\.html\?preview=1$/);
  assert.match(c.textContent, /사이트에 숨겨 둔 페이지/);
  button(c, "페이지 편집").click();
  await flush();
  const d = document.querySelector("dialog.v3-modal");
  assert.match(d.textContent, /방학 특강 커리큘럼/);
  assert.match(d.textContent, /방학 특강 배경/);
  assert.ok(!/로드맵 로고/.test(d.textContent));
  d.remove();
  item("로고 이미지").click();
  await flush();
  button(c, "페이지 편집").click();
  await flush();
  const d2 = document.querySelector("dialog.v3-modal");
  assert.match(d2.textContent, /로드맵 로고/);
  assert.ok([...d2.querySelectorAll("button")].some((b) => b.textContent === "삭제"), "로고 삭제");
  d2.remove();
});
