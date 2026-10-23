import { mountCardList } from "../card-list.mjs";
import { el, mountTabs } from "../teacher-workspace.mjs";

const CATEGORIES = [["textbook", "교재"], ["supply", "준비물"], ["ai", "AI 툴"]];
const empty = (label) => el("p", { className: "muted", textContent: `${label} 항목이 있는 과목이 없습니다.` });

// 교재 / 준비물 / AI 툴 탭마다 그 분류 항목이 있는 과목을 이름순으로 모두 보여 준다(과목마다 제목 + 카드 목록).
// 새 과목은 선생님 준비물 승인으로 들어온다. 카드는 '수정'으로 이미지·내용·링크·정가·설명만 고치고,
// ⠿를 끌어 그 과목 안에서 순서를 바꾼다. 과목의 항목을 다 지우면 그 과목은 탭에서 빠진다.
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
      .sort((a, b) => nameOf.get(a).localeCompare(nameOf.get(b), "ko"));
    if (!has.length) return panel.append(empty(label));
    panel.append(el("p", { className: "desc", textContent:
      "교재는 정가와 이미지가, AI 툴은 설명이 사이트에 함께 나옵니다. 왼쪽 ⠿를 끌어 놓은 순서가 그 과목의 사이트 순서입니다." }));
    await Promise.all(has.map((subjectId) => {
      const section = el("section", { className: "prep-subject" }, [el("h3", { textContent: nameOf.get(subjectId) })]);
      panel.append(section);
      return mountCardList(section, {
        supabase,
        table: "course_prep_items",
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
        // 다 지우면 이 과목은 이 분류가 없는 것 → 탭에서 뺀다.
        onRows: (rows) => {
          if (rows.length) return;
          section.remove();
          if (!panel.querySelector(".prep-subject")) panel.replaceChildren(empty(label));
        },
      });
    }));
  }

  mountTabs(container, panels, undefined, drawTab);
  container.append(...panels.map(([, , panel]) => panel));
}
