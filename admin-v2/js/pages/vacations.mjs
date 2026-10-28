import { el, pick, chip, hint, btn, locked, stats, panel, dl, tabBox, listDetail, select, editor, headActions, groupRequests, nameOf } from "../ui.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";

// 방학 특강(시안): 기수 = 지금의 방학 특강 그룹(curriculum_sets.is_vacation). 강좌 = 그룹 안 강사·과목 묶음.
// 승인 대기(방특 체크해 낸 것)도 같은 표에 '검토 중'으로. 담기·승인·그룹 만들기는 기존 방학 특강 화면.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [groups, setting, curricula, instructors, subjects] = await Promise.all([
    pick(supabase, "curriculum_sets", "id, name", (q) => q.eq("is_vacation", true).order("name")),
    pick(supabase, "site_settings", "key, value", (q) => q.eq("key", "vacation_set_id")),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, vacation, status, updated_at"),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, duration"),
  ]);
  const edit = editor("방학 특강 관리 (기존 '방학 특강' 화면: 그룹 만들기·신청 담기·승인)", () => import("../../../admin/js/pages/vacation.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("강좌 개설", edit.open, true));
  const siteSet = setting[0]?.value;
  const groupIds = groups.map((g) => g.id);
  const courses = [
    ...groupRequests(curricula.filter((r) => r.status === "approved" && groupIds.includes(r.set_id))).map((g) => ({ ...g, state: "approved" })),
    ...groupRequests(curricula.filter((r) => r.status === "pending" && r.vacation)).map((g) => ({ ...g, state: "pending" })),
  ];
  const current = groups.find((g) => g.id === siteSet);

  const groupPick = select("기수", [["", "모든 기수"], ...groups.map((g) => [g.id, g.id === siteSet ? `${g.name} (사이트에 나옴)` : g.name]), ["pending", "검토 중(그룹 담기 전)"]]);
  groupPick.value = siteSet && groupIds.includes(siteSet) ? siteSet : "";
  container.append(
    stats([
      ["현재 기수", current?.name ?? "없음", "사이트 방학 특강 페이지에 나오는 그룹"],
      ["개설 강좌", `${courses.filter((c) => c.state === "approved" && (!siteSet || c.set_id === siteSet)).length}`, "현재 기수의 승인된 강좌"],
      ["콘텐츠 검토", `${courses.filter((c) => c.state === "pending").length}`, "방특으로 낸 승인 대기", courses.some((c) => c.state === "pending"), "#/reviews"],
      ["기수(그룹)", `${groups.length}`, "공개 대상은 1개 기수"],
    ]),
    listDetail({
      cols: ["강좌", "담당 강사", "기간", "커리큘럼", "공개 상태"],
      items: courses,
      cells: (c) => [nameOf(subjects, c.subject_id), nameOf(instructors, c.instructor_id), subjects.find((s) => s.id === c.subject_id)?.duration || "—",
        c.state === "approved" ? chip("승인됨", "good") : chip("검토 중", "warn"),
        c.state === "approved" && c.set_id === siteSet ? chip("사이트에 나옴", "vacation") : chip(c.state === "approved" ? "비공개 기수" : "—")],
      filters: [groupPick],
      match: (c) => !groupPick.value || (groupPick.value === "pending" ? c.state === "pending" : c.set_id === groupPick.value && c.state === "approved"),
      note: hint(`현재 기수: ${current?.name ?? "없음"} · 사이트에 나오는 기수는 기본 설정 › 메인 화면에서 고릅니다. 일반 과목 원본을 복사하지 않습니다.`),
      detail: (c) => panel(`${nameOf(subjects, c.subject_id)} · ${nameOf(instructors, c.instructor_id)}`, tabBox(["강좌 정보", "커리큘럼"], (i) => i === 0 ? [
        dl([["과목", nameOf(subjects, c.subject_id)], ["강사", nameOf(instructors, c.instructor_id)], ["기수", c.state === "approved" ? nameOf(groups, c.set_id) : "아직 그룹에 담지 않음"],
          ["상태", c.state === "approved" ? "승인됨" : "검토 중"], ["최근 수정", formatSeoul(c.at)]]),
        el("div", { className: "v2-actions v2-end" }, [btn(c.state === "pending" ? "그룹에 담아 승인" : "수정", edit.open, true)]),
      ] : [el("p", { textContent: `${c.rows.length}단계` }), hint("단계 내용은 커리큘럼 관리 › 강사별 보기 또는 아래 방학 특강 화면에서 봅니다.")]), "강좌 · 선택한 항목"),
    }),
    edit.node,
  );
}
