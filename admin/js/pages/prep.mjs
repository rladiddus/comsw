import { mountCardList } from "../card-list.mjs";
import { el, mountTabs, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";

const CATEGORIES = [["textbook", "교재"], ["supply", "준비물"], ["ai", "AI 툴"]];
const empty = (label) => el("p", { className: "muted", textContent: `${label} 항목이 있는 과목이 없습니다.` });

// 교재 / 준비물 / AI 툴 탭마다 그 분류 항목이 있는 과목을 학과별로 묶어 보여 준다(학과 제목 → 과목별 카드, 과목명은 카드 안 첫 칸).
// 과목이 여러 학과에 있으면 학과 순서상 첫 학과에만, 학과가 없으면 맨 아래 '기타 과목'에 둔다.
// '+ 추가'·'모두 펼치기'는 탭에 하나씩: '+ 추가'는 과목을 고르고 내용을 써서 넣는다(이미지는 카드 '수정'에서).
// 카드는 '수정'으로 이미지·내용·링크·정가·설명만 고치고, ⠿를 끌어 그 과목 안에서 순서를 바꾼다.
// 과목의 항목을 다 지우면 그 과목은 탭에서 빠진다. 탭을 열 때마다 새로 그린다.
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "수업별 준비물" }));
  const [{ data: subjects }, { data: depts }, { data: links }] = await Promise.all([
    supabase.from("subjects").select("id, name, sort_order"),
    supabase.from("departments").select("id, name").order("sort_order"),
    supabase.from("subject_departments").select("subject_id, department_id"),
  ]);
  const nameOf = new Map((subjects || []).map((s) => [s.id, s.name]));
  // 과목 → 첫 학과(학과 순서 기준). 없으면 기타 과목.
  const deptOf = new Map();
  for (const d of depts || []) {
    for (const l of links || []) if (l.department_id === d.id && !deptOf.has(l.subject_id)) deptOf.set(l.subject_id, d.id);
  }
  const groups = [...(depts || []).map((d) => ({ id: d.id, name: d.name })), { id: null, name: "기타 과목" }];
  const bySubjectOrder = (a, b) => {
    const [x, y] = [subjects.find((s) => s.id === a), subjects.find((s) => s.id === b)];
    return (x.sort_order ?? Infinity) - (y.sort_order ?? Infinity) || x.name.localeCompare(y.name, "ko");
  };
  const panels = CATEGORIES.map(([cat, label]) => [cat, label, el("div", { className: "subpage" })]);

  // 과목 고르기: 학과별 묶음(optgroup), 과목은 첫 학과에만.
  const subjectPicker = () => {
    const select = el("select", {}, [el("option", { value: "", textContent: "과목 고르기" })]);
    for (const g of groups) {
      const ids = (subjects || []).map((s) => s.id).filter((id) => (deptOf.get(id) ?? null) === g.id).sort(bySubjectOrder);
      if (ids.length) select.append(el("optgroup", { label: g.name }, ids.map((id) => el("option", { value: id, textContent: nameOf.get(id) }))));
    }
    select.setAttribute("aria-label", "과목");
    return select;
  };

  async function drawTab(cat) {
    const [, label, panel] = panels.find(([c]) => c === cat);
    panel.replaceChildren();
    const setState = stateLine(panel);
    const lists = [];

    // ── 탭 공통: + 추가(과목 고르고 내용 쓰기) · 모두 펼치기 ──
    const addBtn = el("button", { type: "button", className: "publish-btn", textContent: "+ 추가" });
    const foldBtn = el("button", { type: "button", className: "ghost-btn", textContent: "모두 펼치기" });
    const pick = subjectPicker();
    const content = el("textarea", { rows: 2, placeholder: `${label} 내용` });
    content.setAttribute("aria-label", "내용");
    const link = el("input", { type: "text", placeholder: "https://…" });
    link.setAttribute("aria-label", "링크");
    const extra = el("input", { type: "text", placeholder: cat === "ai" ? "설명" : "정가·설명" });
    extra.setAttribute("aria-label", "정가·설명");
    const save = el("button", { type: "button", className: "publish-btn", textContent: "저장" });
    const cancel = el("button", { type: "button", className: "ghost-btn", textContent: "취소" });
    const form = el("div", { className: "workspace-card prep-add", hidden: true }, [
      el("div", { className: "form-row prep-add-row" }, [
        el("label", { className: "form-field" }, [el("span", { textContent: "과목" }), pick]),
        el("label", { className: "form-field" }, [el("span", { textContent: "내용" }), content]),
        el("label", { className: "form-field" }, [el("span", { textContent: "링크" }), link]),
        el("label", { className: "form-field" }, [el("span", { textContent: "정가·설명" }), extra]),
      ]),
      el("div", { className: "form-actions" }, [save, cancel]),
    ]);
    addBtn.addEventListener("click", () => { form.hidden = false; });
    cancel.addEventListener("click", () => { form.hidden = true; });
    save.addEventListener("click", async () => {
      if (!pick.value) return setState("과목을 골라주세요", true);
      if (!content.value.trim()) return setState("내용을 입력해주세요", true);
      save.disabled = true;
      const { data: same } = await supabase.from("course_prep_items").select("sort_order").eq("subject_id", pick.value).eq("category", cat);
      const sort_order = (same || []).reduce((m, r) => Math.max(m, r.sort_order ?? -1), -1) + 1;
      const { error } = await supabase.from("course_prep_items").insert({
        subject_id: pick.value, category: cat, content: content.value.trim(),
        link_url: link.value.trim() || null, extra: extra.value.trim() || null, sort_order,
      });
      save.disabled = false;
      if (error) return setState(dbErrorMessage(error), true);
      const name = nameOf.get(pick.value);
      await drawTab(cat);
      panel.querySelector(".save-state").textContent = `'${name}'에 ${label}을(를) 추가했습니다. 이미지는 카드의 '수정'에서 넣어주세요.`;
    });
    foldBtn.addEventListener("click", () => {
      const fold = foldBtn.textContent === "모두 접기";
      for (const l of lists) l.setFold(fold);
      foldBtn.textContent = fold ? "모두 펼치기" : "모두 접기";
    });
    panel.append(
      el("p", { className: "desc", textContent:
        "교재는 정가와 이미지가, AI 툴은 설명이 사이트에 함께 나옵니다. 왼쪽 ⠿를 끌어 놓은 순서가 그 과목의 사이트 순서입니다." }),
      el("div", { className: "editor-bar" }, [addBtn, foldBtn]),
      form,
    );

    // ── 학과 → 과목 → 카드 ──
    const { data: items } = await supabase.from("course_prep_items").select("subject_id").eq("category", cat);
    const has = [...new Set((items || []).map((i) => i.subject_id))].filter((id) => nameOf.has(id));
    if (!has.length) return panel.append(empty(label));
    const mounts = [];
    for (const g of groups) {
      const ids = has.filter((id) => (deptOf.get(id) ?? null) === g.id).sort(bySubjectOrder);
      if (!ids.length) continue;
      const deptBox = el("section", { className: "prep-dept" }, [el("h3", { textContent: g.name })]);
      panel.append(deptBox);
      for (const subjectId of ids) {
        const section = el("section", { className: "prep-subject" });
        section.dataset.subject = nameOf.get(subjectId);
        deptBox.append(section);
        mounts.push(mountCardList(section, {
          supabase,
          table: "course_prep_items",
          toolbar: false,
          activeKey: null,
          query: (q) => q.eq("subject_id", subjectId).eq("category", cat),
          fields: [
            // 한 줄, 칸 너비 고정(12칸 격자): 과목 2 / 분류 1 / 내용 4 / 링크 3 / 정가·설명 2 — 카드마다 같은 자리.
            { key: "subject_id", label: "과목", type: "select", locked: true, span: 2, options: () => [[subjectId, nameOf.get(subjectId)]] },
            { key: "category", label: "분류", type: "select", locked: true, span: 1, options: () => CATEGORIES },
            { key: "content", label: "내용", type: "textarea", required: true, span: 4 },
            { key: "link_url", label: "링크", type: "text", span: 3 },
            { key: "extra", label: "정가·설명", type: "text", span: 2 },
          ],
          defaults: () => ({ subject_id: subjectId, category: cat }),
          itemName: (row) => `'${row.content || label}'`,
          deleteConfirm: async (row) => `${nameOf.get(subjectId)} · ${label} '${row.content || ""}'을(를) 삭제할까요?`,
          // 다 지우면 이 과목은 이 분류가 없는 것 → 탭에서 뺀다(학과에 남은 과목이 없으면 학과 제목도).
          onRows: (rows) => {
            if (rows.length) return;
            section.remove();
            if (!deptBox.querySelector(".prep-subject")) deptBox.remove();
            if (!panel.querySelector(".prep-subject")) panel.append(empty(label));
          },
        }).then((list) => lists.push(list)));
      }
    }
    await Promise.all(mounts);
  }

  mountTabs(container, panels, undefined, drawTab);
  container.append(...panels.map(([, , panel]) => panel));
}
