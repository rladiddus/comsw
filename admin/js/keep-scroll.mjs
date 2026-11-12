// 스크롤 유지(2026-11-12 사용자 요청): 스크롤은 사용자가 움직일 때만 바뀐다.
// 화면이 설정 변경·입력 뒤 다시 그려지면(내용을 비웠다 다시 채움, 스크롤 상자를 새로 만듦) 브라우저가 스크롤을 맨 위로 당긴다.
// 화면마다 고치지 않고 여기 한 곳에서: 사용자가 스크롤한 위치를 상자별로 기억하고, DOM이 바뀐 직후의 스크롤 변화는 되돌린다.
// - 사용자 스크롤 = 휠·터치·스크롤 키·스크롤바 끌기. 코드가 부르는 scrollIntoView(버튼 → 그 자리로)는 허용.
// - 메뉴(주소)가 바뀌면 기억을 지운다(새 화면은 처음부터).
// ponytail: 상자는 DOM 경로로 구분한다. 같은 자리에 다른 목록이 그려지면 그 위치를 이어받는다(메뉴 이동 때는 지움).

const RECENT_MS = 300;      // DOM이 바뀐 뒤 이 안의 스크롤 변화는 사용자 것이 아니면 되돌림
const USER_MS = 600;        // 휠·키·터치 뒤 이 안의 스크롤은 사용자 것
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

export function scrollKey(el) {
  const doc = el.ownerDocument;
  if (el === doc || el === doc.scrollingElement || el === doc.documentElement || el === doc.body) return "doc";
  const parts = [];
  for (let n = el; n && n !== doc.body && n.nodeType === 1; n = n.parentElement) {
    if (n.id) { parts.push(`#${n.id}`); break; }
    const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName && c.className === n.className) : [n];
    parts.push(`${n.tagName}.${n.className}:${same.indexOf(n)}`);
  }
  return parts.reverse().join(">");
}

export function keepScroll(doc = document, now = () => Date.now()) {
  if (doc.__keepScroll) return doc.__keepScroll;
  const saved = new Map(); // key → top
  const els = new Map();   // key → 마지막으로 본 상자(아직 붙어 있으면 다시 찾지 않음)
  let changedAt = -Infinity, userAt = -Infinity, allowAt = -Infinity, restoring = false;
  const scroller = (t) => (t === doc || t === doc.documentElement || t === doc.body ? doc.scrollingElement || doc.documentElement : t);
  const find = (key) => {
    if (key === "doc") return doc.scrollingElement || doc.documentElement;
    const last = els.get(key);
    if (last?.isConnected) return last;
    const el = [...doc.querySelectorAll("*")].find((n) => n.scrollHeight > n.clientHeight && scrollKey(n) === key) ?? null;
    if (el) els.set(key, el);
    return el;
  };
  const user = () => { userAt = now(); };

  doc.addEventListener("wheel", user, { capture: true, passive: true });
  doc.addEventListener("touchmove", user, { capture: true, passive: true });
  doc.addEventListener("keydown", (e) => { if (SCROLL_KEYS.has(e.key) && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? "")) user(); }, true);
  // 스크롤바 끌기: 상자 안쪽 칸(client) 밖을 누름. 누르고 있는 동안은 사용자 스크롤.
  let dragging = false;
  doc.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t?.nodeType === 1 && (e.offsetX > t.clientWidth || e.offsetY > t.clientHeight)) { dragging = true; user(); }
  }, true);
  doc.addEventListener("pointerup", () => { dragging = false; }, true);

  const proto = doc.defaultView?.Element?.prototype;
  if (proto?.scrollIntoView && !proto.scrollIntoView.__kept) {
    const orig = proto.scrollIntoView;
    proto.scrollIntoView = function (...args) { allowAt = now() + 1000; return orig.apply(this, args); };
    proto.scrollIntoView.__kept = true;
  }

  const restore = () => {
    restoring = true;
    for (const [key, top] of saved) {
      const el = find(key);
      if (el && Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
    }
    restoring = false;
  };

  doc.addEventListener("scroll", (e) => {
    if (restoring) return;
    const el = scroller(e.target);
    if (el?.nodeType !== 1) return;
    const key = scrollKey(el);
    const t = now();
    const byUser = dragging || t - userAt < USER_MS || t < allowAt;
    // 사용자 것이 아닌데 기억보다 위로, 끝까지 당겨짐 = 내용이 줄어서 당겨진 것(브라우저가 이 신호를 늦게 보내기도 해 시간과 무관).
    const clamped = saved.has(key) && el.scrollTop < saved.get(key) - 1 && el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
    if (!byUser && saved.has(key) && (clamped || t - changedAt < RECENT_MS)) {
      // 다시 그려져서 당겨진 것: 되돌린다(내용이 아직 짧으면 다음 DOM 변화 때 다시 맞춤).
      const top = saved.get(key);
      if (Math.abs(el.scrollTop - top) > 1) { restoring = true; el.scrollTop = top; restoring = false; }
      return;
    }
    saved.set(key, el.scrollTop);
    els.set(key, el);
  }, true);

  const View = doc.defaultView;
  new View.MutationObserver(() => {
    changedAt = now();
    restore();
    View.requestAnimationFrame?.(restore); // 그린 뒤(이미지·글꼴로 높이가 늘어난 뒤) 한 번 더
  }).observe(doc.body, { childList: true, subtree: true });

  // 다른 메뉴로 가면 기억을 지운다(같은 메뉴 안 주소 변화, 예: #/aggregate/과목, 는 유지).
  const menu = () => View.location.hash.replace(/^#\/?/, "").split("/")[0];
  let lastMenu = menu();
  View.addEventListener("hashchange", () => { if (menu() !== lastMenu) { saved.clear(); els.clear(); } lastMenu = menu(); });
  return (doc.__keepScroll = { saved });
}
