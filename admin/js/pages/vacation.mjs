import { mountCardList } from "../card-list.mjs";
import { el } from "../teacher-workspace.mjs";

// 방학 특강 페이지의 커리큘럼(메인 화면 > 기타 설정에서 고른 세트의 승인된 줄). 배경 이미지도 거기서 고른다.
// 다른 카드 목록처럼 이미지 왼쪽, 처음엔 접힘, '수정'으로 고치고, ⠿를 끌어 순서 = 사이트 순서.
// 선생님이 낸 승인 대기 줄은 '커리큘럼 관리 > 신청 과목'에서 승인한다.
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "방학 특강" }));
  const [{ data: settings }, { data: sets }, { data: instructors }, { data: subjects }] = await Promise.all([
    supabase.from("site_settings").select("key, value").eq("key", "vacation_set_id"),
    supabase.from("curriculum_sets").select("id, name"),
    supabase.from("instructors").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("sort_order"),
  ]);
  const set = (sets || []).find((s) => s.id === settings?.[0]?.value);
  if (!set) {
    container.append(el("p", { className: "desc", textContent: "방학 특강으로 쓸 커리큘럼이 정해지지 않았습니다. 메인 화면 > 기타 설정에서 고른 뒤 다시 열어 주세요." }));
    return;
  }
  container.append(el("p", { className: "desc",
    textContent: `'${set.name}' 커리큘럼입니다. 다른 방학 특강으로 바꾸거나 배경 이미지를 바꾸려면 메인 화면 > 기타 설정에서 고릅니다. 승인 대기 중인 커리큘럼은 '커리큘럼 관리 > 신청 과목'에서 확인합니다.` }));
  const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name ?? "";
  await mountCardList(container, {
    supabase,
    table: "instructor_curricula",
    title: "강의 목록",
    description: "사이트 방학 특강에 나오는 강의입니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다.",
    imageKey: "media_url",
    imageLabel: "이미지·영상",
    uploadKind: "curriculum",
    activeKey: null,
    query: (q) => q.eq("set_id", set.id).eq("status", "approved"),
    fields: [
      // 윗줄: 과목 / 단계 / 수업 시간 / 강사, 아랫줄: 커리큘럼(사이트 문구) / 교재·준비물 / 교재 설명.
      // 선생님 원문(written)은 이 화면에 두지 않는다(사용자 요청, DB에는 그대로 남음).
      { key: "subject_id", label: "과목", type: "select", span: 3, options: () => (subjects || []).map((s) => [s.id, s.name]) },
      { key: "step_label", label: "단계", type: "text", required: true, span: 3 },
      { key: "class_time", label: "수업 시간", type: "text", span: 3 },
      { key: "instructor_id", label: "강사", type: "select", span: 3, options: () => (instructors || []).map((i) => [i.id, i.name]) },
      { key: "summary", label: "커리큘럼", type: "textarea", span: 4 },
      { key: "supplies", label: "교재·준비물", type: "textarea", span: 4 },
      { key: "supplies_detail", label: "교재 설명", type: "textarea", span: 4 },
    ],
    defaults: () => ({
      set_id: set.id,
      status: "approved",
      step_label: "1단계",
      instructor_id: instructors?.[0]?.id,
      subject_id: subjects?.[0]?.id,
    }),
    itemName: (row) => `${nameOf(instructors, row.instructor_id)} ${nameOf(subjects, row.subject_id)} ${row.step_label}`,
    deleteConfirm: async (row) =>
      `${nameOf(instructors, row.instructor_id)} 선생님 · ${nameOf(subjects, row.subject_id)} · ${row.step_label} 강의를 삭제할까요?`,
  });
}
