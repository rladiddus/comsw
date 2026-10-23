import { mountCardList } from "../card-list.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";
import { mountInstructorReview } from "../instructor-review.mjs";

// 사이트 '학과 강사소개'에 나오는 강사. 사이트 표시를 끈 강사는 커리큘럼에만 쓰인다(동명이인 구분용 등).
// 로딩 화면·학과와 같은 카드(프로필 사진 왼쪽, 처음엔 접힘, 끌어서 순서 = 사이트 순서).
export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "강사" }));
  const reviewBox = document.createElement("div");
  container.append(reviewBox);
  const [{ data: depts }, { data: subjects }] = await Promise.all([
    supabase.from("departments").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("sort_order"),
  ]);
  const editor = await mountCardList(container, {
    supabase,
    table: "instructors",
    title: "강사",
    description:
      "사이트 표시에 체크한 강사만 '학과 강사소개'에 나옵니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다.",
    imageKey: "photo_url",
    imageLabel: "프로필 사진",
    stageClass: "portrait",
    activeKey: "is_listed",
    activeLabel: "사이트 표시",
    fields: [
      { key: "name", label: "이름", type: "text", required: true },
      { key: "gender", label: "성별", type: "text", placeholder: "여자 / 남자" },
      {
        key: "departments",
        label: "학과",
        type: "links",
        wide: true,
        through: "instructor_departments",
        own: "instructor_id",
        other: "department_id",
        options: () => (depts || []).map((d) => [d.id, d.name]),
      },
      {
        key: "subjects",
        label: "담당 과목",
        type: "links",
        wide: true,
        ordered: true,
        through: "instructor_subjects",
        own: "instructor_id",
        other: "subject_id",
        options: () => (subjects || []).map((s) => [s.id, s.name]),
      },
      { key: "career", label: "경력", type: "textarea", wide: true },
      { key: "message", label: "한마디", type: "textarea", wide: true },
    ],
    defaults: () => ({ name: "새 강사" }),
    itemName: (row) => `${row.name} 강사`,
    deleteConfirm: async (row) => cascadeMessage("강사", row.name, [
      ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "instructor_id", row.id)],
    ]),
  });
  await mountInstructorReview(reviewBox, supabase, () => editor.reload());
}
