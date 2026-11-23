// 바뀐 설정 떠 있는 창(2026-11-19 사용자 요청): 지금 화면 설정이 공개 중인 것(기준)과 다르면 오른쪽 아래에 창이 나타난다.
// [임시 저장] = 서버 보관(다른 메뉴에 갔다 와도 그대로) → 버튼이 [되돌리기]로. [되돌리기] = 기준으로 돌아감(보관 지움).
// [사이트 적용] = 그때 홈페이지에 반영(강사 화면은 [학과장에게 제출]). 다시 기준과 같아지면 창이 사라진다.
// 화면은 track({...})으로 편집기 하나를 등록한다. 입력·클릭이 있으면 알아서 다시 비교한다.
import * as data from "./data.mjs";
import { h, fail } from "./ui.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let trackers = [];
let bar = null;
let pending = false;
let busyNow = false;

// 화면 바꿀 때(app.mjs) 등록을 비운다. 로그아웃이면 창도 바로 숨긴다.
export function resetTracking() { trackers = []; if (bar) { bar.hidden = true; bar.replaceChildren(); } check(); }

// 로그아웃 직전: 임시 저장 안 한 변경을 조용히 임시 저장(다시 로그인하면 이어서). 실패해도 로그아웃은 막지 않는다.
export async function stashAll() {
  for (const t of trackers) {
    const cur = t.read();
    if (same(cur, t.baseline) || same(cur, t.saved)) continue;
    try { await t.store.save(clone(cur)); } catch (err) { console.warn("로그아웃 전 임시 저장 실패", err); }
  }
}

// 저장하지 않은 바뀐 것이 있나(임시 저장 안 한 것)
export const unsaved = (id) => trackers.some((t) => (id == null || t.id === id) && !same(t.read(), t.baseline) && !same(t.read(), t.saved));

/**
 * id: 보관 이름(화면·대상마다 하나), baseline: 공개 중인 설정, read(): 지금 입력, write(state): 입력을 그 설정으로 바꿔 다시 그림,
 * apply(state): 홈페이지 반영(실패하면 던짐), store: { load, save, drop } 기본은 학과장 보관함(v4_drafts kind 'ui'),
 * applyLabel: 버튼 이름(기본 '사이트 적용'), onApplied: 반영 뒤(보통 다시 불러오기)
 */
export function track(opts) {
  const t = { saved: null, applyLabel: "사이트 적용", store: staffStore(opts.id), ...opts, baseline: clone(opts.baseline) };
  // 같은 자리(slot)의 예전 편집기(다른 학과·과목 등)는 뺀다
  trackers = trackers.filter((x) => x.id !== t.id && !(t.slot && x.slot === t.slot)).concat(t);
  t.store.load().then((d) => {
    if (!trackers.includes(t) || d == null) return;
    if (same(d, t.baseline)) { t.store.drop().catch(() => {}); return; }
    t.write(clone(d));
    // 화면에 채운 모양 그대로를 '임시 저장한 상태'로(편집기가 글을 다듬어 담으면 저장본과 글자가 달라질 수 있음)
    const now = clone(t.read());
    if (same(now, t.baseline)) { t.saved = null; t.store.drop().catch(() => {}); } else t.saved = now;
    check();
  }).catch(() => {});
  check();
  return t;
}
// 화면 안에서 다른 학과·과목으로 바꾸기 전에: 임시 저장 안 한 변경이 있으면 묻는다
export const canSwitch = () => !unsaved() || confirm("임시 저장하지 않은 바뀐 설정이 있습니다. 바꾸면 사라집니다. 계속할까요?");
export const isTracked = (id) => trackers.some((t) => t.id === id);
export function untrack(id) { trackers = trackers.filter((t) => t.id !== id); check(); }

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
function staffStore(id) {
  return {
    load: async () => (await data.all("v4_drafts", (q) => q.eq("kind", "ui").eq("target", id)))[0]?.payload ?? null,
    save: async (state) => { const { error } = await data.upsertDraft("ui", id, state); if (error) throw new Error(error); },
    drop: () => data.dropDraft("ui", id),
  };
}

// 입력·클릭 뒤 한 번 비교(화면이 상태를 바꾼 다음에)
export function check() {
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; draw(); });
}
if (typeof document !== "undefined") {
  // 끌어서 옮기기(drop·dragend)와 키보드로 옮기기(Alt+↑/↓ → keyup)도 바로 비교
  for (const ev of ["input", "change", "click", "drop", "dragend", "keyup"]) document.addEventListener(ev, (e) => { if (!bar?.contains(e.target)) check(); }, true);
}

