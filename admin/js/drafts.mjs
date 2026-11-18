// 임시 저장(2026-11-18 사용자 요청): 입력칸이 있는 모든 관리 화면에서 [임시 저장]으로 지금 입력한 내용을 이 브라우저에 남긴다.
// 반영(저장·적용·제출)하지 않고 화면을 벗어났다가 다시 오면 버튼이 [임시저장(내용있음)]으로 바뀌고, 누르면 입력란을 다시 채운다.
// 화면마다 만들지 않고 여기 한 곳에서: 화면(주소 #/메뉴…)마다, 사용자마다 입력칸 값을 모은다(본문 + 열린 팝업).
// - (내용있음) = 임시 저장한 값이 지금 입력란과 다를 때. 반영해서 화면이 그 값이 되면 다시 [임시 저장].
// - 채울 때는 입력·변경 이벤트를 보내 화면이 알아차리게 하고, 고르기(학과 등)로 새로 그려진 칸까지 몇 번 더 채운다.
// - 파일·비밀번호 칸은 빼고, data-no-draft가 붙은 칸도 뺀다.
// ponytail: 칸은 화면 안 위치(DOM 경로)로 찾는다. 화면 모양이 바뀌면(다른 학과를 고른 상태 등) 못 찾은 칸은 건너뛴다.
const SEL = "input:not([type=file]):not([type=password]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]), textarea, select";
const PASSES = 4;

const read = (c) => (c.type === "checkbox" || c.type === "radio" ? c.checked : c.value);
const label = (c) => c.name || c.getAttribute("aria-label") || c.placeholder || "";
// 칸 위치: 위로 id가 있는 곳까지 '태그:같은 태그 중 몇 번째'(바뀌는 class는 쓰지 않음) + 칸 이름
export function fieldKey(c) {
  const parts = [];
  for (let n = c; n && n.nodeType === 1 && n !== n.ownerDocument.body; n = n.parentElement) {
    if (n.id) { parts.push(`#${n.id}`); break; }
    const same = n.parentElement ? [...n.parentElement.children].filter((x) => x.tagName === n.tagName) : [n];
    parts.push(`${n.tagName}:${same.indexOf(n)}`);
  }
  return `${parts.reverse().join(">")}|${label(c)}`;
}

