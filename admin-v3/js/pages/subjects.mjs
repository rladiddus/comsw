import { el, rows, pick, chip, hint, btn, locked, stats, panel, dl, listDetail, search, select, editor, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";
import { typeChip, shortId } from "../v3.mjs";

// 과목 관리(V3 시안 '과목 카탈로그'): 같은 이름이라도 정규/방특·학과가 다르면 다른 과목 ID(정책 6B·7B).
// 지금 DB는 과목 이름이 겹칠 수 없고(이름 유일) 한 과목을 여러 학과가 같이 쓴다 → 그런 과목에 '분리 필요'를 표시한다.
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [subjects, depts, links, weeks, curricula, prep] = await Promise.all([
    rows(supabase, "subjects", (q) => q.order("sort_order", { nullsFirst: false })),
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subject_weeks", "subject_id"),
    pick(supabase, "instructor_curricula", "subject_id, instructor_id, status"),
    pick(supabase, "course_prep_items", "subject_id"),
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

  const q = search("과목 검색");
  const typePick = select("유형", [["", "정규·방특 전체"], ["regular", "정규"], ["vacation", "방특"]]);
  const deptPick = select("학과", [["", "모든 학과"], ...depts.map((d) => [d.id, d.name])]);
  container.append(
    el("div", { className: "v3-callout" }, [el("b", { textContent: "같은 이름 허용  " }),
      document.createTextNode("포토샵 [정규] ≠ 포토샵 [방특] ≠ 다른 학과의 포토샵. 단계·이미지·재료·강사 제출본을 과목 ID로 나눕니다.")]),
    stats([
      ["정규 과목", `${items.filter((i) => !i.s.is_vacation).length}`, "학과 정규 과정"],
      ["방특 과목", `${items.filter((i) => i.s.is_vacation).length}`, "방학 특강 전용"],
      ["학과별 분리 필요", `${items.filter((i) => i.deptIds.length > 1).length}`, "여러 학과가 같이 쓰는 과목(정책 7B)", items.some((i) => i.deptIds.length > 1)],
      ["학과 미연결", `${items.filter((i) => !i.deptIds.length && !i.s.is_vacation).length}`, "어느 학과에도 없는 정규 과목"],
    ]),
    listDetail({
      cols: ["과목명 / ID", "유형", "학과", "단계", "상태"],
      items,
      cells: (it) => [el("div", {}, [el("b", { textContent: it.s.name }), el("small", { className: "muted v3-block", textContent: shortId(it.s.id) })]), typeChip(it.s),
        it.deptIds.map((id) => nameOf(depts, id)).join(", ") || "—", `${count(weeks, it.s.id)}단계`,
        it.deptIds.length > 1 ? chip("학과별 분리 필요", "red") : chip(it.deptIds.length || it.s.is_vacation ? "정상" : "학과 미연결", it.deptIds.length || it.s.is_vacation ? "good" : "warn")],
      filters: [q, typePick, deptPick],
      match: (it) => it.s.name.toLowerCase().includes(q.value.trim().toLowerCase()) && (!typePick.value || (typePick.value === "vacation") === Boolean(it.s.is_vacation))
        && (!deptPick.value || it.deptIds.includes(deptPick.value)),
      detail: (it) => panel(it.s.name, [
        dl([["고유 ID", it.s.id], ["유형", it.s.is_vacation ? "방특" : "정규"], ["기간", it.s.duration], ["학과", it.deptIds.map((id) => nameOf(depts, id)).join(", ")]]),
        el("div", { className: "v3-impact" }, [el("div", { textContent: `단계 ${count(weeks, it.s.id)} · 강사 제출 ${count(curricula, it.s.id)} · 준비물 ${count(prep, it.s.id)}` }),
          el("small", { className: "muted", textContent: "모두 이 과목 ID에 붙어 있습니다." })]),
        ...(it.deptIds.length > 1 ? [hint(`이 과목은 ${it.deptIds.length}개 학과가 같이 씁니다. V3에서는 학과마다 다른 과목 ID로 나눕니다(나누는 작업은 이관 단계에서 관리자 확인 후).`, "warn")] : []),
        el("div", { className: "v2-actions v2-end" }, [locked("방특으로 복제", "새 과목 ID 만들기는 DB 변경(이름 유일 제약 해제) 후 가능합니다"), btn("수정", edit.open, true)]),
      ], "과목 상세", [typeChip(it.s)]),
    }),
    edit.node,
  );
}
