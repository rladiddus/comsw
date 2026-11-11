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

test("V3 메뉴: 13메뉴(과목 관리는 학과 관리 위, 특강·세미나 메뉴로)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../admin-v3/js/app.mjs", import.meta.url), "utf8");
  const labels = [...src.matchAll(/\["([a-z-]+)", "[^"]+", "([^"]+)",/g)].map((m) => m[2]);
  assert.deepEqual(labels, ["기본 설정 등", "강사 관리", "커리큘럼 관리", "과목 관리", "학과 관리", "특강·세미나", "방학 특강", "로드맵", "수업별 준비물",
    "내 프로필", "내 커리큘럼", "승인 대기", "사이트 반영"]);
});

test("V3 과목 관리: [과목 생성] 학과·이름으로 생성, [과목 정리] 커리큘럼 미입력·학과·방특 미포함 과목 삭제", async () => {
  const tables = data();
  tables.subjects.push({ id: "s5", name: "외톨이" }, { id: "s6", name: "방특만", is_vacation: false });
  tables.instructor_curricula.push({ id: "c20", instructor_id: "i1", subject_id: "s6", step_label: "1단계", written: "방특", status: "approved", vacation: true, sort_order: 0 });
  const db = fakeSupabase(tables);
  const calls = [];
  db.rpc = async (name, args) => { calls.push([name, args]); return { data: name === "comsw_create_subject" ? "new1" : [], error: null }; };
  const c = await page("subjects", { supabase: db });
  const createDept = c.querySelector('[aria-label="학과"]');
  assert.equal(createDept.options[0].textContent, "전체 학과", "전체 학과가 맨 위");
  assert.equal(createDept.value, "", "처음엔 전체 학과");
  button(c, "생성").click();
  await flush();
  assert.match(c.textContent, /과목 이름을 입력해주세요/);
  c.querySelector('[aria-label="학과"]').value = "d2";
  c.querySelector('[aria-label="과목 이름"]').value = " 새과목 ";
  button(c, "생성").click();
  await flush();
  assert.deepEqual(calls.at(-1), ["comsw_create_subject", { p_name: "새과목", p_department_ids: ["d2"] }]);
  assert.match(c.textContent, /'새과목' 과목을 건축학과 맨 뒤에 만들었습니다/);
  // 전체 학과: 모든 학과에 넣는다(확인 후)
  globalThis.confirm = () => true;
  c.querySelector('[aria-label="학과"]').value = "";
  c.querySelector('[aria-label="과목 이름"]').value = "공통과목";
  button(c, "생성").click();
  await flush();
  assert.deepEqual(calls.at(-1)[1].p_department_ids, tables.departments.map((d) => d.id));
  assert.match(c.textContent, /모든 학과 맨 뒤에 만들었습니다/);
  button(c, "과목 정리").click();
  const rowsOf = () => [...c.querySelectorAll("tbody tr")].map((r) => [...r.cells].slice(0, 3).map((td) => td.textContent));
  const names = rowsOf().map((r) => r[0]);
  assert.ok(names.includes("외톨이") && names.includes("새과목"), names.join());
  assert.deepEqual(rowsOf().find((r) => r[0] === "외톨이"), ["외톨이", "—", "커리큘럼 미입력학과·방특 미포함"]);
  assert.ok(!names.includes("방특만"), "방특 커리큘럼이 있으면 포함으로 봄");
  globalThis.confirm = () => true;
  button([...c.querySelectorAll("tbody tr")].find((r) => r.cells[0].textContent === "외톨이"), "삭제").click();
  await flush();
  assert.deepEqual(calls.filter(([n]) => n === "comsw_delete_subjects").map(([, a]) => a.p_ids), [["s5"]]);
  assert.ok(!rowsOf().some((r) => r[0] === "외톨이"), "지운 과목은 목록에서 빠짐");
  assert.match(c.textContent, /'외톨이' 과목을 삭제했습니다/);
});

test("V3 과목 관리: [연결] 새 그룹 만들기(같은 이름 그룹, 비슷한 과목 미리 체크)·방학 특강 지정, 그룹에 넣은 과목은 과목 정리에서 빠짐", async () => {
  const tables = {
    departments: [{ id: "d1", name: "인테리어학과", sort_order: 0 }],
    subjects: [
      { id: "cad", name: "캐드", sort_order: null, group_id: null }, { id: "c1", name: "캐드1", sort_order: 0, group_id: null },
      { id: "c2", name: "캐드 2", sort_order: 1, group_id: null }, { id: "ai", name: "AI에이전트", sort_order: null, group_id: null },
    ],
    subject_departments: [{ subject_id: "c1", department_id: "d1" }, { subject_id: "c2", department_id: "d1" }],
    instructor_curricula: [{ subject_id: "c1", vacation: false }, { subject_id: "c2", vacation: false }],
    curriculum_sets: [{ id: "v1", name: "2026년 여름방학특강", is_vacation: true }],
    vacation_set_subjects: [],
    subject_groups: [],
  };
  const c = await page("subjects", { supabase: fakeSupabase(tables) });
  assert.deepEqual([...c.querySelectorAll(".v2-panel > .v2-tabs button")].map((b) => b.textContent), ["과목 생성", "과목 삭제", "과목 정리", "그룹 만들기"]);
  button(c, "과목 정리").click();
  const names = () => [...c.querySelectorAll("tbody tr")].map((r) => r.cells[0].textContent);
  assert.deepEqual(names(), ["캐드", "AI에이전트"], "커리큘럼·학과가 있는 캐드1·캐드 2는 안 나옴");
  const rowOf = (n) => [...c.querySelectorAll("tbody tr")].find((r) => r.cells[0].textContent === n);
  button(rowOf("캐드"), "연결").click();
  let dlg = document.querySelector("dialog.v3-modal");
  const modes = [...dlg.querySelectorAll('input[name="v3-linkmode"]')];
  assert.deepEqual(modes.map((r) => [r.checked, r.disabled]), [[true, false], [false, true]], "ⓐ 새 그룹이 기본, 그룹이 없으면 ⓑ 잠김");
  assert.equal(dlg.querySelector('[aria-label="그룹 이름"]').value, "캐드", "그룹 이름은 이 과목 이름(과목과 겹쳐도 됨)");
  const checked = () => [...dlg.querySelectorAll(".v3-linklist label")].filter((l) => l.querySelector("input").checked).map((l) => l.textContent);
  assert.deepEqual(checked().sort(), ["캐드", "캐드 2", "캐드1"].sort(), "이 과목과 이름이 '캐드'로 시작하는 과목을 미리 체크(띄어쓰기 무시)");
  button(dlg, "그룹 만들기").click();
  await flush();
  assert.deepEqual(tables.subject_groups.map((g) => g.name), ["캐드"]);
  const gid = tables.subject_groups[0].id;
  assert.deepEqual(tables.subjects.filter((x) => x.group_id === gid).map((x) => x.id).sort(), ["c1", "c2", "cad"]);
  assert.ok(!document.querySelector("dialog.v3-modal"), "만들면 닫힘");
  assert.deepEqual(names(), ["AI에이전트"], "그룹에 넣은 과목은 과목 정리에서 빠짐");
  // 학과·방학 특강 지정
  button(rowOf("AI에이전트"), "연결").click();
  dlg = document.querySelector("dialog.v3-modal");
  button(dlg, "학과·방학 특강 지정").click();
  const to = dlg.querySelector('[aria-label="학과 또는 방학 특강"]');
  to.value = "v:v1";
  button(dlg, "지정").click();
  await flush();
  assert.deepEqual(tables.vacation_set_subjects, [{ id: "new0", set_id: "v1", subject_id: "ai" }]);
  assert.doesNotMatch(rowOf("AI에이전트").textContent, /학과·방특 미포함/);
  // ⓑ 기존 그룹에 넣기
  button(rowOf("AI에이전트"), "연결").click();
  dlg = document.querySelector("dialog.v3-modal");
  const b = dlg.querySelector('input[name="v3-linkmode"][value="b"]');
  b.checked = true; b.dispatchEvent(new document.defaultView.Event("change"));
  const r = dlg.querySelector('input[name="v3-group"]');
  assert.equal(r.closest("label").textContent, "캐드 (3개)");
  r.checked = true; r.dispatchEvent(new document.defaultView.Event("change"));
  button(dlg, "넣기").click();
  await flush();
  assert.equal(tables.subjects.find((x) => x.id === "ai").group_id, gid);
  assert.deepEqual(names(), [], "모두 그룹에 들어가 정리할 과목 없음");
});