export function drafts({ uid, doc = document, root = () => doc.querySelector("#content"), storage = globalThis.localStorage, now = () => Date.now() }) {
  if (doc.__drafts) { doc.__drafts.uid = uid; doc.__drafts.update(); return doc.__drafts; }
  const View = doc.defaultView;
  const keyOf = () => `comsw_draft:${api.uid}:${View.location.hash || "#/"}`;
  const controls = () => {
    const scopes = [root(), ...doc.querySelectorAll("dialog[open]")].filter(Boolean);
    return scopes.flatMap((s) => [...s.querySelectorAll(SEL)]).filter((c) => !c.closest("[data-no-draft]"));
  };
  const load = () => { try { return JSON.parse(storage.getItem(keyOf()) || "null"); } catch { return null; } };

  const save = el("button", "publish-btn", "임시 저장");
  const drop = el("button", "ghost-btn", "버리기");
  drop.title = "임시 저장한 내용을 지웁니다";
  const msg = doc.createElement("span");
  msg.className = "save-state";
  const bar = doc.createElement("div");
  bar.className = "draft-bar";
  bar.setAttribute("data-no-draft", "");
  bar.append(msg, drop, save);
  doc.body.append(bar);

  // 임시 저장한 값 중 지금 입력란과 다른 것이 있나(칸이 안 보이면 다름으로)
  const differs = (d) => {
    if (!d) return false;
    const cur = new Map(controls().map((c) => [fieldKey(c), read(c)]));
    return Object.entries(d.values).some(([k, v]) => cur.get(k) !== v);
  };
  function update() {
    // 팝업이 열려 있으면 바깥은 누를 수 없어 버튼을 맨 위 팝업 안으로 옮긴다(팝업 칸도 임시 저장).
    const top = [...doc.querySelectorAll("dialog[open]")].at(-1) ?? doc.body;
    if (bar.parentElement !== top) top.append(bar);
    const has = controls().length > 0;
    bar.hidden = !has || !api.uid;
    const d = load();
    const pending = has && differs(d);
    save.textContent = pending ? "임시저장(내용있음)" : "임시 저장";
    save.title = pending ? `${stamp(d.at)}에 임시 저장한 내용으로 입력란을 채웁니다` : "지금 입력한 내용을 이 브라우저에 임시로 남깁니다(반영은 각 화면의 저장·적용)";
    drop.hidden = !d;
  }
  const stamp = (t) => new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const say = (t, err = false) => { msg.textContent = t; msg.classList.toggle("err", err); };

  async function restore(d) {
    const done = new Set();
    for (let pass = 0; pass < PASSES; pass++) {
      let changed = false;
      for (const c of controls()) {
        const k = fieldKey(c);
        if (done.has(k) || !(k in d.values)) continue;
        done.add(k);
        const v = d.values[k];
        if (read(c) === v) continue;
        if (c.type === "checkbox" || c.type === "radio") c.checked = v; else c.value = v;
        c.dispatchEvent(new View.Event("input", { bubbles: true }));
        c.dispatchEvent(new View.Event("change", { bubbles: true }));
        changed = true;
      }
      if (!changed) break;
      await new Promise((r) => View.setTimeout(r, 30)); // 고르기로 새로 그려진 칸을 다음 번에
    }
    return done.size;
  }

  save.addEventListener("click", async () => {
    const d = load();
    if (save.textContent !== "임시 저장" && d) {
      if (!View.confirm(`${stamp(d.at)}에 임시 저장한 내용으로 입력란을 채울까요? 지금 입력한 내용은 바뀝니다.`)) return;
      const n = await restore(d);
      say(n ? `임시 저장한 내용을 불러왔습니다(${stamp(d.at)}). 반영하려면 이 화면의 저장·적용을 눌러주세요.` : "임시 저장한 칸을 이 화면에서 찾지 못했습니다(고른 학과·과목이 다르면 같게 고른 뒤 다시 눌러주세요).", !n);
    } else {
      const values = Object.fromEntries(controls().map((c) => [fieldKey(c), read(c)]));
      try { storage.setItem(keyOf(), JSON.stringify({ at: now(), values })); } catch { return say("이 브라우저에서는 임시 저장을 할 수 없습니다", true); }
      say(`임시 저장했습니다(${stamp(now())}). 반영하려면 이 화면의 저장·적용을 눌러주세요.`);
    }
    update();
  });
  drop.addEventListener("click", () => {
    if (!View.confirm("임시 저장한 내용을 지울까요?")) return;
    try { storage.removeItem(keyOf()); } catch { /* 저장소 막힘 */ }
    say("임시 저장한 내용을 지웠습니다.");
    update();
  });

  // 화면이 바뀌면(메뉴 이동·다시 그림·팝업) 버튼을 다시 맞춘다.
  let timer = 0;
  const soon = () => { View.clearTimeout(timer); timer = View.setTimeout(update, 250); };
  new View.MutationObserver((list) => { if (list.some((m) => !bar.contains(m.target))) soon(); })
    .observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  View.addEventListener("hashchange", () => { say(""); soon(); });

  function el(tag, cls, text) {
    const b = doc.createElement(tag);
    Object.assign(b, { type: "button", className: cls, textContent: text });
    return b;
  }
  const api = { uid, update, bar };
  doc.__drafts = api;
  update();
  return api;
}

// 로그아웃: 버튼 숨김(다음 사람에게 안 보이게. 내용은 사용자별로 따로 남음)
export function stopDrafts(doc = document) {
  if (!doc.__drafts) return;
  doc.__drafts.uid = null;
  doc.__drafts.update();
}
