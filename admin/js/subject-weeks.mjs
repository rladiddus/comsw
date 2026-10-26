import { mountCardList } from "./card-list.mjs";

// 과목 안의 단계(subject_weeks) = 사이트 '전체 수업'에서 과목을 펼치면 나오는 단계명·원문·요약·대표 이미지.
// 학과 커리큘럼·기타 과목의 '단계' 버튼이 같이 쓴다. 강사 커리큘럼·준비물처럼 카드(대표 이미지 왼쪽),
// '수정'으로 고치고(수정 중 'AI 요약'), ⠿를 끌어 순서(사이트 순서)를 바꾼다.
export function showWeeks(container, supabase, subject) {
  container.replaceChildren();
  mountCardList(container, {
    supabase,
    table: "subject_weeks",
    title: `단계 — ${subject.name}`,
    description: "사이트 '전체 수업'에서 이 과목을 펼치면 나오는 단계입니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다.",
    imageLabel: "대표 이미지",
    uploadKind: "curriculum",
    activeKey: null,
    query: (q) => q.eq("subject_id", subject.id),
    fields: [
      { key: "week_label", label: "단계", type: "text", required: true },
      { key: "written", label: "커리큘럼 원문", type: "textarea", wide: true },
      { key: "summary", label: "AI 요약", type: "textarea", wide: true, ai: "week", source: "written" },
    ],
    defaults: (rows) => ({ subject_id: subject.id, week_label: `${rows.length + 1}단계` }),
    itemName: (row) => `'${row.week_label}'`,
    deleteConfirm: async (row) => `${subject.name} · ${row.week_label}을(를) 삭제할까요?`,
  });
  container.scrollIntoView?.({ behavior: "smooth" });
}
