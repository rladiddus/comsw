// V4 화면 부품. 글자는 늘 textContent로 넣는다(DB 글을 HTML로 해석하지 않음).
import { mediaPreview } from "../../admin/js/media-preview.mjs";

// h("div", {class: "box", onclick}, 자식…) — 자식은 글자·노드·배열·null
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : String(k))));
  return el;
}

export const head = (title, desc) => h("div", { class: "head" }, h("h2", {}, title), desc && h("p", { class: "muted" }, desc));
export const box = (title, ...kids) => h("section", { class: "box" }, title && h("h3", {}, title), ...kids);
export const empty = (text) => h("div", { class: "empty" }, text);
export const note = (text) => h("div", { class: "note" }, text);
export const fail = (text) => h("div", { class: "fail", role: "alert" }, text);
export const pill = (text, kind = "") => h("span", { class: `pill ${kind}`.trim() }, text);

// 탭·칩: [[값, 이름]…] 중 지금 값에 aria-pressed
export function tabs(items, value, onPick, cls = "tabs") {
  return h("div", { class: cls, role: "group" }, items.map(([v, label]) =>
    h("button", { type: "button", "aria-pressed": String(v === value), onclick: () => onPick(v) }, label)));
}

// 표: cols = [[제목, 행 → 칸 내용]…], onPick이 있으면 줄을 눌러 고름
export function table(cols, rows, { onPick, selected } = {}) {
  if (!rows.length) return empty("항목이 없습니다");
  return h("div", { class: "tablewrap" }, h("table", {},
    h("thead", {}, h("tr", {}, cols.map(([t]) => h("th", {}, t)))),
    h("tbody", {}, rows.map((r) => h("tr", {
      class: onPick ? "pick" : null,
      tabindex: onPick ? "0" : null,
      "aria-selected": onPick ? String(selected === r) : null,
      onclick: onPick ? () => onPick(r) : null,
      onkeydown: onPick ? (e) => { if (e.key === "Enter") onPick(r); } : null,
    }, cols.map(([, f]) => h("td", {}, f(r))))))));
}

export const media = (url) => h("div", { class: "media" }, url ? mediaPreview(url) : h("span", { class: "muted" }, "이미지 없음"));

export function dl(pairs) {
  return h("dl", { class: "dl" }, pairs.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v ?? "—")]));
}

// 화면을 비동기로 채운다. 읽기 실패는 '없음'이 아니라 실패로 보여 준다.
export async function fill(el, load) {
  el.replaceChildren(h("div", { class: "muted" }, "불러오는 중..."));
  try {
    el.replaceChildren(...[await load()].flat());
  } catch (err) {
    console.error(err);
    el.replaceChildren(fail(`불러오지 못했습니다: ${err?.message ?? err}`));
  }
}

// 확정 버튼 공통: 누르는 동안 잠그고, 실패하면 이유를 보여 준다(입력은 그대로).
export async function busy(btn, msgEl, work) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "처리 중...";
  msgEl?.replaceChildren();
  try { return await work(); } catch (err) {
    console.error(err);
    msgEl?.replaceChildren(fail(err?.message ?? String(err)));
    return undefined;
  } finally {
    btn.disabled = false; btn.textContent = label;
    import("./changes.mjs").then((c) => c.check()); // AI 등 기다린 뒤 바뀐 내용도 떠 있는 창에 반영
  }
}

// 반영 안 된 다른 변경 안내(학과장·관리자 화면 위)
export async function publishBanner(check) {
  const el = h("div");
  const dirty = await check();
  if (!dirty) return el;
  // [같이 반영](2026-11-20 사용자 결정 B안): 기존 화면에 가지 않고 여기서 그 변경을 공개 → V4 확정이 다시 된다.
  const btn = h("button", { type: "button", class: "btn primary" }, "같이 반영");
  const msg = h("div");
  btn.onclick = () => busy(btn, msg, async () => {
    if (!confirm("기존 관리 화면에서 고치고 아직 반영하지 않은 변경(강사 학과 연결, 승인한 커리큘럼 등)을 지금 홈페이지에 반영할까요?\n\nV4에서 임시 저장한 것은 포함되지 않습니다.")) return;
    await (await import("./data.mjs")).publishPending();
    el.replaceChildren(note("반영했습니다. 이제 V4의 확정·사이트 적용을 쓸 수 있습니다."));
  });
  el.append(h("div", { class: "fail", role: "alert" },
    "기존 관리 화면에서 고치고 아직 홈페이지에 반영하지 않은 변경이 있습니다. 그 변경이 모르게 섞여 공개되지 않도록 V4의 확정·삭제가 멈춥니다. 맞는 변경이면 [같이 반영]을 눌러주세요.",
    h("div", { class: "actions", style: "margin-top:8px" }, btn)), msg);
  return el;
}