test("V3 과목 관리 [그룹 만들기] 탭: 그룹 만들기, 과목 고르기(이름 바꾸기), '−'로 빼기, 그룹 삭제(과목은 남음)", async () => {
  const tables = {
    departments: [{ id: "d1", name: "디자인학과", sort_order: 0 }],
    subjects: [
      { id: "ps", name: "포토샵", sort_order: 0, group_id: null }, { id: "p1", name: "포토샵1", sort_order: 1, group_id: null },
      { id: "p2", name: "포토샵2", sort_order: 2, group_id: null }, { id: "il", name: "일러스트", sort_order: 3, group_id: null },
    ],
    subject_departments: [{ subject_id: "ps", department_id: "d1" }],
    instructor_curricula: [],
    curriculum_sets: [],
    vacation_set_subjects: [],
    subject_groups: [],
  };
  const c = await page("subjects", { supabase: fakeSupabase(tables) });
  button(c.querySelector(".v2-panel > .v2-tabs"), "그룹 만들기").click();
  assert.match(c.textContent, /만든 그룹이 없습니다/);
  button(c.querySelector(".v3-headbar"), "그룹 만들기").click();
  let pop = document.querySelector("dialog.v3-modal");
  const box = (n) => [...pop.querySelectorAll(".v3-linklist label")].find((l) => l.textContent.startsWith(n)).querySelector("input");
  const tick = (n, on = true) => { box(n).checked = on; box(n).dispatchEvent(new document.defaultView.Event("change")); };
  button(pop, "그룹 만들기").click();
  await flush();
  assert.match(pop.textContent, /그룹 이름을 입력해주세요/);
  pop.querySelector('[aria-label="그룹 이름"]').value = "포토샵";
  button(pop, "그룹 만들기").click();
  await flush();
  assert.match(pop.textContent, /그룹에 넣을 과목을 골라주세요/);
  ["포토샵", "포토샵1", "포토샵2"].forEach((n) => tick(n));
  button(pop, "그룹 만들기").click();
  await flush();
  const row = () => c.querySelector("tbody tr");
  assert.deepEqual([...row().cells].slice(0, 3).map((td) => td.textContent), ["포토샵", "포토샵−포토샵1−포토샵2−", "디자인학과"]);
  // 과목 고르기: 이름 바꾸고 포토샵2 빼기
  button(row(), "과목 고르기").click();
  pop = document.querySelector("dialog.v3-modal");
  assert.ok(box("포토샵1").checked, "지금 과목은 체크된 채로");
  pop.querySelector('[aria-label="그룹 이름"]').value = "포토샵 과정";
  tick("포토샵2", false);
  button(pop, "저장").click();
  await flush();
  assert.equal(tables.subject_groups[0].name, "포토샵 과정");
  assert.equal(tables.subjects.find((x) => x.id === "p2").group_id, null);
  // '−'로 빼기
  c.querySelector('.v3-x[title="포토샵1 그룹에서 빼기"]').click();
  await flush();
  assert.equal(tables.subjects.find((x) => x.id === "p1").group_id, null);
  // 그룹 삭제
  globalThis.confirm = () => true;
  button(row(), "그룹 삭제").click();
  await flush();
  assert.deepEqual(tables.subject_groups, []);
  assert.equal(tables.subjects.length, 4, "과목은 그대로");
  assert.match(c.textContent, /'포토샵 과정' 그룹을 삭제했습니다/);
});

test("V3 학과 관리: 과목 생성 버튼 없음, 과목별 커리큘럼은 [제외]만([과목 삭제] 없음)", async () => {
  const headBar = document.createElement("div");
  v3.state.aggTab = "subjects";
  const c = await page("aggregate", { supabase: sb(), headBar });
  assert.ok(![...headBar.querySelectorAll("button")].some((b) => b.textContent === "과목 생성"));
  const row = c.querySelector(".dept-curriculum-row:not(.v3-headrow)");
  assert.ok(button(row, "제외"));
  assert.ok(!button(row, "과목 삭제"));
  v3.state.aggTab = "weeks";
});

