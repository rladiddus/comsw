// V3 시험판 공통: 설계(컴수원_V3_최종설계)의 정책을 지금 DB 위에서 보여 주는 데 필요한 것들.
// V3 전용 칸(4분류 확정·학과별 순서·재직 상태·통합본 버전)은 아직 DB에 없다. 그 값은 아래 state에만 두고(새로고침하면 사라짐) 저장하지 않는다.
import { el, pick, chip, select } from "../../admin-v2/js/ui.mjs";

// 학과 순서·강사 명단은 DB 칸이 생기기 전까지 이 브라우저(localStorage)에 저장한다(saveLocal).
const load = (k) => { try { return new Map(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Map(); } };
export const state = {
  dept: "",
  mode: "regular", // regular | vacation
  orders: load("v3.orders"), // "학과id:mode" → [과목id] (학과별 순서)
  roadmap: new Map(), // 학과id → [{ ids: [과목id], from: 처음 로드맵 단계id }] (로드맵 스텝, 저장 안 됨)
  picks: load("v3.picks"), // "과목id|mode" → [강사id] (과목 통합에 넣을 강사)
  aggTab: "weeks", // 학과 관리(정규): weeks 주차별 | subjects 과목별
  aiLines: 2, // 과목 통합 AI 요약 줄 수(2~4)
  teacherTab: "teacher", // 강사 커리큘럼: teacher 강사별 과목 | subject 과목별 강사
  aggLeft: 0, // 학과 관리 왼쪽 과목 칸 너비(px, 0 = 기본)
  aggRight: 0, // 특강·세미나 오른쪽 신청자 명단 칸 너비(px, 0 = 기본 330)
  employed: new Map(), // 강사id → false(퇴사 처리 시험)
  reviews: new Map(), // 제출 묶음 key → Map(준비물id → 최종 분류)
};

// 화면마다 학과·정규/방특·시기를 따로 기억한다(한 화면에서 고른 것이 다른 화면에 옮겨 가지 않게).
// 처음 여는 화면은 첫 학과·정규. 다른 화면에 갔다 돌아오면 떠날 때 고른 그대로.
const pageCtx = new Map();
let currentPage = "";
export function usePage(name) {
  if (currentPage) pageCtx.set(currentPage, { dept: state.dept, mode: state.mode });
  currentPage = name;
  Object.assign(state, pageCtx.get(name) ?? { dept: "", mode: "regular" });
}

export function saveLocal() {
  try {
    localStorage.setItem("v3.orders", JSON.stringify([...state.orders]));
    localStorage.setItem("v3.picks", JSON.stringify([...state.picks]));
  } catch { /* 저장소를 못 쓰면 화면에서만 기억 */ }
}

export const CAT ={ textbook: "교재", supply: "물품", software: "사용 프로그램", ai: "AI 도구" };
export const norm = (s) => String(s || "").replace(/[\s\-_.·()[\]]+/g, "").toLowerCase();
export const typeChip = (s) => chip(s?.is_vacation ? "방특" : "정규", s?.is_vacation ? "profiles" : "vacation");
export const isEmployed = (id) => state.employed.get(id) !== false;

// 선생님이 칸에 적은 글을 항목으로 나눈다(줄바꿈·쉼표·가운뎃점).
export function splitItems(text) {
  return String(text || "").split(/[\n,·]+/).map((s) => s.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}

// 규칙 검사(AI 미연결): 이름으로 분류를 짐작해 '제안'만 한다. 선생님 분류는 바꾸지 않는다.
const WORDS = [
  ["ai", /chat\s*gpt|gpt|gemini|제미나이|claude|클로드|midjourney|미드저니|copilot|코파일럿|뤼튼|wrtn|생성형|(^|[^a-z])ai([^a-z]|$)|stable\s*diffusion|dall|달리|suno|runway|런웨이|perplexity|퍼플렉시티|노트북lm|notebooklm/i],
  ["textbook", /교재|도서|워크북|문제집|책$/],
  ["software", /포토샵|photoshop|일러스트|illustrator|피그마|figma|프리미어|premiere|애프터\s*이펙트|after\s*effects|캐드|autocad|스케치업|sketchup|블렌더|blender|엑셀|excel|파워포인트|powerpoint|vs\s*code|유니티|unity|캔바|canva|인디자인|indesign|라이트룸|lightroom|3ds\s*max|마야|maya|cinema\s*4d|zbrush|지브러시/i],
];
export const guessCategory = (label) => WORDS.find(([, re]) => re.test(label))?.[0] ?? null;

// items: [{ id, label, teacher }], others: 같은 과목의 다른 출처(다른 강사·준비물 카드) 이름(norm)
export function checkMaterials(items, others = []) {
  return items.map((m) => {
    const issues = [];
    const guess = guessCategory(m.label);
    if (guess && guess !== m.teacher) issues.push(["분류 확인", `${CAT[guess]}(으)로 보입니다`]);
    if (/http:\/\//i.test(m.label)) issues.push(["링크 확인", "https가 아닌 링크입니다"]);
    if (norm(m.label).length < 2) issues.push(["내용 부족", "항목명이 너무 짧습니다"]);
    if (items.some((x) => x !== m && norm(x.label) === norm(m.label))) issues.push(["중복 후보", "같은 제출 안에 같은 항목이 있습니다"]);
    else if (others.includes(norm(m.label))) issues.push(["중복 후보", "이 과목의 다른 강사·준비물 카드에 같은 항목이 있습니다"]);
    return { ...m, suggested: guess && guess !== m.teacher ? guess : m.teacher, issues };
  });
}

// 지금 DB는 선생님이 '사용 프로그램'과 '준비물' 두 칸에 적는다 → 칸 이름을 선생님 분류로 본다(4분류 입력은 DB 추가 후).
export const materialsOf = (row) => row ? [
  ...splitItems(row.tools).map((label, i) => ({ id: `t${i}`, label, teacher: "software" })),
  ...splitItems(row.supplies).map((label, i) => ({ id: `s${i}`, label, teacher: "supply" })),
] : [];

// 학과·유형의 과목 순서. 저장된 학과별 순서 칸이 없어 지금은 전체 공통 순서(subjects.sort_order)를 쓴다.
// 정규 = 학과에 연결된 과목 중 '방특' 표시가 없는 것.
// 방특 = 학과에 연결된 '방특' 표시 과목 + 그 학과 강사가 방특으로 낸 과목(지금 방특 제출은 대부분 정규 과목을 그대로 쓴다).
export function deptSubjects(dept, mode, { subjects, links, curricula = [], idepts = [] }) {
  const vac = mode === "vacation";
  const linked = new Set(links.filter((l) => l.department_id === dept).map((l) => l.subject_id));
  const used = new Set();
  if (vac) {
    const mine = new Set(idepts.filter((x) => x.department_id === dept).map((x) => x.instructor_id));
    curricula.filter((c) => c.vacation && mine.has(c.instructor_id)).forEach((c) => used.add(c.subject_id));
  }
  const base = subjects.filter((s) => used.has(s.id) || (linked.has(s.id) && Boolean(s.is_vacation) === vac))
    .sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9) || a.name.localeCompare(b.name));
  // 정규 학과 순서는 DB(subjects.sort_order·subject_departments, 학과 관리 '저장')를 따른다. 이 브라우저 순서는 방특만.
  const saved = vac ? state.orders.get(`${dept}:${mode}`) : null;
  return saved ? saved.map((id) => subjects.find((s) => s.id === id)).filter(Boolean) : base;
}

// 이 학과 순서에 더 넣을 수 있는 과목: 정규는 '방특' 표시가 없는 과목, 방특은 모든 과목(방특도 정규 과목을 쓴다).
export const addableSubjects = (subjects, ids, mode) => subjects
  .filter((s) => !ids.includes(s.id) && (mode === "vacation" || !s.is_vacation))
  .sort((a, b) => a.name.localeCompare(b.name));

// 화면 위 공통 막대: 학과 / 정규·방특(필요 없는 화면은 .v3-switch를 지운다).
export function contextBar(depts, onChange, extra = []) {
  if (!depts.some((d) => d.id === state.dept)) state.dept = depts[0]?.id ?? "";
  const sel = select("학과", depts.map((d) => [d.id, d.name]));
  sel.value = state.dept;
  sel.addEventListener("change", () => { state.dept = sel.value; onChange(); });
  const scope = el("span", { className: "v2-row v2-gap" }, [el("span", { className: "v2-label", textContent: "학과" }), sel]);
  const modeBtn = (mode, text) => Object.assign(el("button", { type: "button", className: state.mode === mode ? "publish-btn" : "ghost-btn", textContent: text }),
    { onclick: () => { state.mode = mode; [...sw.children].forEach((b, i) => { b.className = (i === 0) === (mode === "regular") ? "publish-btn" : "ghost-btn"; }); onChange(); } });
  const sw = el("div", { className: "v3-switch" }, [modeBtn("regular", "정규"), modeBtn("vacation", "방특")]);
  return el("div", { className: "v2-panel v2-filter v2-bar" }, [scope, sw, ...extra]);
}

// 확인 창(브라우저 기본 dialog). actions: [글자, 할 일](누르면 닫고 실행) 또는 직접 만든 버튼. 창 밖을 누르면 닫힌다.
export function modal(title, body, actions, cancel = "취소") {
  const d = el("dialog", { className: "v3-modal" });
  const close = () => { d.close?.(); d.remove(); };
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const b = d.getBoundingClientRect();
    if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) close();
  });
  d.append(el("h3", { textContent: title }), ...body, el("div", { className: "v2-actions v2-end" }, [
    Object.assign(el("button", { type: "button", className: "ghost-btn", textContent: cancel }), { onclick: close }),
    ...actions.map((a) => Array.isArray(a) ? Object.assign(el("button", { type: "button", className: "publish-btn", textContent: a[0] }), { onclick: () => { close(); a[1](); } }) : a),
  ]));
  document.body.append(d);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  return d;
}

