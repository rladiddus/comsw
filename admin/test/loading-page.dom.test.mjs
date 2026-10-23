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
  { id: "a", image_url: "https://x.com/a.webp", text: "For Masterpieces", font_family: "Great Vibes", font_size: "1.25rem, 3.5vw, 3rem", font_weight: "400", is_active: true, sort_order: 0 },
  { id: "b", image_url: "https://x.com/b.webp", text: "둘째", font_size: "48px", is_active: false, sort_order: 1 },
  { id: "c", image_url: "https://x.com/c.webp", text: "셋째", is_active: true, sort_order: 2 },
] });

test("끌어 놓은 자리로 옮기고 순서가 바뀐 줄만 다시 매긴다", () => {
  const rows = data().loading_items;
  assert.deepEqual(reorderUpdates(rows, 2, 0), [{ id: "c", sort_order: 0 }, { id: "a", sort_order: 1 }, { id: "b", sort_order: 2 }]);
  assert.deepEqual(reorderUpdates(rows, 0, 1), [{ id: "b", sort_order: 0 }, { id: "a", sort_order: 1 }]);
  assert.deepEqual(reorderUpdates(rows, 1, 1), []);
});

test("카드: 맨 왼쪽 손잡이, 미리보기에 문구를 그 폰트로, [문구][폰트]/[크기][두께], 사용·삭제·수정·접기", async () => {
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(data()) });
  const card = c.querySelector(".card-item");
  assert.equal(card.firstElementChild.className, "drag-handle");
  const caption = card.querySelector(".loading-caption");
  assert.equal(caption.textContent, "For Masterpieces");
  assert.match(caption.style.fontFamily, /Great Vibes/);
  const lines = [...card.querySelectorAll(".card-fields > .card-line")].map((l) => l.firstElementChild.textContent);
  assert.deepEqual(lines, ["문구", "폰트", "폰트 크기", "두께"]);
  assert.ok(card.querySelector(".card-line input").readOnly);
  assert.deepEqual([...card.querySelectorAll(".media-actions > *")].map((b) => b.textContent), ["사용", "삭제", "수정", "접기"]);
});

test("수정 → 칸이 열리고 이미지 올리기가 나오며 '저장'(주황), 저장하면 다시 '수정'", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const card = c.querySelector(".card-item");
  assert.equal(card.querySelector(".card-upload").hidden, true);
  button(card, "수정").click();
  assert.equal(card.querySelector(".card-upload").hidden, false);
  const save = button(card, "저장");
  assert.equal(save.className, "publish-btn");
  const text = card.querySelector(".card-line input");
  text.value = "For Dreams";
  save.click();
  await flush();
  assert.equal(tables.loading_items[0].text, "For Dreams");
  assert.ok(button(card, "수정"));
  assert.equal(card.querySelector(".card-upload").hidden, true);
});

test("손잡이로 끌어 다른 줄에 놓으면 순서를 저장한다", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const cards = () => [...c.querySelectorAll(".card-item")];
  cards()[2].querySelector(".drag-handle").dispatchEvent(new dom.window.Event("pointerdown"));
  cards()[2].dispatchEvent(new dom.window.Event("dragstart"));
  cards()[0].dispatchEvent(new dom.window.Event("drop", { cancelable: true }));
  await flush();
  const order = Object.fromEntries(tables.loading_items.map((r) => [r.id, r.sort_order]));
  assert.deepEqual(order, { a: 1, b: 2, c: 0 });
});

test("폰트·크기·두께는 드롭다운, 두께는 고른 폰트가 가진 것만", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const card = c.querySelector(".card-item");
  const [font, size, weight] = card.querySelectorAll(".card-fields select");
  assert.equal(font.value, "Great Vibes");
  assert.deepEqual([...font.options].map((o) => o.value), ["Paperlogy", "Great Vibes"]);
  assert.equal(size.selectedOptions[0].textContent, "보통", "예전 값(1.25rem…)과 같은 단계");
  assert.deepEqual([...weight.options].map((o) => o.value), ["400"]);
  assert.ok(font.disabled, "수정 전에는 고를 수 없다");
  const oldSize = c.querySelectorAll(".card-item")[1].querySelectorAll(".card-fields select")[1];
  assert.equal(oldSize.selectedOptions[0].textContent, "(현재) 48px", "목록에 없는 예전 값은 남겨 둔다");
  [...card.querySelectorAll("button")].find((b) => b.textContent === "수정").click();
  font.value = "Paperlogy";
  font.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual([...weight.options].map((o) => o.value), ["800"], "폰트를 바꾸면 그 폰트의 두께");
  size.value = "1.5rem, 4.5vw, 4rem";
  [...card.querySelectorAll("button")].find((b) => b.textContent === "저장").click();
  await flush();
  const saved = tables.loading_items[0];
  assert.deepEqual([saved.font_family, saved.font_size, saved.font_weight], ["Paperlogy", "1.5rem, 4.5vw, 4rem", "800"]);
});

test("접으면 한 줄(작은 미리보기)이 되고, 접은 채로도 수정·저장할 수 있다", async () => {
  const tables = data();
  const c = document.createElement("div");
  await render(c, { supabase: fakeSupabase(tables) });
  const card = c.querySelector(".card-item");
  [...card.querySelectorAll("button")].find((b) => b.textContent === "접기").click();
  assert.ok(card.classList.contains("collapsed"));
  assert.ok([...card.querySelectorAll("button")].some((b) => b.textContent === "펼치기"));
  [...card.querySelectorAll("button")].find((b) => b.textContent === "수정").click();
  card.querySelector(".card-line input").value = "접은 채로 수정";
  [...card.querySelectorAll("button")].find((b) => b.textContent === "저장").click();
  await flush();
  assert.equal(tables.loading_items[0].text, "접은 채로 수정");
  const all = [...c.querySelectorAll("button")].find((b) => b.textContent === "모두 접기");
  all.click();
  assert.equal(c.querySelectorAll(".card-item.collapsed").length, 3);
});
