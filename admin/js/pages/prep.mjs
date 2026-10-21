import { mountTableEditor } from "../table-editor.mjs";
import { mountPicker } from "../picker.mjs";

export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "수업별 준비물" }));
  const { data: subjects } = await supabase.from("subjects").select("id, name").order("name");
  const options = (subjects || [])
    .map(s => ({ value: s.id, label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const section = document.createElement("section");
  mountPicker(container, {
    label: "과목",
    options,
    onChange: subjectId => {
      section.replaceChildren();
      mountTableEditor(section, {
        supabase,
        table: "course_prep_items",
        description: "교재는 정가와 이미지가, AI 툴은 설명이 사이트에 함께 나옵니다.",
        filter: q => q.eq("subject_id", subjectId),
        defaults: { subject_id: subjectId, category: "textbook" },
        columns: [
          { key: "category", label: "분류", type: "select",
            options: [{ value: "textbook", label: "교재" }, { value: "supply", label: "준비물" }, { value: "ai", label: "AI 툴" }] },
          { key: "content", label: "내용", type: "textarea", required: true },
          { key: "link_url", label: "링크", type: "text" },
          { key: "image_url", label: "이미지", type: "image" },
          { key: "extra", label: "정가·설명", type: "text" },
        ],
      });
    },
  });
  container.append(section);
}