// 끌어서 순서 바꾸기: pairs = [[줄, id]], ids = 지금 순서. 줄의 위쪽 절반이면 그 앞, 아래쪽 절반이면 뒤(경계에 점선).
export function sortable(pairs, ids, onDrop) {
  let dragged = null;
  const clear = () => pairs.forEach(([n]) => n.classList.remove("drop-before", "drop-after"));
  pairs.forEach(([r, id]) => {
    r.draggable = true;
    const after = (e) => { const b = r.getBoundingClientRect(); return e.clientY > b.top + b.height / 2; };
    // 안쪽 목록(예: 스텝 안 과목)을 끌 때 바깥 목록(스텝)이 같이 끌리지 않게 막는다
    r.addEventListener("dragstart", (e) => { e.stopPropagation(); dragged = id; e.dataTransfer?.setData("text/plain", String(id)); });
    r.addEventListener("dragend", () => { dragged = null; clear(); });
    r.addEventListener("dragover", (e) => { if (!dragged || dragged === id) return; e.preventDefault(); clear(); r.classList.add(after(e) ? "drop-after" : "drop-before"); });
    r.addEventListener("dragleave", () => r.classList.remove("drop-before", "drop-after"));
    r.addEventListener("drop", (e) => {
      e.preventDefault(); clear();
      if (!dragged || dragged === id) return;
      const a = ids.filter((x) => x !== dragged);
      a.splice(a.indexOf(id) + (after(e) ? 1 : 0), 0, dragged);
      dragged = null;
      onDrop(a);
    });
  });
}

