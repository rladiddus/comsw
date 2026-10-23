import { mountCardList } from "../card-list.mjs";
import { mountPicker } from "../picker.mjs";
import { el, mountTabs } from "../teacher-workspace.mjs";

const CATEGORIES = [["textbook", "교재"], ["supply", "준비물"], ["ai", "AI 툴"]];

// 교재 / 준비물 / AI 툴 탭마다 그 분류 항목이 있는 과목만 고를 수 있다(새 과목은 선생님 준비물 승인으로 들어온다).
// 아래 카드는 '수정'으로 이미지·내용·링크·정가·설명만 고치고, ⠿를 끌어 순서를 바꾼다. 다 지우면 그 과목은 목록에서 빠진다.
// 탭을 열 때마다 새로 그린다(다른 탭·승인에서 바뀐 과목 목록이 보이게).
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "수업별 준비물" }));
  const { data: subjects } = await supabase.from("subjects").select("id, name");
  const nameOf = new Map((subjects || []).map((s) => [s.id, s.name]));
  const panels = CATEGORIES.map(([cat, label]) => [cat, label, el("div", { className: "subpage" })]);

  async function drawTab(cat) {
    const [, label, panel] = panels.find(([c]) => c === cat);
    panel.replaceChildren();
    const { data: items } = await supabase.from("course_prep_items").select("subject_id").eq("category", cat);
    const has = [...new Set((items || []).map((i) => i.subject_id))]
      .filter((id) => nameOf.has(id))
      .map((id) => ({ value: id, label: nameOf.get(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
    if (!has.length) return panel.append(el("p", { className: "muted", textContent: `${label} 항목이 있는 과목이 없습니다.` }));
    const section = el("section");
    const show = (subjectId) => {
      section.replaceChildren();
      if (!subjectId) return;
      mountCardList(section, {
        supabase,
        table: "course_prep_items",
        description: "교재는 정가와 이미지가, AI 툴은 설명이 사이트에 함께 나옵니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다.",
        activeKey: null,
        query: (q) => q.eq("subject_id", subjectId).eq("category", cat),
        fields: [
          { key: "category", label: "분류", type: "select", locked: true, options: () => CATEGORIES },
          { key: "content", label: "내용", type: "textarea", required: true, wide: true },
          { key: "link_url", label: "링크", type: "text", wide: true },
          { key: "extra", label: "정가·설명", type: "text", wide: true },
        ],
        defaults: () => ({ subject_id: subjectId, category: cat }),
        itemName: (row) => `'${row.content || label}'`,
        deleteConfirm: async (row) => `${nameOf.get(subjectId)} · ${label} '${row.content || ""}'을(를) 삭제할까요?`,
        // 다 지우면 이 과목은 이 분류가 없는 것 → 과목 목록에서 빼고 다음 과목을 보여 준다.
        onRows: (rows) => {
          if (rows.length) return;
          const select = picker.querySelector("select");
          select.querySelector(`option[value="${subjectId}"]`)?.remove();
          if (select.options.length) return show(select.value);
          panel.replaceChildren(el("p", { className: "muted", textContent: `${label} 항목이 있는 과목이 없습니다.` }));
        },
      });
    };
    mountPicker(panel, { label: "과목", options: has, onChange: show });
    const picker = panel.lastElementChild;
    panel.append(section);
  }

  mountTabs(container, panels, undefined, drawTab);
  container.append(...panels.map(([, , panel]) => panel));
}
