import { pick, chip, hint, btn, locked, stats, panel, dl, listDetail, search, select, editor, headActions, parseDate, daysFrom } from "../ui.mjs";

// 특강·세미나(시안): 일시 글에서 날짜를 읽어 모집 중/정원 마감/종료를 나눈다. 신청자 수만 읽고(이름·연락처는 안 읽음),
// 명단은 기존 특강 화면에서 본다.
export function seminarState(date, applied, capacity, now = new Date()) {
  if (!date) return ["날짜 확인", ""];
  if (daysFrom(date, now) < 0) return ["종료", ""];
  if (capacity && applied >= capacity) return ["정원 마감", "red"];
  if (daysFrom(date, now) <= 14) return ["마감 임박", "warn"];
  return ["모집 중", "good"];
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [seminars, apps] = await Promise.all([
    pick(supabase, "seminars", "id, title, subtitle, datetime_text, instructor, place, capacity, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "seminar_applications", "seminar_id, created_at"),
  ]);
  const edit = editor("특강 만들기·수정·신청자 명단 (기존 '특강·세미나' 화면)", () => import("../../../admin/js/pages/seminars.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("특강 만들기", edit.open, true));
  const now = new Date();
  const items = seminars.map((s) => {
    const date = parseDate(s.datetime_text, now);
    const applied = apps.filter((a) => a.seminar_id === s.id).length;
    return { s, date, applied, state: seminarState(date, applied, s.capacity, now) };
  });
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const by = (name) => items.filter((i) => i.state[0] === name).length;

  const q = search("특강 검색");
  const statePick = select("상태", [["", "모든 상태"], ...["모집 중", "마감 임박", "정원 마감", "종료", "날짜 확인"].map((x) => [x, x])]);
  container.append(
    stats([
      ["모집 중", `${by("모집 중") + by("마감 임박")}`, "날짜가 지나지 않은 특강"],
      ["마감 임박", `${by("마감 임박")}`, "14일 안에 열림", by("마감 임박") > 0],
      ["종료·정원 마감", `${by("종료") + by("정원 마감")}`, "날짜가 지났거나 정원이 찬 특강"],
      ["이번 달 신청", `${apps.filter((a) => String(a.created_at).startsWith(month)).length}`, `${month} 신청 수`],
    ]),
    listDetail({
      cols: ["특강", "날짜", "장소", "신청/정원", "상태"],
      items,
      cells: (i) => [i.s.title, i.s.datetime_text || "—", i.s.place || "—", `${i.applied} / ${i.s.capacity ?? "—"}`, chip(...i.state)],
      filters: [q, statePick],
      match: (i) => i.s.title.includes(q.value.trim()) && (!statePick.value || i.state[0] === statePick.value),
      note: hint("신청자 명단은 필요한 담당자만 봐야 합니다. 이 화면은 신청 수만 보여 주고, 명단은 아래 기존 화면에서 엽니다.", "warn"),
      detail: (i) => panel(i.s.title, [
        dl([["소주제", i.s.subtitle], ["일시", i.s.datetime_text], ["강사", i.s.instructor], ["장소", i.s.place], ["신청/정원", `${i.applied} / ${i.s.capacity ?? "—"}`], ["상태", chip(...i.state)]]),
        btn("신청자 명단·수정", edit.open, true),
      ], "행사 상세 · 선택한 특강"),
    }),
    edit.node,
  );
}
