import { el, rows, pick, chip, btn, panel, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects } from "../v3.mjs";

// 학과 관리(V3 시안): 학과 카드 + '과목 순서 보기'. 추가·수정은 기존 '학과' 화면.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, curricula, idepts] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, subject_id, vacation"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
  ]);
  const edit = editor("학과 추가·수정 (기존 '학과' 화면)", () => import("../../../admin/js/pages/departments.mjs"), ctx);
  headActions(ctx, btn("학과 추가", edit.open, true));
  const data = { subjects, links, curricula, idepts };
  container.append(
    el("div", { className: "v3-cards" }, depts.map((d) => panel(d.name, [
      el("p", { className: "muted", textContent: `정규 ${deptSubjects(d.id, "regular", data).length}개 · 방특 ${deptSubjects(d.id, "vacation", data).length}개` }),
      el("div", { className: "v2-row v2-gap" }, [d.is_active ? chip("운영 중", "good") : chip("숨김"), chip("독립 순서", "vacation")]),
      el("div", { className: "v2-actions", style: "margin-top:12px" }, [btn("과목 순서 보기", () => { state.dept = d.id; location.hash = "#/order"; }), btn("수정", edit.open)]),
    ], d.name_en || ""))),
    edit.node,
  );
}
