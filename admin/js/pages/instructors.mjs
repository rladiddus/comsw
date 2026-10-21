import { mountTableEditor } from "../table-editor.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";

// 사이트 '학과 강사소개'에 나오는 강사. 사이트 표시를 끈 강사는 커리큘럼에만 쓰인다(동명이인 구분용 등).
export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "강사" }));
  const [{ data: depts }, { data: subjects }] = await Promise.all([
    supabase.from("departments").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("sort_order"),
  ]);
  mountTableEditor(container, {
    supabase,
    table: "instructors",
    title: "강사",
    description: "사이트 표시에 체크한 강사만 '학과 강사소개'에 나옵니다. ↑↓ 순서가 사이트 순서입니다.",
    columns: [
      { key: "name", label: "이름", type: "text", required: true },
      { key: "gender", label: "성별", type: "text" },
      { key: "departments", label: "학과", type: "links", through: "instructor_departments", own: "instructor_id", other: "department_id",
        options: (depts || []).map(d => ({ value: d.id, label: d.name })) },
      { key: "subjects", label: "담당 과목", type: "links", through: "instructor_subjects", own: "instructor_id", other: "subject_id", ordered: true,
        options: (subjects || []).map(s => ({ value: s.id, label: s.name })) },
      { key: "career", label: "경력", type: "textarea" },
      { key: "message", label: "한마디", type: "textarea" },
      { key: "photo_url", label: "프로필 사진", type: "image" },
      { key: "is_listed", label: "사이트 표시", type: "checkbox" },
    ],
    defaults: { name: "새 강사", is_listed: false },
    deleteConfirm: async row => cascadeMessage("강사", row.name, [
      ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "instructor_id", row.id)],
    ]),
  });
}
