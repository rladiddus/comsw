import { mountTableEditor } from "../table-editor.mjs";
import { mountPicker } from "../picker.mjs";

// 과목 목록에는 준비물이 있는 과목만 나온다. 새 과목의 준비물은 '+ 다른 과목'에서 골라 시작한다.
export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "수업별 준비물" }));
  const [{ data: subjects }, { data: items }] = await Promise.all([
    supabase.from("subjects").select("id, name").order("name"),
    supabase.from("course_prep_items").select("subject_id"),
  ]);
  const has = new Set((items || []).map(i => i.subject_id));
  const byName = (a, b) => a.label.localeCompare(b.label, "ko");
  const all = (subjects || []).map(s => ({ value: s.id, label: s.name })).sort(byName);
  const section = document.createElement("section");
  const show = subjectId => {
    section.replaceChildren();
    if (!subjectId) return;
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
  };
  mountPicker(container, { label: "과목", options: all.filter(o => has.has(o.value)), onChange: show });
  const other = document.createElement("select");
  other.setAttribute("aria-label", "다른 과목");
  for (const o of [{ value: "", label: "+ 다른 과목" }, ...all.filter(o => !has.has(o.value))]) {
    other.append(Object.assign(document.createElement("option"), { value: o.value, textContent: o.label }));
  }
  other.addEventListener("change", () => show(other.value));
  container.lastElementChild.append(other); // 과목 선택 상자 옆
  container.append(section);
}
