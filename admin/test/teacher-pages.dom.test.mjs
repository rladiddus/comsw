import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";

const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost/admin/",
});
globalThis.document = dom.window.document;
globalThis.confirm = () => true;
const flush = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};
const tables = () => ({
  instructors: [{ id: "me", account_uid: "uid", name: "선생님" }],
  instructor_profile_drafts: [],
  instructor_link_requests: [],
  instructor_departments: [{ instructor_id: "me", department_id: "dept" }],
  instructor_subjects: [{ instructor_id: "me", subject_id: "subject", sort_order: 1 }],
  departments: [{ id: "dept", name: "웹학과", is_active: true }],
  subjects: [{ id: "subject", name: "웹1" }],
  subject_departments: [{ subject_id: "subject", department_id: "dept" }],
  curriculum_sets: [{ id: "set", name: "웹학과", department_id: "dept" }],
  instructor_curricula: [{
    id: "old",
    instructor_id: "me",
    set_id: "set",
    subject_id: "subject",
    step_label: "1주차",
    written: "원본",
    status: "approved",
  }],
});
async function setup(page, data = tables()) {
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  const sb = fakeSupabase(data);
  const calls = [];
  sb.rpc = async (name, args) => {
    calls.push([name, args]);
    return {
      data: name === "comsw_submit_my_curriculum" ? "new" : [],
      error: null,
    };
  };
  const { render } = await import(`../js/pages/${page}.mjs`);
  const majors = { saved: null };
  await render(c, {
    supabase: sb,
    uid: "uid",
    displayName: "선생님",
    loadMyMajors: async () => ["웹학과"],
    saveMyMajors: async (_uid, list) => {
      majors.saved = list;
    },
  });
  await flush();
  return { c, sb, calls, majors };
}
const findButton = (c, text) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent === text);