function draw() {
  if (!bar) { bar = h("div", { class: "change-bar", role: "region", "aria-label": "바뀐 설정" }); movable(bar); }
  // 팝업이 열려 있으면 바깥은 누를 수 없어 창을 맨 위 팝업 안으로 옮긴다
  const top = [...document.querySelectorAll("dialog[open]:not(.blocker)")].at(-1) ?? document.body;
  if (bar.parentElement !== top) top.append(bar);
  const dirty = trackers.filter((t) => !same(t.read(), t.baseline));
  // 기준과 같아졌는데 보관이 남아 있으면 지운다(되돌아가면 창이 사라지게)
  for (const t of trackers) if (t.saved && same(t.read(), t.baseline)) { t.saved = null; t.store.drop().catch(() => {}); }
  if (!dirty.length) { bar.hidden = true; bar.replaceChildren(); return; }
  if (busyNow) return;
  const allSaved = dirty.every((t) => same(t.read(), t.saved));
  const msg = h("div");
  const first = allSaved
    ? h("button", { type: "button", class: "btn", onclick: () => run(first, msg, revert) }, "되돌리기")
    : h("button", { type: "button", class: "btn", onclick: () => run(first, msg, saveAll) }, "임시 저장");
  const labels = [...new Set(dirty.map((t) => t.applyLabel))];
  const apply = h("button", { type: "button", class: "btn primary", onclick: () => run(apply, msg, applyAll) }, labels.join(" · "));
  // [취소]: 방금 바꾼 것(임시 저장 안 한 것)만 되돌림 — 임시 저장한 게 있으면 그 상태로, 없으면 공개 중인 상태로
  const cancel = allSaved ? null : h("button", { type: "button", class: "btn", onclick: () => run(cancel, msg, cancelAll) }, "취소");
  bar.hidden = false;
  bar.replaceChildren(
    h("b", { class: "bar-title", title: "끌어서 옮길 수 있습니다(두 번 누르면 원래 자리)" }, h("span", { class: "drag-handle", "aria-hidden": "true" }, "⠿ "), allSaved ? "임시 저장한 변경이 있습니다" : "바뀐 설정이 있습니다"),
    h("span", { class: "muted" }, dirty.map((t) => t.title).filter(Boolean).join(", ")),
    msg, h("div", { class: "actions" }, cancel, first, apply));
}

// 창 옮기기(2026-11-23 사용자 요청): 버튼이 아닌 곳을 끌면 옮겨지고, 위치는 이 브라우저에 기억. 제목을 두 번 누르면 원래 자리(오른쪽 아래).
const POS_KEY = "comsw_v4_bar_pos";
function place(el, x, y) {
  const win = el.ownerDocument.defaultView;
  const w = el.offsetWidth || 360, hgt = el.offsetHeight || 140;
  const left = Math.max(8, Math.min(x, (win?.innerWidth ?? 1200) - w - 8));
  const top = Math.max(8, Math.min(y, (win?.innerHeight ?? 800) - hgt - 8));
  Object.assign(el.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
  return { x: left, y: top };
}
function movable(el) {
  const win = el.ownerDocument.defaultView;
  if (!win) return;
  const store = (() => { try { return win.localStorage; } catch { return null; } })();
  try { const p = JSON.parse(store?.getItem(POS_KEY) ?? "null"); if (p) setTimeout(() => place(el, p.x, p.y)); } catch { /* 기억 못 해도 기본 자리 */ }
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button, a, input, select, textarea")) return;
    const r = el.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.setPointerCapture?.(e.pointerId);
    el.classList.add("moving");
  });
  el.addEventListener("pointermove", (e) => { if (drag) place(el, e.clientX - drag.dx, e.clientY - drag.dy); });
  const end = () => {
    if (!drag) return;
    drag = null;
    el.classList.remove("moving");
    try { store?.setItem(POS_KEY, JSON.stringify({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) })); } catch { /* 없음 */ }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".bar-title")) return;
    Object.assign(el.style, { left: "", top: "", right: "", bottom: "" });
    try { store?.removeItem(POS_KEY); } catch { /* 없음 */ }
  });
  // 창 크기가 바뀌어 화면 밖으로 나가지 않게
  win.addEventListener("resize", () => { if (el.style.left) place(el, parseFloat(el.style.left), parseFloat(el.style.top)); });
}

async function run(btn, msg, work) {
  busyNow = true;
  bar.querySelectorAll("button").forEach((b) => { b.disabled = true; });
  btn.textContent = "처리 중...";
  try { await work(); busyNow = false; draw(); } catch (err) {
    console.error(err);
    busyNow = false;
    draw();
    bar.insertBefore(fail(err?.message ?? String(err)), bar.querySelector(".actions"));
  }
}
async function saveAll() {
  for (const t of trackers.filter((x) => !same(x.read(), x.baseline))) {
    const state = clone(t.read());
    await t.store.save(state);
    t.saved = state;
  }
}
async function cancelAll() {
  for (const t of trackers.filter((x) => !same(x.read(), x.baseline) && !same(x.read(), x.saved))) t.write(clone(t.saved ?? t.baseline));
}
async function revert() {
  if (!confirm("임시 저장한 변경을 버리고 원래 설정으로 되돌릴까요?")) return;
  for (const t of trackers.filter((x) => !same(x.read(), x.baseline))) {
    await t.store.drop().catch(() => {});
    t.saved = null;
    t.write(clone(t.baseline));
  }
}
async function applyAll() { await applyList(trackers.filter((x) => !same(x.read(), x.baseline))); }
// 팝업의 [사이트 적용]: 그 편집기 하나만 반영(바뀐 것이 없으면 알림)
export async function applyTracked(id) {
  const t = trackers.find((x) => x.id === id);
  if (!t || same(t.read(), t.baseline)) throw new Error("바뀐 내용이 없습니다");
  await applyList([t]);
}
async function applyList(dirty) {
  const what = dirty.map((t) => t.title).filter(Boolean).join(", ");
  if (!confirm(`${what || "바뀐 설정"}을(를) ${dirty[0].applyLabel === "사이트 적용" ? "홈페이지에 반영" : dirty[0].applyLabel}할까요?`)) return;
  for (const t of dirty) {
    await t.apply(clone(t.read()));
    await t.store.drop().catch(() => {});
    t.saved = null;
    t.baseline = clone(t.read());
  }
  // 반영한 편집기는 빼고(화면이 다시 그리며 새로 등록), 화면을 다시 불러온다
  trackers = trackers.filter((t) => !dirty.includes(t));
  for (const t of dirty) t.onApplied?.();
}
