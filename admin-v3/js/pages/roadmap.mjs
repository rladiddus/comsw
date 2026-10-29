import { el, rows, pick, chip, hint, btn, locked, panel, empty, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects, contextBar, typeChip } from "../v3.mjs";

// 로드맵(V3 시안 '자동 로드맵'): 순서는 '학과별 과목 순서'를 그대로 따르고(여기서 순서를 바꾸지 않음), 한 단계에 과목을 하나 이상 묶을 수 있다.
// 묶음은 순서에서 이어진 과목끼리만. 처음 묶음은 지금 로드맵(roadmap_step_subjects)에서 같은 단계에 있는 이웃 과목끼리.
// 묶음 바꾸기는 이 화면에서만 시험한다(state.steps, 저장 안 됨).

// list(순서대로 과목) · starts(새 단계를 시작하는 과목 id) → [[과목, …], …]
export function group(list, starts) {
  const out = [];
  list.forEach((s, i) => (i === 0 || starts.has(s.id) ? out.push([s]) : out.at(-1).push(s)));
  return out;
}

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
    const savedStep = (id) => stepSubjects.find((x) => x.subject_id === id && myStepIds.has(x.step_id))?.step_id ?? null;
    const key = `${state.dept}:${state.mode}`;
    if (!state.steps.has(key)) state.steps.set(key, new Set(list.filter((s, i) => i > 0 && (!savedStep(s.id) || savedStep(s.id) !== savedStep(list[i - 1].id))).map((s) => s.id)));
    const starts = state.steps.get(key);
    const groups = group(list, starts);
    const redraw = (fn) => () => { fn(); draw(); };

    body.replaceChildren(groups.length ? el("div", { className: "v3-cards" }, groups.map((g, i) => {
      const ids = new Set(g.map((s) => savedStep(s.id)));
      const saved = ids.size === 1 && !ids.has(null) ? steps.find((st) => st.id === [...ids][0]) : null;
      const same = saved && stepSubjects.filter((x) => x.step_id === saved.id && list.some((s) => s.id === x.subject_id)).length === g.length;
      const next = groups[i + 1]?.[0];
      return panel(`STEP ${i + 1}  ${g.map((s) => s.name).join(" + ")}`, [
        ...g.map((s, j) => el("div", { className: "v2-row v2-gap v3-line" }, [
          el("span", { textContent: s.name }), typeChip(s),
          el("small", { className: "muted", textContent: s.dept_curriculum ? "학과 커리큘럼 문구 있음" : "학과 커리큘럼 문구 없음" }),
          ...(j > 0 ? [btn("여기서 나누기", redraw(() => starts.add(s.id)))] : []),
        ])),
        el("p", { textContent: String(saved?.summary || "").trim() || "로드맵 문구가 없습니다." }),
        el("div", { className: "v2-row v2-gap" }, [
          same ? chip("로드맵 문구 있음", "good") : [...ids].some(Boolean) ? chip("묶음 바뀜 · 다시 요약 필요", "warn") : chip("로드맵에 없음", "warn"),
        ]),
        el("div", { className: "v2-actions" }, [
          ...(next ? [btn(`다음 과목(${next.name})도 이 단계에`, redraw(() => starts.delete(next.id)))] : []),
          btn("학과 커리큘럼 보기", () => { location.hash = `#/aggregate/${g[0].id}`; }),
          locked("다시 요약", "학과 통합본으로 다시 요약하는 작업은 DB·서버 추가가 필요합니다"),
        ]),
      ], "", [chip(`과목 ${g.length}개`, g.length > 1 ? "vacation" : "")]);
    })) : panel("로드맵", [empty("이 학과·유형에 과목이 없습니다.")]));
  }
  container.append(
    contextBar(depts, draw),
    el("div", { className: "v3-callout" }, [document.createTextNode("로드맵에서는 순서를 따로 바꾸지 않습니다. 순서는 "), el("b", { textContent: "학과별 과목 순서" }),
      document.createTextNode(" 한 곳에서만 정합니다. 한 단계에 과목을 하나 이상 묶을 수 있습니다(순서에서 이어진 과목끼리).")]),
    body,
    hint("묶음 바꾸기는 시험 기능입니다. 저장하지 않으며 새로고침하면 지금 로드맵 묶음으로 돌아갑니다. 실제 묶음은 '문구 고치기'(기존 로드맵 화면)에서 바꿉니다."),
    edit.node,
  );
  draw();
}