// 팝업(<dialog>). 닫으면 지워진다. Esc·바깥·[닫기]로 닫음.
export function modal(title, body, { onClose, beforeClose, actions = [] } = {}) {
  const dlg = h("dialog", { class: "modal", "aria-label": title });
  const close = () => {
    if (beforeClose && beforeClose() === false) return;
    dlg.close?.(); dlg.remove(); onClose?.();
    import("./changes.mjs").then((c) => c.check()); // 떠 있는 창을 다시 본문으로
  };
  dlg.append(h("div", { class: "row modal-head" }, h("h3", {}, title), h("div", { class: "actions" }, h("button", { type: "button", class: "btn", onclick: close }, "닫기"), ...actions)), body);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  import("./changes.mjs").then((c) => c.check());
  return { dlg, close };
}

// 화면 전체 막기(반투명 검은 막 + 도는 표시). 맨 위(다른 팝업 위)에 뜨고 Esc로도 안 닫힘. 돌려준 함수로 걷는다.
export function blocker(text) {
  const dlg = h("dialog", { class: "blocker", "aria-label": text, "aria-busy": "true" },
    h("div", { class: "spinner", "aria-hidden": "true" }), h("p", { role: "status" }, text));
  dlg.addEventListener("cancel", (e) => e.preventDefault());
  document.body.append(dlg);
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  return () => { dlg.close?.(); dlg.remove(); };
}

// 이미지 고르기 팝업: 파일 고르기 또는 끌어다 놓기 → 올린 주소(닫으면 null)
export function pickImage(title, kind = "curriculum") {
  return new Promise((resolve) => {
    let done = false;
    const msg = h("div");
    const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": `${title} 파일 고르기` });
    const pop = modal(title, h("section", { class: "box", style: "margin:0" }, msg,
      h("label", { class: "drop-zone big" }, h("b", {}, "이미지를 여기로 끌어다 놓거나, 눌러서 파일을 고르세요"), h("span", { class: "muted" }, "PNG·JPG·WEBP"), file)),
    { onClose: () => { if (!done) resolve(null); } });
    pop.dlg.classList.add("modal-small");
    file.onchange = () => busy(file, msg, async () => {
      if (!file.files[0]) return;
      const { url } = await (await import("./data.mjs")).upload(file.files[0], kind);
      done = true;
      resolve(url);
      pop.close();
    });
  });
}

// 목록 위 거르기 줄: [{ key, label, options? }] — options가 없으면 검색칸, 있으면 드롭다운([[값, 이름]…], 첫 값 ''=전체).
// 바꿀 때마다 onChange(값들). 목록만 다시 그리고 이 줄은 그대로 둔다(입력 중 글자가 날아가지 않게).
export function filterBar(fields, onChange) {
  const values = Object.fromEntries(fields.map((f) => [f.key, ""]));
  const el = h("div", { class: "filter-bar" }, fields.map((f) => h("label", {}, h("span", { class: "muted" }, f.label),
    f.options
      ? h("select", { "aria-label": `${f.label} 거르기`, onchange: (e) => { values[f.key] = e.target.value; onChange(values); } },
        f.options.map(([v, l]) => h("option", { value: v }, l)))
      : h("input", { type: "search", "aria-label": `${f.label} 검색`, placeholder: `${f.label} 검색`, oninput: (e) => { values[f.key] = e.target.value.trim(); onChange(values); } }))));
  return { el, values };
}
export const hasText = (text, q) => !q || String(text ?? "").toLowerCase().replace(/\s/g, "").includes(q.toLowerCase().replace(/\s/g, ""));

// 켜기·끄기 스위치(role=switch). onToggle은 새 값으로 불림.
export const toggleSwitch = (on, label, onToggle) => h("button", {
  type: "button", role: "switch", class: "switch", "aria-checked": String(!!on), "aria-label": label, title: label,
  // 지금 표시 상태에서 뒤집는다(다시 그리지 않는 화면에서도 여러 번 누를 수 있게)
  onclick: (e) => { e.stopPropagation(); const el = e.currentTarget; const next = el.getAttribute("aria-checked") !== "true"; el.setAttribute("aria-checked", String(next)); onToggle(next, el); },
}, h("span", { class: "knob" }));

