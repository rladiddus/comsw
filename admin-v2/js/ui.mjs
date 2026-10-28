// V2 화면 조각: 시안(컴수원_V2_관리화면_인터랙티브_시안.html)의 카드·패널·표·상세 탭을 실제 데이터로 그린다.
import { el, rows } from "../../admin/js/teacher-workspace.mjs";
import { dbErrorMessage } from "../../admin/js/fields.mjs";

export { el, rows };

// 필요한 칸만 읽는다(긴 글이 든 표를 통째로 받지 않게).
export async function pick(supabase, table, cols, filter = (q) => q) {
  const { data, error } = await filter(supabase.from(table).select(cols));
  if (error) throw new Error(dbErrorMessage(error));
  return data || [];
}

export const chip = (text, kind = "") => el("span", { className: `v2-chip ${kind}`, textContent: text });
export const hint = (text, kind = "") => el("p", { className: `v2-hint ${kind}`, textContent: text });
export const btn = (text, onClick, primary = false, extra = {}) =>
  Object.assign(el("button", { type: "button", className: primary ? "publish-btn" : "ghost-btn", textContent: text, ...extra }), { onclick: onClick });
export const locked = (text, why) => btn(text, null, false, { disabled: true, title: why });

// 숫자 카드: [이름, 값, 설명, 강조, 누르면 갈 곳]
export const stats = (items) => el("div", { className: "v2-stats" }, items.map(([label, value, note = "", alert = false, href]) =>
  el(href ? "a" : "div", { className: `v2-stat${alert ? " alert" : ""}`, ...(href ? { href } : {}) }, [
    el("span", { className: "v2-stat-label", textContent: label }),
    el("strong", { className: "v2-stat-num", textContent: value }),
    el("span", { className: "v2-stat-hint", textContent: note }),
  ])));

export const panel = (title, body, desc = "", extra = []) => el("section", { className: "v2-panel" }, [
  el("div", { className: "v2-panel-head" }, [
    el("div", {}, [el("h3", { textContent: title }), ...(desc ? [el("p", { className: "v2-desc", textContent: desc })] : [])]),
    ...extra,
  ]),
  el("div", { className: "v2-panel-body" }, body),
]);

export const dl = (pairs) => el("dl", { className: "v2-dl" }, pairs.flatMap(([k, v]) =>
  [el("dt", { textContent: k }), el("dd", {}, [v instanceof Node ? v : document.createTextNode(v || "—")])]));

export const check = (title, detail, warn = false) => el("div", { className: `v2-check${warn ? " warn" : ""}` }, [
  el("span", { className: "v2-check-icon", textContent: warn ? "!" : "✓" }),
  el("div", {}, [el("b", { textContent: title }), el("small", { textContent: detail })]),
]);

export const empty = (text) => el("p", { className: "v2-empty", textContent: text });

// 탭 상자: 이름들과 i번째 탭 내용을 그리는 함수.
export function tabBox(names, draw) {
  const body = el("div", { className: "v2-panel-body" });
  const bar = el("div", { className: "v2-tabs" });
  const open = (i) => {
    [...bar.children].forEach((b, j) => b.classList.toggle("active", i === j));
    body.replaceChildren(...[draw(i)].flat());
  };
  names.forEach((n, i) => bar.append(Object.assign(el("button", { type: "button", className: "v2-tab", textContent: n }), { onclick: () => open(i) })));
  open(0);
  return [bar, body];
}

// 표: 줄을 누르면 onSelect(item). 고른 줄은 강조.
export function table(cols, items, cells, onSelect) {
  const tbody = el("tbody");
  const draw = (list, selected) => tbody.replaceChildren(...list.map((it) => {
    const tr = el("tr", {}, cells(it).map((c, i) => el("td", { className: i === 0 ? "v2-strong" : "" }, [c instanceof Node ? c : document.createTextNode(c ?? "")])));
    if (it === selected) tr.classList.add("selected");
    if (onSelect) tr.addEventListener("click", () => onSelect(it));
    return tr;
  }));
  draw(items);
  const node = el("div", { className: "v2-table-wrap" }, [el("table", { className: "v2-table" }, [
    el("thead", {}, [el("tr", {}, cols.map((c) => el("th", { textContent: c })))]), tbody,
  ])]);
  return { node, draw };
}

