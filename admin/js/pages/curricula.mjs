import { mountTableEditor } from "../table-editor.mjs";
import { mountPicker } from "../picker.mjs";
import { mountCurriculumEditor } from "../curriculum-editor.mjs";
import { freeName } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// 학과별 강사 커리큘럼(예전 '강사 커리큘럼' 시트의 학과 탭). 방학 특강 세트는 '방학 특강' 화면에서 고친다.
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "강사 커리큘럼" }));
  const [{ data: sets }, { data: settings }, { data: depts }] = await Promise.all([
    supabase.from("curriculum_sets").select("*").order("sort_order"),
    supabase.from("site_settings").select("key, value").eq("key", "vacation_set_id"),
    supabase.from("departments").select("id, name").order("sort_order"),
  ]);
  const vacationId = settings?.[0]?.value;
  const tabs = (sets || []).filter(s => s.id !== vacationId);

  const setsBox = el("details");
  setsBox.append(el("summary", { textContent: "학과 탭(커리큘럼 세트) 관리" }));
  container.append(setsBox);
  mountTableEditor(setsBox, {
    supabase, table: "curriculum_sets", title: "커리큘럼 세트",
    description: "세트 이름이 사이트에서 탭 이름으로 쓰입니다. 바꾸거나 추가한 뒤에는 이 화면을 다시 열어 주세요.",
    columns: [
      { key: "name", label: "이름", type: "text", required: true },
      { key: "department_id", label: "학과", type: "select",
        options: [{ value: "", label: "(없음)" }, ...(depts || []).map(d => ({ value: d.id, label: d.name }))] },
    ],
    defaults: rows => ({ name: freeName("새 세트", rows, "name") }),
    deleteConfirm: async row => cascadeMessage("세트", row.name, [
      ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "set_id", row.id)],
    ]),
  });

  if (!tabs.length) { container.append(el("p", { className: "desc", textContent: "커리큘럼 세트가 없습니다." })); return; }
  const body = el("section");
  mountPicker(container, {
    label: "학과 탭",
    options: tabs.map(s => ({ value: s.id, label: s.name })),
    onChange: setId => { body.replaceChildren(); mountCurriculumEditor(body, { supabase, setId }); },
  });
  container.append(body);
}
