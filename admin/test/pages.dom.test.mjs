// 세 관리 페이지가 가짜 DB로 오류 없이 그려지고, 특강 신청자 명단·CSV·삭제 경고가 동작하는지 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
globalThis.URL.createObjectURL = () => "blob:x";
globalThis.URL.revokeObjectURL = () => {};
globalThis.Blob = dom.window.Blob;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
let lastConfirm = "";
globalThis.confirm = msg => { lastConfirm = msg; return false; };

const DATA = {
  main_media: [{ id: "m1", url: "video.mp4", caption: "캡션", is_active: true, sort_order: 0 }],
  menus: [{ id: "n1", name: "전체 수업", is_active: true, side: "left", sort_order: 1 }],
  site_settings: [{ key: "roadmap_logo_url", value: "logo" }, { key: "vacation_set_id", value: "s1" }],
  curriculum_sets: [{ id: "s1", name: "2026년 여름방학특강", department_id: null, sort_order: 0, is_vacation: true }],
  loading_items: [{ id: "l1", image_url: "img", text: "For", is_active: false, sort_order: 0 }],
  seminars: [{ id: "x1", title: "AI 특강", capacity: 25, sort_order: 0 }],
  seminar_applications: [
    { id: "p1", seminar_id: "x1", name: "홍길동", phone: "010-1111-2222", created_at: "2026-10-21T01:00:00Z" },
    { id: "p2", seminar_id: "x1", name: "김철수", phone: "010-3333-4444", created_at: "2026-10-21T02:00:00Z" },
  ],
};

// 필요한 만큼만 흉내 낸 supabase-js 쿼리 빌더 (eq·is 필터, order, count head).
function fakeSupabase() {
  return {
    from(table) {
      const filters = [];
      let head = false;
      const q = {
        select: (_cols, opts) => { head = Boolean(opts?.head); return q; },
        eq: (k, v) => { filters.push(r => r[k] === v); return q; },
        is: (k, v) => { filters.push(r => (r[k] ?? null) === v); return q; },
        order: () => q,
        upsert: () => Promise.resolve({ error: null }),
        then: (ok, bad) => {
          const rows = (DATA[table] || []).filter(r => filters.every(f => f(r))).map(r => ({ ...r }));
          return Promise.resolve(head ? { count: rows.length, error: null } : { data: rows, error: null }).then(ok, bad);
        },
      };
      return q;
    },
  };
}

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };
async function renderPage(path, ctx = {}) {
  const { render } = await import(path);
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  await render(container, { supabase: fakeSupabase(), ...ctx });
  await flush();
  return container;
}

test("메인 화면: 배경 미디어(미리보기 카드)·메뉴 표·기타 설정(미리보기 카드)", async () => {
  const c = await renderPage("../js/pages/main-page.mjs");
  assert.deepEqual([...c.querySelectorAll("h3")].map(h => h.textContent), ["배경 미디어", "메뉴", "기타 설정"]);
  assert.equal(c.querySelectorAll("table.editor").length, 1, "메뉴만 표");
  assert.ok(c.querySelector(".media-editor .media-stage video"), "mp4는 영상으로 미리보기");
  assert.equal(c.querySelector(".settings-select select").value, "s1");
  const logo = [...c.querySelectorAll(".media-card")].find(card => card.querySelector("h4")?.textContent === "로드맵 로고");
  assert.equal(logo.querySelector("input").value, "logo");
  assert.ok(logo.querySelector(".media-stage img"), "로고 미리보기");
  assert.equal(logo.querySelector(".upload-zone").parentElement.hidden, true, "올리기는 '수정'을 눌러야");
  [...logo.querySelectorAll("button")].find(b => b.textContent === "수정").click();
  assert.equal(logo.querySelector(".upload-zone").parentElement.hidden, false);
  assert.ok([...logo.querySelectorAll("button")].some(b => b.textContent === "저장" && b.className === "publish-btn"));
  assert.equal(c.querySelector("table.editor select").value, "left");
});

test("메인 화면: 메뉴 줄마다 PC·태블릿 미리보기", async () => {
  const opened = [];
  const c = await renderPage("../js/pages/main-page.mjs", { preview: (name, tablet) => opened.push([name, tablet]) });
  const buttons = [...c.querySelector("table.editor").querySelectorAll("tbody button")];
  buttons.find(b => b.textContent === "미리보기").click();
  buttons.find(b => b.textContent === "태블릿").click();
  assert.deepEqual(opened, [["전체 수업", false], ["전체 수업", true]]);
});

test("로딩 화면: 카드가 그려진다", async () => {
  const c = await renderPage("../js/pages/loading.mjs");
  assert.equal(c.querySelector("h2").textContent, "로딩 화면");
  assert.equal(c.querySelectorAll(".card-item").length, 1);
});

test("특강: 신청자 명단을 열면 인원·연락처가 보이고 CSV를 내려받는다", async () => {
  const c = await renderPage("../js/pages/seminars.mjs");
  const card = c.querySelector(".card-item");
  assert.ok(card.classList.contains("image-left") && card.classList.contains("collapsed"), "포스터 왼쪽, 처음엔 접힘");
  assert.ok(card.querySelector(".drag-handle"), "끌어서 순서");
  assert.deepEqual([...card.querySelectorAll(".card-fields > .card-line")].map(l => [l.firstChild.textContent, l.style.gridColumn]),
    [["특강명", "span 6"], ["소주제", "span 6"], ["일시", "span 3"], ["강사명", "span 3"], ["장소", "span 3"], ["정원", "span 3"]]);
  const btn = [...card.querySelectorAll("button")].find(b => b.textContent === "신청자 명단");
  btn.click();
  await flush();
  assert.equal(c.querySelector("section h3").textContent, "신청자 명단 — AI 특강 (2명)");
  assert.deepEqual([...c.querySelectorAll("section tbody tr")].map(tr => tr.children[1].textContent), ["010-1111-2222", "010-3333-4444"]);
  let downloaded = null;
  dom.window.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
  [...c.querySelectorAll("section button")].find(b => b.textContent.startsWith("엑셀")).click();
  assert.equal(downloaded, "AI 특강_신청자.csv");
});

test("신청자 수 조회가 실패하면 삭제를 묻지 않는다", async () => {
  const { render } = await import("../js/pages/seminars.mjs");
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const sb = fakeSupabase();
  const realFrom = sb.from;
  sb.from = t => {
    const q = realFrom(t);
    if (t !== "seminar_applications") return q;
    const realSelect = q.select;
    q.select = (cols, opts) => (opts?.head ? { eq: () => Promise.resolve({ count: null, error: { message: "boom" } }) } : realSelect(cols, opts));
    return q;
  };
  await render(container, { supabase: sb });
  await flush();
  lastConfirm = "";
  container.querySelector(".card-item button.danger").click();
  await flush();
  assert.equal(lastConfirm, "");
  assert.match(container.querySelector(".save-state").textContent, /신청자 수를 확인하지 못했습니다/);
});

test("특강 삭제 경고에 신청자 수가 나온다 (취소하면 지우지 않음)", async () => {
  const c = await renderPage("../js/pages/seminars.mjs");
  c.querySelector(".card-item button.danger").click();
  await flush();
  assert.equal(lastConfirm, "'AI 특강' 특강을 삭제하면 신청자 2명의 명단도 함께 삭제됩니다. 삭제할까요?");
});
