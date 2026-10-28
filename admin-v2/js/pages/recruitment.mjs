import { pick, chip, hint, btn, locked, stats, panel, dl, listDetail, search, select, editor, headActions, nameOf, parseDate, daysFrom } from "../ui.mjs";

// 채용 공고(시안): 마감일은 글이라 날짜를 읽을 수 있을 때만 모집 중/마감 임박/마감으로 나눈다('상시' 등은 상시·확인).
export function postState(deadline, now = new Date()) {
  const d = parseDate(deadline, now);
  if (!d) return /상시|수시/.test(String(deadline || "")) ? ["상시", "vacation"] : ["마감일 확인", ""];
  const left = daysFrom(d, now);
  if (left < 0) return ["마감", ""];
  if (left <= 7) return ["마감 임박", "warn"];
  return ["모집 중", "good"];
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [posts, depts] = await Promise.all([
    pick(supabase, "recruitment_posts", "*", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "departments", "id, name"),
  ]);
  const edit = editor("공고 추가·수정 (기존 '채용 공고' 화면)", () => import("../../../admin/js/pages/recruitment.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("공고 추가", edit.open, true));
  const items = posts.map((p) => ({ p, state: postState(p.deadline) }));
  const by = (n) => items.filter((i) => i.state[0] === n).length;

  const q = search("기업·직무 검색");
  const deptPick = select("학과", [["", "모든 학과"], ...depts.map((d) => [d.id, d.name])]);
  const statePick = select("상태", [["", "모든 상태"], ...["모집 중", "마감 임박", "상시", "마감", "마감일 확인"].map((x) => [x, x])]);
  container.append(
    stats([
      ["모집 중", `${by("모집 중") + by("마감 임박") + by("상시")}`, "상시 모집 포함"],
      ["마감 임박", `${by("마감 임박")}`, "7일 안에 마감", by("마감 임박") > 0],
      ["마감", `${by("마감")}`, "마감일이 지난 공고"],
      ["전체 공고", `${items.length}`, `학과 ${new Set(posts.map((p) => p.department_id)).size}곳`],
    ]),
    listDetail({
      cols: ["기업", "모집 직무", "학과", "마감일", "상태"],
      items,
      cells: (i) => [i.p.company || "—", i.p.job_title || "—", nameOf(depts, i.p.department_id), i.p.deadline || "—", chip(...i.state)],
      filters: [q, deptPick, statePick],
      match: (i) => `${i.p.company || ""}${i.p.job_title || ""}`.includes(q.value.trim()) && (!deptPick.value || i.p.department_id === deptPick.value)
        && (!statePick.value || i.state[0] === statePick.value),
      note: hint("마감일은 글로 저장되어 있어 '2026.11.10'처럼 날짜로 적힌 공고만 자동으로 나눕니다."),
      detail: (i) => panel(i.p.company || "(기업 없음)", [
        dl([["직무", i.p.job_title], ["학과", nameOf(depts, i.p.department_id)], ["지역", i.p.location], ["고용 형태", i.p.employment_type], ["경력", i.p.experience],
          ["급여", i.p.salary], ["마감일", i.p.deadline], ["지원 방법", i.p.how_to_apply], ["연락처", i.p.contact]]),
        btn("수정 저장", edit.open, true),
      ], "공고 상세 · 선택한 공고", [chip(...i.state)]),
    }),
    edit.node,
  );
}