const submitForm = (c) =>
  c.querySelector("form.curriculum-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
const tabButton = (c, name) => c.querySelector(`.tab-bar [data-tab=${name}]`);

test("등록한 커리큘럼이 있으면 조회하기가 먼저 열리고, 조회하기에서 바로 수정해 승인 요청한다", async () => {
  const { c, calls } = await setup("mine");
  assert.equal(tabButton(c, "list").getAttribute("aria-selected"), "true");
  assert.ok(c.querySelector("form.curriculum-form").hidden);
  assert.match(tabButton(c, "list").textContent, /조회하기 \(1\)/);
  findButton(c, "수정").click();
  const card = c.querySelector(".submission-card");
  card.querySelector("textarea").value = "새 커리큘럼";
  findButton(card, "저장 및 승인 요청").click();
  await flush();
  const call = calls.find(([n]) => n === "comsw_submit_my_curriculum");
  assert.deepEqual(
    [call[1].p_set_id, call[1].p_subject_id, call[1].p_step_label, call[1].p_written],
    ["set", "subject", "1주차", "새 커리큘럼"],
  );
  assert.ok(!("instructor_id" in call[1]));
});

test("등록하기: 이미지는 직접 업로드가 기본이고 링크로 바꿀 수 있다", async () => {
  const { c } = await setup("mine");
  tabButton(c, "write").click();
  const row = c.querySelector(".step-row");
  assert.equal(row.querySelector(".upload-zone").parentElement.hidden, false);
  assert.ok(row.querySelector(".media-link").hidden);
  findButton(row, "링크로 업로드").click();
  assert.ok(row.querySelector(".upload-zone").parentElement.hidden);
  assert.equal(row.querySelector(".media-link").hidden, false);
});

test("프로필 저장은 경력·한마디와 비공개 사진 ID를 승인 대기로 제출", async () => {
  const { c, calls } = await setup("profile");
  c.querySelector("[name=career]").value = "강의 5년";
  c.querySelector("[name=message]").value = "함께 배워요";
  c.querySelector("form.profile-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await flush();
  const call = calls.find(([n]) => n === "comsw_save_my_profile");
  assert.equal(call[1].p_name, "선생님", "이름은 강사 정보 그대로");
  assert.equal(call[1].p_career, "강의 5년");
  assert.equal(call[1].p_message, "함께 배워요");
  assert.match(c.textContent, /승인/);
});

test("교사 개인 화면에는 AI 실행과 비용 안내 없이 원문·사진 제출만 제공", async () => {
  const mine = await setup("mine");
  assert.equal(findButton(mine.c, "AI로 요약"), undefined);
  assert.equal(mine.c.querySelector("[name=summary]"), null);
  const profile = await setup("profile");
  assert.equal(findButton(profile.c, "AI 프로필 만들기"), undefined);
  assert.doesNotMatch(profile.c.textContent, /3,000원|AI 사용·예약/);
  assert.match(profile.c.textContent, /학과장/);
});

test("연결 안 된 선생님은 요청 화면 없이 쌤톡 이름으로 본인 강사 정보가 만들어진다", async () => {
  const data = { ...tables(), instructors: [], instructor_link_requests: [{ id: "old", account_uid: "uid" }] };
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  const sb = fakeSupabase(data);
  const calls = [];
  sb.rpc = async (name, args) => {
    calls.push([name, args]);
    if (name === "comsw_create_my_instructor") {
      data.instructors.push({ id: "new", account_uid: "uid", name: args.p_name });
    }
    return { data: [], error: null };
  };
  const { render } = await import("../js/pages/mine.mjs");
  await render(c, { supabase: sb, uid: "uid", displayName: "", loadMyName: async () => "김새봄", loadMyMajors: async () => [] });
  await flush();
  assert.deepEqual(calls[0], ["comsw_create_my_instructor", { p_name: "김새봄" }]);
  assert.equal(data.instructor_link_requests.length, 0, "남은 연결 요청은 지운다");
  assert.doesNotMatch(c.textContent, /강사 정보 연결/);
  assert.ok(c.querySelector("form.curriculum-form"), "바로 커리큘럼 작성");
});

test("쌤톡 이름을 알 수 없으면 강사 정보를 만들지 않고 안내한다", async () => {
  const data = { ...tables(), instructors: [] };
  const c = document.createElement("div");
  document.body.replaceChildren(c);
  const sb = fakeSupabase(data);
  const calls = [];
  sb.rpc = async (name) => { calls.push(name); return { data: [], error: null }; };
  const { render } = await import("../js/pages/mine.mjs");
  await render(c, { supabase: sb, uid: "uid", displayName: "", loadMyName: async () => { throw new Error("x"); }, loadMyMajors: async () => [] });
  await flush();
  assert.equal(calls.length, 0);
  assert.match(c.textContent, /쌤톡 이름을 확인할 수 없습니다/);
});

test("내 프로필: 이름은 바꿀 수 없고 경력·한마디에 예시가 보인다", async () => {
  const { c } = await setup("profile");
  assert.ok(c.querySelector("[name=name]").readOnly);
  assert.match(c.querySelector("[name=career]").placeholder, /^예시\)\n現 SBS아카데미/);
  assert.match(c.querySelector("[name=message]").placeholder, /^예시\)/);
});

const withAi = () => {
  const t = tables();
  t.departments.push({ id: "ai", name: "AI학과", is_active: true });
  t.subjects.push({ id: "ai1", name: "AI기초" }, { id: "web2", name: "웹2" });
  t.subject_departments.push({ subject_id: "ai1", department_id: "ai" }, { subject_id: "web2", department_id: "dept" });
  return t;
};

test("내 프로필: 내 소개·수업 설정 탭, 수업 설정은 쌤톡 학과와 체크한 과목을 보여 준다", async () => {
  const { c } = await setup("profile", withAi());
  assert.deepEqual([...c.querySelectorAll(".tab-bar button")].map((b) => b.textContent), ["내 소개", "수업 설정"]);
  assert.ok(c.querySelector(".class-settings").closest(".workspace-single").hidden);
  findButton(c, "수업 설정").click();
  const box = c.querySelector(".class-settings");
  assert.match(box.querySelector(".class-summary").textContent, /웹학과웹1/, "저장된 설정을 먼저 보여 준다");
  findButton(box, "수정").click();
  assert.deepEqual([...box.querySelectorAll(".class-dept h4")].map((h) => h.textContent), ["웹학과"]);
  const checks = Object.fromEntries([...box.querySelectorAll(".subject-check")].map((l) => [l.textContent, l.querySelector("input").checked]));
  assert.deepEqual(checks, { "웹1": true, "웹2": false });
});

