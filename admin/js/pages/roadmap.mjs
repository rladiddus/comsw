import { mountTableEditor } from "../table-editor.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";
import { freeName } from "../order.mjs";

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "로드맵" }));
  const [{ data: depts }, { data: subjects }] = await Promise.all([
    supabase.from("departments").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const steps = el("section");

  function showSteps(track) {
    steps.replaceChildren();
    mountTableEditor(steps, {
      supabase,
      table: "roadmap_steps",
      title: `단계 — ${track.name}`,
      description: "단계 번호가 사이트의 순서(1, 2, 3 …)입니다. 과목 칸에서 과목을 고르면 사이트 상자에 그 이름이 나옵니다.",
      filter: q => q.eq("track_id", track.id),
      orderKey: "position",
      movable: false,
      duplicateMessage: "이미 있는 단계 번호입니다",
      defaults: rows => ({ track_id: track.id, position: rows.reduce((m, r) => Math.max(m, r.position ?? 0), 0) + 1 }),
      columns: [
        { key: "position", label: "단계", type: "number", required: true },
        { key: "subjects", label: "과목", type: "links", through: "roadmap_step_subjects", own: "step_id", other: "subject_id", ordered: true,
          options: (subjects || []).map(s => ({ value: s.id, label: s.name })) },
        { key: "source_text", label: "원문", type: "textarea" },
        { key: "summary", label: "요약", type: "textarea", ai:'roadmap', source:'source_text' },
      ],
    });
    steps.scrollIntoView({ behavior: "smooth" });
  }

  mountTableEditor(container, {
    supabase,
    table: "roadmap_tracks",
    title: "로드맵 묶음",
    description: "'사무 자격증'처럼 학과와 이름이 달라도 됩니다. 원페이지 커리큘럼은 이름에 학과 이름이 들어간 묶음을 그 학과 로드맵으로 씁니다.",
    columns: [
      { key: "name", label: "묶음 이름", type: "text", required: true },
      { key: "department_id", label: "학과", type: "select",
        options: [{ value: "", label: "없음" }, ...(depts || []).map(d => ({ value: d.id, label: d.name }))] },
    ],
    // 이름이 같은 묶음이 이웃하면 공개 사이트(roadmap.html)가 하나로 합쳐 두 번째를 빠뜨린다.
    defaults: rows => ({ name: freeName("새 로드맵", rows, "name") }),
    deleteConfirm: async row => cascadeMessage("로드맵", row.name, [["단계", await countRows(supabase, "roadmap_steps", "track_id", row.id)]]),
    extraActions: [{ label: "단계", onClick: showSteps }],
  });
  container.append(steps);
}
