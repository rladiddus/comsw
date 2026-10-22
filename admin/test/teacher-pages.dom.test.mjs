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

test("본인 강사 미연결이면 제출 대신 이름 후보 확인과 새 프로필 등록 안내", async () => {
  const data = tables();
  data.instructors = [];
  const { c } = await setup("mine", data);
  assert.equal(c.querySelector("form.curriculum-form"), null);
  assert.match(c.textContent, /강사 정보 연결/);
  assert.ok(findButton(c, "새 강사로 시작"));
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