test("수업 설정: 학과를 추가·삭제하고 과목을 체크해 저장하면 강사 정보와 쌤톡 학과에 함께 반영한다", async () => {
  const { c, calls, majors } = await setup("profile", withAi());
  const box = c.querySelector(".class-settings");
  findButton(box, "수정").click();
  const pick = box.querySelector(".form-actions select");
  pick.value = "ai";
  findButton(box, "+ 학과 추가").click();
  const aiDept = [...box.querySelectorAll(".class-dept")].find((d) => d.querySelector("h4").textContent === "AI학과");
  aiDept.querySelector("input").checked = true;
  aiDept.querySelector("input").dispatchEvent(new dom.window.Event("change"));
  findButton(box, "저장").click();
  await flush();
  let call = calls.findLast(([n]) => n === "comsw_set_my_classes");
  assert.deepEqual(call[1], { p_department_ids: ["dept", "ai"], p_subject_ids: ["subject", "ai1"] });
  assert.deepEqual(majors.saved, ["웹학과", "AI학과"]);
  assert.match(box.textContent, /쌤톡 학과에도 반영했습니다/);
  assert.ok(box.querySelector(".class-summary").textContent.includes("AI기초"), "저장 후 보기 화면");
  findButton(box, "수정").click();
  const web = [...box.querySelectorAll(".class-dept")].find((d) => d.querySelector("h4").textContent === "웹학과");
  findButton(web, "학과 삭제").click();
  findButton(box, "저장").click();
  await flush();
  call = calls.findLast(([n]) => n === "comsw_set_my_classes");
  assert.deepEqual(call[1], { p_department_ids: ["ai"], p_subject_ids: ["ai1"] }, "삭제한 학과의 과목은 빠진다");
  assert.deepEqual(majors.saved, ["AI학과"]);
});

test("내 프로필: 프로필 사진 확인 칸은 없다", async () => {
  const { c } = await setup("profile");
  assert.equal(c.querySelector(".profile-preview"), null);
  assert.doesNotMatch(c.textContent, /완성된 사진은 이곳에서/);
});

test("내 프로필: 경력과 한마디는 한 줄에 나란히 있다", async () => {
  const { c } = await setup("profile");
  const row = c.querySelector("[name=career]").closest(".form-row");
  assert.ok(row && row.contains(c.querySelector("[name=message]")));
});

test("내 프로필: 적용된 소개가 있으면 보기 화면부터, 수정을 눌러 고치고 저장 및 승인 요청", async () => {
  const data = tables();
  Object.assign(data.instructors[0], { career: "現 웹 강사", message: "함께 성장해요" });
  const { c, calls } = await setup("profile", data);
  const view = c.querySelector(".profile-view");
  const form = c.querySelector("form.profile-form");
  assert.equal(view.hidden, false);
  assert.equal(form.hidden, true);
  assert.match(view.textContent, /現 웹 강사/);
  assert.match(view.textContent, /사이트에 적용된 소개/);
  findButton(view, "수정").click();
  assert.equal(form.hidden, false);
  findButton(form, "취소").click();
  assert.equal(view.hidden, false);
  findButton(view, "수정").click();
  form.querySelector("[name=message]").value = "새 한마디";
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  assert.equal(calls.find(([n]) => n === "comsw_save_my_profile")[1].p_message, "새 한마디");
});

test("내 프로필: 처음 쓰는 선생님은 바로 작성 화면", async () => {
  const { c } = await setup("profile");
  assert.equal(c.querySelector("form.profile-form").hidden, false);
  assert.equal(c.querySelector(".profile-view").hidden, true);
});

test("조회하기: 내용 오른쪽에 이미지가 한 줄로 있고, 누르면 크게 보인다", async () => {
  const data = tables();
  data.instructor_curricula[0].media_url = "https://img.example/step1.webp";
  const { c } = await setup("mine", data);
  const card = c.querySelector(".submission-card");
  assert.ok(card.classList.contains("submission-row"));
  const thumb = card.querySelector(".submission-thumb");
  assert.equal(thumb.querySelector("img").getAttribute("src"), "https://img.example/step1.webp");
  assert.equal(card.lastElementChild, thumb, "이미지는 오른쪽");
  thumb.click();
  const zoom = c.querySelector("dialog.image-zoom");
  assert.ok(zoom.open || zoom.hasAttribute("open"));
  assert.equal(zoom.querySelector("img").getAttribute("src"), "https://img.example/step1.webp");
});

