// 준비물: 기준 과목(끝 숫자 뺀 이름) 단위. '캐드' 준비물 = 캐드1·캐드2 모두에 적용(2026-11-19 사용자 결정).
// 강사 준비물(원문)은 그대로 두고 [강사 준비물 가져오기]로 모아 학과장이 정리 → 떠 있는 창 [임시 저장] / [사이트 적용](준비물만 공개).
// 학과·과목 화면의 '공통 준비물 정리'도 여기로 온다(같은 원본 course_prep_items).
import * as data from "../data.mjs";
import { h, head, box, fill, empty, note, publishBanner } from "../ui.mjs";
import { baseName } from "../rules.mjs";
import { track, canSwitch } from "../changes.mjs";

const CATS = [["textbook", "교재"], ["supply", "준비물"], ["ai", "AI 도구"]];
let pick = null;
const key = (i) => `${i.category}|${String(i.content ?? "").replace(/\s/g, "").toLowerCase()}|${i.department_id ?? ""}`;

// 강사 준비물 칸(교재·물품: 쉼표·줄바꿈, AI: 한 줄에 '이름 | 링크')을 항목으로
export function itemsFromMaterials(m) {
  const split = (t, sep) => String(t ?? "").split(sep).map((x) => x.trim()).filter(Boolean);
  return [
    ...split(m.textbook, /[,\n\r]+/).map((content) => ({ category: "textbook", content })),
    ...split(m.supplies, /[,\n\r]+/).map((content) => ({ category: "supply", content })),
    ...split(m.ai, /[\n\r]+/).map((line) => {
      const [name, ...rest] = line.split("|");
      const link = rest.join("|").trim();
      return { category: "ai", content: name.trim(), link_url: /^https?:\/\//i.test(link) ? link : link ? `https://${link}` : "" };
    }),
  ];
}

// 기준 과목 하나의 공통 준비물 편집(준비물 메뉴와 학과·과목 과목 팝업이 같이 씀). 바꾸면 떠 있는 창으로 저장·적용.
export function prepEditor(base, { subjects, items, mats, departments, msg, onApplied }) {
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const members = subjects.filter((s) => baseName(s.name) === base);
  const ids = new Set(members.map((s) => s.id));
  const seen = new Set();
  const published = items.filter((i) => ids.has(i.subject_id)).map(({ category, content, link_url, department_id }) => ({ category, content: content ?? "", link_url: link_url ?? "", department_id: department_id ?? null }))
    .filter((i) => !seen.has(key(i)) && seen.add(key(i)));
  let list = JSON.parse(JSON.stringify(published));
  const listEl = h("div");
  const drawList = () => listEl.replaceChildren(list.length ? h("div", { class: "tablewrap" }, h("table", {},
    h("thead", {}, h("tr", {}, ["분류", "내용", "링크(AI 도구)", "학과", ""].map((t) => h("th", {}, t)))),
    h("tbody", {}, list.map((it, n) => h("tr", {},
      h("td", {}, h("select", { "aria-label": "분류", onchange: (e) => { it.category = e.target.value; } },
        CATS.map(([v, l]) => h("option", { value: v, selected: v === it.category }, l)))),
      h("td", {}, h("input", { value: it.content, "aria-label": "내용", style: "width:100%", oninput: (e) => { it.content = e.target.value; } })),
      h("td", {}, h("input", { value: it.link_url ?? "", "aria-label": "링크", placeholder: "https://", style: "width:100%", oninput: (e) => { it.link_url = e.target.value; } })),
      h("td", {}, deptName.get(it.department_id) ?? "전체"),
      h("td", {}, h("button", { type: "button", class: "btn danger", onclick: () => { list.splice(n, 1); drawList(); } }, "빼기"))))))) : empty("공통 준비물이 없습니다"));
  drawList();
  const fromTeachers = h("button", { type: "button", class: "btn" }, "강사 준비물 가져오기");
  fromTeachers.onclick = () => {
    const add = mats.filter((m) => ids.has(m.subject_id)).flatMap(itemsFromMaterials).filter((i) => !seen.has(key(i)) && seen.add(key(i)));
    list.push(...add);
    drawList();
    msg.replaceChildren(note(add.length ? `강사 준비물 ${add.length}개를 더했습니다. 정리한 뒤 [사이트 적용] 또는 [임시 저장]을 눌러주세요.` : "더할 강사 준비물이 없습니다(이미 모두 있음)."));
  };
  const addRow = h("button", { type: "button", class: "btn", onclick: () => { list.push({ category: "supply", content: "", link_url: "" }); drawList(); } }, "+ 항목");
  const t = track({
    id: `prep:${base}`, slot: "prep", title: `${base} 공통 준비물`, baseline: published,
    read: () => list, write: (x) => { list = JSON.parse(JSON.stringify(x)); drawList(); },
    apply: async (x) => {
      const clean = x.map((i) => ({ ...i, content: i.content.trim(), link_url: (i.link_url ?? "").trim() })).filter((i) => i.content);
      const bad = clean.find((i) => i.link_url && !/^https?:\/\//i.test(i.link_url));
      if (bad) throw new Error(`'${bad.content}' 링크는 http:// 또는 https://로 시작해야 합니다`);
      await data.call("comsw_v4_confirm_prep", { p_base: base, p_items: clean });
    },
    onApplied,
  });
  const el = box(`${base} 공통 준비물`, note(`적용 과목: ${members.map((s) => s.name).join(", ")}`),
    listEl, h("div", { class: "actions", style: "margin-top:12px" }, addRow, fromTeachers));
  return { el, trackId: t.id };
}

export async function render({ main, params = [] }) {
  if (params[0]) pick = params[0];
  main.replaceChildren(head("준비물", "기준 과목마다 공통 준비물을 정리합니다. 캐드에 적은 준비물은 캐드1·캐드2에도 적용됩니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, items, mats] = await Promise.all([data.catalog(), data.prepItems(), data.materials()]);
    const subjects = data.general(cat); // 공통 준비물은 일반 과목끼리(방학 특강 과목 제외)
    const bases = [...new Set(subjects.map((s) => baseName(s.name)))].sort((a, b) => a.localeCompare(b, "ko"));
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    const draw = () => {
      pick = bases.includes(pick) ? pick : bases[0];
      out.replaceChildren(banner, msg, h("div", { class: "two" },
        box(`기준 과목 ${bases.length}개`, h("div", { class: "chips" }, bases.map((b) =>
          h("button", { type: "button", "aria-pressed": String(b === pick), onclick: () => { if (!canSwitch()) return; pick = b; msg.replaceChildren(); draw(); } }, b)))),
        prepEditor(pick, { subjects, items, mats, departments: cat.departments, msg, onApplied: () => render({ main, params: [pick] }) }).el));
    };
    draw();
    return out;
  });
}
