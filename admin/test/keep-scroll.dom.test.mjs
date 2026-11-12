// 스크롤 유지(keep-scroll.mjs): 다시 그려져 당겨진 스크롤은 되돌리고, 사용자가 움직인 스크롤만 기억한다.
// jsdom엔 레이아웃이 없어 scrollTop·scrollHeight·clientHeight를 직접 흉내 낸다(실제 Chrome 확인은 record.md 2026-11-12).
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { keepScroll, scrollKey } from "../js/keep-scroll.mjs";

function setup() {
  const { window } = new JSDOM(`<!doctype html><body><div id="app"><div class="pane"></div></div></body>`, { url: "https://x.test/#/aggregate" });
  const doc = window.document;
  let t = 0;
  const now = () => t;
  const fake = (el, height = 3000) => {
    let top = 0;
    Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 300 });
    Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => (el.childNodes.length > 1 ? height : 300) });
    Object.defineProperty(el, "scrollTop", { configurable: true, get: () => top, set: (v) => { top = Math.max(0, Math.min(v, el.scrollHeight - el.clientHeight)); } });
    return el;
  };
  const pane = () => doc.querySelector(".pane");
  const fill = (el) => { el.replaceChildren(...Array.from({ length: 50 }, () => doc.createElement("p"))); return el; };
  fill(fake(pane()));
  keepScroll(doc, now);
  const scroll = (el) => el.dispatchEvent(new window.Event("scroll"));
  const tick = (ms) => { t += ms; };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { window, doc, pane, fake, fill, scroll, tick, flush };
}

test("상자 키: id가 있으면 거기서 끊고, 같은 모양 형제는 순서로 구분", () => {
  const { pane, doc } = setup();
  assert.equal(scrollKey(pane()), "#app>DIV.pane:0");
  assert.equal(scrollKey(doc.body), "doc");
});

test("사용자가 휠로 내린 위치는 기억하고, 비웠다 다시 채우면(늦게 와도) 그 위치로 돌아간다", async () => {
  const { window, doc, pane, fill, scroll, tick, flush } = setup();
  doc.dispatchEvent(new window.Event("wheel"));
  pane().scrollTop = 900; scroll(pane());
  tick(5000);
  pane().replaceChildren("불러오는 중"); await flush();
  pane().scrollTop = 0; tick(2000); scroll(pane()); // 브라우저가 늦게 보낸 '당겨짐'
  assert.equal(doc.__keepScroll.saved.get("#app>DIV.pane:0"), 900, "당겨진 0은 기억하지 않음");
  fill(pane()); await flush();
  assert.equal(pane().scrollTop, 900);
});

test("상자를 통째로 새로 만들어도 같은 자리면 위치를 이어받고, 다른 메뉴로 가면 지운다", async () => {
  const { window, doc, pane, fake, fill, scroll, flush } = setup();
  doc.dispatchEvent(new window.Event("wheel"));
  pane().scrollTop = 600; scroll(pane());
  const fresh = fill(fake(doc.createElement("div"))); fresh.className = "pane";
  pane().replaceWith(fresh); await flush();
  assert.equal(pane().scrollTop, 600);
  window.location.hash = "#/aggregate/s1"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  assert.equal(doc.__keepScroll.saved.size, 1, "같은 메뉴 안 주소 변화는 유지");
  window.location.hash = "#/roadmap"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  assert.equal(doc.__keepScroll.saved.size, 0);
});
