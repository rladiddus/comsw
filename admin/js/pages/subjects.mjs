import { mountTableEditor } from "../table-editor.mjs";
import { freeName, nextOrder } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";
import { dbErrorMessage } from "../fields.mjs";

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// sort_order가 비어 있는 과목은 공개 사이트 '전체수업'에 나오지 않는다(2단계 스냅샷 규칙).
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "과목·단계" }));
  const { data: depts } = await supabase.from("departments").select("id, name").order("sort_order");
  const columns = [
    { key: "name", label: "과목명", type: "text", required: true },
    { key: "departments", label: "학과", type: "links", through: "subject_departments", own: "subject_id", other: "department_id",
      options: (depts || []).map(d => ({ value: d.id, label: d.name })) },
    { key: "duration", label: "기간", type: "text" },
    { key: "dept_curriculum", label: "학과별 커리큘럼 요약", type: "textarea", ai:'department', source:async row=>{
      const {data,error}=await supabase.from('subject_weeks').select('summary').eq('subject_id',row.id).order('sort_order');
      if(error)throw new Error(dbErrorMessage(error));return (data||[]).map(w=>w.summary||'').filter(Boolean).join('\n');
    } },
    { key: "program", label: "프로그램·준비물", type: "textarea" },
    { key: "level", label: "학습 수준", type: "text" },
  ];
  const weeks = el("section");
  const allRows = () => [...main.rows(), ...other.rows()];
  const deleteConfirm = async row => cascadeMessage("과목", row.name, [
    ["단계", await countRows(supabase, "subject_weeks", "subject_id", row.id)],
    ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "subject_id", row.id)],
    ["강사 담당 과목", await countRows(supabase, "instructor_subjects", "subject_id", row.id)],
    ["준비물", await countRows(supabase, "course_prep_items", "subject_id", row.id)],
    ["로드맵 연결", await countRows(supabase, "roadmap_step_subjects", "subject_id", row.id)],
  ]);

  async function setOrder(row, sort_order) {
    const { error } = await supabase.from("subjects").update({ sort_order }).eq("id", row.id);
    if (error) { alertState(dbErrorMessage(error)); return; }
    await Promise.all([main.reload(), other.reload()]);
  }
  const status = el("p", { className: "save-state" });
  const alertState = m => { status.textContent = m; status.classList.add("err"); };

  function showWeeks(row) {
    weeks.replaceChildren();
    mountTableEditor(weeks, {
      supabase,
      table: "subject_weeks",
      title: `단계 — ${row.name}`,
      filter: q => q.eq("subject_id", row.id),
      defaults: rows => ({ subject_id: row.id, week_label: `${rows.length + 1}단계` }),
      columns: [
        { key: "week_label", label: "단계", type: "text", required: true },
        { key: "written", label: "커리큘럼 원문", type: "textarea" },
        { key: "summary", label: "AI 요약", type: "textarea", ai:'week', source:'written' },
        { key: "image_url", label: "대표 이미지", type: "image", uploadKind:'curriculum' },
      ],
    });
    weeks.scrollIntoView({ behavior: "smooth" });
  }

  const main = mountTableEditor(container, {
    supabase, table: "subjects", columns, deleteConfirm,
    title: "전체수업 과목",
    description: "사이트 '전체 수업'·커리큘럼에 나오는 과목입니다. ↑↓ 순서가 사이트 순서입니다.",
    filter: q => q.not("sort_order", "is", null),
    defaults: () => ({ name: freeName("새 과목", allRows(), "name") }),
    extraActions: [
      { label: "단계", onClick: showWeeks },
      { label: "전체수업에서 빼기", onClick: row => setOrder(row, null) },
    ],
  });
  const other = mountTableEditor(container, {
    supabase, table: "subjects", columns, deleteConfirm,
    title: "기타 과목",
    description: "준비물·강사·로드맵에만 쓰이고 '전체 수업'에는 나오지 않는 과목입니다.",
    filter: q => q.is("sort_order", null),
    movable: false,
    defaults: () => ({ sort_order: null, name: freeName("새 과목", allRows(), "name") }),
    extraActions: [{ label: "전체수업에 넣기", onClick: row => setOrder(row, nextOrder(main.rows())) }],
  });
  container.append(status, weeks);
}
