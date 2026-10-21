import { mountCurriculumEditor } from "../curriculum-editor.mjs";

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// 방학 특강 페이지의 커리큘럼. 어떤 세트를 쓸지와 배경 이미지는 메인 화면 > 기타 설정에서 고른다.
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "방학 특강" }));
  const [{ data: settings }, { data: sets }] = await Promise.all([
    supabase.from("site_settings").select("key, value").eq("key", "vacation_set_id"),
    supabase.from("curriculum_sets").select("id, name"),
  ]);
  const set = (sets || []).find(s => s.id === settings?.[0]?.value);
  if (!set) {
    container.append(el("p", { className: "desc", textContent: "방학 특강으로 쓸 커리큘럼이 정해지지 않았습니다. 메인 화면 > 기타 설정에서 고른 뒤 다시 열어 주세요." }));
    return;
  }
  container.append(el("p", { className: "desc",
    textContent: `'${set.name}' 커리큘럼입니다. 다른 방학 특강으로 바꾸거나 배경 이미지를 바꾸려면 메인 화면 > 기타 설정에서 고릅니다.` }));
  await mountCurriculumEditor(container, {
    supabase, setId: set.id,
    extraColumns: [
      { key: "supplies", label: "교재·준비물", type: "text" },
      { key: "supplies_detail", label: "교재 설명", type: "textarea" },
      { key: "class_time", label: "수업 시간", type: "text" },
    ],
  });
}