test("V3 과목 관리 [과목 삭제] 탭: 학과(전체 학과)·과목명 검색으로 거르고, 과목·강사, 체크한 과목을 한 번에 삭제", async () => {
  const db = sb();
  const calls = [];
  db.rpc = async (name, args) => {
    calls.push([name, args]);
    return { data: name === "comsw_subject_usage" ? [{ subject_id: "s1", approved: 2, roadmap: 1 }, { subject_id: "s2", approved: 1 }] : [], error: null };
  };
  let asked = "";
  globalThis.confirm = (m) => { asked = m; return true; };
  const c = await page("subjects", { supabase: db });
  assert.deepEqual([...c.querySelectorAll(".v2-panel > .v2-tabs button")].map((b) => b.textContent).slice(0, 2), ["과목 생성", "과목 삭제"], "과목 생성 바로 오른쪽");
  button(c, "과목 삭제").click();
  const names = () => [...c.querySelectorAll(".v3-deltable tbody tr")].map((r) => r.cells[0].textContent);
  const dept = c.querySelector('.v3-delbar [aria-label="학과"]');
  assert.equal(dept.options[0].textContent, "전체 학과");
  assert.ok(names().includes("포토샵") && names().includes("웹1"));
  dept.value = "d2"; dept.dispatchEvent(new dom.window.Event("change"));
  assert.ok(names().includes("포토샵") && !names().includes("웹1"), "건축학과 과목만(포토샵은 공용)");
  dept.value = ""; dept.dispatchEvent(new dom.window.Event("change"));
  const q = c.querySelector('[aria-label="과목명 검색"]');
  q.value = "포토"; q.dispatchEvent(new dom.window.Event("input"));
  assert.deepEqual(names(), ["포토샵"]);
  assert.match(c.querySelector(".v3-deltable tbody tr").cells[1].textContent, /김/, "강사명");
  const del = button(c, "삭제");
  assert.equal(del.disabled, true, "고르기 전엔 꺼짐");
  const tick = (n) => { const b = [...c.querySelectorAll(".v3-deltable tbody tr")].find((r) => r.cells[0].textContent === n).querySelector("input"); b.checked = true; b.dispatchEvent(new dom.window.Event("change")); };
  tick("포토샵");
  q.value = ""; q.dispatchEvent(new dom.window.Event("input"));
  tick("웹1");
  assert.equal(button(c, "삭제 (2)").disabled, false);
  button(c, "삭제 (2)").click();
  await flush();
  assert.match(asked, /포토샵 외 1개.*승인된 강사 커리큘럼 3개.*로드맵 연결 1개/);
  assert.deepEqual(calls.find(([n]) => n === "comsw_delete_subjects")[1], { p_ids: ["s1", "s2"], p_seen: 4 });
  assert.ok(!names().includes("포토샵") && !names().includes("웹1"), "지운 과목은 목록에서 빠짐");
  assert.match(c.textContent, /과목 2개를 삭제했습니다/);
});

test("V3 준비물 칸 나누기·선생님 분류", () => {
  assert.deepEqual(v3.splitItems("포토샵, ChatGPT\n- 노트북 · 1) 펜"), ["포토샵", "ChatGPT", "노트북", "펜"]);
  assert.deepEqual(v3.materialsOf({ tools: "포토샵", supplies: "노트북", textbook: "교재", ai: "ChatGPT" }).map((m) => `${m.label}:${m.teacher}`),
    ["포토샵:software", "교재:textbook", "노트북:supply", "ChatGPT:ai"]);
});

test("V3 전환 점검: 같은 과목을 여러 학과에 따로 낸 강사(7)·여러 기수 방특(6B), 공용 과목·여러 과목 로드맵 단계는 정상", async () => {
  const list = await v3.audit(sb());
  assert.deepEqual(list.map(([t, , l]) => `${t}=${l.join(",")}`), [
    "같은 과목을 여러 학과에 따로 낸 강사=김 · 포토샵", "여러 방특 시기에 쓰인 과목=방특AI", "정규·방특에 함께 쓰인 과목=",
  ]);
});