// 왼쪽 목록 | 끌 수 있는 경계 | 오른쪽 내용. 왼쪽 너비(기본 330px, 160~520px)는 화면끼리 같이 쓰고 화면에서만 기억.
// right = true: 오른쪽 칸 너비를 정한다(기본 330px, 특강·세미나의 신청자 명단). 너비는 따로 기억(state.aggRight).
export function splitGrid(left, right, { right: fromRight = false } = {}) {
  const bar = el("div", { className: "v3-splitter", title: "끌어서 너비 조절" });
  const grid = el("div", { className: fromRight ? "v3-gridagg v3-gridright" : "v3-gridagg" }, [left, bar, right]);
  const key = fromRight ? "aggRight" : "aggLeft";
  const prop = fromRight ? "--agg-right" : "--agg-left";
  bar.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const box = grid.getBoundingClientRect();
    const move = (ev) => { state[key] = Math.min(520, Math.max(160, Math.round(fromRight ? box.right - ev.clientX : ev.clientX - box.left))); grid.style.setProperty(prop, `${state[key]}px`); };
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); grid.classList.remove("resizing"); };
    grid.classList.add("resizing");
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
  if (state[key]) grid.style.setProperty(prop, `${state[key]}px`);
  return grid;
}

// V3 전환 점검: 설계 정책과 지금 데이터가 어긋나는 곳(실데이터 기준). [제목, 설명, 이름 목록, 갈 곳]
// 정책 7(2026-10-29): 과목 하나를 여러 학과가 같이 쓰는 것은 정상. 대신 강사 × 과목 커리큘럼은 하나여야 한다.
export async function audit(supabase) {
  const [subjects, instructors, curricula, sets] = await Promise.all([
    pick(supabase, "subjects", "id, name, is_vacation"),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "instructor_curricula", "instructor_id, subject_id, set_id, status"),
    pick(supabase, "curriculum_sets", "id, is_vacation"),
  ]);
  const name = (list, id) => list.find((s) => s.id === id)?.name ?? "?";
  const vacSet = new Set(sets.filter((s) => s.is_vacation).map((s) => s.id));
  const approved = curricula.filter((c) => c.status === "approved");
  const setsOf = (list, key) => list.reduce((m, c) => m.set(key(c), (m.get(key(c)) ?? new Set()).add(c.set_id)), new Map());
  const twice = [...setsOf(approved.filter((c) => !vacSet.has(c.set_id)), (c) => `${c.instructor_id}|${c.subject_id}`)]
    .filter(([, v]) => v.size > 1).map(([k]) => { const [i, s] = k.split("|"); return `${name(instructors, i)} · ${name(subjects, s)}`; });
  const vacMulti = [...setsOf(approved.filter((c) => vacSet.has(c.set_id)), (c) => c.subject_id)].filter(([, v]) => v.size > 1).map(([id]) => name(subjects, id));
  const mixed = [...new Set(approved.filter((c) => vacSet.has(c.set_id)).map((c) => c.subject_id))]
    .filter((id) => approved.some((c) => c.subject_id === id && !vacSet.has(c.set_id))).map((id) => name(subjects, id));
  return [
    ["같은 과목을 여러 학과에 따로 낸 강사", "정책 7: 강사 × 과목 커리큘럼은 하나입니다. 합칠 때 가장 최근 승인본을 남깁니다.", twice, "#/teachers"],
    ["여러 방특 시기에 쓰인 과목", "정책 6B: 방특 시기마다 과목 ID를 따로 둬야 합니다.", vacMulti, "#/vacation"],
    ["정규·방특에 함께 쓰인 과목", "정책 6B: 정규와 방특은 이름이 같아도 다른 과목입니다.", mixed, "#/aggregate"],
  ];
}
