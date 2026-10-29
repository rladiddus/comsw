import { el, rows, pick, chip, btn, panel, empty, editor, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { state, contextBar, typeChip, isEmployed } from "../v3.mjs";

// 강사 커리큘럼(V3 시안): 학과·정규/방특을 고르면 강사 × 과목 승인본 카드. 수정 대기 제출이 있으면 함께 표시.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, curricula, instructors, subjects, sets] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, step_label, written, media_url, status, vacation, sort_order, updated_at"),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, is_vacation"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
  ]);
  const edit = editor("강사 커리큘럼 고치기 (기존 '강사 커리큘럼' 화면)", () => import("../../../admin/js/pages/curricula.mjs"), ctx);
  headActions(ctx, btn("승인 대기 보기", () => { location.hash = "#/inbox"; }, true));
  const body = el("div");
  const inScope = (setId) => {
    const set = sets.find((s) => s.id === setId);
    return state.mode === "vacation" ? Boolean(set?.is_vacation) : set?.department_id === state.dept && !set?.is_vacation;
  };

  function draw() {
    const approved = groupRequests(curricula.filter((c) => c.status === "approved" && inScope(c.set_id)));
    const pending = curricula.filter((c) => c.status === "pending");
    body.replaceChildren(approved.length ? el("div", { className: "v3-cards" }, approved.map((g) => {
      const subject = subjects.find((s) => s.id === g.subject_id);
      const steps = [...g.rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const img = steps.find((r) => r.media_url)?.media_url;
      const waiting = pending.some((p) => p.instructor_id === g.instructor_id && p.subject_id === g.subject_id);
      const more = el("div", { hidden: true }, steps.map((r) => el("div", { className: "v2-mini-card" }, [el("b", { textContent: r.step_label }), el("small", { textContent: String(r.written || "").slice(0, 200) })])));
      return panel(`${nameOf(instructors, g.instructor_id)}`, [
        el("div", { className: "v2-row" }, [el("b", { textContent: subject?.name ?? "" }), typeChip(subject)]),
        img ? el("img", { className: "v2-thumb wide", src: driveThumbnail(img) || img, alt: "" }) : el("div", { className: "v2-preview-hero", textContent: "이미지 없음" }),
        el("p", { className: "muted", textContent: `${state.mode === "vacation" ? nameOf(sets, g.set_id) : ""} 승인본 ${steps.length}단계` }),
        more,
        el("div", { className: "v2-actions" }, [btn("승인본 보기", () => { more.hidden = !more.hidden; }), ...(waiting ? [btn("수정 제출 검토", () => { location.hash = "#/inbox"; }, true)] : [])]),
      ], "", [isEmployed(g.instructor_id) ? chip("재직", "good") : chip("퇴사(시험)", "red"), ...(waiting ? [chip("수정 대기", "warn")] : [])]);
    })) : panel("강사 커리큘럼", [empty("이 학과·유형에 승인된 강사 커리큘럼이 없습니다.")]));
  }
  container.append(contextBar(depts, draw), body, edit.node);
  draw();
}