test("V3 승인 대기: 준비물 검토 없이 적용(② 칸이 검토), 프로필은 따로", async () => {
  location.hash = "#/inbox";
  let c = await page("inbox");
  const items = [...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent);
  assert.deepEqual(items, ["김 · 포토샵", "이 · 프로필"]);
  assert.match(c.textContent, /제출된 커리큘럼[\s\S]*새 원문/);
  assert.doesNotMatch(c.textContent, /과목 승인 영향|승인 단위입니다|학과장 확인 후 승인합니다/, "1A·9D 안내와 영향 박스 없음");
  assert.doesNotMatch(c.textContent, /이전 승인본|옛 원문/, "이전 승인본은 안 보임");
  assert.match(c.textContent, /선생님이 적은 준비물입니다\. 고치려면 \[준비물 작성\][\s\S]*물품 노트북, 포토샵 교재[\s\S]*사용 프로그램 포토샵, ChatGPT/);
  assert.doesNotMatch(c.textContent, /검토 0\/4|작성·검토 대기/);
  assert.equal(c.querySelectorAll(".v3-submitted .v2-diff-cols:not(.v2-diff-head) > div:first-child button.submission-thumb img").length, 1, "이미지는 단계 줄 왼쪽");
  c.querySelector(".v2-diff button.submission-thumb").click();
  assert.ok(c.querySelector("dialog.image-zoom img"), "누르면 크게 보기");
  assert.ok(!button(c, "과목 전체 승인") && !button(c, "적용"), "첫 쪽에는 승인 버튼 대신 '학과 커리큘럼 보기'");
  assert.ok(button(c, "학과 커리큘럼 보기"));
  assert.ok(!button(c, "준비물 검토 보기") && button(c, "준비물 작성") && button(c, "그룹 설정"), "준비물 작성·그룹 설정");

  // 한 화면 세 쪽, AI는 모두 토글(기본 꺼짐, 켜면 AI로 채움, 끄면 되돌림): ① 단계별 AI 요약 → ② 과목별 커리큘럼 AI생성 → ③ 로드맵 문구 AI 요약 → [적용]
  globalThis.confirm = () => true;
  location.hash = "#/inbox";
  const gd = data();
  gd.subject_groups = [{ id: "g1", name: "포토샵 과정" }];
  gd.subjects[0].group_id = "g1"; // 준비물이 있으면 그룹이 있어야 적용된다
  const db = fakeSupabase(gd);
  const approvals = [];
  db.rpc = async (name, args) => { approvals.push([name, args]); return { data: null, error: null }; };
  c = await page("inbox", { supabase: db });
  assert.ok(!/기존 승인 화면|방학 특강 승인 화면/.test(c.textContent), "기존 승인 화면은 없음");
  assert.match(c.textContent, /김 선생님의 포토샵 제출 커리큘럼/);
  assert.doesNotMatch(c.textContent, /사이트 문구 \(단계마다|빈 문구 AI로 채우기/);
  assert.ok(!button(c, "AI 요약") && !c.querySelector('[aria-label="1단계 AI 요약 적용"]'), "AI 요약 버튼·적용 스위치 대신 토글 하나");
  const toggle = (name) => { const x = c.querySelector(`[aria-label="${name}"]`); x.checked = !x.checked; x.dispatchEvent(new dom.window.Event("change")); return x; };
  const on = c.querySelector('[aria-label="1단계 AI 요약"]');
  const summary = c.querySelector('[aria-label="1단계 AI 요약 글"]');
  assert.equal(on.type, "checkbox");
  assert.ok(!on.checked && summary.hidden, "기본 꺼짐, 요약 칸 숨김");
  const asked = [];
  const { configureServices } = await import("../../admin/js/services.mjs");
  const answer = { week: "포토샵 기초", department: "01 합친 요약", roadmap: "포토샵 로드맵\n둘째 줄" };
  configureServices({ summarize: async (kind, text) => { asked.push([kind, text]); return { text: answer[kind] }; } });
  toggle("1단계 AI 요약");
  await flush();
  assert.deepEqual(asked[0], ["week", "새 원문"], "기존 단계 요약 프롬프트(week)");
  assert.ok(!summary.hidden && summary.value === "포토샵 기초", "켜면 AI로 채운 칸이 보임");
  summary.value = "";
  button(c, "학과 커리큘럼 보기").click();
  await flush();
  assert.match(c.textContent, /1단계: 사이트에 보일 글이 없습니다/);
  assert.ok(c.querySelector(".v3-submitted"), "비어 있으면 첫 쪽에 머묾");
  toggle("1단계 AI 요약");
  assert.ok(summary.hidden, "끄면 숨김(원문 사용)");
  toggle("1단계 AI 요약");
  await flush();
  assert.equal(summary.value, "포토샵 기초");

  button(c, "학과 커리큘럼 보기").click();
  await flush();
  assert.match(c.textContent, /과목별 커리큘럼[\s\S]*학과별 커리큘럼 요약/);
  const dept = c.querySelector('[aria-label="학과별 커리큘럼 요약"]');
  assert.equal(asked.length, 2, "들어가기만 해서는 AI를 부르지 않음");
  assert.equal(dept.value, "문구", "처음은 지금 문구");
  assert.equal(dept.nextElementSibling?.querySelector("input")?.getAttribute("aria-label"), "학과별 커리큘럼 요약 AI생성", "AI생성 토글은 글 상자 아래");
  toggle("학과별 커리큘럼 요약 AI생성");
  await flush();
  assert.equal(asked[2][0], "department", "학과 커리큘럼 프롬프트");
  assert.match(asked[2][1], /지금 학과별 커리큘럼 요약\]\n문구[\s\S]*김 선생님 새 커리큘럼\]\n\[1단계\]\n- 포토샵 기초/, "지금 요약 + 새 제출본을 합침");
  assert.equal(dept.value, "01 합친 요약");
  toggle("학과별 커리큘럼 요약 AI생성");
  assert.equal(dept.value, "문구", "끄면 지금 문구로");
  toggle("학과별 커리큘럼 요약 AI생성");
  await flush();
  dept.value = "01 고친 요약";
  const field = (name) => c.querySelector(`[aria-label="${name}"]`);
  assert.equal(field("프로그램").value, "포토샵\nChatGPT", "선생님이 적은 프로그램을 승인 함수처럼 합쳐 미리 채움");
  assert.deepEqual([...field("학습 수준").options].map((o) => o.value).slice(1), ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"]);
  field("기간").value = "2개월";
  field("학습 수준").value = "★★★☆☆";
  assert.match(c.querySelector(".cell-supplies").textContent, /물품 노트북, 포토샵 교재[\s\S]*사용 프로그램 포토샵, ChatGPT/, "② 준비물은 보기만");
  assert.ok(!c.querySelector(".cell-supplies input, .cell-supplies textarea"), "② 준비물 칸에는 입력·없음 체크 없음");
  button(c, "로드맵 문구 보기").click();
  await flush();
  assert.doesNotMatch(c.textContent, /STEP|스텝 삭제|과목 삭제/);
  assert.match(c.textContent, /디자인\(포토샵·웹1 함께\) 로드맵에 들어 있음/);
  assert.equal(asked.length, 4, "들어가기만 해서는 AI를 부르지 않음");
  toggle("로드맵 문구 AI 요약");
  await flush();
  assert.deepEqual(asked[4], ["roadmap", "[과목] 포토샵\n01 고친 요약"], "고친 학과 문구로 로드맵 문구");
  assert.equal(c.querySelector('[aria-label="로드맵 문구"]').value, "포토샵 로드맵\n둘째 줄");
  button(c, "이전").click();
  assert.equal(c.querySelector('[aria-label="학과별 커리큘럼 요약"]').value, "01 고친 요약", "이전으로 가도 고친 것 그대로");
  assert.ok(field("학과별 커리큘럼 요약 AI생성").checked, "토글 상태도 그대로");
  button(c, "로드맵 문구 보기").click();
  await flush();
  assert.equal(asked.length, 5);
  configureServices({});
  assert.equal(button(c, "적용").className, "publish-btn", "적용 버튼에 색");
  button(c, "적용").click();
  await flush();
  assert.deepEqual(approvals, [["comsw_approve_curriculum", { p_id: "c1" }]]);
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "instructor_curricula" && patch.summary === "포토샵 기초"));
  const subj = db.calls.find(([k, t]) => k === "update" && t === "subjects")?.[3];
  assert.deepEqual(subj, { duration: "2개월", dept_curriculum: "01 고친 요약", tools: "포토샵\nChatGPT", level: "★★★☆☆", roadmap_summary: "포토샵 로드맵\n둘째 줄" }, "준비물 칸은 승인 함수가 합친 그대로");
  assert.ok(!db.calls.some(([k, t]) => k === "upsert" && t === "instructor_subject_materials"), "준비물을 안 고치면 선생님 칸 그대로");
  assert.ok(db.calls.some(([k, t, , patch]) => k === "update" && t === "roadmap_steps" && patch.summary === "포토샵 로드맵 둘째 줄\n"), "과목 둘이 든 곳은 이 과목 줄만, 다른 줄은 그대로");
  assert.match(c.textContent, /승인했습니다\(과목별 커리큘럼·로드맵 문구 함께 적용\)/);
});

