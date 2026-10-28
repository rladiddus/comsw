import { el, pick, chip, hint, btn, locked, stats, panel, dl, tabBox, listDetail, search, select, editor, headActions, nameOf } from "../ui.mjs";

// 수업별 준비물(시안 '교재·준비물 라이브러리'): 지금 DB는 과목마다 품목을 따로 적는다.
// 이름이 같은 품목을 하나로 묶어 '여러 과목에 쓰임'을 보여 준다(묶기는 화면에서만, DB는 그대로).
const CAT = { textbook: "교재", supply: "준비물", ai: "AI 도구" };
export const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

export function groupItems(items) {
  const map = new Map();
  for (const it of items) {
    const key = `${it.category}|${norm(it.content)}`;
    if (!norm(it.content)) continue;
    const g = map.get(key) ?? { key, name: String(it.content).trim(), category: it.category, rows: [], link: "" };
    g.rows.push(it);
    g.link ||= it.link_url || "";
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name));
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [items, subjects, depts, proposals] = await Promise.all([
    pick(supabase, "course_prep_items", "id, subject_id, category, content, link_url, image_url, department_id"),
    pick(supabase, "subjects", "id, name"),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "instructor_subject_materials", "instructor_id, subject_id, tools, supplies"),
  ]);
  const edit = editor("품목 등록·수정 (기존 '수업별 준비물' 화면)", () => import("../../../admin/js/pages/prep.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("품목 등록", edit.open, true));
  const groups = groupItems(items);
  const dup = groups.filter((g) => g.rows.length > 1);

  const q = search("품목 검색");
  const catPick = select("분류", [["", "전체 분류"], ...Object.entries(CAT)]);
  const usePick = select("쓰임", [["", "전체"], ["many", "여러 과목에 쓰임"], ["one", "한 과목"]]);
  container.append(
    stats([
      ["등록 품목", `${groups.length}`, `과목별로 적힌 줄 ${items.length}개`],
      ["연결된 과목", `${new Set(items.map((i) => i.subject_id)).size}`, "준비물이 하나라도 있는 과목"],
      ["여러 과목에 쓰임", `${dup.length}`, "같은 품목을 과목마다 따로 적은 것", dup.length > 0],
      ["선생님 제안", `${proposals.filter((p) => String(p.tools || "").trim() || String(p.supplies || "").trim()).length}`, "선생님이 적은 프로그램·준비물"],
    ]),
    listDetail({
      cols: ["품목명", "분류", "연결 과목", "링크", "상태"],
      items: groups,
      cells: (g) => [g.name, CAT[g.category] ?? g.category, `${g.rows.length}개 과목`, g.link ? "있음" : "—", chip(g.rows.length > 1 ? "여러 과목" : "사용 중", g.rows.length > 1 ? "vacation" : "good")],
      filters: [q, catPick, usePick],
      match: (g) => norm(g.name).includes(norm(q.value)) && (!catPick.value || g.category === catPick.value)
        && (!usePick.value || (usePick.value === "many") === (g.rows.length > 1)),
      detail: (g) => panel(g.name, tabBox(["기본 정보", "연결 과목"], (i) => i === 0 ? [
        dl([["품목명", g.name], ["분류", CAT[g.category]], ["링크", g.link]]),
        hint("지금은 과목마다 따로 적습니다. 같은 품목을 한 번 만들어 여러 과목에 연결하는 방식은 DB 변경이 필요합니다."),
        el("div", { className: "v2-actions v2-end" }, [btn("수정 저장", edit.open, true)]),
      ] : g.rows.map((r) => el("div", { className: "v2-mini-card v2-row" }, [
        el("b", { textContent: nameOf(subjects, r.subject_id) }),
        el("small", { textContent: r.department_id ? `${nameOf(depts, r.department_id)}만` : "모든 학과" }),
      ]))), "품목 · 선택한 항목"),
    }),
    edit.node,
  );
}
