import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";
import { render } from "../js/pages/accounts.mjs";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
const flush = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};
const data = () => ({
  instructors: [
    { id: "web", name: "김민주", account_uid: null },
    { id: "vis", name: "김민주", account_uid: null },
    { id: "lee", name: "이영희", account_uid: "uid-lee" },
  ],
  instructor_link_requests: [{ id: "r", account_uid: "uid-kim", instructor_id: "vis", requested_name: "김민주" }],
  departments: [{ id: "d1", name: "웹학과" }, { id: "d2", name: "시각편집학과" }],
  instructor_departments: [{ instructor_id: "web", department_id: "d1" }, { instructor_id: "vis", department_id: "d2" }],
  subjects: [],
  instructor_subjects: [],
});
const members = async () => [
  { uid: "uid-lee", name: "이영희", username: "lee", majors: ["웹학과"] },
  { uid: "uid-kim", name: "김민주", username: "kimmj", majors: ["시각편집학과"] },
];

test("쌤톡 회원과 강사를 나란히 보여 주고, 고르면 바로 연결하고 요청은 지운다", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables), loadMembers: members });
  const rowsEl = () => [...c.querySelectorAll("tbody tr")];
  assert.deepEqual(rowsEl().map((r) => r.cells[0].textContent), ["김민주", "이영희"], "연결 안 된 회원이 위");
  const kim = rowsEl()[0];
  assert.equal(kim.cells[1].textContent, "kimmj");
  assert.match(kim.cells[4].textContent, /연결 요청: 김민주/);
  const labels = [...kim.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(labels.slice(0, 3), ["연결 안 함", "★ 김민주 · 웹학과", "★ 김민주 · 시각편집학과"]);
  const lee = [...kim.querySelectorAll("option")].find((o) => o.value === "lee");
  assert.ok(lee.disabled, "다른 계정에 연결된 강사는 고를 수 없다");
  const select = kim.querySelector("select");
  select.value = "vis";
  select.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(tables.instructors.find((i) => i.id === "vis").account_uid, "uid-kim");
  assert.equal(tables.instructor_link_requests.length, 0);
  assert.match(c.textContent, /김민주 님을 김민주 강사에 연결했습니다/);
});

test("다른 강사로 바꾸면 이전 연결을 풀고, '연결 안 함'이면 연결을 해제한다", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables), loadMembers: members });
  const leeRow = [...c.querySelectorAll("tbody tr")].find((r) => r.cells[0].textContent === "이영희");
  const select = leeRow.querySelector("select");
  assert.equal(select.value, "lee");
  select.value = "web";
  select.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(tables.instructors.find((i) => i.id === "lee").account_uid, null);
  assert.equal(tables.instructors.find((i) => i.id === "web").account_uid, "uid-lee");
  const again = [...c.querySelectorAll("tbody tr")].find((r) => r.cells[0].textContent === "이영희").querySelector("select");
  again.value = "";
  again.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(tables.instructors.find((i) => i.id === "web").account_uid, null);
});

test("쌤톡 목록을 못 읽으면 오류를 보여 준다", async () => {
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(data()), loadMembers: async () => { throw new Error("권한 없음"); } });
  assert.match(c.textContent, /목록을 불러오지 못했습니다: 권한 없음/);
});
