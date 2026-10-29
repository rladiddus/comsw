import { el, rows, pick, chip, hint, btn, panel, empty, table, tabBox, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, CAT, norm, splitItems, deptSubjects, contextBar, typeChip } from "../v3.mjs";

// 수업별 준비물(V3 시안 '준비물·교재·AI 도구', 정책 9D): 과목 ID별 카탈로그, 4분류 탭. 다른 과목과는 합치지 않는다.
// 지금 DB: 교재·준비물·AI 도구 = course_prep_items, 사용 프로그램 = 과목 공통 '프로그램' 칸(subjects.tools). 출처 강사 = 선생님이 적은 칸에 같은 이름이 있는 수.
export function catalog(cat, subjectIds, { prep, subjects, teacherMats, dept }) {
  const out = new Map();
  const add = (subject_id, label, origin, link = "") => {
    const k = `${subject_id}|${norm(label)}`;
    if (!norm(label)) return;
    const row = out.get(k) ?? { subject_id, label: String(label).trim(), origins: new Set(), link };
    row.origins.add(origin);
    out.set(k, row);
  };
  if (cat === "software") subjects.filter((s) => subjectIds.includes(s.id)).forEach((s) => splitItems(s.tools).forEach((t) => add(s.id, t, "과목 공통 칸")));
  else prep.filter((p) => p.category === cat && subjectIds.includes(p.subject_id) && (!p.department_id || p.department_id === dept)).forEach((p) => add(p.subject_id, p.content, "준비물 카드", p.link_url));
  return [...out.values()].map((r) => ({
    ...r,
    teachers: teacherMats.filter((m) => m.subject_id === r.subject_id && [...splitItems(m.tools), ...splitItems(m.supplies)].some((x) => norm(x) === norm(r.label))).length,
  }));
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, curricula, idepts, prep, teacherMats] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, tools"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, subject_id, vacation"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "course_prep_items", "subject_id, category, content, link_url, department_id"),
    pick(supabase, "instructor_subject_materials", "instructor_id, subject_id, tools, supplies"),
  ]);
  const edit = editor("품목 등록·수정 (기존 '수업별 준비물' 화면)", () => import("../../../admin/js/pages/prep.mjs"), ctx);
  headActions(ctx, btn("준비물 검토 화면", () => { location.hash = "#/validation"; }), btn("품목 등록", edit.open, true));
  const body = el("div");

  function draw() {
    const list = deptSubjects(state.dept, state.mode, { subjects, links, curricula, idepts });
    const ids = list.map((s) => s.id);
    const cats = Object.keys(CAT);
    body.replaceChildren(el("section", { className: "v2-panel" }, tabBox(cats.map((c) => CAT[c]), (i) => {
      const items = catalog(cats[i], ids, { prep, subjects, teacherMats, dept: state.dept });
      const name = (id) => list.find((s) => s.id === id);
      return [
        items.length ? table(["항목", "과목(ID별)", "출처", "선생님 제출", "상태"], items, (r) => [
          r.label, el("span", {}, [document.createTextNode(`${name(r.subject_id)?.name ?? ""} `), typeChip(name(r.subject_id))]),
          [...r.origins].join(", "), r.teachers ? `${r.teachers}명` : "—", chip("기존 데이터 · 확정 기록 없음", ""),
        ]).node : empty(`이 학과·유형에 ${CAT[cats[i]]} 항목이 없습니다.`),
        hint(cats[i] === "software" ? "지금 '사용 프로그램'은 과목 공통 칸에 글로 적혀 있습니다. V3에서는 준비물 카드처럼 따로 확정합니다."
          : "같은 과목 안에서만 같은 이름을 하나로 묶었습니다. 다른 학과·정규/방특 과목의 같은 이름은 합치지 않습니다. 확정·병합 기록은 DB 추가 후 남깁니다."),
      ];
    })));
  }
  container.append(
    el("div", { className: "v3-callout" }, [chip("9D", "vacation"), document.createTextNode(" 선생님이 분류를 정하고, 검사는 제안만 기록하며, 학과장이 확정한 것만 과목별 카탈로그에 올라갑니다.")]),
    contextBar(depts, draw), body, edit.node,
  );
  draw();
}
