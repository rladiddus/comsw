// 준비물: 기준 과목(끝 숫자 뺀 이름) 단위. '캐드' 준비물 = 캐드1·캐드2 모두에 적용(2026-11-19 사용자 결정).
// 강사 준비물(원문)은 그대로 두고 [강사 준비물 가져오기]로 모아 학과장이 정리 → 떠 있는 창 [임시 저장] / [사이트 적용](준비물만 공개).
// 학과·과목 화면의 '공통 준비물 정리'도 여기로 온다(같은 원본 course_prep_items).
import * as data from "../data.mjs";
import { h, head, box, fill, empty, note, publishBanner, table, pill, modal, filterBar, hasText, tabs } from "../ui.mjs";
import { baseName } from "../rules.mjs";
import { track, unsaved, untrack } from "../changes.mjs";

const CATS = [["textbook", "교재"], ["supply", "준비물"], ["ai", "AI 도구"]];
let pick = null;
let view = "public"; // 공개 / 비공개 탭(2026-11-26)
const CAT_LABEL = Object.fromEntries(CATS);
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
  // 가격·구독 비용(extra)과 교재 이미지(image_url)도 함께 다룬다(2026-11-26, 예전에는 저장할 때 지워짐)
  const published = items.filter((i) => ids.has(i.subject_id)).map(({ category, content, link_url, image_url, extra, department_id }) => ({ category, content: content ?? "", link_url: link_url ?? "", image_url: image_url ?? "", extra: extra ?? "", department_id: department_id ?? null }))
    .filter((i) => !seen.has(key(i)) && seen.add(key(i)));
  let list = JSON.parse(JSON.stringify(published));
  const listEl = h("div");
  const drawList = () => listEl.replaceChildren(list.length ? h("div", { class: "tablewrap" }, h("table", {},
    h("thead", {}, h("tr", {}, ["분류", "내용", "링크", "가격·구독 비용", "이미지(교재)", "학과", ""].map((t) => h("th", {}, t)))),
    h("tbody", {}, list.map((it, n) => h("tr", {},
      h("td", {}, h("select", { "aria-label": "분류", onchange: (e) => { it.category = e.target.value; drawList(); } },
        CATS.map(([v, l]) => h("option", { value: v, selected: v === it.category }, l)))),
      h("td", {}, h("input", { value: it.content, "aria-label": "내용", style: "width:100%", oninput: (e) => { it.content = e.target.value; } })),
      h("td", {}, h("input", { value: it.link_url ?? "", "aria-label": "링크", placeholder: "https://", style: "width:100%", oninput: (e) => { it.link_url = e.target.value; } })),
      h("td", {}, h("input", { value: it.extra ?? "", "aria-label": "가격·구독 비용", maxLength: 200, style: "width:100%",
        placeholder: it.category === "textbook" ? "예: 28,000원" : it.category === "ai" ? "예: 무료 / 월 $20(Pro)" : "비고(선택)", oninput: (e) => { it.extra = e.target.value; } })),
      h("td", {}, it.category === "textbook"
        ? h("input", { value: it.image_url ?? "", "aria-label": "교재 이미지 주소", placeholder: "https://", style: "width:100%", oninput: (e) => { it.image_url = e.target.value; } })
        : h("span", { class: "muted" }, "—")),
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
  const addRow = h("button", { type: "button", class: "btn", onclick: () => { list.push({ category: "supply", content: "", link_url: "", image_url: "", extra: "" }); drawList(); } }, "+ 항목");
  const t = track({
    id: `prep:${base}`, slot: "prep", title: `${base} 공통 준비물`, baseline: published,
    read: () => list, write: (x) => { list = JSON.parse(JSON.stringify(x)); drawList(); },
    apply: async (x) => {
      const clean = x.map((i) => ({ ...i, content: i.content.trim(), link_url: (i.link_url ?? "").trim(), extra: (i.extra ?? "").trim(),
        image_url: i.category === "textbook" ? (i.image_url ?? "").trim() : "" })).filter((i) => i.content);
      const bad = clean.find((i) => i.link_url && !/^https?:\/\//i.test(i.link_url));
      if (bad) throw new Error(`'${bad.content}' 링크는 http:// 또는 https://로 시작해야 합니다`);
      const badImg = clean.find((i) => i.image_url && !/^https?:\/\//i.test(i.image_url));
      if (badImg) throw new Error(`'${badImg.content}' 이미지 주소는 http:// 또는 https://로 시작해야 합니다`);
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
  main.replaceChildren(head("준비물", "기준 과목마다 공통 준비물을 정리합니다. 캐드에 적은 준비물은 캐드1·캐드2에도 적용됩니다. 과목을 누르면 팝업으로 고칩니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, items, mats] = await Promise.all([data.catalog(), data.prepItems(), data.materials()]);
    const subjects = data.general(cat); // 공통 준비물은 일반 과목끼리(방학 특강 과목 제외)
    const bases = [...new Set(subjects.map((s) => baseName(s.name)))].sort((a, b) => a.localeCompare(b, "ko"));
    const deptName = new Map(cat.departments.map((d) => [d.id, d.name]));
    const activeDept = new Set(cat.departments.filter((d) => d.is_active !== false).map((d) => d.id));
    // 표(강사 페이지처럼): 기준 과목 · 적용 과목 · 학과 · 공통 준비물(분류별 개수) · 강사 준비물
    const rows = bases.map((b) => {
      const members = subjects.filter((s) => baseName(s.name) === b);
      const ids = new Set(members.map((s) => s.id));
      const seen = new Set();
      const own = items.filter((i) => ids.has(i.subject_id)).filter((i) => !seen.has(key(i)) && seen.add(key(i)));
      const n = (c) => own.filter((i) => i.category === c).length;
      return {
        base: b, members,
        depts: [...new Set(cat.links.filter((l) => ids.has(l.subject_id)).map((l) => deptName.get(l.department_id)).filter(Boolean))],
        count: own.length, cats: [...new Set(own.map((i) => i.category))], summary: CATS.map(([c, l]) => (n(c) ? `${l} ${n(c)}` : "")).filter(Boolean).join(" · "),
        teachers: new Set(mats.filter((m) => ids.has(m.subject_id) && itemsFromMaterials(m).length).map((m) => m.instructor_id)).size,
        // 홈페이지 수업별 준비물에 나오나: 이 기준 과목의 과목 하나라도 공개 학과의 학과 구성에 있으면 공개
        isPublic: cat.links.some((l) => ids.has(l.subject_id) && activeDept.has(l.department_id)),
        own,
      };
    });
    const msg = h("div");
    const banner = await publishBanner(data.unpublished);
    // 거르기: 기준 과목(검색), 적용 과목(검색), 학과(드롭다운), 공통 준비물(드롭다운)
    const deptOpts = [...new Set(rows.flatMap((r) => r.depts))].sort((a, b) => a.localeCompare(b, "ko"));
    const filter = filterBar([
      { key: "base", label: "기준 과목" },
      { key: "member", label: "적용 과목" },
      { key: "dept", label: "학과", options: [["", "전체 학과"], ["-", "학과 없음"], ...deptOpts.map((d) => [d, d])] },
      { key: "prep", label: "공통 준비물", options: [["", "전체"], ["yes", "있음"], ["no", "없음"], ...CATS.map(([c, l]) => [c, `${l} 있음`])] },
    ], () => drawList());
    const listBox = h("section", { class: "box" });
    const tabBar = h("div");
    const drawList = () => {
      const f = filter.values;
      const hiddenRows = rows.filter((r) => !r.isPublic); // 홈페이지에 안 나오는 과목은 준비물이 없어도 비공개(2026-11-26 사용자 요청)
      tabBar.replaceChildren(tabs([["public", "공개"], ["hidden", `비공개(${hiddenRows.length})`]], view, (v) => { view = v; drawList(); }, "chips"));
      const pool = view === "hidden" ? hiddenRows : rows.filter((r) => r.isPublic);
      const now = pool.filter((r) => hasText(r.base, f.base) && (!f.member || r.members.some((s) => hasText(s.name, f.member)))
        && (!f.dept || (f.dept === "-" ? !r.depts.length : r.depts.includes(f.dept)))
        && (!f.prep || (f.prep === "yes" ? r.count > 0 : f.prep === "no" ? r.count === 0 : r.cats.includes(f.prep))));
      listBox.replaceChildren(...[h("h3", {}, now.length === pool.length ? `기준 과목 ${pool.length}개` : `기준 과목 ${now.length}개 (전체 ${pool.length}개)`),
        view === "hidden" ? note("공개 학과의 학과 구성에 없는 과목이라 홈페이지 수업별 준비물에 나오지 않는 준비물입니다. 과목을 누르면 내용·링크·이미지·가격을 볼 수 있습니다. 다시 보이게 하려면 학과·과목 › 학과 구성에서 그 과목을 학과에 넣거나, 맞는 과목의 준비물로 옮겨 적어주세요.") : null,
        now.length ? (view === "hidden" ? hiddenTable(now) : listTable(now)) : empty(view === "hidden" ? "비공개 준비물이 없습니다" : "조건에 맞는 과목이 없습니다")].filter(Boolean)); // null은 글자로 들어가므로 뺀다
    };
    const listTable = (list) => table([
      ["기준 과목", (r) => h("span", { class: "subject-chip" }, r.base)],
      ["적용 과목", (r) => (r.members.length > 1 || r.members[0]?.name !== r.base ? r.members.map((s) => s.name).join(", ") : "—")],
      ["학과", (r) => r.depts.join(", ") || pill("학과 없음", "neutral")],
      ["공통 준비물", (r) => (r.count ? r.summary : pill("없음", "neutral"))],
      ["강사 준비물", (r) => (r.teachers ? `${r.teachers}명 작성` : "—")],
    ], list, { onPick: (r) => openPop(r.base) });
    const hiddenTable = (list) => table([
      ["기준 과목", (r) => h("span", { class: "subject-chip" }, r.base)],
      ["적용 과목", (r) => (r.members.length > 1 || r.members[0]?.name !== r.base ? r.members.map((s) => s.name).join(", ") : "—")],
      ["안 보이는 이유", (r) => pill(r.depts.length ? "비공개 학과에만 있음" : "학과에 없음", "neutral")],
      ["준비물", (r) => (r.count ? r.summary : pill("없음", "neutral"))],
    ], list, { onPick: (r) => detailPop(r) });
    // 비공개 준비물 보기(보기만, 고치려면 과목을 학과에 넣은 뒤 공개 탭에서)
    const detailPop = (r) => {
      const subjectName = new Map(r.members.map((s) => [s.id, s.name]));
      const all = items.filter((i) => r.members.some((s) => s.id === i.subject_id));
      const link = (u) => (u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer", style: "word-break:break-all" }, u) : "—");
      const pop = modal(`${r.base} · 비공개 준비물`, h("div", { class: "modal-body" }, h("div", { class: "modal-main" }, h("section", { class: "box", style: "margin:0" },
        note(`홈페이지에 나오지 않는 준비물입니다(${r.depts.length ? `비공개 학과에만 있음: ${r.depts.join(", ")}` : "어느 학과에도 없음"}). 보기만 할 수 있습니다.`),
        table([
          ["분류", (i) => CAT_LABEL[i.category] ?? i.category],
          ["내용", (i) => i.content || "—"],
          ["링크", (i) => link(i.link_url)],
          ["이미지", (i) => link(i.image_url)],
          ["가격·비고", (i) => i.extra || "—"],
          ["과목", (i) => subjectName.get(i.subject_id) ?? "—"],
        ], all.length ? all : [{ category: "", content: "준비물이 없습니다" }])))));
      pop.dlg.classList.add("modal-talk");
    };
    drawList();
    // 과목을 누르면 팝업(학과·과목의 준비물 팝업과 같은 편집기). 반영은 오른쪽 아래 창.
    const openPop = (base) => {
      pick = base;
      const popMsg = h("div");
      let pop = null;
      const ed = prepEditor(base, { subjects, items, mats, departments: cat.departments, msg: popMsg, onApplied: () => { pop?.close(); render({ main }); } });
      pop = modal(`${base} · 공통 준비물`, h("div", { class: "modal-body" }, popMsg, h("div", { class: "modal-main" }, ed.el)), {
        beforeClose: () => !unsaved(ed.trackId) || confirm("임시 저장하지 않은 준비물 변경이 있습니다. 닫으면 사라집니다. 닫을까요?"),
        onClose: () => { untrack(ed.trackId); pick = null; },
      });
      pop.dlg.classList.add("modal-fit", "modal-mid");
    };
    if (pick && bases.includes(pick)) setTimeout(() => openPop(pick)); // #/prep/기준과목 으로 오면 그 팝업을 연다
    return [banner, msg, tabBar, h("div", { style: "height:10px" }), filter.el, listBox];
  });
}
