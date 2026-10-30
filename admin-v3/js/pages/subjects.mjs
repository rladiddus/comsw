import { el, rows, pick, chip, hint, btn, locked, stats, panel, dl, listDetail, search, select, editor, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";
import { typeChip } from "../v3.mjs";

// 과목 관리(V3 시안 '과목 카탈로그'): 정규 과목은 하나를 여러 학과가 같이 쓴다(정책 7, 2026-10-29). 방특은 시기마다 새 과목(6B).
// 과목 아래는 강사별 커리큘럼(포토샵 - A강사, - B강사 …). 고유 ID는 화면에 보이지 않는다.
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [subjects, depts, links, weeks, curricula, prep, instructors] = await Promise.all([
    rows(supabase, "subjects", (q) => q.order("sort_order", { nullsFirst: false })),
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subject_weeks", "subject_id"),
    pick(supabase, "instructor_curricula", "subject_id, instructor_id, status"),
    pick(supabase, "course_prep_items", "subject_id"),
    pick(supabase, "instructors", "id, name"),
  ]);
  const edit = editor("과목 추가·수정 (기존 과목 정보·학과별 과목·신규 과목·기타 과목 화면)", async () => ({
    render: subpages("과목 편집", [
      ["manage", "과목 정보", old("subject-manage"), { fresh: true }],
      ["by-dept", "학과별 과목", old("department-subjects"), { fresh: true }],
      ["new", "신규 과목", old("new-subjects"), { fresh: true }],
    ]),
  }), ctx);
  headActions(ctx, btn("새 과목 등록", edit.open, true));
  const items = subjects.map((s) => ({ s, deptIds: links.filter((l) => l.subject_id === s.id).map((l) => l.department_id) }));
  const count = (list, id) => list.filter((x) => x.subject_id === id).length;
  const teachersOf = (id) => [...new Set(curricula.filter((c) => c.subject_id === id).map((c) => c.instructor_id))];

  const q = search("과목 검색");
  const typePick = select("유형", [["", "정규·방특 전체"], ["regular", "정규"], ["vacation", "방특"]]);
  const deptPick = select("학과", [["", "모든 학과"], ...depts.map((d) => [d.id, d.name])]);
  container.append(
    el("div", { className: "v3-callout" }, [el("b", { textContent: "과목 하나, 모든 학과 공용  " }),
      document.createTextNode("포토샵 하나를 시각편집학과·모션학과가 같이 씁니다. 고치면 모든 학과에 같이 반영됩니다. 강사별 커리큘럼은 과목 아래에 따로 있고, 방특은 시기마다 새 과목입니다.")]),
    stats([
      ["정규 과목", `${items.filter((i) => !i.s.is_vacation).length}`, "학과 정규 과정"],
      ["방특 과목", `${items.filter((i) => i.s.is_vacation).length}`, "방학 특강 전용"],
      ["여러 학과 공용", `${items.filter((i) => i.deptIds.length > 1).length}`, "고치면 쓰는 학과 모두에 반영"],
      ["학과 미연결", `${items.filter((i) => !i.deptIds.length && !i.s.is_vacation).length}`, "어느 학과에도 없는 정규 과목"],
    ]),
    listDetail({
      cols: ["과목명", "유형", "학과", "강사", "상태"],
      items,
      cells: (it) => [el("b", { textContent: it.s.name }), typeChip(it.s),
        it.deptIds.map((id) => nameOf(depts, id)).join(", ") || "—", `${teachersOf(it.s.id).length}명`,
        chip(it.deptIds.length || it.s.is_vacation ? "정상" : "학과 미연결", it.deptIds.length || it.s.is_vacation ? "good" : "warn")],
      filters: [q, typePick, deptPick],
      match: (it) => it.s.name.toLowerCase().includes(q.value.trim().toLowerCase()) && (!typePick.value || (typePick.value === "vacation") === Boolean(it.s.is_vacation))
        && (!deptPick.value || it.deptIds.includes(deptPick.value)),
      detail: (it) => panel(it.s.name, [
        dl([["유형", it.s.is_vacation ? "방특" : "정규"], ["기간", it.s.duration], ["학과", it.deptIds.map((id) => nameOf(depts, id)).join(", ")]]),
        el("div", { className: "v3-impact" }, [el("div", { textContent: `과목 공통 단계 ${count(weeks, it.s.id)} · 준비물 ${count(prep, it.s.id)}` }),
          el("small", { className: "muted", textContent: "강사별 커리큘럼" }),
          ...(teachersOf(it.s.id).length ? teachersOf(it.s.id).map((id) => el("div", { className: "v3-line", textContent: `ㄴ ${it.s.name} - ${nameOf(instructors, id)}` })) : [el("div", { className: "muted", textContent: "아직 없음" })])]),
        ...(it.deptIds.length > 1 ? [hint(`${it.deptIds.length}개 학과가 같이 씁니다. 고치면 모든 학과에 같이 반영됩니다.`)] : []),
        el("div", { className: "v2-actions v2-end" }, [locked("방특으로 복제", "새 과목 ID 만들기는 DB 변경(이름 유일 제약 해제) 후 가능합니다"), btn("수정", edit.open, true)]),
      ], "과목 상세", [typeChip(it.s)]),
    }),
    edit.node,
  );
}
