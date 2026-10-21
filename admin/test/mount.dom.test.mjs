import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
const { mountPage, clearApp } = await import("../js/mount.mjs");

test("페이지를 빨리 옮겨도 늦게 끝난 이전 페이지 내용이 새 페이지에 붙지 않는다", async () => {
  const content = document.createElement("main");
  let releaseA;
  const slowA = { render: async c => { await new Promise(r => { releaseA = r; }); c.append(Object.assign(document.createElement("p"), { textContent: "A 설정" })); } };
  const fastB = { render: async c => { c.append(Object.assign(document.createElement("p"), { textContent: "B" })); } };
  const a = mountPage(content, async () => slowA, {});
  await new Promise(r => setTimeout(r, 0));
  await mountPage(content, async () => fastB, {});
  releaseA();
  await a;
  assert.equal(content.textContent, "B");
});

test("로그아웃하면 화면 내용·메뉴·사용자 표시를 비운다", () => {
  const content = document.createElement("main");
  content.textContent = "010-1111-2222";
  const nav = document.createElement("nav");
  nav.textContent = "메뉴";
  const email = document.createElement("span");
  email.textContent = "a@b.c";
  clearApp([content, nav], [email]);
  assert.equal(content.childNodes.length, 0);
  assert.equal(nav.childNodes.length, 0);
  assert.equal(email.textContent, "");
});
