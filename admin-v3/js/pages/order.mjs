import { el, rows, pick, chip, hint, btn, locked, panel, empty, search, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects, contextBar, typeChip, sortable, addableSubjects, saveLocal } from "../v3.mjs";

// 학과별 과목 순서(V3 시안): 학과 × 정규/방특마다 순서 하나. 전체 수업·과목 통합 커리큘럼·로드맵이 이 순서를 같이 쓴다.
// 지금 DB에는 학과별 순서 칸이 없어(전체 공통 sort_order 하나) 저장은 잠그고, 바꾼 순서는 이 화면·로드맵·과목 통합 커리큘럼에서만 보인다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, curricula, idepts] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, subject_id, vacation"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
  ]);
  const data = { subjects, links, curricula, idepts };
  headActions(ctx, btn("처음 순서로", () => { state.orders.delete(key()); saveLocal(); draw(); }), locked("순서 저장", "학과별 순서 칸(subject_departments.sort_order)을 DB에 추가한 뒤 저장할 수 있습니다"));
  const key = () => `${state.dept}:${state.mode}`;
  const body = el("div");
  // 배치 가능한 과목 검색: 목록만 다시 그려 입력 중 커서가 유지되게 한다.
  const q = search("과목 검색");
  const restBox = el("div", { className: "v3-scroll" });
  let rest = [], addTo = () => {};
  const fillRest = () => {
    const word = q.value.trim().toLowerCase();
    const hit = rest.filter((s) => s.name.toLowerCase().includes(word));
    restBox.replaceChildren(...(hit.length ? hit.map((s) => el("div", { className: "v2-mini-card v2-row" }, [el("b", { textContent: s.name }), btn("이 학과에 추가", () => addTo(s.id))]))
      : [empty(rest.length ? "검색한 과목이 없습니다." : "이 유형에서 더 넣을 과목이 없습니다.")]));
  };
  q.addEventListener("input", fillRest);
  const setOrder = (ids) => { state.orders.set(key(), ids); saveLocal(); draw(); };

  function draw() {
    const list = deptSubjects(state.dept, state.mode, data);
    const ids = list.map((s) => s.id);
    const rowsEl = list.map((s, i) => el("div", { className: "v3-orderrow" }, [
      el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("span", { className: "v2-num", textContent: `${i + 1}` }),
      el("b", { className: "v2-grow", textContent: s.name }), typeChip(s),
      btn("빼기", () => setOrder(ids.filter((x) => x !== s.id))),
    ]));
    sortable(rowsEl.map((r, i) => [r, ids[i]]), ids, setOrder);
    rest = addableSubjects(subjects, ids, state.mode);
    addTo = (id) => setOrder([...ids, id]);
    fillRest();
    const shared = list.map((s, i) => `${i + 1}. ${s.name}`).join(" → ") || "과목 없음";
    body.replaceChildren(
      el("div", { className: "v3-grid48" }, [
        panel("배치 가능한 과목", [restBox], state.mode === "vacation" ? "방특은 모든 과목" : "정규 과목만", [q]),
        panel("현재 과목 순서", rowsEl.length ? rowsEl : [empty("배정된 과목이 없습니다.")], "끌어서 옮깁니다. 들어갈 자리에 점선이 보입니다", [state.orders.has(key()) ? chip("바꾼 순서 · 이 브라우저에 저장", "warn") : chip("지금 순서", "good")]),
      ]),
      panel("같은 순서 자동 반영 미리보기", [
        el("div", { className: "v3-three" }, ["전체 수업", "과목 통합 커리큘럼", "로드맵"].map((t) => el("div", { className: "v2-mini-card" }, [el("b", { textContent: t }), el("small", { textContent: shared })]))),
        hint("지금은 모든 학과가 전체 공통 순서 하나를 같이 씁니다. 학과마다 다른 순서를 저장하려면 DB 칸 추가와 공개 사이트 읽기 수정이 필요합니다. 바꾼 순서는 이 브라우저의 V3 화면(로드맵·과목 통합 커리큘럼)에만 보입니다."),
      ]),
    );
  }
  container.append(contextBar(depts, draw), body);
  draw();
}