test("V3 승인 대기 [준비물 작성]: 교재·물품·사용 프로그램·AI 도구(이름+링크), 제목 옆 '준비물 없음', 그룹 없으면 적용 막음", async () => {
  globalThis.confirm = () => true;
  location.hash = "#/inbox";
  const d = data();
  d.subject_groups = [{ id: "g1", name: "포토샵 과정" }];
  const db = fakeSupabase(d);
  const approvals = [];
  db.rpc = async (name, args) => { approvals.push([name, args]); return { data: null, error: null }; };
  const c = await page("inbox", { supabase: db });
  assert.match(c.textContent, /그룹 없음/);
  const open = () => { button(c, "준비물 작성").click(); return [...document.querySelectorAll("dialog.v3-modal")].at(-1); };
  let dlg = open();
  const q = (l) => dlg.querySelector(`[aria-label="${l}"]`);
  assert.match(dlg.querySelector("h3").textContent, /김 · 포토샵 준비물 작성[\s\S]*준비물 없음/, "제목 오른쪽에 준비물 없음");
  assert.equal(q("물품").value, "노트북, 포토샵 교재", "선생님이 적은 것");
  assert.equal(q("사용 프로그램").value, "포토샵, ChatGPT");
  // 없음 체크 → 모든 칸 막힘, 풀면 다시
  const none = q("준비물 없음");
  none.checked = true; none.dispatchEvent(new dom.window.Event("change"));
  assert.ok(["교재", "물품", "사용 프로그램", "AI 도구 이름", "AI 도구 링크"].every((l) => q(l).disabled));
  none.checked = false; none.dispatchEvent(new dom.window.Event("change"));
  q("교재").value = "웹 교재"; q("물품").value = "포토샵 교재";
  q("AI 도구 이름").value = "ChatGPT"; q("AI 도구 링크").value = "https://chatgpt.com";
  button(dlg, "추가").click();
  assert.match(dlg.querySelector(".prep-list").textContent, /ChatGPT링크/);
  q("AI 도구 이름").value = "Gemini"; // [추가] 안 눌러도 저장됨
  button(dlg, "저장").click();
  assert.match(c.textContent, /교재 웹 교재[\s\S]*물품 포토샵 교재[\s\S]*AI 도구 ChatGPT \(링크\), Gemini/);
  button(c, "학과 커리큘럼 보기").click();
  assert.match(c.querySelector(".cell-supplies").textContent, /교재 웹 교재/);
  button(c, "로드맵 문구 보기").click();
  button(c, "적용").click();
  await flush();
  assert.match(c.textContent, /먼저 \[그룹 설정\]으로 이 과목의 그룹을 정해주세요/);
  assert.equal(approvals.length, 0);
  // [그룹 설정] → 기존 그룹에 넣기
  button(c, "이전").click(); button(c, "이전").click();
  button(c, "그룹 설정").click();
  const gdlg = [...document.querySelectorAll("dialog.v3-modal")].at(-1);
  const join = gdlg.querySelector('input[value="b"]'); join.checked = true; join.dispatchEvent(new dom.window.Event("change"));
  const r = gdlg.querySelector('input[name="v3-group"]'); r.checked = true; r.dispatchEvent(new dom.window.Event("change"));
  button(gdlg, "넣기").click();
  await flush();
  assert.ok(db.calls.some(([k, t, id, patch]) => k === "update" && t === "subjects" && id === "s1" && patch.group_id === "g1"));
  assert.match(c.textContent, /그룹: 포토샵 과정/);
  button(c, "학과 커리큘럼 보기").click();
  button(c, "로드맵 문구 보기").click();
  button(c, "적용").click();
  await flush();
  assert.deepEqual(approvals, [["comsw_approve_curriculum", { p_id: "c1" }]]);
  assert.deepEqual(db.calls.find(([k, t]) => k === "upsert" && t === "instructor_subject_materials")?.[2],
    { instructor_id: "i1", subject_id: "s1", tools: "포토샵, ChatGPT", supplies: "포토샵 교재", textbook: "웹 교재", ai: "ChatGPT | https://chatgpt.com\nGemini" },
    "선생님 칸 = 작성한 분류대로(승인 함수가 이것을 수업별 준비물에 분류대로, AI 도구는 링크까지)");
});

test("V3 승인 대기 [준비물 작성] '준비물 없음'으로 저장하면 선생님 칸을 비우고 적용", async () => {
  globalThis.confirm = () => true;
  location.hash = "#/inbox";
  const db = fakeSupabase(data());
  db.rpc = async () => ({ data: null, error: null });
  const c = await page("inbox", { supabase: db });
  button(c, "준비물 작성").click();
  const dlg = [...document.querySelectorAll("dialog.v3-modal")].at(-1);
  const none = dlg.querySelector('[aria-label="준비물 없음"]');
  none.checked = true; none.dispatchEvent(new dom.window.Event("change"));
  button(dlg, "저장").click();
  assert.match(c.textContent, /준비물 없음/);
  button(c, "학과 커리큘럼 보기").click();
  assert.equal(c.querySelector('[aria-label="프로그램"]').value, "포토샵", "선생님 프로그램도 빠짐");
  button(c, "로드맵 문구 보기").click();
  button(c, "적용").click();
  await flush();
  assert.deepEqual(db.calls.find(([k, t]) => k === "upsert" && t === "instructor_subject_materials")?.[2],
    { instructor_id: "i1", subject_id: "s1", tools: null, supplies: null, textbook: null, ai: null });
});

test("V3 승인 대기 [적용]: 과목·로드맵을 단계 승인보다 먼저 저장(승인 뒤 실패해도 다시 할 수 있게)", async () => {
  globalThis.confirm = () => true;
  location.hash = "#/inbox";
  const d = data(); d.subject_groups = [{ id: "g1", name: "포토샵 과정" }]; d.subjects[0].group_id = "g1";
  const db = fakeSupabase(d); // rpc도 calls에 순서대로 남는다
  const c = await page("inbox", { supabase: db });
  button(c, "학과 커리큘럼 보기").click();
  button(c, "로드맵 문구 보기").click();
  button(c, "적용").click();
  await flush();
  const at = (f) => db.calls.findIndex(f);
  const subj = at(([k, t]) => k === "update" && t === "subjects");
  const approve = at(([k, n]) => k === "rpc" && n === "comsw_approve_curriculum");
  assert.ok(subj >= 0 && approve > subj, `과목 저장(${subj}) → 단계 승인(${approve})`);
});

test("준비물 링크는 http(s)만, 형식 없으면 https://", async () => {
  const { safeLink } = await import("../../admin/js/prep-items.mjs");
  assert.equal(safeLink("https://a.com"), "https://a.com");
  assert.equal(safeLink("chatgpt.com"), "https://chatgpt.com");
  assert.equal(safeLink("javascript:alert(1)"), "");
  assert.equal(safeLink(" data:text/html,x"), "");
  assert.equal(safeLink(""), "");
});

test("V3 승인 대기: 선생님 몫 계산(남긴 것 + 과목에 없던 새 것)", async () => {
  const { teacherPart } = await import("../../admin-v3/js/pages/inbox.mjs");
  assert.equal(teacherPart("노트북\n포토샵 교재", "포토샵 교재, 마우스", ""), "포토샵 교재, 마우스");
  assert.equal(teacherPart("포토샵, ChatGPT", "포토샵\nChatGPT", "포토샵"), "포토샵, ChatGPT");
  assert.equal(teacherPart("노트북", "펜", "펜"), null, "과목에 원래 있던 것은 선생님 몫이 아님");
  assert.equal(teacherPart(null, "", null), null);
});

test("V3 승인 대기: 프로그램·준비물 합치기는 승인 함수(merge_items)와 같은 규칙", async () => {
  const { mergeItems } = await import("../../admin-v3/js/pages/inbox.mjs");
  assert.equal(mergeItems("포토샵", "포 토샵, ChatGPT\nChatGPT"), "포토샵\nChatGPT");
  assert.equal(mergeItems("", "노트북, 펜"), "노트북, 펜");
  assert.equal(mergeItems("노트북", ""), "노트북");
  assert.equal(mergeItems(null, null), "");
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
  location.hash = "#/inbox";
  const c = await page("inbox", { supabase: db });
  assert.ok(!button(c, "학과 커리큘럼 보기"), "방특은 한 쪽뿐");
  button(c, "적용").click();
  await flush();
  assert.match(c.textContent, /담을 방특 시기를 골라주세요/);
  const pickCohort = [...c.querySelectorAll("select")].at(-1);
  pickCohort.value = "v2";
  button(c, "적용").click();
  await flush();
  assert.ok(db.calls.some(([k, , , patch]) => k === "update" && patch.set_id === "v2"));
  assert.deepEqual(approvals, [["comsw_approve_curriculum", { p_id: "c9" }]]);
});

