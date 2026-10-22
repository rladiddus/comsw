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
  await render(c, { supabase: sb, uid: "uid", displayName: "선생님" });
  await flush();
  return { c, sb, calls };
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
  findButton(c, "수정해서 제출").click();
  const card = c.querySelector(".submission-card");
  card.querySelector("textarea").value = "새 커리큘럼";
  findButton(card, "수정 승인 요청").click();
  await flush();
  const call = calls.find(([n]) => n === "comsw_submit_my_curriculum");
  assert.deepEqual(
    [call[1].p_set_id, call[1].p_subject_id, call[1].p_step_label, call[1].p_written],
    ["set", "subject", "1주차", "새 커리큘럼"],
  );
  assert.ok(!("instructor_id" in call[1]));
});

test("등록하기: 과목·단계가 한 줄에 있고 + 단계 추가로 여러 단계를 한 번에 승인 요청한다", async () => {
  const { c, calls } = await setup("mine");
  tabButton(c, "write").click();
  assert.match(c.textContent, /기본 4단계로 작성해주세요/);
  const head = c.querySelector(".step-row .step-head");
  assert.ok(head.querySelector("[name=subject_id]") && head.querySelector("[name=step_label]"));
  assert.equal(head.querySelector("[name=step_label]").value, "1단계");
  findButton(c, "+ 단계 추가").click();
  const rowsEl = [...c.querySelectorAll(".step-row")];
  assert.equal(rowsEl[1].querySelector("[name=step_label]").value, "2단계");
  rowsEl[0].querySelector("[name=written]").value = "첫 단계";
  rowsEl[1].querySelector("[name=written]").value = "둘째 단계";
  findButton(rowsEl[1], "링크로 업로드").click();
  const link = rowsEl[1].querySelector("input[type=url]");
  link.value = "https://example.com/a.png";
  link.dispatchEvent(new dom.window.Event("change"));
  submitForm(c);
  await flush();
  const sent = calls.filter(([n]) => n === "comsw_submit_my_curriculum").map(([, a]) => [a.p_step_label, a.p_written, a.p_media_url]);
  assert.deepEqual(sent, [["1단계", "첫 단계", ""], ["2단계", "둘째 단계", "https://example.com/a.png"]]);
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
  await render(c, { supabase: sb, uid: "uid", displayName: "", loadMyName: async () => "김새봄" });
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
  await render(c, { supabase: sb, uid: "uid", displayName: "", loadMyName: async () => { throw new Error("x"); } });
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
