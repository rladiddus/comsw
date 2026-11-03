import { el, rows, pick, chip, btn, panel, empty, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { state, contextBar, typeChip, isEmployed, splitGrid, deptSubjects } from "../v3.mjs";
import { thumb } from "./aggregate.mjs";

// 강사 커리큘럼(V3 시안): 학과를 고르고 두 탭으로 정규 승인본을 본다(방특은 '방학 특강' 메뉴).
// [강사별 과목 커리큘럼] 왼쪽 강사 → 오른쪽 그 강사의 과목 → 고른 과목의 단계별 커리큘럼
// [과목별 강사 커리큘럼] 왼쪽 과목 → 오른쪽 그 과목의 강사 → 고른 강사의 단계별 커리큘럼
// 과목 순서는 '학과 관리'(학과·시기별 과목 순서)과 같다. 수정 대기 제출이 있으면 함께 표시. 방특은 시기가 여럿이면 시기마다 따로 나온다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, curricula, instructors, subjects, sets, links, idepts] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, step_label, written, media_url, status, vacation, sort_order, updated_at"),
    pick(supabase, "instructors", "id, name, sort_order"),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
  ]);
  state.mode = "regular"; // 정규만
  headActions(ctx);
  const body = el("div");
  const inScope = (setId) => {
    const set = sets.find((s) => s.id === setId);
    return set?.department_id === state.dept && !set?.is_vacation;
  };
  const pending = curricula.filter((c) => c.status === "pending");
  const waiting = (g) => pending.some((p) => p.instructor_id === g.instructor_id && p.subject_id === g.subject_id);
  const byOrder = (list) => (a, b) => (list.find((x) => x.id === a)?.sort_order ?? 1e9) - (list.find((x) => x.id === b)?.sort_order ?? 1e9) || nameOf(list, a).localeCompare(nameOf(list, b));
  // 과목: 이 학과·유형의 과목 순서대로, 순서에 없는 과목은 그 뒤(전체 순서)
  const subjectOrder = () => {
    const data = { subjects, links, curricula: curricula.filter((c) => c.status === "approved"), idepts };
    const ids = deptSubjects(state.dept, state.mode, data).map((s) => s.id);
    const at = (id) => (ids.includes(id) ? ids.indexOf(id) : 1e6);
    return (a, b) => at(a) - at(b) || byOrder(subjects)(a, b);
  };
  let left = "", pickKey = ""; // 왼쪽에서 고른 강사·과목 id, 오른쪽에서 고른 묶음 key

  const tabs = el("div", { className: "v2-tabs v3-teachtabs" }, [["teacher", "강사별 과목 커리큘럼"], ["subject", "과목별 강사 커리큘럼"]].map(([k, t]) =>
    Object.assign(el("button", { type: "button", className: "v2-tab", textContent: t }), { onclick: () => { state.teacherTab = k; left = ""; pickKey = ""; draw(); } })));

  // 고른 강사 × 과목의 단계별 승인본
  function curriculum(g) {
    const subject = subjects.find((s) => s.id === g.subject_id);
    const steps = [...g.rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return [
      el("div", { className: "v2-row v2-gap" }, [typeChip(subject),
        isEmployed(g.instructor_id) ? chip("재직", "good") : chip("퇴사(시험)", "red"),
        ...(waiting(g) ? [chip("수정 대기", "warn"), btn("수정 제출 검토", () => { location.hash = "#/inbox"; }, true)] : [])]),
      ...steps.map((r) => el("div", { className: "v2-mini-card v3-week" }, [thumb(r.media_url, `${r.step_label} 이미지`),
        el("div", { className: "v2-grow" }, [el("b", { textContent: r.step_label }), el("p", { textContent: r.written || "(내용 없음)" })])])),
    ];
  }

  function draw() {
    const teacherTab = state.teacherTab !== "subject";
    [...tabs.children].forEach((b, i) => b.classList.toggle("active", (i === 0) === teacherTab));
    const groups = groupRequests(curricula.filter((c) => c.status === "approved" && inScope(c.set_id)));
    if (!groups.length) return body.replaceChildren(panel("강사 커리큘럼", [empty("이 학과에 승인된 강사 커리큘럼이 없습니다.")]));
    const [mine, other, mineList, otherList] = teacherTab ? ["instructor_id", "subject_id", instructors, subjects] : ["subject_id", "instructor_id", subjects, instructors];
    const sortOf = (list) => (list === subjects ? subjectOrder() : byOrder(list));
    const lefts = [...new Set(groups.map((g) => g[mine]))].sort(sortOf(mineList));
    if (!lefts.includes(left)) left = lefts[0];
    const mineGroups = groups.filter((g) => g[mine] === left).sort((a, b) => sortOf(otherList)(a[other], b[other]));
    const chosen = mineGroups.find((g) => g.key === pickKey) ?? mineGroups[0];
    pickKey = chosen.key;
    const label = (g) => nameOf(otherList, g[other]);

    const leftPanel = panel(teacherTab ? "강사" : "과목", [el("div", { className: "v2-boxlist" }, lefts.map((id) => {
      const mg = groups.filter((g) => g[mine] === id);
      return Object.assign(el("div", { className: `v2-listitem${id === left ? " active" : ""}` }, [
        el("div", { className: "v2-row v2-gap" }, [el("b", { className: "v2-grow", textContent: nameOf(mineList, id) }),
          ...(teacherTab && !isEmployed(id) ? [chip("퇴사", "red")] : []), ...(mg.some(waiting) ? [chip("수정 대기", "warn")] : [])]),
        el("small", { textContent: teacherTab ? `과목 ${mg.length}개` : `강사 ${mg.length}명` }),
      ]), { onclick: () => { left = id; pickKey = ""; draw(); } });
    }))]);

    const right = panel(`${nameOf(mineList, left)} · ${teacherTab ? "과목" : "강사"}`, [
      el("div", { className: "v3-picks" }, mineGroups.map((g) => Object.assign(el("button", { type: "button", className: g.key === pickKey ? "publish-btn" : "ghost-btn", textContent: label(g) }),
        { onclick: () => { pickKey = g.key; draw(); } }))),
      el("p", { className: "v2-label", textContent: `${nameOf(instructors, chosen.instructor_id)} · ${nameOf(subjects, chosen.subject_id)} 커리큘럼` }),
      ...curriculum(chosen),
    ], teacherTab ? "과목을 고르면 그 과목의 커리큘럼이 나옵니다" : "강사를 고르면 그 강사의 커리큘럼이 나옵니다");
    body.replaceChildren(splitGrid(leftPanel, right));
  }
  // 학과·정규/방특 칸과 강사별/과목별 탭은 제목 '강사 커리큘럼' 오른쪽에(머리 자리가 없으면 화면 맨 위).
  const filter = contextBar(depts, draw, [tabs]);
  filter.querySelector(".v3-switch")?.remove(); // 정규·방특 버튼 없음
  if (ctx.headBar) ctx.headBar.replaceChildren(filter); else container.append(filter);
  container.append(body);
  draw();
}
