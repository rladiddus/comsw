import { el, rows, pick, chip, hint, btn, panel, empty, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { state, deptSubjects, contextBar, splitGrid } from "../v3.mjs";

// 로드맵(V3): 학과마다(정규만) 스텝을 위에서 아래로 쌓는다. 왼쪽 = 과목 통합 커리큘럼의 과목 순서, 오른쪽 = 스텝 박스.
// 스텝에 과목 넣기 = 왼쪽 과목을 끌어 스텝 박스에 놓기(다른 스텝에 있던 과목이면 옮김). 맨 아래 '+ 스텝 추가'.
// 스텝 박스 왼쪽 = 넣은 과목, 오른쪽 = 요약 문구. 문구는 과목마다 하나(모든 학과 공용, 2026-10-29 결정)이고,
// 과목을 여럿 넣은 스텝은 그 과목들의 문구를 요약한 것. 지금 DB에는 과목별 문구 칸이 없어 그 과목 하나만 든 로드맵 단계의 문구를 과목 문구로 본다.
// 스텝 구성은 이 화면에서만 기억한다(state.roadmap, 저장 안 됨). 처음 = 지금 로드맵(roadmap_steps·roadmap_step_subjects).
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, tracks, steps, stepSubjects] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "roadmap_tracks", "id, name, department_id"),
    pick(supabase, "roadmap_steps", "id, track_id, position, summary"),
    pick(supabase, "roadmap_step_subjects", "step_id, subject_id"),
  ]);
  const edit = editor("로드맵 문구 고치기 (기존 '로드맵' 화면)", () => import("../../../admin/js/pages/roadmap.mjs"), ctx);
  headActions(ctx, btn("과목 순서 수정", () => { location.hash = "#/aggregate"; }), btn("문구 고치기", edit.open, true));
  state.mode = "regular"; // 로드맵은 정규만
  const data = { subjects, links };
  const body = el("div");
  const nameOfS = (id) => subjects.find((s) => s.id === id)?.name ?? "?";
  const subsOf = (stepId) => stepSubjects.filter((x) => x.step_id === stepId).map((x) => x.subject_id);
  // 과목 문구: 그 과목 하나만 든 로드맵 단계(어느 학과든)의 문구
  const own = (id) => steps.find((st) => { const xs = subsOf(st.id); return xs.length === 1 && xs[0] === id; })?.summary?.trim() ?? "";
  let dragged = null;

  // 처음 스텝 = 이 학과 로드맵의 단계(위치 순서)
  const stepsOf = () => {
    if (!state.roadmap.has(state.dept)) {
      const mine = tracks.filter((t) => t.department_id === state.dept).map((t) => t.id);
      state.roadmap.set(state.dept, steps.filter((st) => mine.includes(st.track_id)).sort((a, b) => mine.indexOf(a.track_id) - mine.indexOf(b.track_id) || (a.position ?? 0) - (b.position ?? 0))
        .map((st) => ({ ids: subsOf(st.id).filter((id) => subjects.some((s) => s.id === id)), from: st.id })));
    }
    return state.roadmap.get(state.dept);
  };
  const summaryOf = (step) => {
    const saved = steps.find((st) => st.id === step.from);
    const same = saved && subsOf(saved.id).length === step.ids.length && step.ids.every((id) => subsOf(saved.id).includes(id));
    if (same && saved.summary?.trim()) return [saved.summary.trim(), chip("요약 있음", "good")];
    if (step.ids.length === 1) return own(step.ids[0]) ? [own(step.ids[0]), chip("과목 문구", "good")] : ["로드맵 문구가 없습니다.", chip("과목 문구 없음", "warn")];
    return step.ids.length ? [`과목 문구 ${step.ids.length}개를 요약해야 합니다.`, chip("다시 요약 필요", "warn")] : ["왼쪽에서 과목을 끌어 놓으세요.", chip("과목 없음", "")];
  };

  function draw() {
    const list = deptSubjects(state.dept, "regular", data);
    const plan = stepsOf();
    const stepNo = (id) => plan.findIndex((st) => st.ids.includes(id)) + 1;

    const items = list.map((s, i) => {
      const n = stepNo(s.id);
      const r = el("div", { className: "v2-listitem v3-dragsrc", draggable: true }, [el("div", { className: "v2-row v2-gap" }, [
        el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("b", { className: "v2-grow", textContent: `${i + 1}. ${s.name}` }),
        n ? chip(`STEP ${n}`, "good") : chip("스텝 없음", "")])]);
      r.addEventListener("dragstart", (e) => { dragged = s.id; e.dataTransfer?.setData("text/plain", s.id); });
      r.addEventListener("dragend", () => { dragged = null; });
      return r;
    });
    const boxes = plan.map((step, i) => {
      const [text, status] = summaryOf(step);
      const box = el("div", { className: "v3-step" }, [
        el("div", { className: "v3-stepsubs" }, [el("b", { textContent: `STEP ${i + 1}` }),
          ...(step.ids.length ? step.ids.map((id) => el("span", { className: "v3-tchip", textContent: nameOfS(id) })) : [el("small", { className: "muted", textContent: "여기에 과목을 놓으세요" })])]),
        el("div", { className: "v3-steptext" }, [el("p", { textContent: text }), status]),
      ]);
      box.addEventListener("dragover", (e) => { if (!dragged) return; e.preventDefault(); box.classList.add("drop-on"); });
      box.addEventListener("dragleave", () => box.classList.remove("drop-on"));
      box.addEventListener("drop", (e) => {
        e.preventDefault(); box.classList.remove("drop-on");
        const id = dragged; dragged = null;
        if (!id || step.ids.includes(id)) return;
        plan.forEach((st) => { st.ids = st.ids.filter((x) => x !== id); }); // 다른 스텝에 있던 과목은 옮긴다
        step.ids.push(id);
        draw();
      });
      return box;
    });
    body.replaceChildren(splitGrid(
      panel("과목", [list.length ? el("div", { className: "v2-boxlist" }, items) : empty("이 학과에 과목이 없습니다.")], "과목 통합 커리큘럼 순서 · 끌어서 스텝에 놓기"),
      panel("로드맵 스텝", [
        ...(boxes.length ? boxes : [empty("스텝이 없습니다. 아래 '+ 스텝 추가'를 누르세요.")]),
        el("div", { className: "v2-actions" }, [btn("+ 스텝 추가", () => { plan.push({ ids: [], from: null }); draw(); })]),
        hint("스텝 구성은 화면에서만 기억합니다(저장 안 됨). 실제 로드맵 문구는 '문구 고치기'(기존 로드맵 화면)에서 고칩니다."),
      ], "위에서 아래로 한 박스가 한 스텝"),
    ));
  }
  const bar = contextBar(depts, draw);
  bar.querySelector(".v3-switch")?.remove(); // 정규·방특 버튼 없음
  container.append(bar, body, edit.node);
  draw();
}