test("V3 과목 통합 순서 → 로드맵·학과 커리큘럼이 같은 순서, 퇴사 시험은 출처에서 빠짐", async () => {
  v3.state.dept = "d1"; v3.state.mode = "regular"; v3.state.orders.clear(); v3.state.employed.clear(); v3.state.roadmap.clear();
  // 학과 관리 왼쪽 목록에서 저장한 순서(DB 전체 순서): 웹1 → 포토샵
  const ordered = data(); ordered.subjects.find((x) => x.id === "s1").sort_order = 5;
  const odb = fakeSupabase(ordered); odb.rpc = async () => ({ data: [], error: null });
  let c;
  const drag = (node, type) => node.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: 0 }));
  v3.state.mode = "vacation"; // 로드맵은 정규만 → 들어가면 정규
  c = await page("roadmap", { supabase: odb });
  assert.equal(v3.state.mode, "regular");
  assert.ok(!button(c, "정규") && !button(c, "방특"), "정규·방특 버튼 없음");
  const left = () => [...c.querySelectorAll(".v3-dragsrc b")].map((b) => b.textContent);
  assert.deepEqual(left(), ["1. 웹1", "2. 포토샵"], "왼쪽 과목은 학과 관리 순서");
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
  // − 는 늘 보이고(과목 삭제 버튼 없음) 바로 빼기, 스텝 삭제
  assert.ok(!button(boxesOf()[0], "과목 삭제"), "과목 삭제 버튼 없음");
  assert.equal(boxesOf()[0].querySelectorAll(".v3-x").length, 1);
  boxesOf()[0].querySelector('.v3-x[title="포토샵 빼기"]').click();
  assert.deepEqual(stepSubs(), [[], ["웹1"]]);
  button(boxesOf()[0], "스텝 삭제").click();
  assert.deepEqual(stepSubs(), [[], ["웹1"]], "확인 전에는 그대로");
  const del = document.querySelector("dialog.v3-modal");
  assert.match(del.textContent, /정말 STEP 1을 삭제하시나요\?/);
  button(del, "삭제").click();
  assert.ok(c.querySelector(".v3-steplist"), "스텝 박스만 스크롤되는 칸");
  assert.deepEqual(stepSubs(), [["웹1"]]);
  // [저장]: 새 스텝을 임시 위치에 넣고 과목 연결 → 옛 스텝 삭제 → 위치 1..n
  button(c, "+ 스텝 추가").click();
  drag(c.querySelectorAll(".v3-dragsrc")[1], "dragstart"); drag(boxesOf()[1], "dragover"); drag(boxesOf()[1], "drop");
  odb.calls.length = 0;
  const save = button(c, "저장");
  assert.equal(save.disabled, false, "바뀐 것이 있으면 저장 켜짐");
  save.click();
  await flush();
  const ins = odb.calls.filter(([k, t]) => k === "insert" && t === "roadmap_steps")[0][2];
  assert.deepEqual(ins.map((r) => [r.track_id, r.position, r.summary]), [["t1", 1000, "로드맵 요약"], ["t1", 1001, null]], "AI 문구, 새로 넣은 과목은 문구 없음");
  const subs = odb.calls.filter(([k, t]) => k === "insert" && t === "roadmap_step_subjects")[0][2];
  assert.deepEqual(subs.map((r) => [r.subject_id, r.sort_order]), [["s2", 0], ["s1", 0]]);
  assert.ok(odb.calls.some(([k, t]) => k === "delete" && t === "roadmap_steps"), "옛 스텝 삭제");
  assert.deepEqual(odb.calls.filter(([k, t]) => k === "update" && t === "roadmap_steps").map((x) => x[3].position), [1, 2]);
  assert.match(c.textContent, /저장했습니다/);
  assert.deepEqual(stepSubs(), [["웹1"], ["포토샵"]], "저장한 로드맵으로 다시 그림");
  assert.equal(button(c, "저장").disabled, true, "저장 뒤에는 꺼짐");

  location.hash = "#/aggregate/s1";
  c = await page("aggregate");
  assert.ok(!c.textContent.includes("기여 강사와 출처"));
  assert.ok(!c.textContent.includes("통합 강사:"), "주차별 오른쪽 위 강사 줄 없음");
  assert.ok(!c.textContent.includes("학과 관리 고치기"), "아래 기존 화면 없음");
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
  assert.ok(!c.textContent.includes("학과 관리 문구"));
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
  const layout = [];
  const rpc0 = db.rpc;
  db.rpc = async (n, a) => { if (n === "comsw_save_subject_layout") layout.push(a); return rpc0(n, a); };
  saveBtn().click();
  await flush();
  assert.deepEqual(layout, [{ // DB에 저장: 캐드 넣고 웹1 빼고, 이 학과 과목 자리끼리 순서(캐드 → 포토샵)
    p_add: [{ subject_id: "s3", department_id: "d1" }],
    p_subjects: [{ id: "s1", sort_order: 2 }, { id: "s3", sort_order: 0 }],
    p_remove: [{ subject_id: "s2", department_id: "d1" }],
  }]);
  assert.equal(v3.state.orders.has("d1:regular"), false, "브라우저에는 저장 안 함");
  db.rpc = rpc0;
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
  layout.length = 0;
  db.rpc = async (n, a) => { if (n === "comsw_save_subject_layout") layout.push(a); return rpc0(n, a); };
  globalThis.confirm = () => true;
  button(rowsOf()[1], "제외").click();
  await flush();
  assert.deepEqual(layout.map((a) => a.p_remove), [[{ subject_id: "s2", department_id: "d1" }]], "제외는 바로 DB에서 이 학과 연결만 뺌");
  db.rpc = rpc0;
  v3.state.orders.clear(); v3.state.aggTab = "weeks";
  v3.state.picks.clear(); v3.state.aiLines = 2;
  v3.state.employed.set("i2", false);
  c = await page("aggregate");
  assert.match(c.querySelector(".v2-listitem.active").textContent, /통합 강사 1명/);
  [...c.querySelectorAll(".v3-aggtabs button")][1].click();
  assert.match(c.textContent, /다시 만들기 필요/);
  // AI생성하면 '다시 만들기 필요'가 사라지고, 다시 열어도 같은 명단이면 안 나옴
  configureServices({ summarize: async () => ({ text: "01 새 요약" }) });
  const row0 = c.querySelector(".dept-curriculum-row:not(.v3-headrow)");
  button(row0, "수정").click();
  button(row0, "AI생성").click();
  await flush();
  assert.ok(!/다시 만들기 필요/.test(row0.textContent));
  configureServices();
  c = await page("aggregate");
  [...c.querySelectorAll(".v3-aggtabs button")][1].click();
  assert.ok(!/다시 만들기 필요/.test(c.querySelector(".dept-curriculum-row:not(.v3-headrow)").textContent));
  v3.state.made.clear();
  v3.state.aggTab = "weeks";
  v3.state.employed.clear(); v3.state.orders.clear(); v3.state.roadmap.clear();
});

