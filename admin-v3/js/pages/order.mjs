import { el, rows, pick, chip, hint, btn, locked, panel, empty, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects, contextBar, typeChip } from "../v3.mjs";

// 학과별 과목 순서(V3 시안, 정책 8A): 학과 × 정규/방특마다 순서 하나. 전체 수업·학과 커리큘럼·로드맵이 이 순서를 같이 쓴다.
// 지금 DB에는 학과별 순서 칸이 없어(전체 공통 sort_order 하나) 저장은 잠그고, 바꾼 순서는 이 화면·로드맵·학과 커리큘럼에서만 보인다.
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
  headActions(ctx, btn("처음 순서로", () => { state.orders.delete(key()); draw(); }), locked("순서 저장", "학과별 순서 칸(subject_departments.sort_order)을 DB에 추가한 뒤 저장할 수 있습니다"));
  const key = () => `${state.dept}:${state.mode}`;
  const body = el("div");
  let dragged = null;
  const setOrder = (ids) => { state.orders.set(key(), ids); draw(); };

  function draw() {
    const list = deptSubjects(state.dept, state.mode, data);
    const ids = list.map((s) => s.id);
    const move = (id, dir) => { const a = [...ids], i = a.indexOf(id), j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setOrder(a); };
    const rowsEl = list.map((s, i) => {
      const r = el("div", { className: "v3-orderrow", draggable: true }, [
        el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("span", { className: "v2-num", textContent: `${i + 1}` }),
        el("b", { className: "v2-grow", textContent: s.name }), typeChip(s),
        btn("↑", () => move(s.id, -1)), btn("↓", () => move(s.id, 1)), btn("빼기", () => setOrder(ids.filter((x) => x !== s.id))),
      ]);
      r.addEventListener("dragstart", () => { dragged = s.id; });
      r.addEventListener("dragover", (e) => e.preventDefault());
      r.addEventListener("drop", () => {
        if (!dragged || dragged === s.id) return;
        const a = ids.filter((x) => x !== dragged);
        a.splice(a.indexOf(s.id), 0, dragged);
        dragged = null;
        setOrder(a);
      });
      return r;
    });
    const rest = subjects.filter((s) => Boolean(s.is_vacation) === (state.mode === "vacation") && !ids.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
    const shared = list.map((s, i) => `${i + 1}. ${s.name}`).join(" → ") || "과목 없음";
    body.replaceChildren(
      el("div", { className: "v3-grid48" }, [
        panel("배치 가능한 과목", rest.length ? [el("div", { className: "v3-scroll" }, rest.map((s) => el("div", { className: "v2-mini-card v2-row" }, [el("b", { textContent: s.name }), btn("이 학과에 추가", () => setOrder([...ids, s.id]))])))]
          : [empty("이 유형에서 더 넣을 과목이 없습니다.")], "같은 유형(정규/방특) 과목만"),
        panel("현재 과목 순서", rowsEl.length ? rowsEl : [empty("배정된 과목이 없습니다.")], "끌어서 옮기거나 ↑↓로 바꿉니다", [state.orders.has(key()) ? chip("바꾼 순서 · 저장 안 됨", "warn") : chip("지금 순서", "good")]),
      ]),
      panel("같은 순서 자동 반영 미리보기", [
        el("div", { className: "v3-three" }, ["전체 수업", "학과 커리큘럼", "로드맵"].map((t) => el("div", { className: "v2-mini-card" }, [el("b", { textContent: t }), el("small", { textContent: shared })]))),
        hint("지금은 모든 학과가 전체 공통 순서 하나를 같이 씁니다. 학과마다 다른 순서를 저장하려면 DB 칸 추가와 공개 사이트 읽기 수정이 필요합니다. 바꾼 순서는 이 브라우저의 V3 화면(로드맵·학과 커리큘럼)에만 보입니다."),
      ]),
    );
  }
  container.append(contextBar(depts, draw), body);
  draw();
}
