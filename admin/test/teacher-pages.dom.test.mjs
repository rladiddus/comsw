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

test("승인본 수정 제출은 본인 강사 선택 없이 pending RPC 사용", async () => {
  const { c, calls } = await setup("mine");
  findButton(c, "수정해서 제출").click();
  await flush();
  const written = c.querySelector("[name=written]");
  written.value = "새 커리큘럼";
  c.querySelector("form.curriculum-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await flush();
  const call = calls.find(([n]) => n === "comsw_submit_my_curriculum");
  assert.equal(call[1].p_written, "새 커리큘럼");
  assert.equal(call[1].p_set_id, "set");
  assert.equal(call[1].p_subject_id, "subject");
  assert.ok(!("instructor_id" in call[1]));
  assert.ok(!c.querySelector("[name=status]"));
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