test("조회하기 수정: 등록하기와 같은 한 줄 배치이고 과목·단계는 고정", async () => {
  const { c } = await setup("mine");
  findButton(c, "수정").click();
  const row = c.querySelector(".submission-card .step-row");
  assert.ok(row);
  const labels = [...row.querySelectorAll(":scope > .form-field > span")].map((s) => s.textContent);
  assert.deepEqual(labels, ["과목", "단계", "개인 수업 커리큘럼"]);
  assert.ok(row.querySelector(".media-picker"));
  const [subject, step] = row.querySelectorAll("input[readonly]");
  assert.deepEqual([subject.value, step.value], ["웹1", "1주차"]);
});

const twoSubjects = () => {
  const t = withAi();
  t.instructor_subjects.push({ instructor_id: "me", subject_id: "web2", sort_order: 2 });
  return t;
};

test("내 커리큘럼: 내 학과는 쌤톡 학과, 위쪽은 '선택 학과', 수업 설정에서 고른 과목이 한 줄 탭으로", async () => {
  const { c } = await setup("mine", twoSubjects());
  tabButton(c, "write").click();
  const labels = [...c.querySelectorAll(".form-row:not(.materials-row) .form-field > span")].map((s) => s.textContent);
  assert.deepEqual(labels, ["내 학과", "선택 학과"]);
  assert.deepEqual([...c.querySelector("[name=department]").options].map((o) => o.textContent), ["웹학과"]);
  assert.deepEqual([...c.querySelectorAll(".subject-tabs button")].map((b) => b.textContent), ["웹1", "웹2"]);
  assert.ok(findButton(c, "내 프로필 > 수업 설정에서 학과·과목 바꾸기"));
  const row = c.querySelector(".subject-panel:not([hidden]) .step-row");
  const order = [...row.children].map((x) => x.querySelector("span")?.textContent ?? x.textContent);
  assert.deepEqual(order, ["단계", "개인 수업 커리큘럼", "커리큘럼 이미지", "단계 삭제"], "과목은 탭이 정한다");
});

test("등록하기: 과목 탭마다 단계를 쓰고(+ 단계 추가), 내용 있는 단계만 한 번에 승인 요청", async () => {
  const { c, calls } = await setup("mine", twoSubjects());
  tabButton(c, "write").click();
  const visible = () => c.querySelector(".subject-panel:not([hidden])");
  visible().querySelector("[name=written]").value = "웹1 첫 단계";
  findButton(visible(), "+ 단계 추가").click();
  const second = visible().querySelectorAll(".step-row")[1];
  assert.equal(second.querySelector("[name=step_label]").value, "2단계");
  second.querySelector("[name=written]").value = "웹1 둘째 단계";
  findButton(second, "링크로 업로드").click();
  const link = second.querySelector("input[type=url]");
  link.value = "https://example.com/a.png";
  link.dispatchEvent(new dom.window.Event("change"));
  findButton(c.querySelector(".subject-tabs"), "웹2").click();
  assert.equal(visible().querySelectorAll(".step-row").length, 1, "웹2 탭은 따로");
  visible().querySelector("[name=written]").value = "웹2 첫 단계";
  findButton(c.querySelector(".subject-tabs"), "웹1").click();
  assert.equal(visible().querySelectorAll(".step-row").length, 2, "탭을 오가도 쓴 내용 유지");
  submitForm(c);
  await flush();
  const sent = calls.filter(([n]) => n === "comsw_submit_my_curriculum")
    .map(([, a]) => [a.p_subject_id, a.p_step_label, a.p_written, a.p_media_url]);
  assert.deepEqual(sent, [
    ["subject", "1단계", "웹1 첫 단계", ""],
    ["subject", "2단계", "웹1 둘째 단계", "https://example.com/a.png"],
    ["web2", "1단계", "웹2 첫 단계", ""],
  ]);
});

