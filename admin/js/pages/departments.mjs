import { mountTableEditor } from "../table-editor.mjs";
import { mountCardList } from "../card-list.mjs";
import { freeName } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";

// 학과: 로딩 화면과 같은 카드(대표 이미지 왼쪽, 내용 오른쪽, 끌어서 순서, 접기·펼치기).
export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "학과" }));
  await mountCardList(container, {
    supabase,
    table: "departments",
    title: "학과",
    description:
      "사용에 체크한 학과만 사이트 학과 목록에 나옵니다. 영문 이름은 커리큘럼 제목에 쓰입니다. 왼쪽 ⠿를 끌어 순서를 바꿀 수 있습니다.",
    imageLabel: "대표 이미지",
    fields: [
      { key: "name", label: "학과명", type: "text", required: true },
      { key: "name_en", label: "영문", type: "text", placeholder: "Visual Design" },
      { key: "drive_folder_id", label: "드라이브 폴더 ID", type: "text", wide: true },
      { key: "description", label: "소개 문구", type: "textarea", wide: true },
    ],
    defaults: (rows) => ({ name: freeName("새 학과", rows, "name") }),
    itemName: (row) => `'${row.name}' 학과`,
    deleteConfirm: async (row) => cascadeMessage("학과", row.name, [
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
