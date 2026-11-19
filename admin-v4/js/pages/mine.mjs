// 내 커리큘럼(강사): 내 학과(연결된 것만) → 수업할 과목 → 일반/방학 특강 → 과목마다 4단계.
// 1단계는 실제 자료 읽기만. 작성·저장·제출은 3단계(기존 제출 함수 재사용).
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, media, fill, empty, note } from "../ui.mjs";
import { curriculumUnits, deptOrder, stepState, STEPS } from "../rules.mjs";

let state = { dept: null, scope: "general", subject: null };

export async function render({ main, session }) {
  main.replaceChildren(head("내 커리큘럼", "수업할 과목마다 1~4단계 커리큘럼과 준비물을 작성해 학과장에게 제출합니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const me = await data.myInstructor(session.uid);
    if (!me) return box(null, note("이 계정과 연결된 강사 정보가 없습니다. 학과장에게 계정 연결을 요청해주세요."));
    const [cat, myDepts, mySubjects, rows] = await Promise.all([
      data.catalog(), data.all("instructor_departments", (q) => q.eq("instructor_id", me.id)),
      data.instructorSubjects(me.id), data.curricula((q) => q.eq("instructor_id", me.id).order("sort_order", { nullsFirst: false })),
    ]);
    const depts = cat.departments.filter((d) => myDepts.some((l) => l.department_id === d.id));
    if (!depts.length) return box(null, note("연결된 학과가 없습니다. 학과장에게 소속 학과 연결을 요청해주세요."));
    const units = curriculumUnits(rows);
    const subjects = data.live(cat.subjects);
    const out = h("div");
    const draw = () => {
      state.dept = depts.some((d) => d.id === state.dept) ? state.dept : depts[0].id;
      const scopes = [["general", "일반 수업"], ...cat.vacations.map((v) => [v.id, v.name])];
      if (!scopes.some(([v]) => v === state.scope)) state.scope = "general";
      const inDept = deptOrder(cat.links.filter((l) => l.department_id === state.dept), subjects);
      const pool = state.scope === "general" ? inDept
        : inDept.filter((s) => cat.vacLinks.some((l) => l.set_id === state.scope && l.subject_id === s.id));
      const chosen = new Set(mySubjects.map((x) => x.subject_id));
      const sub = pool.find((s) => s.id === state.subject) ?? pool.find((s) => chosen.has(s.id)) ?? pool[0];
      const isVac = (u) => cat.vacations.some((v) => v.id === u.set_id);
      const unit = sub && units.find((u) => u.subject_id === sub.id && (state.scope === "general" ? !isVac(u) : u.set_id === state.scope));
      const now = unit ? (unit.pending.length ? unit.pending : unit.approved) : [];
      out.replaceChildren(
        box("내 학과", tabs(depts.map((d) => [d.id, d.name]), state.dept, (id) => { state.dept = id; draw(); }, "chips")),
        box("수업 구분", tabs(scopes, state.scope, (v) => { state.scope = v; state.subject = null; draw(); }, "chips")),
        h("div", { class: "two" },
          box("수업할 과목", pool.length ? h("div", { class: "chips" }, pool.map((s) =>
            h("button", { type: "button", "aria-pressed": String(s.id === sub?.id) , onclick: () => { state.subject = s.id; draw(); } },
              s.name, chosen.has(s.id) ? " ✓" : ""))) : empty("이 구분에 과목이 없습니다")),
          sub ? box(`${sub.name} · ${STEPS}단계`,
            h("div", { class: "actions" }, unit?.pending.length ? pill("제출함 · 검수 전") : unit ? pill("검수 완료", "neutral") : pill("아직 작성 전", "neutral"),
              now.length ? pill(stepState(now.length).label, stepState(now.length).kind) : null),
            now.length ? h("div", { class: "steps" }, now.map((r) => h("div", { class: "step" },
              h("b", {}, r.step_label), h("p", {}, r.written || "—"), r.media_url ? media(r.media_url) : null)))
              : empty("작성한 단계가 없습니다")) : h("div")),
      );
    };
    draw();
    return out;
  });
}
