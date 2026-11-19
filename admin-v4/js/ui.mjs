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
