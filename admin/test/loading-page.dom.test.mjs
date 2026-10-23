import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";
import { render, reorderUpdates } from "../js/pages/loading.mjs";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
globalThis.confirm = () => true;
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };
const button = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);
const data = () => ({ loading_items: [
  { id: "a", image_url: "https://x.com/a.webp", text: "For Masterpieces", font_family: "Great Vibes", font_size: "48px", font_weight: "400", is_active: true, sort_order: 0 },
  { id: "b", image_url: "https://x.com/b.webp", text: "둘째", is_active: false, sort_order: 1 },
  { id: "c", image_url: "https://x.com/c.webp", text: "셋째", is_active: true, sort_order: 2 },
] });

test("끌어 놓은 자리로 옮기고 순서가 바뀐 줄만 다시 매긴다", () => {
  const rows = data().loading_items;
  assert.deepEqual(reorderUpdates(rows, 2, 0), [{ id: "c", sort_order: 0 }, { id: "a", sort_order: 1 }, { id: "b", sort_order: 2 }]);
  assert.deepEqual(reorderUpdates(rows, 0, 1), [{ id: "b", sort_order: 0 }, { id: "a", sort_order: 1 }]);
  assert.deepEqual(reorderUpdates(rows, 1, 1), []);
});

test("카드: 맨 왼쪽 손잡이, 미리보기에 문구를 그 폰트로, 오른쪽은 '제목 [값]' 줄", async () => {
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(data()) });
  const card = c.querySelector(".loading-card");
  assert.equal(card.firstElementChild.className, "drag-handle");
  const caption = card.querySelector(".loading-caption");
  assert.equal(caption.textContent, "For Masterpieces");
  assert.match(caption.style.fontFamily, /Great Vibes/);
  const lines = [...card.querySelectorAll(".loading-fields > .loading-line")].map((l) => l.firstElementChild.textContent);
  assert.deepEqual(lines, ["문구", "폰트", "폰트 크기", "두께", "사용"]);
  assert.ok(card.querySelector(".loading-line input").readOnly);
  assert.deepEqual([...card.querySelectorAll(".media-actions button")].map((b) => b.textContent), ["삭제", "수정"]);
});

test("수정 → 칸이 열리고 이미지 올리기가 나오며 '저장'(주황), 저장하면 다시 '수정'", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const card = c.querySelector(".loading-card");
  assert.equal(card.querySelector(".loading-upload").hidden, true);
  button(card, "수정").click();
  assert.equal(card.querySelector(".loading-upload").hidden, false);
  const save = button(card, "저장");
  assert.equal(save.className, "publish-btn");
  const text = card.querySelector(".loading-line input");
  text.value = "For Dreams";
  save.click();
  await flush();
  assert.equal(tables.loading_items[0].text, "For Dreams");
  assert.ok(button(card, "수정"));
  assert.equal(card.querySelector(".loading-upload").hidden, true);
});

test("손잡이로 끌어 다른 줄에 놓으면 순서를 저장한다", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const cards = () => [...c.querySelectorAll(".loading-card")];
  cards()[2].querySelector(".drag-handle").dispatchEvent(new dom.window.Event("pointerdown"));
  cards()[2].dispatchEvent(new dom.window.Event("dragstart"));
  cards()[0].dispatchEvent(new dom.window.Event("drop", { cancelable: true }));
  await flush();
  const order = Object.fromEntries(tables.loading_items.map((r) => [r.id, r.sort_order]));
  assert.deepEqual(order, { a: 1, b: 2, c: 0 });
});
