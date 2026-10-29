import { el, pick, chip, hint, btn, stats, panel, table, editor, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";
import { state, isEmployed, modal } from "../v3.mjs";

// 강사 관리(V3 시안 '강사·재직 관리', 정책 5): 재직 상태는 사이트 공개(is_listed)와 다르다.
// 지금 DB에 재직 칸이 없어 처음엔 '재직(확인 전)'으로 보고, 퇴사 처리는 이 화면에서만 시험한다(학과 커리큘럼 출처에서 빠지는 것까지).
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);

// 퇴사하면 다시 만들어야 하는 곳: 이 강사의 승인 커리큘럼이 있는 (학과 · 과목)
export function affected(instructorId, approved, sets) {
  const out = new Map();
  for (const c of approved.filter((x) => x.instructor_id === instructorId)) {
    const set = sets.find((s) => s.id === c.set_id);
    const k = `${set?.department_id ?? set?.id}|${c.subject_id}`;
    out.set(k, { dept: set?.department_id, setName: set?.name, subject_id: c.subject_id, vacation: Boolean(set?.is_vacation) });
  }
  return [...out.values()];
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [instructors, depts, subjects, idepts, isubjects, approved, sets] = await Promise.all([
    pick(supabase, "instructors", "id, name, is_listed, account_uid, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "subjects", "id, name"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "instructor_subjects", "instructor_id, subject_id"),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id", (q) => q.eq("status", "approved")),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
  ]);
  const edit = editor("강사 추가·수정·계정 연결 (기존 화면)", async () => ({
    render: subpages("강사 편집", [["list", "강사", old("instructors"), { fresh: true }], ["accounts", "계정 연결", old("accounts")]]),
  }), ctx);
  headActions(ctx, btn("강사 추가", edit.open, true));
  const statBox = el("div");
  const listBox = el("div");

  function toggle(i) {
    const on = isEmployed(i.id);
    const hit = affected(i.id, approved, sets);
    modal(`${i.name} · ${on ? "퇴사 처리" : "재직 복구"} 영향`, [
      el("p", { className: "muted", textContent: "강사 원문·승인 이력은 지우지 않습니다. 아래 학과 커리큘럼과 로드맵이 '다시 만들기 필요'가 되고, 학과장이 확인한 뒤 바뀝니다." }),
      ...(hit.length ? hit.map((h) => el("div", { className: "v3-impact" }, [el("div", { textContent: `${h.vacation ? h.setName : nameOf(depts, h.dept)} / ${h.vacation ? "방특" : "정규"} ${nameOf(subjects, h.subject_id)}` }),
        el("small", { className: "muted", textContent: "학과 통합 문구 · 로드맵 문구" })])) : [el("p", { textContent: "승인된 커리큘럼이 없어 영향받는 곳이 없습니다." })]),
      hint("시험 기능: 저장하지 않습니다(재직 칸은 DB 추가 후). 새로고침하면 되돌아갑니다.", "warn"),
    ], [[on ? "퇴사로 바꿔 보기" : "재직으로 되돌리기", () => { state.employed.set(i.id, !on); draw(); }]]);
  }

  function draw() {
    const out = instructors.filter((i) => !isEmployed(i.id)).length;
    statBox.replaceChildren(stats([
      ["재직(확인 전)", `${instructors.length - out}`, "재직 상태는 아직 DB에 없음"],
      ["퇴사 처리(시험)", `${out}`, "학과 커리큘럼 출처에서 빠짐", out > 0],
      ["사이트 공개", `${instructors.filter((i) => i.is_listed).length}`, "재직과 별개인 '사이트에 보이기'"],
      ["계정 연결", `${instructors.filter((i) => i.account_uid).length}`, "쌤톡 계정과 연결됨"],
    ]));
    listBox.replaceChildren(panel("강사 목록", [table(["강사", "재직 상태", "사이트", "담당 학과", "담당 과목", "통합 출처", "작업"], instructors, (i) => {
      const subs = isubjects.filter((x) => x.instructor_id === i.id).map((x) => nameOf(subjects, x.subject_id));
      return [i.name, isEmployed(i.id) ? chip("재직", "good") : chip("퇴사(시험)", "red"), i.is_listed ? chip("공개", "vacation") : chip("비공개"),
        idepts.filter((x) => x.instructor_id === i.id).map((x) => nameOf(depts, x.department_id)).join(", ") || "—",
        subs.slice(0, 3).join(", ") + (subs.length > 3 ? ` 외 ${subs.length - 3}` : "") || "—",
        `${affected(i.id, approved, sets).length}곳`, btn(isEmployed(i.id) ? "퇴사 영향 확인" : "재직 복구", () => toggle(i))];
    }).node], "통합 출처 = 이 강사의 승인 커리큘럼이 들어가는 학과·과목 수"));
  }
  container.append(
    el("div", { className: "v3-callout" }, [chip("5", "vacation"), document.createTextNode(" 퇴사는 강사 원문을 지우지 않습니다. 영향받는 학과 커리큘럼·로드맵을 다시 만들 대상으로 표시하고, 학과장이 확인·확정합니다.")]),
    statBox, listBox, edit.node,
  );
  draw();
}
