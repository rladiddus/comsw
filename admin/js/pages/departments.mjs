import { mountTableEditor } from "../table-editor.mjs";
import { freeName } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";

export function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "학과" }));
  mountTableEditor(container, {
    supabase,
    table: "departments",
    title: "학과",
    description: "사용에 체크한 학과만 사이트 학과 목록에 나옵니다. 영문 이름은 커리큘럼 제목에 쓰입니다.",
    columns: [
      { key: "name", label: "학과명", type: "text", required: true },
      { key: "name_en", label: "영문", type: "text" },
      { key: "description", label: "소개 문구", type: "textarea" },
      { key: "image_url", label: "대표 이미지", type: "image" },
      { key: "drive_folder_id", label: "드라이브 폴더 ID", type: "text" },
      { key: "is_active", label: "사용", type: "checkbox" },
    ],
    defaults: rows => ({ name: freeName("새 학과", rows, "name"), is_active: false }),
    deleteConfirm: async row => cascadeMessage("학과", row.name, [
      ["채용 공고", await countRows(supabase, "recruitment_posts", "department_id", row.id)],
      ["과목 연결", await countRows(supabase, "subject_departments", "department_id", row.id)],
      ["강사 연결", await countRows(supabase, "instructor_departments", "department_id", row.id)],
    ]),
  });
  mountTableEditor(container, {
    supabase,
    table: "site_categories",
    title: "카테고리",
    description: "학과별 자료 화면의 순서입니다. 사이트는 이 이름으로 화면을 고릅니다: 커리큘럼, 학과 강사소개, 채용정보, 취업 프로세스",
    columns: [
      { key: "name", label: "이름", type: "text", required: true },
      { key: "is_active", label: "사용", type: "checkbox" },
    ],
    defaults: rows => ({ name: freeName("새 카테고리", rows, "name"), is_active: false }),
  });
}
