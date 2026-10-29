import { el, rows, pick, chip, hint, btn, locked, panel, empty, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects, contextBar, typeChip } from "../v3.mjs";

// 로드맵(V3 시안 '자동 로드맵', 정책 8A): 한 단계 = 과목 하나, 순서는 '학과별 과목 순서'를 그대로 따른다(여기서 순서를 바꾸지 않음).
// 문구는 지금 로드맵에 저장된 단계 문구(roadmap_steps.summary)에서 그 과목이 들어 있는 단계를 찾아 보여 준다.
// 과목이 2개 이상 묶인 단계는 V3로 옮길 때 나눠야 하므로 표시한다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, curricula, idepts, tracks, steps, stepSubjects] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, dept_curriculum"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, subject_id, vacation"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "roadmap_tracks", "id, name, department_id"),
    pick(supabase, "roadmap_steps", "id, track_id, position, summary"),
    pick(supabase, "roadmap_step_subjects", "step_id, subject_id"),
  ]);
  const edit = editor("로드맵 문구 고치기 (기존 '로드맵' 화면)", () => import("../../../admin/js/pages/roadmap.mjs"), ctx);
  headActions(ctx, btn("학과별 순서 수정", () => { location.hash = "#/order"; }), btn("문구 고치기", edit.open, true));
  const data = { subjects, links, curricula, idepts };
  const body = el("div");

  function draw() {
    const list = deptSubjects(state.dept, state.mode, data);
    const myTracks = tracks.filter((t) => t.department_id === state.dept).map((t) => t.id);
    const myStepIds = new Set(steps.filter((s) => myTracks.includes(s.track_id)).map((s) => s.id));
    body.replaceChildren(list.length ? el("div", { className: "v3-cards" }, list.map((s, i) => {
      const hit = stepSubjects.filter((x) => x.subject_id === s.id && myStepIds.has(x.step_id)).map((x) => steps.find((st) => st.id === x.step_id));
      const step = hit[0];
      const together = step ? stepSubjects.filter((x) => x.step_id === step.id).length : 0;
      return panel(`STEP ${i + 1}  ${s.name}`, [
        el("p", { className: "muted", textContent: s.dept_curriculum ? "학과 커리큘럼 문구 있음 → 이 문구로 요약" : "학과 커리큘럼 문구 없음" }),
        el("p", { textContent: String(step?.summary || "").trim() || "로드맵 문구가 없습니다." }),
        el("div", { className: "v2-row v2-gap" }, [
          step ? chip("로드맵 문구 있음", "good") : chip("로드맵에 없음", "warn"),
          ...(together > 1 ? [chip(`한 단계에 과목 ${together}개 · 나눠야 함`, "red")] : []),
        ]),
        el("div", { className: "v2-actions" }, [btn("학과 커리큘럼 보기", () => { location.hash = `#/aggregate/${s.id}`; }), locked("다시 요약", "학과 통합본으로 다시 요약하는 작업은 DB·서버 추가가 필요합니다")]),
      ], "", [typeChip(s)]);
    })) : panel("로드맵", [empty("이 학과·유형에 과목이 없습니다.")]));
  }
  container.append(
    contextBar(depts, draw),
    el("div", { className: "v3-callout" }, [document.createTextNode("로드맵에서는 순서를 따로 바꾸지 않습니다. 순서는 "), el("b", { textContent: "학과별 과목 순서" }),
      document.createTextNode(" 한 곳에서만 정합니다. 한 과목 = 한 로드맵 단계(정책 8A).")]),
    body,
    hint("방특은 지금 로드맵이 없습니다. 지금 공개 사이트의 로드맵은 기존 로드맵 단계 순서로 나옵니다(V3 순서로 바꾸려면 공개 사이트 읽기 수정 필요)."),
    edit.node,
  );
  draw();
}
