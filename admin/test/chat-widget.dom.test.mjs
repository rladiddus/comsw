import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";

const ROOT = new URL("../../", import.meta.url);
const CODE = readFileSync(new URL("assets/js/chat-widget.js", ROOT), "utf8");
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

function page(store = {}, reply = async () => ({ ok: true, status: 200, json: async () => ({ reply: "<b>추천</b>합니다. https://book.kr/a?b=1" }) })) {
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
  assert.equal(p.texts().at(-1), "<b>추천</b>합니다. https://book.kr/a?b=1");
  const link = p.root.querySelector(".msg a");
  assert.deepEqual([link.href, link.target, link.rel], ["https://book.kr/a?b=1", "_blank", "noopener noreferrer"]);
  assert.equal(p.root.querySelector(".msg b"), null, "답변을 HTML로 읽지 않음");
  p.$(".x").click();
  assert.ok(!p.$(".rate").hidden && !p.$(".win").hidden, "대화한 뒤 처음 닫으면 별점부터");
  [...p.root.querySelectorAll(".rate button")].find((b) => b.textContent === "건너뛰기").click();
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

test("채팅창 높이: 오른쪽 아래 모서리를 끌면 높이만 바뀌고(위쪽 끝·너비 그대로) 이 탭에 기억, 너무 작게는 안 됨", () => {
  const p = page();
  p.$(".icon").click();
  const win = p.$(".win");
  const grip = p.$(".grip");
  assert.ok(grip, "모서리 손잡이");
  const width = win.style.width;
  p.pointer(grip, "pointerdown", 300, 500);
  p.pointer(grip, "pointermove", 360, 650);
  p.pointer(grip, "pointerup", 360, 650);
  const h = JSON.parse(p.w.sessionStorage.getItem("comsw_chat")).h;
  assert.ok(h > 0 && win.style.height === `${h}px`, "높이를 정하고 기억");
  assert.equal(win.style.width, width, "너비는 그대로");
  p.pointer(grip, "pointerdown", 300, 500);
  p.pointer(grip, "pointermove", 300, -2000);
  p.pointer(grip, "pointerup", 300, -2000);
  assert.equal(JSON.parse(p.w.sessionStorage.getItem("comsw_chat")).h, 320, "최소 320px");
  const again = page({ comsw_chat: p.w.sessionStorage.getItem("comsw_chat") });
  assert.equal(JSON.parse(again.w.sessionStorage.getItem("comsw_chat")).h, 320, "다른 페이지로 가도 그대로");
});

test("번호 고르기: 선택지를 누르면 색이 바뀌고(모두 처음이에요는 따로), [이대로 답하기]로 보내며 고른 그대로 남음, 다음 질문에는 [고를 것]을 붙여 보냄", async () => {
  const replies = [{ reply: "컴활1급은 조금 어려운 편이에요.", choices: ["함수로 값 찾기", "피벗 테이블", "필터·정렬"] }, { reply: "컴활2급부터 추천해요." }];
  const p = page({}, async () => ({ ok: true, status: 200, json: async () => replies.shift() }));
  p.$(".icon").click();
  p.$("textarea").value = "컴활1급 많이 어려워?";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  const btns = () => [...p.root.querySelectorAll(".choice")];
  const send = () => p.$(".pick-send");
  assert.deepEqual(btns().map((b) => b.textContent), ["1함수로 값 찾기", "2피벗 테이블", "3필터·정렬", "–모두 처음이에요"]);
  assert.ok(send().disabled, "고르기 전에는 보낼 수 없음");
  btns()[0].click(); btns()[2].click();
  assert.deepEqual(btns().map((b) => b.getAttribute("aria-pressed")), ["true", "false", "true", "false"]);
  assert.equal(send().textContent, "이대로 답하기 (2개 선택)");
  btns()[3].click();
  assert.deepEqual(btns().map((b) => b.getAttribute("aria-pressed")), ["false", "false", "false", "true"], "모두 처음이에요를 누르면 다른 선택은 풀림");
  btns()[0].click(); btns()[2].click();
  assert.equal(btns()[3].getAttribute("aria-pressed"), "false");
  send().click();
  await flush();
  assert.equal(p.texts().at(-2), "1번, 3번은 해 봤어요");
  assert.equal(p.texts().at(-1), "컴활2급부터 추천해요.");
  assert.ok(p.$(".choices").classList.contains("done") && !send(), "고른 그대로 남고 다시 못 바꿈");
  assert.ok(btns().every((b) => b.disabled));
  const sent = p.sent[1][1].messages;
  assert.equal(sent.at(-2).content, "컴활1급은 조금 어려운 편이에요.\n[고를 것] 1. 함수로 값 찾기 / 2. 피벗 테이블 / 3. 필터·정렬 / 4. 모두 처음이에요");
  assert.equal(sent.at(-1).content, "1번, 3번은 해 봤어요");
  const again = page({ comsw_chat: p.w.sessionStorage.getItem("comsw_chat") });
  assert.deepEqual([...again.root.querySelectorAll(".choice")].map((b) => b.getAttribute("aria-pressed")), ["true", "false", "true", "false"], "다른 페이지에서도 고른 그대로");
  assert.ok(!again.$(".pick-send"));
});

test("번호 고르기: 고르지 않고 직접 써서 답하면 선택지는 닫힘", async () => {
  const replies = [{ reply: "어려운 편이에요.", choices: ["가", "나"] }, { reply: "알겠어요." }];
  const p = page({}, async () => ({ ok: true, status: 200, json: async () => replies.shift() }));
  p.$(".icon").click();
  p.$("textarea").value = "컴활1급 어려워?";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  p.$("textarea").value = "엑셀은 매일 써요";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  assert.ok(p.$(".choices").classList.contains("done") && !p.$(".pick-send"));
  assert.equal(p.texts().at(-2), "엑셀은 매일 써요");
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
  assert.ok(!p.$(".rate").hidden, "대화한 뒤 Esc도 별점부터");
  key("Escape");
  assert.ok(p.$(".win").hidden, "별점 창에서 Esc를 한 번 더 누르면 닫힘");
  assert.equal(leaked, 0);
});

test("상담 평가: [상담 끝내기]는 대화한 뒤에만, 별을 눌러 고르면 [보내기], 보내면 별점·대화를 서버로, 고마워요 → 새 상담", async () => {
  const replies = [{ reply: "CG 과정이 궁금하시군요!" }, { ok: true }];
  const p = page({}, async () => ({ ok: true, status: 200, json: async () => replies.shift() }));
  p.$(".icon").click();
  assert.ok(p.$(".end").hidden, "대화 전에는 없음");
  p.$("textarea").value = "CG 알려줘";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  assert.ok(!p.$(".end").hidden);
  p.$(".end").click();
  const send = () => p.root.querySelector(".rate-send");
  const stars = () => [...p.root.querySelectorAll(".stars button")];
  assert.ok(send().disabled, "별을 고르기 전에는 못 보냄");
  stars()[3].click();
  assert.deepEqual(stars().map((b) => b.classList.contains("on")), [true, true, true, true, false]);
  assert.equal(p.root.querySelector(".word").textContent, "도움이 됐어요");
  p.root.querySelector(".rate textarea").value = "좋아요";
  send().click();
  await flush();
  const body = p.sent.at(-1)[1];
  assert.deepEqual(body.feedback.stars, 4);
  assert.equal(body.feedback.comment, "좋아요");
  assert.deepEqual(body.feedback.messages.map((m) => m.role), ["user", "assistant"]);
  assert.match(p.root.querySelector(".rate").textContent, /★★★★☆[\s\S]*의견 고마워요/);
  [...p.root.querySelectorAll(".rate button")].find((b) => b.textContent === "새 상담 시작하기").click();
  assert.equal(p.texts().length, 1, "처음 인사만 남음");
  assert.ok(p.$(".end").hidden && p.$(".rate").hidden);
  p.$(".x").click();
  assert.ok(p.$(".win").hidden, "새 상담에서 대화가 없으면 바로 닫힘");
});

test("상담 평가: 닫을 때는 한 번만 묻고, [건너뛰기]하면 아무것도 보내지 않음", async () => {
  const p = page();
  p.$(".icon").click();
  p.$("textarea").value = "질문";
  p.$("form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await flush();
  const before = p.sent.length;
  p.$(".x").click();
  [...p.root.querySelectorAll(".rate button")].find((b) => b.textContent === "건너뛰기").click();
  assert.ok(p.$(".win").hidden);
  assert.equal(p.sent.length, before, "건너뛰면 저장 안 함");
  p.$(".icon").click();
  p.$(".x").click();
  assert.ok(p.$(".win").hidden, "같은 상담에서는 다시 묻지 않음");
  const again = page({ comsw_chat: p.w.sessionStorage.getItem("comsw_chat") });
  again.$(".icon").click();
  again.$(".x").click();
  assert.ok(again.$(".win").hidden, "다른 페이지로 가도 다시 묻지 않음");
});
