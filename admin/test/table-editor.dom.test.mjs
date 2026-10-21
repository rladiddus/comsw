// 브라우저 대신 jsdom, Supabase 대신 메모리 가짜 DB로 표 편집기 동작을 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
let confirmAnswer = true;
globalThis.confirm = () => confirmAnswer;
const { mountTableEditor } = await import("../js/table-editor.mjs");

// supabase-js 쿼리 빌더 흉내: eq·in·is·not 필터, order, update·delete·insert.
function fakeSupabase(tables, { unique = {} } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const rows = (tables[table] ??= []);
      const query = (kind, payload) => {
        const filters = [];
        const eqs = [];
        let orderCol = null;
        const run = () => {
          const hit = rows.filter(r => filters.every(f => f(r)));
          if (kind === "select") {
            const key = r => r[orderCol] ?? Infinity;
            return { data: [...hit].sort((a, b) => (orderCol ? key(a) - key(b) : 0)).map(r => ({ ...r })), error: null };
          }
          const id = eqs.find(([k]) => k === "id")?.[1];
          if (kind === "update") {
            calls.push(["update", table, id, payload]);
            const u = unique[table];
            if (u && u in payload && rows.some(r => !hit.includes(r) && r[u] === payload[u]))
              return { error: { code: "23505", message: "duplicate" } };
            hit.forEach(r => Object.assign(r, payload));
            return { error: null };
          }
          calls.push(["delete", table, id ?? Object.fromEntries(eqs)]);
          for (const r of hit) rows.splice(rows.indexOf(r), 1);
          return { error: null };
        };
        const q = {
          eq: (k, v) => { filters.push(r => r[k] === v); eqs.push([k, v]); return q; },
          in: (k, vs) => { filters.push(r => vs.includes(r[k])); return q; },
          is: (k, v) => { filters.push(r => (r[k] ?? null) === v); return q; },
          not: (k, _op, v) => { filters.push(r => (r[k] ?? null) !== v); return q; },
          order: col => { orderCol = col; return q; },
          then: (ok, bad) => Promise.resolve().then(run).then(ok, bad),
        };
        return q;
      };
      return {
        select: () => query("select"),
        update: patch => query("update", patch),
        delete: () => query("delete"),
        insert: row => {
          calls.push(["insert", table, row]);
          rows.push({ id: `new${rows.length}`, ...row });
          return Promise.resolve({ error: null });
        },
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

test("네트워크·권한 오류처럼 서버 쪽 실패면 입력한 글을 지우지 않는다", async () => {
  const { rowsEl, supabase, state } = await setup();
  const realFrom = supabase.from.bind(supabase);
  supabase.from = t => ({ ...realFrom(t), update: () => ({ eq: () => Promise.resolve({ error: { message: "Failed to fetch" } }) }) });
  const input = rowsEl()[0].querySelector("input");
  change(input, "긴 문구를 열심히 썼다");
  await flush();
  assert.equal(input.value, "긴 문구를 열심히 썼다");
  assert.equal(state(), "저장하지 못했습니다: Failed to fetch");
});

test("숫자 칸은 글자가 섞여도 브라우저가 지우지 않게 text 입력칸(숫자 키패드)으로 만든다", async () => {
  const tables = { seminars: [{ id: "s", capacity: 25, sort_order: 0 }] };
  const container = document.createElement("div");
  mountTableEditor(container, { supabase: fakeSupabase(tables), table: "seminars", columns: [{ key: "capacity", label: "정원", type: "number" }] });
  await flush();
  const input = container.querySelector("tbody input");
  assert.equal(input.type, "text");
  assert.equal(input.inputMode, "numeric");
  change(input, "25명");
  await flush();
  assert.equal(container.querySelector(".save-state").textContent, "정원에는 숫자만 입력할 수 있습니다");
  assert.equal(tables.seminars[0].capacity, 25);
});

test("삭제 확인 문구를 만들다 실패하면 삭제를 묻지 않고 오류를 보여준다", async () => {
  let asked = false;
  const saved = globalThis.confirm;
  globalThis.confirm = () => { asked = true; return true; };
  const { rowsEl, tables, state } = await setup({ deleteConfirm: async () => { throw new Error("신청자 수를 확인하지 못했습니다. 잠시 후 다시 시도해주세요"); } });
  rowsEl()[0].querySelector("button.danger").click();
  await flush();
  globalThis.confirm = saved;
  assert.equal(asked, false);
  assert.equal(tables.menus.length, 2);
  assert.equal(state(), "신청자 수를 확인하지 못했습니다. 잠시 후 다시 시도해주세요");
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

test("orderKey로 정렬하고 movable:false면 ↑↓가 없다", async () => {
  const tables = { roadmap_steps: [{ id: "s1", position: 3 }, { id: "s2", position: 1 }, { id: "s3", position: 2 }] };
  const container = document.createElement("div");
  mountTableEditor(container, { supabase: fakeSupabase(tables), table: "roadmap_steps", orderKey: "position", movable: false,
    columns: [{ key: "position", label: "단계", type: "number" }] });
  await flush();
  assert.deepEqual([...container.querySelectorAll("tbody input")].map(i => i.value), ["1", "2", "3"]);
  assert.ok(![...container.querySelectorAll(".actions button")].some(b => b.textContent === "↑"));
});

test("추가 기본값이 sort_order를 덮어쓴다", async () => {
  const { container, supabase } = await setup({ defaults: { name: "기타", sort_order: null } });
  container.querySelector(".editor-bar button").click();
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["insert", "menus", { sort_order: null, name: "기타" }]);
});

const DEPT_OPTIONS = [{ value: "d1", label: "시각편집학과" }, { value: "d2", label: "웹학과" }];
async function linksSetup(extraLinks = [], column = {}) {
  const tables = {
    subjects: [{ id: "a", name: "포토샵", sort_order: 0 }],
    subject_departments: [{ subject_id: "a", department_id: "d1" }, ...extraLinks],
  };
  const supabase = fakeSupabase(tables);
  const container = document.createElement("div");
  mountTableEditor(container, { supabase, table: "subjects", columns: [
    { key: "name", label: "과목명", type: "text" },
    { key: "departments", label: "학과", type: "links", through: "subject_departments", own: "subject_id", other: "department_id", options: DEPT_OPTIONS, ...column },
  ] });
  await flush();
  const chips = () => [...container.querySelectorAll(".chip")].map(c => c.firstChild.textContent);
  return { tables, supabase, container, chips, linkInput: () => container.querySelector("input.link-input"), state: () => container.querySelector(".save-state").textContent };
}

test("연결 칩: 읽기·추가·빼기", async () => {
  const { chips, linkInput, supabase, tables, container } = await linksSetup();
  assert.deepEqual(chips(), ["시각편집학과"]);
  change(linkInput(), "웹학과");
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["insert", "subject_departments", { subject_id: "a", department_id: "d2" }]);
  assert.deepEqual(chips(), ["시각편집학과", "웹학과"]);
  container.querySelector(".chip button").click();
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["delete", "subject_departments", { subject_id: "a", department_id: "d1" }]);
  assert.deepEqual(tables.subject_departments.map(r => r.department_id), ["d2"]);
  assert.deepEqual(chips(), ["웹학과"]);
});

test("연결 칩: 목록에 없는 이름은 저장하지 않는다", async () => {
  const { linkInput, supabase, state } = await linksSetup();
  change(linkInput(), "없는학과");
  await flush();
  assert.equal(state(), "목록에 없는 항목입니다");
  assert.ok(!supabase.calls.some(c => c[0] === "insert"));
});

test("연결 칩: 이미 연결된 항목은 다시 넣지 않는다", async () => {
  const { linkInput, supabase, chips } = await linksSetup();
  change(linkInput(), "시각편집학과");
  await flush();
  assert.ok(!supabase.calls.some(c => c[0] === "insert"));
  assert.deepEqual(chips(), ["시각편집학과"]);
});

test("ordered 연결은 그 줄의 다음 순서로 넣는다", async () => {
  const tables = {
    roadmap_steps: [{ id: "s", position: 1 }],
    roadmap_step_subjects: [{ step_id: "s", subject_id: "x", sort_order: 0 }, { step_id: "s", subject_id: "y", sort_order: 1 }],
  };
  const supabase = fakeSupabase(tables);
  const container = document.createElement("div");
  mountTableEditor(container, { supabase, table: "roadmap_steps", orderKey: "position", movable: false, columns: [
    { key: "subjects", label: "과목", type: "links", through: "roadmap_step_subjects", own: "step_id", other: "subject_id", ordered: true,
      options: [{ value: "x", label: "포토샵" }, { value: "y", label: "일러스트" }, { value: "z", label: "웹1" }] },
  ] });
  await flush();
  assert.deepEqual([...container.querySelectorAll(".chip")].map(c => c.firstChild.textContent), ["포토샵", "일러스트"]);
  change(container.querySelector("input.link-input"), "웹1");
  await flush();
  assert.deepEqual(supabase.calls.at(-1), ["insert", "roadmap_step_subjects", { step_id: "s", subject_id: "z", sort_order: 2 }]);
});
