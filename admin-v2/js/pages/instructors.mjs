import { el, pick, chip, hint, btn, locked, stats, panel, dl, empty, tabBox, listDetail, search, select, editor, headActions, nameOf } from "../ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";

// 강사 관리(시안 '강사·계정'): 강사 정보와 쌤톡 계정 연결. 프로필 승인은 '승인 대기'에서. 고치기는 기존 강사·계정 연결 화면.
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [instructors, depts, subjects, idepts, isubjects, drafts, curricula] = await Promise.all([
    pick(supabase, "instructors", "id, name, career, message, photo_url, account_uid, account_email, is_listed, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "subjects", "id, name"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "instructor_subjects", "instructor_id, subject_id"),
    pick(supabase, "instructor_profile_drafts", "instructor_id", (q) => q.eq("status", "pending")),
    pick(supabase, "instructor_curricula", "instructor_id, status"),
  ]);
  const edit = editor("강사 추가·수정 (기존 강사·계정 연결 화면)", async () => ({
    render: subpages("강사 편집", [["list", "강사", old("instructors"), { fresh: true }], ["accounts", "계정 연결", old("accounts")]]),
  }), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("강사 추가", edit.open, true));
  const deptsOf = (i) => idepts.filter((x) => x.instructor_id === i.id).map((x) => nameOf(depts, x.department_id));
  const subjectsOf = (i) => isubjects.filter((x) => x.instructor_id === i.id).map((x) => nameOf(subjects, x.subject_id));
  const linked = (i) => Boolean(i.account_uid);

  const q = search("강사 이름 검색");
  const deptPick = select("학과", [["", "전체 학과"], ...depts.map((d) => [d.name, d.name])]);
  const statePick = select("상태", [["", "전체 상태"], ["on", "사이트 공개"], ["off", "비공개"], ["nolink", "계정 미연결"]]);
  container.append(
    stats([
      ["등록 강사", `${instructors.length}`, `사이트 공개 ${instructors.filter((i) => i.is_listed).length}명`],
      ["계정 연결", `${instructors.filter(linked).length}`, "쌤톡 계정과 연결됨"],
      ["연결 필요", `${instructors.filter((i) => !linked(i)).length}`, "계정이 연결되지 않은 강사"],
      ["프로필 검토", `${drafts.length}`, "승인 대기 중인 프로필", drafts.length > 0, "#/reviews"],
    ]),
    listDetail({
      cols: ["강사", "담당 학과", "담당 과목", "계정 연결", "상태"],
      items: instructors,
      cells: (i) => [i.name, deptsOf(i).join(", ") || "—", (subjectsOf(i).slice(0, 3).join(", ") + (subjectsOf(i).length > 3 ? " 외" : "")) || "—",
        linked(i) ? chip("연결됨", "good") : chip("미연결", "warn"), i.is_listed ? chip("공개", "vacation") : chip("비공개")],
      filters: [q, deptPick, statePick],
      match: (i) => i.name.includes(q.value.trim()) && (!deptPick.value || deptsOf(i).includes(deptPick.value))
        && (!statePick.value || (statePick.value === "nolink" ? !linked(i) : (statePick.value === "on") === Boolean(i.is_listed))),
      detail: (i) => panel(i.name, tabBox(["기본 정보", "연결 정보", "수정 이력"], (t) => t === 0 ? [
        ...(i.photo_url ? [el("img", { className: "v2-thumb", src: driveThumbnail(i.photo_url) || i.photo_url, alt: "" })] : []),
        dl([["이름", i.name], ["경력", i.career], ["한마디", i.message], ["사이트", i.is_listed ? "공개" : "비공개"]]),
        el("div", { className: "v2-actions v2-end" }, [btn("수정 저장", edit.open, true)]),
      ] : t === 1 ? [
        dl([["학과", deptsOf(i).join(", ")], ["담당 과목", subjectsOf(i).join(", ")],
          ["계정", linked(i) ? (i.account_email || "연결됨") : "미연결"],
          ["커리큘럼", `승인 ${curricula.filter((c) => c.instructor_id === i.id && c.status === "approved").length}단계 · 대기 ${curricula.filter((c) => c.instructor_id === i.id && c.status === "pending").length}단계`]]),
        hint("승인이 필요한 프로필 제출은 '승인 대기'에서 검토합니다. 계정 중복은 쌤톡 계정 기준으로 막습니다."),
      ] : [empty("수정 이력은 아직 기록하지 않습니다(DB 추가가 필요합니다).")]), "강사 정보 · 선택한 강사"),
    }),
    edit.node,
  );
}
