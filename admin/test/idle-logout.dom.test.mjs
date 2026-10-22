import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { IDLE_MS, WARN_MS, idleState, sessionExpired, startIdleLogout } from "../js/idle-logout.mjs";

const MIN = 60 * 1000;
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
function setup() {
  const { window } = new JSDOM("<!doctype html><body></body>");
  const clock = { t: 1_000_000 };
  const storage = memory();
  let loggedOut = 0;
  const idle = startIdleLogout({
    onLogout: () => loggedOut++,
    now: () => clock.t,
    storage,
    doc: window.document,
    tickMs: 60 * 60 * 1000,
  });
  const dialog = window.document.querySelector("dialog.idle-dialog");
  const isOpen = () => dialog.open || dialog.hasAttribute("open");
  const button = (text) => [...dialog.querySelectorAll("button")].find((b) => b.textContent === text);
  return { window, clock, storage, idle, dialog, isOpen, button, out: () => loggedOut };
}

test("30분 기준: 29분부터 경고, 30분이면 로그아웃", () => {
  assert.equal(IDLE_MS, 30 * MIN);
  assert.equal(WARN_MS, MIN);
  assert.equal(idleState(0, 28 * MIN), "ok");
  assert.equal(idleState(0, 29 * MIN), "warn");
  assert.equal(idleState(0, 30 * MIN), "logout");
});

test("로그아웃 1분 전에 남은 시간과 '30분 연장 / 로그아웃'을 묻고, 연장은 몇 번이든 된다", () => {
  const s = setup();
  for (let round = 0; round < 3; round++) {
    s.clock.t += 29 * MIN + 30 * 1000;
    s.idle.check();
    assert.ok(s.isOpen(), "경고");
    assert.match(s.dialog.textContent, /30초 뒤 로그아웃/);
    s.button("30분 연장").click();
    assert.ok(!s.isOpen());
    s.idle.check();
    assert.equal(s.out(), 0);
  }
  s.clock.t += 30 * MIN;
  s.idle.check();
  assert.equal(s.out(), 1, "답이 없으면 30분에 로그아웃");
  assert.equal(s.window.document.querySelector("dialog.idle-dialog"), null, "정리됨");
});

test("조작하면 30분을 다시 세고, 경고 중 '로그아웃'을 누르면 바로 로그아웃", () => {
  const s = setup();
  s.clock.t += 20 * MIN;
  s.window.document.dispatchEvent(new s.window.Event("keydown"));
  s.clock.t += 20 * MIN;
  s.idle.check();
  assert.ok(!s.isOpen(), "조작 후 20분은 아직 괜찮다");
  s.clock.t += 9 * MIN + 30 * 1000;
  s.idle.check();
  assert.ok(s.isOpen());
  s.button("로그아웃").click();
  assert.equal(s.out(), 1);
});

test("다른 탭에서 쓰고 있으면 이 탭도 로그아웃하지 않고, 다시 열었을 때 30분이 지났으면 만료", () => {
  const s = setup();
  s.clock.t += 25 * MIN;
  s.storage.setItem("comsw_last_active", String(s.clock.t));
  s.clock.t += 25 * MIN;
  s.idle.check();
  assert.equal(s.out(), 0);
  assert.equal(sessionExpired(s.storage, s.clock.t + 31 * MIN), true);
  assert.equal(sessionExpired(memory(), s.clock.t), false, "기록이 없으면 만료로 보지 않는다");
  s.idle.stop();
});
