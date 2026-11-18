// 준비물 입력(prep-items.mjs) 2026-11-18: ◆ 고치기([추가] → [수정]), set()('1과 같음'으로 다른 과목 준비물 가져오기).
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
const { prepItems } = await import("../js/prep-items.mjs");

test("◆를 누르면 입력칸에 들어가고 [수정]으로 그 자리를 바꾼다, 비우고 [수정]이면 뺀다", () => {
  const p = prepItems({ values: { supply: "이어폰, 노트", ai: "Claude (Pro) | claude.ai" } });
  const chips = () => [...p.node.querySelectorAll(".prep-chip")];
  const [cat, text, link, add] = p.node.querySelectorAll(".prep-add > *");
  chips()[2].querySelector(".prep-edit").click();
  assert.equal(cat.value, "ai");
  assert.equal(text.value, "Claude (Pro)");
  assert.equal(link.value, "claude.ai");
  assert.equal(add.textContent, "수정");
  assert.ok(chips()[2].classList.contains("editing"));
  text.value = "Claude (Max)";
  add.click();
  assert.equal(add.textContent, "추가");
  assert.deepEqual(p.value(), { supply: "이어폰, 노트", textbook: null, ai: "Claude (Max) | https://claude.ai" });
  // 같은 이름 그대로 고쳐도 '이미 있음'으로 빠지지 않는다
  chips()[0].querySelector(".prep-edit").click();
  add.click();
  assert.equal(p.value().supply, "이어폰, 노트");
  // [수정]을 안 눌러도 저장 값에는 고친 내용
  chips()[1].querySelector(".prep-edit").click();
  text.value = "스케치북";
  assert.equal(p.value().supply, "이어폰, 스케치북");
  text.value = "";
  add.click();
  assert.equal(p.value().supply, "이어폰");
});

test("set(): 다른 과목 준비물로 바꾸기, '없음'도", () => {
  const p = prepItems({ values: { supply: "이어폰" } });
  p.set({ supply: "펜", textbook: "교재A", ai: "ChatGPT" });
  assert.deepEqual(p.value(), { supply: "펜", textbook: "교재A", ai: "ChatGPT" });
  p.set({}, true);
  assert.equal(p.none.checked, true);
  assert.deepEqual(p.value(), { supply: null, textbook: null, ai: null });
});
