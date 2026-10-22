import { mountTableEditor } from "./table-editor.mjs";
import { mountPicker } from "./picker.mjs";
import { dbErrorMessage } from "./fields.mjs";

// 한 커리큘럼 세트(학과 탭·방학 특강)의 강사 커리큘럼. 승인된 줄만 사이트에 나오고,
// 선생님이 낸 줄(승인 대기)은 승인하면 같은 강사·과목·주차의 예전 줄을 대신한다.
export async function mountCurriculumEditor(container, { supabase, setId, extraColumns = [] }) {
  const [{ data: instructors }, { data: subjects }] = await Promise.all([
    supabase.from("instructors").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("sort_order"),
  ]);
  const columns = [
    { key: "instructor_id", label: "강사", type: "select", options: (instructors || []).map(i => ({ value: i.id, label: i.name })) },
    { key: "subject_id", label: "과목", type: "select", options: (subjects || []).map(s => ({ value: s.id, label: s.name })) },
    { key: "step_label", label: "주차", type: "text", required: true },
    { key: "written", label: "원문", type: "textarea" },
    { key: "summary", label: "정리", type: "textarea", ai:'week', source:'written' },
    { key: "media_url", label: "이미지·영상", type: "image", uploadKind:'curriculum' },
    ...extraColumns,
  ];
  const body = document.createElement("div");
  const state = Object.assign(document.createElement("p"), { className: "save-state" });
  let approved, pending;

  async function approve(row) {
    if (!confirm(`${row.step_label} 줄을 승인할까요? 같은 강사·과목·주차의 예전 내용은 지워집니다.`)) return;
    const { error } = await supabase.rpc("comsw_approve_curriculum", { p_id: row.id });
    if (error) { state.textContent = dbErrorMessage(error); state.classList.add("err"); return; }
    state.textContent = "승인됨 — '적용'을 눌러야 사이트에 반영됩니다";
    state.classList.remove("err");
    await Promise.all([approved.reload(), pending.reload()]);
  }

  function show(instructorId) {
    body.replaceChildren();
    const scope = status => q => {
      q = q.eq("set_id", setId).eq("status", status);
      return instructorId ? q.eq("instructor_id", instructorId) : q;
    };
    approved = mountTableEditor(body, {
      supabase, table: "instructor_curricula", columns,
      title: "승인된 커리큘럼",
      description: "사이트에 나오는 줄입니다. ↑↓ 순서가 사이트 순서입니다.",
      filter: scope("approved"),
      defaults: () => ({
        set_id: setId, status: "approved", step_label: "1주차",
        instructor_id: instructorId || instructors?.[0]?.id, subject_id: subjects?.[0]?.id,
      }),
    });
    pending = mountTableEditor(body, {
      supabase, table: "instructor_curricula", columns,
      title: "승인 대기",
      description: "선생님이 제출한 줄입니다. 승인하면 사이트에 나옵니다('적용' 후).",
      filter: scope("pending"),
      movable: false,
      extraActions: [{ label: "승인", onClick: approve }],
    });
    // 대기 줄은 선생님이 내므로 관리 화면에서 새로 만들지 않는다.
    body.querySelectorAll(".editor-bar")[1]?.querySelector("button")?.remove();
  }

  mountPicker(container, {
    label: "강사",
    options: [{ value: "", label: "전체 강사" }, ...(instructors || []).map(i => ({ value: i.id, label: i.name }))],
    onChange: show,
  });
  container.append(state, body);
}