test("V3 준비물: 과목 이름 대신 그룹 이름, 같은 학과·같은 그룹 과목은 한 묶음", async () => {
  const gd = data();
  gd.subject_groups = [{ id: "g1", name: "포토샵 과정" }];
  gd.subjects[0].group_id = "g1"; gd.subjects[1].group_id = "g1";
  gd.course_prep_items.push({ id: "p9", subject_id: "s2", category: "textbook", content: "웹 교재" });
  gd.course_prep_items.forEach((x, i) => { x.id ??= `p${i}`; });
  const gc = await page("materials", { supabase: fakeSupabase(gd) });
  gc.querySelectorAll(".v2-tab")[0].click();
  await flush();
  const d1 = [...gc.querySelectorAll(".prep-dept")].find((x) => x.querySelector("h3").textContent === "시각편집학과");
  assert.deepEqual([...d1.querySelectorAll(".prep-subject")].map((x) => x.dataset.subject), ["포토샵 과정"], "포토샵·웹1이 그룹 하나로");
  assert.equal(d1.querySelectorAll(".card-item").length, 2);
  const d2 = [...gc.querySelectorAll(".prep-dept")].find((x) => x.querySelector("h3").textContent === "건축학과");
  assert.deepEqual([...d2.querySelectorAll(".prep-subject")].map((x) => x.dataset.subject), ["캐드"], "그룹 없는 과목은 과목 이름");
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
  for (const f of ["inbox", "subjects", "instructors", "teachers", "aggregate", "roadmap", "materials", "vacation", "seminars", "release", "legacy"]) { // mine·profile은 기존 화면이 Firebase(CDN)를 불러 테스트에서 못 염(V2 테스트와 같음)
    location.hash = `#/${f}`;
    const c = await page(f);
    assert.ok(!c.querySelector(".save-state.err"), `${f}: ${c.querySelector(".save-state.err")?.textContent}`);
    assert.ok(c.textContent.length > 20, f);
  }
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

test("V3 커리큘럼 관리: 강사별 과목 / 과목별 강사 탭, 고르면 단계별 커리큘럼", async () => {
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
  // 과목 순서는 학과 관리에서 저장한 순서(DB)를 따른다
  tables.subjects.find((x) => x.id === "s1").sort_order = 5;
  const c2 = await page("teachers", { supabase: s });
  assert.deepEqual([...c2.querySelectorAll(".v2-listitem b")].map((b) => b.textContent), ["웹1", "포토샵"]);
  v3.state.teacherTab = "teacher";
  const c3 = await page("teachers", { supabase: s });
  c3.querySelectorAll(".v2-listitem")[1].click();
  assert.deepEqual([...c3.querySelectorAll(".v3-picks button")].map((b) => b.textContent), ["웹1", "포토샵"]);
  v3.state.orders.clear();
});

test("V3 커리큘럼 관리·학과 관리는 정규만(정규·방특 버튼 없음)", async () => {
  v3.state.dept = "d1"; v3.state.mode = "vacation"; v3.state.orders.clear(); v3.state.picks.clear(); v3.state.employed.clear();
  for (const f of ["aggregate", "teachers"]) {
    const c = await page(f);
    assert.ok(!button(c, "정규") && !button(c, "방특"), `${f}: 정규·방특 버튼 없음`);
    assert.equal(v3.state.mode, "regular");
    assert.ok(!c.textContent.includes("방특AI"), `${f}: 방특 과목 안 나옴`);
  }
});

test("V3 화면마다 학과·정규/방특을 따로 기억", () => {
  v3.usePage("aggregate"); v3.state.mode = "vacation";
  v3.usePage("teachers");
  assert.equal(v3.state.mode, "regular", "다른 화면은 처음 그대로");
  v3.state.dept = "d2";
  v3.usePage("aggregate");
  assert.equal(v3.state.mode, "vacation", "돌아오면 떠날 때 고른 그대로");
  v3.usePage("teachers");
  assert.equal(v3.state.dept, "d2");
  v3.state.dept = "d1"; v3.state.mode = "regular";
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
  assert.ok(!/카테고리/.test(dd.textContent), "카테고리 표 없음");
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

test("V3 방학 특강: 방특 신청 칸·설명 없이, 시기를 고르면 왼쪽 강사 · 오른쪽 과목 → 단계별 이미지·커리큘럼", async () => {
  const db = fakeSupabase({
    curriculum_sets: [{ id: "v1", name: "2026 여름", is_vacation: true }, { id: "v2", name: "2026 겨울", is_vacation: true }],
    site_settings: [{ key: "vacation_set_id", value: "v1" }],
    instructors: [{ id: "i1", name: "김", sort_order: 0 }, { id: "i2", name: "이", sort_order: 1 }],
    subjects: [{ id: "s1", name: "포토샵", sort_order: 0 }, { id: "s2", name: "일러", sort_order: 1 }],
    instructor_curricula: [
      { instructor_id: "i1", set_id: "v1", subject_id: "s1", step_label: "1단계", written: "원문", summary: "사이트 문구", status: "approved", sort_order: 0 },
      { instructor_id: "i1", set_id: "v1", subject_id: "s2", step_label: "1단계", written: "일러 원문", status: "approved", sort_order: 1 },
      { instructor_id: "i2", set_id: "v2", subject_id: "s1", step_label: "1단계", written: "겨울", status: "approved", sort_order: 0 },
      { instructor_id: "i2", set_id: "v1", subject_id: "s1", step_label: "1단계", written: "대기", status: "pending", sort_order: 0 },
    ],
  });
  const c = await page("vacation", { supabase: db });
  assert.ok(!/방특 신청|그룹을 고르면/.test(c.textContent));
  assert.equal(c.querySelector('select[aria-label="방학 특강"]').value, "v1", "사이트에 나오는 시기부터");
  assert.deepEqual([...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent), ["김"], "승인된 강사만");
  assert.deepEqual([...c.querySelectorAll(".v3-picks button")].map((b) => b.textContent), ["포토샵", "일러"]);
  assert.match(c.querySelector(".v3-week").textContent, /1단계사이트 문구/);
  const sel = c.querySelector('select[aria-label="방학 특강"]');
  // 과목별 강사 탭: 왼쪽 과목, 오른쪽 강사
  [...c.querySelectorAll(".v3-teachtabs button")][1].click();
  assert.deepEqual([...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent), ["포토샵", "일러"]);
  assert.deepEqual([...c.querySelectorAll(".v3-picks button")].map((b) => b.textContent), ["김"]);
  [...c.querySelectorAll(".v3-teachtabs button")][0].click();
  sel.value = "v2"; sel.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual([...c.querySelectorAll(".v2-listitem b")].map((b) => b.textContent), ["이"]);
});

test("V3 강사 관리: 5번 안내·통합 출처·작업 없이, 학과→강사 고르기로 거르고, 줄을 누르면 펼친 강사 카드 팝업", async () => {
  const c = await page("instructors");
  assert.ok(!/퇴사는 강사 원문|통합 출처|작업/.test(c.textContent));
  assert.ok(!/기존 화면/.test(c.textContent), "아래 기존 강사 화면 칸 없음");
  assert.deepEqual([...c.querySelectorAll(".v2-table th")].map((th) => th.textContent), ["강사", "사이트", "담당 학과", "담당 과목", "공개"], "재직 상태 칸 없음, 끝에 공개 체크");
  const tabs = () => [...c.querySelectorAll(".v3-insttabs button")];
  assert.deepEqual(tabs().map((b) => b.textContent), ["전체", "공개", "비공개", "계정 연결"]);
  tabs()[1].click();
  assert.deepEqual([...c.querySelectorAll(".v2-table tbody tr td:first-child")].map((td) => td.textContent), ["김"], "공개만");
  tabs()[2].click();
  assert.deepEqual([...c.querySelectorAll(".v2-table tbody tr td:first-child")].map((td) => td.textContent), ["이"], "비공개만");
  tabs()[0].click();
  const [dept, name] = c.querySelectorAll(".v2-panel-head select");
  dept.value = "d2"; dept.dispatchEvent(new dom.window.Event("change"));
  assert.equal(c.querySelectorAll(".v2-table tbody tr").length, 0, "건축학과 강사 없음");
  dept.value = "d1"; dept.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual([...name.options].map((o) => o.textContent), ["전체 강사", "김", "이"]);
  name.value = "i2"; name.dispatchEvent(new dom.window.Event("change"));
  const rows = c.querySelectorAll(".v2-table tbody tr");
  assert.equal(rows.length, 1);
  rows[0].click();
  await flush();
  const d = document.querySelector("dialog.v3-tpop");
  assert.match(d.querySelector("h3").textContent, /이 강사/);
  const card = d.querySelector(".card-item");
  assert.ok(card && !card.classList.contains("collapsed"), "펼친 카드 한 장");
  assert.ok([...card.querySelectorAll(".consent span")].some((x) => x.textContent === "공개"), "사이트 표시 → 공개");
  assert.equal(d.querySelectorAll(".card-item").length, 1);
  assert.ok(!/성별/.test(d.textContent), "성별 없음");
  // 팝업에서 공개 체크를 바꾸면 뒤 목록이 바로 바뀜(새로고침 없이)
  const pub = [...card.querySelectorAll(".consent")].find((x) => x.textContent === "공개").querySelector("input");
  pub.checked = true; pub.dispatchEvent(new dom.window.Event("change"));
  await flush(); await flush();
  assert.match(c.querySelector(".v2-table tbody tr").textContent, /공개/);
  assert.ok(!/비공개/.test(c.querySelector(".v2-table tbody tr").textContent));
  d.remove();
});

test("V3 강사 관리: 줄 끝 공개 체크로 바로 저장(팝업 안 열림), 전체 탭은 공개 위·비공개 아래", async () => {
  const db = fakeSupabase(data());
  const c = await page("instructors", { supabase: db });
  const names = () => [...c.querySelectorAll(".v2-table tbody tr td:first-child")].map((td) => td.textContent);
  const box = (name) => [...c.querySelectorAll(".v2-table tbody tr")].find((tr) => tr.firstChild.textContent === name).querySelector(".v3-listed input");
  assert.deepEqual(names(), ["김", "이"]);
  box("김").click(); // 김 비공개
  await flush();
  assert.ok(db.calls.some(([k, t, id, p]) => k === "update" && t === "instructors" && id === "i1" && p.is_listed === false));
  assert.ok(!document.querySelector("dialog.v3-tpop"), "체크는 팝업을 열지 않음");
  box("이").click(); // 이 공개
  await flush();
  assert.deepEqual(names(), ["이", "김"], "공개 강사가 위로");
});

test("V3 특강·세미나: 오른쪽 상세·아래 기존 화면 없이, 줄의 [신청자 명단]은 그 줄 아래, 줄을 누르면 특강 팝업, [특강 만들기]는 빈 칸 팝업", async () => {
  const db = fakeSupabase({
    seminars: [
      { id: "m1", title: "AI 특강", subtitle: "소주제", datetime_text: "2026년 8월 5일 11:00-13:00", instructor: "조", place: "J강의장", capacity: 16, sort_order: 0, is_listed: true },
      { id: "m2", title: "숨긴 특강", datetime_text: "2026년 8월 6일", sort_order: 1, is_listed: false },
    ],
    seminar_applications: [{ id: "a1", seminar_id: "m1", name: "이영희", phone: "010-1111-2222", created_at: "2026-10-01T00:00:00Z" }],
  });
  const head = document.createElement("div");
  const c = await page("seminars", { supabase: db, headActions: head });
  assert.ok(!/행사 상세|기존 '특강·세미나' 화면|아래 기존 화면/.test(c.textContent));
  const rows = () => [...c.querySelectorAll(".v3-semtable tbody tr")];
  assert.match(rows()[1].textContent, /비공개/);
  assert.ok(c.querySelector(".v3-gridright"), "왼쪽 목록 · 오른쪽 명단");
  button(rows()[0], "신청자 명단").click();
  await flush();
  const right = c.querySelector(".v3-gridright").children[2]; // [목록, 경계, 명단]
  assert.ok(c.querySelector(".v3-gridright .v3-splitter"), "경계를 끌어 너비 조절");
  assert.match(right.textContent, /이영희/, "명단은 오른쪽 칸에");
  assert.ok(button(right, "엑셀(CSV) 내려받기"));
  assert.equal(rows().length, 2, "목록 사이에 줄이 생기지 않음");
  rows()[0].querySelector("td").click();
  await flush();
  const d = document.querySelector("dialog.v3-spop");
  const card = d.querySelector(".card-item");
  assert.ok(card && !card.classList.contains("collapsed"));
  assert.ok([...card.querySelectorAll(".consent span")].some((x) => x.textContent === "공개"));
  const before = c.querySelector(".v3-gridright");
  d.close?.(); d.dispatchEvent(new dom.window.Event("close")); d.remove();
  await flush();
  assert.equal(c.querySelector(".v3-gridright"), before, "닫아도 화면 전체를 다시 그리지 않음");
  assert.ok(!button(head, "특강 만들기"), "오른쪽 위에는 없음");
  button(c.querySelector(".v2-panel-head"), "특강 만들기").click(); // '특강 목록' 오른쪽
  const n = document.querySelector("dialog.v3-spop");
  assert.equal(n.querySelector("h3").textContent, "특강 만들기");
  const inputs = [...n.querySelectorAll(".card-line input")];
  assert.ok(inputs.every((i) => !i.value && i.placeholder.startsWith("예:")), "빈 칸 + 예시 글");
  inputs[0].value = "새 특강"; inputs[5].value = "20";
  button(n, "만들기").click();
  await flush();
  assert.ok(db.calls.some(([k, t, row]) => k === "insert" && t === "seminars" && row.title === "새 특강" && row.capacity === 20 && row.is_listed === true));
});
