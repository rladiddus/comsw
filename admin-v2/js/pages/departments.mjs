import { el, rows, pick, chip, hint, btn, locked, stats, panel, dl, empty, tabBox, listDetail, search, select, editor, headActions, nameOf } from "../ui.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";

// 학과 관리(시안): 학과 정보만. 과목 연결은 과목 관리에서(여기서는 보기만). 고치기는 기존 '학과' 화면.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, cats, links, subjects, teach, instructors, tracks] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "site_categories", "id, is_active"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subjects", "id, name"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "roadmap_tracks", "id, name, department_id"),
  ]);
  const edit = editor("학과 추가·수정 (기존 '학과' 화면)", () => import("../../../admin/js/pages/departments.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("학과 추가", edit.open, true));
  const subjectsOf = (d) => links.filter((l) => l.department_id === d.id).map((l) => nameOf(subjects, l.subject_id));
  const teachersOf = (d) => teach.filter((t) => t.department_id === d.id).map((t) => nameOf(instructors, t.instructor_id));

  const q = search("학과 이름 검색");
  const state = select("상태", [["", "모든 상태"], ["on", "운영 중"], ["off", "숨김"]]);
  container.append(
    stats([
      ["운영 중 학과", `${depts.filter((d) => d.is_active).length}`, `전체 ${depts.length}개`],
      ["사이트 카테고리", `${cats.filter((c) => c.is_active).length}`, "기본 설정의 하단 메뉴 분류"],
      ["소개 미완성", `${depts.filter((d) => !String(d.description || "").trim()).length}`, "소개 글이 비어 있는 학과", depts.some((d) => !String(d.description || "").trim())],
      ["이미지 없음", `${depts.filter((d) => !d.image_url).length}`, "대표 이미지가 없는 학과", depts.some((d) => !d.image_url)],
    ]),
    listDetail({
      cols: ["학과명", "영문명", "연결 과목", "강사", "상태"],
      items: depts,
      cells: (d) => [d.name, d.name_en || "—", `${subjectsOf(d).length}개`, `${teachersOf(d).length}명`, d.is_active ? chip("운영 중", "good") : chip("숨김")],
      filters: [q, state],
      match: (d) => d.name.includes(q.value.trim()) && (!state.value || (state.value === "on") === Boolean(d.is_active)),
      detail: (d) => panel(d.name, tabBox(["기본 정보", "연결 정보", "수정 이력"], (i) => i === 0 ? [
        dl([["학과명", d.name], ["영문명", d.name_en], ["상태", d.is_active ? "운영 중" : "숨김"], ["소개", d.description]]),
        ...(d.image_url ? [el("img", { className: "v2-thumb wide", src: driveThumbnail(d.image_url) || d.image_url, alt: "" })] : []),
        el("div", { className: "v2-actions v2-end" }, [btn("수정", edit.open, true)]),
      ] : i === 1 ? [
        el("h4", { textContent: `연결 과목 ${subjectsOf(d).length}개` }), el("p", { textContent: subjectsOf(d).join(", ") || "없음" }),
        el("h4", { textContent: `강사 ${teachersOf(d).length}명` }), el("p", { textContent: teachersOf(d).join(", ") || "없음" }),
        el("h4", { textContent: "로드맵" }), el("p", { textContent: tracks.filter((t) => t.department_id === d.id).map((t) => t.name).join(", ") || "없음" }),
        hint("학과에서 과목을 직접 넣거나 빼지 않습니다. 학과-과목 연결은 과목 관리에서 합니다."),
        btn("이 학과의 과목 보기", () => { location.hash = `#/subjects/${d.id}`; }),
      ] : [empty("수정 이력은 아직 기록하지 않습니다(DB 추가가 필요합니다).")]), "학과 정보 · 선택한 학과"),
    }),
    edit.node,
  );
}
