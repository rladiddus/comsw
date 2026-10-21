import { mountTableEditor } from "../table-editor.mjs";
import { mountPicker } from "../picker.mjs";

const COLUMNS = [
  ["company", "회사명"], ["job_title", "채용직무"], ["location", "근무지"], ["employment_type", "근무형태"],
  ["requirements", "자격요건", "textarea"], ["duties", "업무내용", "textarea"], ["salary", "급여"], ["how_to_apply", "지원방법"],
  ["deadline", "지원마감일"], ["contact", "연락처"], ["experience", "경력"], ["notes", "기타", "textarea"],
  ["link_url", "링크"], ["updated_text", "업데이트일"],
].map(([key, label, type = "text"]) => ({ key, label, type }));

export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "채용 공고" }));
  const { data: depts } = await supabase.from("departments").select("id, name").order("sort_order");
  const section = document.createElement("section");
  mountPicker(container, {
    label: "학과",
    options: (depts || []).map(d => ({ value: d.id, label: d.name })),
    onChange: departmentId => {
      section.replaceChildren();
      mountTableEditor(section, {
        supabase,
        table: "recruitment_posts",
        description: "사이트 학과별 자료의 '채용정보' 화면에는 회사명·근무형태·자격요건·업무내용·급여가 나옵니다.",
        filter: q => q.eq("department_id", departmentId),
        defaults: { department_id: departmentId },
        columns: COLUMNS,
      });
    },
  });
  container.append(section);
}