// 스크롤 지키기(2026-11-20 사용자 요청): 입력·선택·클릭 뒤 화면을 다시 그려도 스크롤은 사용자가 움직일 때만.
// 누르기 직전 스크롤된 칸(창 포함)의 위치를 기억했다가, 다시 그린 뒤(이미지 늦게 뜨는 것까지) 줄어든 것만 되돌린다.
// 칸은 body에서의 자리(자식 순번 경로)로 찾는다(다시 그려 새 칸이 생겨도 같은 자리면 같은 칸). 메뉴 이동은 건드리지 않는다.
if (typeof document !== "undefined" && typeof window !== "undefined") {
  let userScroll = 0;
  const mark = () => { userScroll = Date.now(); };
  for (const ev of ["wheel", "touchmove"]) window.addEventListener(ev, mark, { passive: true, capture: true });
  window.addEventListener("keydown", (e) => {
    if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(e.key) && !e.target.closest?.("input,textarea,select,[contenteditable]")) mark();
  }, true);
  const pathOf = (el) => { const p = []; for (; el && el !== document.body; el = el.parentElement) p.unshift([...el.parentElement.children].indexOf(el)); return p; };
  const at = (p) => p.reduce((n, i) => n?.children[i], document.body);
  const remember = () => {
    const hash = location.hash, since = Date.now(), y = window.scrollY;
    const boxes = [...document.body.querySelectorAll("*")].filter((e) => e.scrollTop > 0).map((e) => ({ p: pathOf(e), t: e.scrollTop }));
    const restore = () => {
      if (location.hash !== hash || userScroll >= since) return;
      for (const b of boxes) { const n = at(b.p); if (n && n.scrollTop < b.t) n.scrollTop = b.t; }
      if (window.scrollY < y) window.scrollTo(window.scrollX, y);
    };
    setTimeout(restore);
    setTimeout(restore, 300); // 이미지가 늦게 떠서 높이가 다시 늘어난 뒤
  };
  for (const ev of ["input", "change", "click"]) document.addEventListener(ev, remember, true);
}

// 이미지 끌어다 놓기(2026-11-20 사용자 요청): 파일 칸(input type=file)이 든 가장 가까운 칸에 이미지를 놓으면
// 그 파일 칸에 넣고 change를 일으켜 [파일 선택]과 똑같이 올린다. 파일이 아닌 끌기(과목 순서 바꾸기)는 건드리지 않는다.
// 파일 칸 밖에 떨어뜨리면 브라우저가 이미지를 열어 버리지 않게 막는다.
export function fileInputAt(target) {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    const inputs = el.querySelectorAll?.("input[type=file]:not([disabled])");
    if (inputs?.length === 1) return inputs[0];
    if (inputs?.length > 1) return null; // 여러 칸이 섞인 큰 칸이면 어느 것인지 모름
  }
  return null;
}
export function dropFiles(input, files) {
  const ok = [...files].filter((f) => !input.accept || input.accept.split(",").some((t) => f.type === t.trim()));
  if (!ok.length) return false;
  const dt = new DataTransfer();
  dt.items.add(ok[0]);
  input.files = dt.files;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event("change", { bubbles: true }));
  return true;
}
if (typeof document !== "undefined" && typeof DataTransfer !== "undefined") {
  const isFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");
  let over = null;
  const mark = (el) => { if (over === el) return; over?.classList.remove("file-over"); over = el; el?.classList.add("file-over"); };
  const zoneOf = (input) => input.closest("label, .step, .box") ?? input.parentElement;
  document.addEventListener("dragover", (e) => {
    if (!isFiles(e)) return;
    e.preventDefault();
    const input = fileInputAt(e.target);
    e.dataTransfer.dropEffect = input ? "copy" : "none";
    mark(input ? zoneOf(input) : null);
  });
  document.addEventListener("dragleave", (e) => { if (isFiles(e) && !e.relatedTarget) mark(null); });
  document.addEventListener("drop", (e) => {
    if (!isFiles(e)) return;
    e.preventDefault();
    mark(null);
    const input = fileInputAt(e.target);
    if (input && !dropFiles(input, e.dataTransfer.files)) alert("PNG·JPG·WEBP 이미지만 올릴 수 있습니다");
  });
}
