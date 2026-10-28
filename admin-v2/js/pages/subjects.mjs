import { el, rows, pick, chip, hint, btn, locked, stats, panel, dl, check, tabBox, listDetail, search, select, editor, headActions, nameOf } from "../ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";

// 과목 관리(시안 '과목 카탈로그'): 학과 과목·신규·기타·방특을 한 목록에서 찾고 상세를 본다.
// 고치기는 아래 '과목 편집'(기존 과목 정보·학과별 과목·신규 과목·기타 과목 화면)에서.
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);

export function subjectState(s, deptIds, weekCount) {
  if (s.is_vacation && !deptIds.length) return ["방학 특강", "vacation"];
  if (!deptIds.length) return ["학과 미연결", "red"];
  if (!weekCount) return ["단계 없음", "warn"];
  return ["운영 중", "good"];
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [subjects, depts, links, weeks, curricula, steps, prep] = await Promise.all([
    rows(supabase, "subjects", (q) => q.order("sort_order", { nullsFirst: false })),
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subject_weeks", "subject_id"),
    pick(supabase, "instructor_curricula", "subject_id, instructor_id, status"),
    pick(supabase, "roadmap_step_subjects", "subject_id"),
    pick(supabase, "course_prep_items", "subject_id"),
  ]);
  const edit = editor("과목 편집 (기존 과목 정보·학과별 과목·신규 과목·기타 과목 화면)", async () => ({
    render: subpages("과목 편집", [
      ["manage", "과목 정보", old("subject-manage"), { fresh: true }],
      ["by-dept", "학과별 과목", old("department-subjects"), { fresh: true }],
      ["new", "신규 과목", old("new-subjects"), { fresh: true }],
      ["other", "기타 과목", old("other-subjects"), { fresh: true }],
    ]),
  }), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("새 과목 추가", edit.open, true));

  const count = (list, id) => list.filter((x) => x.subject_id === id).length;
  const items = subjects.map((s) => {
    const deptIds = links.filter((l) => l.subject_id === s.id).map((l) => l.department_id);
    const weekCount = count(weeks, s.id);
    const teachers = new Set(curricula.filter((c) => c.subject_id === s.id && c.status === "approved").map((c) => c.instructor_id)).size;
    return { s, deptIds, weekCount, teachers, state: subjectState(s, deptIds, weekCount) };
  });
  const deptNames = (it) => it.deptIds.map((id) => nameOf(depts, id)).join(" / ");

  const q = search("과목 검색");
  const deptPick = select("학과", [["", "모든 학과"], ...depts.map((d) => [d.id, d.name]), ["none", "학과 미연결"]]);
  const statePick = select("상태", [["", "모든 상태"], ["good", "운영 중"], ["warn", "단계 없음"], ["red", "학과 미연결"], ["vacation", "방학 특강"]]);
  deptPick.value = location.hash.split("/")[2] ?? ""; // 학과 관리에서 '이 학과의 과목 보기'로 왔을 때

  container.append(
    stats([
      ["전체 과목", `${items.length}`, "기타·방학 특강 과목 포함"],
      ["운영 과목", `${items.filter((i) => i.state[1] === "good").length}`, "학과에 연결되고 단계가 있는 과목"],
      ["정리 필요", `${items.filter((i) => i.state[1] === "warn").length}`, "학과에 있지만 단계 없음", items.some((i) => i.state[1] === "warn")],
      ["미연결 과목", `${items.filter((i) => i.state[1] === "red").length}`, "어느 학과에도 없음(기타 과목)"],
    ]),
    listDetail({
      cols: ["과목명", "학과", "기간", "단계", "강사", "상태"],
      items,
      cells: (it) => [it.s.name, deptNames(it) || "학과 미연결", it.s.duration || "—", `${it.weekCount}단계`, `${it.teachers}명`, chip(...it.state)],
      filters: [q, deptPick, statePick],
      match: (it) => it.s.name.toLowerCase().includes(q.value.trim().toLowerCase())
        && (!deptPick.value || (deptPick.value === "none" ? !it.deptIds.length : it.deptIds.includes(deptPick.value)))
        && (!statePick.value || it.state[1] === statePick.value),
      detail: (it) => panel(it.s.name, tabBox(["기본 정보", "학과 배치", "사용처"], (i) => [
        ...(i === 0 ? [
          dl([["과목명", it.s.name], ["기간", it.s.duration], ["수준", it.s.level], ["상태", chip(...it.state)]]),
          hint("과목의 단계(학과 커리큘럼)는 커리큘럼 관리에서, 학과 연결은 '학과 배치'에서 확인합니다."),
        ] : i === 1 ? [
          el("p", { className: "v2-label", textContent: "이 과목이 속한 학과" }),
          ...(it.deptIds.length ? it.deptIds.map((id) => el("div", { className: "v2-mini-card v2-row" }, [el("b", { textContent: `☰  ${nameOf(depts, id)}` }), btn("연결 관리", edit.open)]))
            : [el("p", { className: "muted", textContent: "연결된 학과가 없습니다(기타 과목)." })]),
          hint("지금은 모든 학과가 과목 순서 하나를 같이 씁니다. 학과마다 다른 순서는 DB 변경 후 이곳에서 정합니다."),
        ] : [
          check("로드맵 연결", `${count(steps, it.s.id)}개 로드맵 단계에서 씁니다.`),
          check("강사 커리큘럼", `${count(curricula, it.s.id)}단계(승인 대기 포함), 승인된 강사 ${it.teachers}명`),
          check("수업별 준비물", `${count(prep, it.s.id)}개 항목이 연결되어 있습니다.`),
          check("단계(학과 커리큘럼)", `${it.weekCount}단계`, !it.weekCount && it.deptIds.length > 0),
          hint("쓰이는 곳이 있는 과목을 지우면 연결된 자료가 함께 지워집니다. '보관'은 DB 추가 후 엽니다.", "warn"),
        ]),
        el("div", { className: "v2-actions v2-end" }, [locked("보관", "보관은 DB 추가가 필요합니다"), btn("변경 저장", edit.open, true)]),
      ]), "과목 단위 원본 · 선택한 과목", [chip(...it.state)]),
    }),
    edit.node,
  );
}