// 목록 + 상세(시안의 grid2). filters: 고르기 칸들, match(item) 로 거른다.
export function listDetail({ cols, items, cells, detail, filters = [], match = () => true, note }) {
  const side = el("div", { className: "v2-stack" });
  const count = el("span", { className: "muted" });
  let selected = items[0];
  const t = table(cols, items, cells, (it) => { selected = it; redraw(); });
  function redraw() {
    const list = items.filter(match);
    count.textContent = `${list.length}개`;
    if (!list.includes(selected)) selected = list[0];
    t.draw(list, selected);
    side.replaceChildren(...(selected ? [detail(selected)].flat() : [panel("선택한 항목", [empty("목록이 비어 있습니다.")])]));
  }
  for (const f of filters) f.addEventListener(f.tagName === "SELECT" ? "change" : "input", redraw);
  const node = el("div", { className: "v2-grid2" }, [
    el("div", { className: "v2-stack" }, [
      el("section", { className: "v2-panel" }, [el("div", { className: "v2-filter" }, [...filters, count]), t.node]),
      ...(note ? [note] : []),
    ]),
    side,
  ]);
  redraw();
  return node;
}

export const select = (label, options) => {
  const s = el("select", { className: "v2-field" }, options.map(([v, t]) => el("option", { value: v, textContent: t })));
  s.setAttribute("aria-label", label);
  return s;
};
export const search = (placeholder) => {
  const s = el("input", { type: "search", className: "v2-field", placeholder });
  s.setAttribute("aria-label", placeholder);
  return s;
};

// 고치기·추가는 기존 화면을 그대로 연다(처음 열 때 그린다). open()으로 펼치고 그쪽으로 스크롤.
export function editor(title, load, ctx, { open: startOpen = false } = {}) {
  const body = el("div", { className: "v2-editor-body" });
  const node = el("details", { className: "v2-editor" }, [el("summary", { textContent: title }), body]);
  let drawn = null;
  const draw = () => (drawn ??= (async () => {
    try { await (await load()).render(body, ctx); } catch (err) { body.append(el("p", { className: "save-state err", textContent: err.message })); }
  })());
  node.addEventListener("toggle", () => { if (node.open) draw(); });
  if (startOpen) { node.open = true; draw(); }
  return { node, open: () => { node.open = true; draw(); node.scrollIntoView?.({ behavior: "smooth", block: "start" }); } };
}

// 머리 오른쪽 버튼(시안의 '변경 이력'·대표 버튼 자리).
export function headActions(ctx, ...buttons) {
  ctx.headActions?.replaceChildren(...buttons);
}

// '2026년 8월 18일', '2026.8.18', '2026-08-18', '8/18', '11.10' 같은 글에서 날짜를 찾는다. 못 찾으면 null.
export function parseDate(text, now = new Date()) {
  const s = String(text || "");
  let m = s.match(/(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})\s*(?:월\s*|[./]\s*)(\d{1,2})\s*일?/);
  if (m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) return new Date(now.getFullYear(), +m[1] - 1, +m[2]);
  return null;
}
export const daysFrom = (date, now = new Date()) =>
  Math.floor((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);

// 커리큘럼 신청은 묶음(선생님·학과 탭·과목) 단위로 본다 — 기존 '신청 과목'과 같은 단위. 최근 것이 먼저.
export function groupRequests(list) {
  const groups = new Map();
  for (const r of list) {
    const key = `${r.instructor_id}|${r.set_id}|${r.subject_id}`;
    const g = groups.get(key) ?? { key, instructor_id: r.instructor_id, set_id: r.set_id, subject_id: r.subject_id, vacation: r.vacation, rows: [], at: r.updated_at };
    g.rows.push(r);
    if (String(r.updated_at) > String(g.at)) g.at = r.updated_at;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? "";
