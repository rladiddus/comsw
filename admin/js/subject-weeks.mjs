import { mountTableEditor } from "./table-editor.mjs";

// 과목 안의 단계(subject_weeks) = 사이트 '전체 수업'에서 과목을 펼치면 나오는 단계명·원문·요약·대표 이미지.
// 학과 커리큘럼·기타 과목의 '단계' 버튼이 같이 쓴다(예전 '과목·단계' 화면의 단계 편집기).
export function showWeeks(container, supabase, subject) {
  container.replaceChildren();
  mountTableEditor(container, {
    supabase,
    table: "subject_weeks",
    title: `단계 — ${subject.name}`,
    description: "사이트 '전체 수업'에서 이 과목을 펼치면 나오는 단계입니다. ↑↓ 순서가 사이트 순서입니다.",
    filter: (q) => q.eq("subject_id", subject.id),
    defaults: (rows) => ({ subject_id: subject.id, week_label: `${rows.length + 1}단계` }),
    columns: [
      { key: "week_label", label: "단계", type: "text", required: true },
      { key: "written", label: "커리큘럼 원문", type: "textarea" },
      { key: "summary", label: "AI 요약", type: "textarea", ai: "week", source: "written" },
      { key: "image_url", label: "대표 이미지", type: "image", uploadKind: "curriculum" },
    ],
  });
  container.scrollIntoView?.({ behavior: "smooth" });
}
