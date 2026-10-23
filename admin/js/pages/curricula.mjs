import { mountTableEditor } from "../table-editor.mjs";
import { mountCardList } from "../card-list.mjs";
import { freeName } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// 학과별 강사 커리큘럼(승인된 줄 = 사이트에 나오는 줄). 방학 특강 세트는 '방학 특강' 화면에서 고친다.
// 위에서 학과 탭·강사·과목 중 고른 것으로 검색하고(아무것도 안 고르면 전체), 아래 카드에서 고친다.
// 순서는 학과 탭마다 따로라서, 검색 결과에 학과 탭이 하나일 때만 끌어 옮길 수 있다.
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "강사 커리큘럼" }));
  const [{ data: sets }, { data: settings }, { data: depts }, { data: instructors }, { data: subjects }] = await Promise.all([
    supabase.from("curriculum_sets").select("*").order("sort_order"),
    supabase.from("site_settings").select("key, value").eq("key", "vacation_set_id"),
    supabase.from("departments").select("id, name").order("sort_order"),
    supabase.from("instructors").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("sort_order"),
  ]);
  const vacationId = settings?.[0]?.value;
  const tabs = (sets || []).filter((s) => s.id !== vacationId);

  const setsBox = el("details");
  setsBox.append(el("summary", { textContent: "학과 탭(커리큘럼 세트) 관리" }));
  container.append(setsBox);
  mountTableEditor(setsBox, {
    supabase, table: "curriculum_sets", title: "커리큘럼 세트",
    description: "세트 이름이 사이트에서 탭 이름으로 쓰입니다. 바꾸거나 추가한 뒤에는 이 화면을 다시 열어 주세요.",
    columns: [
      { key: "name", label: "이름", type: "text", required: true },
      { key: "department_id", label: "학과", type: "select",
        options: [{ value: "", label: "(없음)" }, ...(depts || []).map((d) => ({ value: d.id, label: d.name }))] },
    ],
    defaults: (rows) => ({ name: freeName("새 세트", rows, "name") }),
    deleteConfirm: async (row) => cascadeMessage("세트", row.name, [
      ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "set_id", row.id)],
    ]),
  });
  if (!tabs.length) {
    container.append(el("p", { className: "desc", textContent: "커리큘럼 세트가 없습니다." }));
    return;
  }

  // ── 검색: 학과 탭 / 강사 / 과목 ──
  const choose = (label, list) => {
    const select = el("select", {}, [
      el("option", { value: "", textContent: "전체" }),
      ...list.map((x) => el("option", { value: x.id, textContent: x.name })),
    ]);
    select.setAttribute("aria-label", label);
    return [select, el("label", { className: "form-field" }, [el("span", { textContent: label }), select])];
  };
  const [setPick, setField] = choose("학과 탭", tabs);
  const [instPick, instField] = choose("강사", instructors || []);
  const [subjPick, subjField] = choose("과목", subjects || []);
  const search = el("button", { type: "button", className: "publish-btn", textContent: "검색" });
  const count = el("span", { className: "muted" });
  container.append(
    el("div", { className: "search-bar" }, [setField, instField, subjField, search, count]),
    el("p", { className: "muted", textContent: "승인 대기 중인 커리큘럼은 '커리큘럼 관리 > 신청 과목'에서 확인합니다." }),
  );

  const setOrder = new Map(tabs.map((s, i) => [s.id, i]));
  const list = el("div");
  container.append(list);
  const nameOf = (rows, id) => (rows || []).find((x) => x.id === id)?.name ?? "";
  const editor = await mountCardList(list, {
    supabase,
    table: "instructor_curricula",
    description: "사이트에 나오는 커리큘럼입니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다(학과 탭 하나를 고르고 검색했을 때).",
    imageKey: "media_url",
    imageLabel: "이미지·영상",
    activeKey: null,
    query: (q) => q.eq("status", "approved"),
    // 방학 특강 세트는 빼고, 지금 순서 그대로: 학과 탭 순서 → 탭 안의 순서.
    sortRows: (rows) =>
      rows.filter((r) => setOrder.has(r.set_id)).sort((a, b) =>
        (setOrder.get(a.set_id) ?? 999) - (setOrder.get(b.set_id) ?? 999) ||
        (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)
      ),
    orderScope: (row) => row.set_id,
    canAdd: () => setPick.value ? true : "새 커리큘럼은 학과 탭을 고르고 검색한 뒤 추가해주세요",
    fields: [
      { key: "set_id", label: "학과 탭", type: "select", options: () => tabs.map((s) => [s.id, s.name]) },
      { key: "instructor_id", label: "강사", type: "select", options: () => (instructors || []).map((i) => [i.id, i.name]) },
      { key: "subject_id", label: "과목", type: "select", options: () => (subjects || []).map((s) => [s.id, s.name]) },
      { key: "step_label", label: "단계", type: "text", required: true },
      { key: "written", label: "원문", type: "textarea", wide: true },
      { key: "summary", label: "정리(사이트 문구)", type: "textarea", wide: true },
    ],
    defaults: () => ({
      set_id: setPick.value,
      status: "approved",
      step_label: "1단계",
      instructor_id: instPick.value || instructors?.[0]?.id,
      subject_id: subjPick.value || subjects?.[0]?.id,
    }),
    itemName: (row) => `${nameOf(instructors, row.instructor_id)} ${nameOf(subjects, row.subject_id)} ${row.step_label}`,
    deleteConfirm: async (row) =>
      `${nameOf(instructors, row.instructor_id)} 선생님 · ${nameOf(subjects, row.subject_id)} · ${row.step_label} 커리큘럼을 삭제할까요?`,
  });
  const run = () => {
    const [s, i, j] = [setPick.value, instPick.value, subjPick.value];
    const n = editor.setFilter((r) =>
      (!s || r.set_id === s) && (!i || r.instructor_id === i) && (!j || r.subject_id === j)
    );
    count.textContent = `${n}개`;
  };
  search.addEventListener("click", run);
  run();
}