test("등록하기: 아무것도 안 쓰면 제출하지 않고, 이미지만 넣은 단계는 내용을 쓰라고 그 과목 탭을 연다", async () => {
  const { c, calls } = await setup("mine", twoSubjects());
  tabButton(c, "write").click();
  submitForm(c);
  await flush();
  assert.match(c.textContent, /커리큘럼 내용을 입력해주세요/);
  findButton(c.querySelector(".subject-tabs"), "웹2").click();
  const panel = c.querySelector(".subject-panel:not([hidden])");
  findButton(panel, "링크로 업로드").click();
  const link = panel.querySelector("input[type=url]");
  link.value = "https://example.com/b.png";
  link.dispatchEvent(new dom.window.Event("change"));
  findButton(c.querySelector(".subject-tabs"), "웹1").click();
  submitForm(c);
  await flush();
  assert.match(c.textContent, /웹2: 단계와 커리큘럼 내용을 모두 입력해주세요/);
  assert.equal(c.querySelector(".subject-tabs .active").textContent, "웹2");
  assert.equal(calls.filter(([n]) => n === "comsw_submit_my_curriculum").length, 0);
});

test("제목부터 탭까지 한 덩어리로 고정된다", async () => {
  for (const page of ["mine", "profile"]) {
    const { c } = await setup(page);
    const head = c.querySelector(".page-head");
    assert.ok(head.querySelector("h2") && head.querySelector(".tab-bar"), page);
  }
});

test("내 프로필: 수정 요청을 받으면 요청 내용이 보이고, 고쳐서 다시 승인 요청한다", async () => {
  const data = tables();
  Object.assign(data.instructors[0], { career: "옛 경력", message: "옛 한마디" });
  data.instructor_profile_drafts = [{ instructor_id: "me", name: "선생님", career: "새 경력", message: "새 한마디", status: "changes_requested", review_note: "연도를 넣어주세요" }];
  const { c, calls } = await setup("profile", data);
  const view = c.querySelector(".profile-view");
  assert.match(view.textContent, /학과장 수정 요청: 연도를 넣어주세요/);
  assert.match(view.textContent, /새 경력/, "보낸 수정본을 보여 준다");
  findButton(view, "수정").click();
  const form = c.querySelector("form.profile-form");
  assert.match(form.textContent, /연도를 넣어주세요/);
  form.querySelector("[name=career]").value = "2024 새 경력";
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  assert.equal(calls.find(([n]) => n === "comsw_save_my_profile")[1].p_career, "2024 새 경력");
});

test("내 커리큘럼: 과목 탭마다 사용 프로그램·준비물을 쓰고, 바뀐 것만 커리큘럼과 함께 저장한다", async () => {
  const data = tables();
  data.instructor_subject_materials = [{ instructor_id: "me", subject_id: "subject", tools: "VS Code", supplies: null }];
  const { c, calls } = await setup("mine", data);
  const form = c.querySelector("form.curriculum-form");
  assert.equal(form.querySelector("[name=tools]").value, "VS Code", "저장해 둔 값");
  form.querySelector("[name=supplies]").value = "멘토시리즈 웹";
  form.querySelector("[name=written]").value = "HTML 기초";
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await flush();
  assert.deepEqual(calls[0], ["comsw_save_my_materials", { p_subject_id: "subject", p_tools: "VS Code", p_supplies: "멘토시리즈 웹" }]);
  assert.equal(calls[1][0], "comsw_submit_my_curriculum");
});

test("내 커리큘럼: 프로그램·준비물만 바꿔도 저장되고, 안 바꾸면 저장하지 않는다", async () => {
  const { c, calls } = await setup("mine");
  const form = c.querySelector("form.curriculum-form");
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await flush();
  assert.equal(calls.length, 0);
  assert.match(c.textContent, /커리큘럼 내용을 입력해주세요/);
  form.querySelector("[name=tools]").value = "Figma";
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await flush();
  assert.deepEqual(calls.map((x) => x[0]), ["comsw_save_my_materials"]);
  assert.match(c.textContent, /승인될 때 함께 반영/);
});
