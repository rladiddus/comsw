import { el, rows, pick, chip, hint, btn, locked, panel, empty, editor, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects, contextBar, typeChip, isEmployed } from "../v3.mjs";

// 과목 통합 커리큘럼(V3 시안 '학과 통합 커리큘럼', 정책 3·4·5·7): 과목 하나를 모든 학과가 같이 쓴다(2026-10-29 결정).
// 출처 = 이 과목의 재직 강사 승인본 전부(어느 학과 묶음으로 냈든). 통합 문구(subjects.dept_curriculum)도 과목에 하나, 모든 학과에 같이 나온다.
// 통합본 버전·출처 기록·자동 재생성은 DB 추가가 필요하다.
// AI로 만들기·고치기는 기존 '학과 커리큘럼' 화면에서.
export function sources(approved, sets, mode, subjectId) {
  return approved.filter((c) => c.subject_id === subjectId && Boolean(sets.find((s) => s.id === c.set_id)?.is_vacation) === (mode === "vacation"));
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, approved, idepts, sets, instructors, weeks] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, dept_curriculum"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, step_label, written, sort_order, vacation, updated_at", (q) => q.eq("status", "approved")),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subject_weeks", "subject_id, week_label, summary, sort_order"),
  ]);
  const edit = editor("과목 통합 커리큘럼 만들기·고치기 (기존 '학과 커리큘럼' 화면, AI 포함)", () => import("../../../admin/js/pages/department-curriculum.mjs"), ctx);
  headActions(ctx, locked("통합본 다시 만들기", "승인본 모음으로 다시 만드는 작업 대기열은 DB·서버 추가가 필요합니다. 지금은 아래 기존 화면의 AI를 씁니다"), btn("고치기", edit.open, true));
  const data = { subjects, links, curricula: approved, idepts };
  let subjectId = location.hash.split("/")[2] ?? "";
  const body = el("div");

  function draw() {
    const list = deptSubjects(state.dept, state.mode, data);
    if (!list.some((s) => s.id === subjectId)) subjectId = list[0]?.id ?? "";
    const subject = subjects.find((s) => s.id === subjectId);
    const src = sources(approved, sets, state.mode, subjectId);
    const teachers = [...new Set(src.map((c) => c.instructor_id))];
    const active = teachers.filter(isEmployed);
    const stale = active.length !== teachers.length;
    const steps = [...new Set(src.filter((c) => isEmployed(c.instructor_id)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => c.step_label))];
    const sharedDepts = links.filter((l) => l.subject_id === subjectId).length;
    body.replaceChildren(el("div", { className: "v2-grid3" }, [
      panel("과목", list.length ? [el("div", { className: "v2-boxlist" }, list.map((s, i) => Object.assign(el("div", { className: `v2-listitem${s.id === subjectId ? " active" : ""}` }, [
        el("b", { textContent: `${i + 1}. ${s.name}` }), el("small", { textContent: `승인 강사 ${new Set(sources(approved, sets, state.mode, s.id).map((c) => c.instructor_id)).size}명` }),
      ]), { onclick: () => { subjectId = s.id; draw(); } })))] : [empty("이 학과·유형에 과목이 없습니다.")], "학과별 과목 순서대로"),
      panel(`과목 통합본 · ${subject?.name ?? ""}`, subject ? [
        el("div", { className: "v2-row v2-gap" }, [chip(!active.length ? "출처 없음 · 검토 필요" : stale ? "다시 만들기 필요" : "출처 확인", !active.length ? "red" : stale ? "warn" : "good"), typeChip(subject)]),
        el("p", { className: "v2-label", textContent: "지금 사이트에 나오는 과목 통합 커리큘럼 문구" }),
        el("textarea", { className: "v2-textarea", value: subject.dept_curriculum || "", readOnly: true }),
        ...(sharedDepts > 1 ? [hint(`이 과목을 쓰는 ${sharedDepts}개 학과(${links.filter((l) => l.subject_id === subjectId).map((l) => nameOf(depts, l.department_id)).join(", ")})에 같은 문구가 나옵니다. 고치면 모두 같이 바뀝니다.`)] : []),
        el("p", { className: "v2-label", textContent: `통합할 단계 (재직 강사 승인본 ${active.length}명)` }),
        ...(steps.length ? steps.map((label) => {
          const by = src.filter((c) => c.step_label === label && isEmployed(c.instructor_id));
          return el("div", { className: "v2-mini-card" }, [el("b", { textContent: label }),
            el("div", { className: "v2-row v2-gap" }, by.map((c) => chip(`${nameOf(instructors, c.instructor_id)} 출처`, "vacation")))]);
        }) : [empty("통합할 승인본이 없습니다. 빈 문구를 자동으로 공개하지 않습니다.")]),
        el("div", { className: "v2-actions v2-end" }, [locked("확정", "통합본 버전·확정 기록은 DB 추가가 필요합니다"), btn("로드맵 보기", () => { location.hash = "#/roadmap"; })]),
      ] : [empty("과목을 고르세요.")]),
      panel("기여 강사와 출처", [
        el("small", { className: "muted", textContent: "기준: 과목 + 재직 + 승인된 최신본(어느 학과 묶음으로 냈든)" }),
        ...(teachers.length ? teachers.map((id) => el("div", { className: "v2-mini-card v2-row" }, [
          el("div", {}, [el("b", { textContent: nameOf(instructors, id) }), el("small", { textContent: `승인 ${src.filter((c) => c.instructor_id === id).length}단계` })]),
          isEmployed(id) ? chip("통합 포함", "good") : chip("통합 제외(퇴사)", "red"),
        ])) : [empty("승인한 강사가 없습니다.")]),
        el("p", { className: "v2-label", textContent: "과목 공통 단계(기존 과목 통합 커리큘럼 단계)" }),
        el("small", { className: "muted", textContent: weeks.filter((w) => w.subject_id === subjectId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((w) => w.week_label).join(" · ") || "없음" }),
      ]),
    ]));
  }
  container.append(contextBar(depts, draw), body, edit.node);
  draw();
}
