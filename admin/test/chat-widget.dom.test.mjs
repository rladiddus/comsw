import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";

const ROOT = new URL("../../", import.meta.url);
const CODE = readFileSync(new URL("assets/js/chat-widget.js", ROOT), "utf8");
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

function page(store = {}, reply = async () => ({ ok: true, status: 200, json: async () => ({ reply: "<b>추천</b>합니다." }) })) {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://x/comsw/item.html", runScripts: "outside-only" });
  const w = dom.window;
  for (const [k, v] of Object.entries(store)) w.sessionStorage.setItem(k, v);
  Object.defineProperty(w.document, "currentScript", { value: { src: "https://x/comsw/assets/js/chat-widget.js" } });
  w.COMSW_SUPABASE_CONFIG = { url: "https://db", anonKey: "anon" };
  w.HTMLElement.prototype.setPointerCapture = () => {};
  w.AbortSignal.timeout ??= () => undefined;
  const sent = [];
  w.fetch = async (url, init) => { sent.push([url, JSON.parse(init.body)]); return reply(); };
  w.eval(CODE);
  const root = w.document.getElementById("comsw-chat").shadowRoot;
  const $ = (s) => root.querySelector(s);
  const pointer = (el, type, x, y) => el.dispatchEvent(Object.assign(new w.MouseEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y }), { pointerId: 1 }));
  return { w, $, root, sent, pointer, texts: () => [...root.querySelectorAll(".msg")].map((m) => m.textContent) };
}

test("홈페이지 모든 페이지에 챗봇이 한 번씩 들어 있다", () => {
  const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "index2.html"); // index2는 index로 넘기기만 함
  assert.equal(pages.length, 14);
  for (const f of pages) assert.equal(readFileSync(new URL(f, ROOT), "utf8").split("chat-widget.js").length, 2, f);
});

test("아이콘 → 채팅창 → 질문·답변(글자로만) → 닫으면 아이콘, 같은 탭에서는 이어짐", async () => {
  const p = page();
  assert.ok(p.$(".win").hidden && !p.$(".icon").hidden);
  p.$(".icon").click();
  assert.ok(!p.$(".win").hidden && p.$(".icon").hidden);
  p.$("textarea").value = "AI로 이미지를 만드는 수업을 알려줘";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  assert.equal(p.sent[0][0], "https://db/functions/v1/comsw-chat");
  assert.deepEqual(p.sent[0][1].messages, [{ role: "user", content: "AI로 이미지를 만드는 수업을 알려줘" }]);
  assert.equal(p.texts().at(-1), "<b>추천</b>합니다.");
  assert.equal(p.root.querySelector(".msg b"), null, "답변을 HTML로 읽지 않음");
  p.$(".x").click();
  assert.ok(p.$(".win").hidden && !p.$(".icon").hidden);

  const next = page({ comsw_chat: p.w.sessionStorage.getItem("comsw_chat") });
  assert.equal(next.texts().length, 3, "다른 페이지에서도 이어짐");
  assert.equal(page().texts().length, 1, "새 브라우저는 새 대화");
  assert.equal(p.w.localStorage.length, 0, "브라우저를 닫으면 지워지는 곳에만 저장");
});

test("실패하면 안내를 보이고 질문을 되돌려 주며, 대화에는 남기지 않음", async () => {
  const p = page({}, async () => ({ ok: false, status: 429, json: async () => ({ error: "질문이 너무 많습니다." }) }));
  p.$(".icon").click();
  p.$("textarea").value = "질문";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  assert.equal(p.texts().at(-1), "질문이 너무 많습니다.");
  assert.equal(p.$("textarea").value, "질문");
  assert.deepEqual(JSON.parse(p.w.sessionStorage.getItem("comsw_chat")).msgs, []);
  assert.equal(p.$(".send").disabled, false);
});

test("아이콘을 끌면 옮겨지고 열리지 않음, 채팅창은 제목 줄로 옮김", () => {
  const p = page();
  const drag = (el) => { p.pointer(el, "pointerdown", 900, 600); p.pointer(el, "pointermove", 700, 400); p.pointer(el, "pointerup", 700, 400); };
  const pos = () => JSON.parse(p.w.sessionStorage.getItem("comsw_chat"));
  const before = pos();
  drag(p.$(".icon"));
  p.$(".icon").click();
  assert.ok(p.$(".win").hidden, "끌기 뒤의 누름은 열지 않음");
  assert.notDeepEqual([pos().r, pos().b], [before.r, before.b]);
  p.$(".icon").click();
  assert.ok(!p.$(".win").hidden);
  const x = pos().r;
  p.pointer(p.$(".bar"), "pointerdown", 100, 100);
  p.pointer(p.$(".bar"), "pointermove", 400, 160);
  p.pointer(p.$(".bar"), "pointerup", 400, 160);
  assert.notEqual(pos().r, x);
});

test("채팅창에서 누른 키는 페이지(슬라이드 넘기기)로 새지 않고, Enter는 보내기·한글 쓰는 중은 아님·Esc는 닫기", async () => {
  const p = page();
  let leaked = 0;
  p.w.addEventListener("keydown", () => leaked++, true);
  p.w.document.addEventListener("keydown", () => leaked++, true);
  p.$(".icon").click();
  const key = (k, extra = {}) => p.$("textarea").dispatchEvent(new p.w.KeyboardEvent("keydown", { key: k, bubbles: true, composed: true, cancelable: true, ...extra }));
  p.$("textarea").value = "질문";
  key("ArrowRight");
  key("Enter", { isComposing: true });
  key("Enter", { shiftKey: true });
  assert.equal(p.sent.length, 0);
  key("Enter");
  await flush();
  assert.equal(p.sent.length, 1);
  key("Escape");
  assert.ok(p.$(".win").hidden);
  assert.equal(leaked, 0);
});
