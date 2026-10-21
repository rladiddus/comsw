// 브라우저 대신 jsdom, Supabase 대신 메모리 가짜 DB로 표 편집기 동작을 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
let confirmAnswer = true;
globalThis.confirm = () => confirmAnswer;
const { mountTableEditor } = await import("../js/table-editor.mjs");

function fakeSupabase(tables, { unique = {} } = {}) {
  const calls = [];
  const result = value => ({ then: (ok, bad) => Promise.resolve(value).then(ok, bad) });
  return {
    calls,
    from(table) {
      const rows = tables[table];
      return {
        select: () => ({
          order: () => result({
            data: [...rows].sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)).map(r => ({ ...r })),
            error: null,
          }),
        }),
        update: patch => ({
          eq: (_, id) => {
            calls.push(["update", table, id, patch]);
            const key = unique[table];
            if (key && key in patch && rows.some(r => r.id !== id && r[key] === patch[key]))
              return result({ error: { code: "23505", message: "duplicate" } });
            Object.assign(rows.find(r => r.id === id), patch);
            return result({ error: null });
          },
        }),
        insert: row => {
          calls.push(["insert", table, row]);
          rows.push({ id: `new${rows.length}`, ...row });
          return result({ error: null });
        },
        delete: () => ({
          eq: (_, id) => {
            calls.push(["delete", table, id]);
            rows.splice(rows.findIndex(r => r.id === id), 1);
            return result({ error: null });
          },
        }),
      };
    },
  };
}

const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); };
const COLUMNS = [
  { key: "name", label: "메뉴 이름", type: "text", required: true },
  { key: "is_active", label: "사용", type: "checkbox" },
  { key: "url", label: "주소", type: "image" },
];

async function setup(extra = {}) {
  const tables = { menus: [
    { id: "b", name: "학과별 자료", is_active: true, url: "", sort_order: 1 },
    { id: "a", name: "전체 수업", is_active: false, url: "https://drive.google.com/file/d/IMG1/view", sort_order: 0 },
  ] };
  const supabase = fakeSupabase(tables, { unique: { menus: "name" } });
  const container = document.createElement("div");
  mountTableEditor(container, { supabase, table: "menus", columns: COLUMNS, title: "메뉴", ...extra });
  await flush();
  const rowsEl = () => [...container.querySelectorAll("tbody tr")];
  const state = () => container.querySelector(".save-state").textContent;
  return { tables, supabase, container, rowsEl, state };
}
const change = (input, value) => {
  if (input.type === "checkbox") input.checked = value; else input.value = value;
  input.dispatchEvent(new dom.window.Event("change"));
};

test("순서대로 줄을 그리고 드라이브 이미지는 썸네일로 미리 보여준다", async () => {
  const { rowsEl } = await setup();
  assert.deepEqual(rowsEl().map(tr => tr.querySelector("input").value), ["전체 수업", "학과별 자료"]);
  assert.equal(rowsEl()[0].querySelector("img.thumb").src, "https://drive.google.com/thumbnail?id=IMG1&sz=w1000");
  assert.equal(rowsEl()[1].querySelector("img.thumb").hidden, true);
});

test("칸을 고치면 바로 저장하고 '저장됨'을 보여준다", async () => {
  const { rowsEl, supabase, tables, state } = await setup();
  change(rowsEl()[0].querySelector("input"), " 전체 수업 2 ");
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["update", "menus", "a", { name: "전체 수업 2" }]);
  assert.equal(tables.menus.find(r => r.id === "a").name, "전체 수업 2");
  assert.equal(state(), "저장됨");
});

test("체크박스는 바로 참/거짓으로 저장한다", async () => {
  const { rowsEl, supabase } = await setup();
  change(rowsEl()[0].querySelector("input[type=checkbox]"), true);
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["update", "menus", "a", { is_active: true }]);
});

test("필수 칸을 비우면 저장하지 않고 오류를 보여준 뒤 원래 값으로 되돌린다", async () => {
  const { rowsEl, supabase, state } = await setup();
  const input = rowsEl()[0].querySelector("input");
  change(input, "   ");
  await flush();
  assert.equal(supabase.calls.filter(c => c[0] === "update").length, 0);
  assert.equal(state(), "메뉴 이름을(를) 입력해주세요");
  assert.equal(rowsEl()[0].querySelector(".row-err").textContent, "메뉴 이름을(를) 입력해주세요");
  assert.equal(input.value, "전체 수업");
});

test("다른 줄과 같은 이름이면 '같은 이름이 이미 있습니다'와 함께 되돌린다", async () => {
  const { rowsEl, state, tables } = await setup();
  const input = rowsEl()[0].querySelector("input");
  change(input, "학과별 자료");
  await flush();
  assert.equal(state(), "같은 이름이 이미 있습니다");
  assert.equal(input.value, "전체 수업");
  assert.equal(tables.menus.find(r => r.id === "a").name, "전체 수업");
});

test("↓를 누르면 두 줄 순서가 바뀐다", async () => {
  const { rowsEl } = await setup();
  rowsEl()[0].querySelector(".actions button").nextSibling.click();
  await flush();
  assert.deepEqual(rowsEl().map(tr => tr.querySelector("input").value), ["학과별 자료", "전체 수업"]);
});

test("+ 추가는 다음 순서 번호와 기본값으로 줄을 만든다", async () => {
  const { container, supabase, rowsEl } = await setup({ defaults: rows => ({ name: `새 메뉴 ${rows.length + 1}`, is_active: false }) });
  container.querySelector(".editor-bar button").click();
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["insert", "menus", { name: "새 메뉴 3", is_active: false, sort_order: 2 }]);
  assert.equal(rowsEl().length, 3);
});

test("삭제는 확인했을 때만 지운다 (확인 문구는 비동기 함수도 가능)", async () => {
  let asked = "";
  const { rowsEl, tables } = await setup({ deleteConfirm: async row => (asked = `${row.name} 삭제?`) });
  confirmAnswer = false;
  rowsEl()[0].querySelector("button.danger").click();
  await flush();
  assert.equal(tables.menus.length, 2);
  assert.equal(asked, "전체 수업 삭제?");
  confirmAnswer = true;
  rowsEl()[0].querySelector("button.danger").click();
  await flush();
  assert.equal(tables.menus.length, 1);
  assert.equal(rowsEl().length, 1);
});

test("추가 버튼(extraActions)은 그 줄 데이터를 넘긴다", async () => {
  let got = null;
  const { rowsEl } = await setup({ extraActions: [{ label: "신청자 명단", onClick: row => { got = row.id; } }] });
  [...rowsEl()[1].querySelectorAll(".actions button")].find(b => b.textContent === "신청자 명단").click();
  assert.equal(got, "b");
});
