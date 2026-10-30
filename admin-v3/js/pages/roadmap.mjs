import { el, rows, pick, chip, hint, btn, panel, empty, headActions } from "../../../admin-v2/js/ui.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { state, deptSubjects, contextBar, splitGrid } from "../v3.mjs";

// 로드맵(V3): 학과마다(정규만) 스텝을 위에서 아래로 쌓는다. 왼쪽 = 과목 통합 커리큘럼의 과목 순서, 오른쪽 = 스텝 박스.
// 스텝에 과목 넣기 = 왼쪽 과목을 끌어 스텝 박스에 놓기(다른 스텝에 있던 과목이면 옮김). 맨 아래 '+ 스텝 추가'.
// 스텝 박스 = 넣은 과목 | 요약 문구 | [과목 삭제][스텝 삭제][AI 요약]. AI 요약은 과목을 넣고 빼거나 새 스텝이라 문구가 필요할 때만 켜진다. 문구는 과목마다 하나(모든 학과 공용, 2026-10-29 결정)이고,
// 과목을 여럿 넣은 스텝은 그 과목들의 문구를 요약한 것. 지금 DB에는 과목별 문구 칸이 없어 그 과목 하나만 든 로드맵 단계의 문구를 과목 문구로 본다.
// 스텝 구성은 이 화면에서만 기억한다(state.roadmap, 저장 안 됨). 처음 = 지금 로드맵(roadmap_steps·roadmap_step_subjects).
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, tracks, steps, stepSubjects] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, dept_curriculum"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "roadmap_tracks", "id, name, department_id"),
    pick(supabase, "roadmap_steps", "id, track_id, position, summary"),
    pick(supabase, "roadmap_step_subjects", "step_id, subject_id"),
  ]);
  headActions(ctx, btn("과목 순서 수정", () => { location.hash = "#/aggregate"; }));
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
        .map((st) => ({ ids: subsOf(st.id).filter((id) => subjects.some((s) => s.id === id)), from: st.id, dirty: false, summary: "", removing: false })));
    }
    return state.roadmap.get(state.dept);
  };
  // 스텝 문구: AI로 만든 것 > 지금 로드맵 단계 문구(과목 구성이 같을 때) > 과목 하나면 그 과목 문구. 없으면 ""
  const textOf = (step) => {
    if (step.summary) return step.summary;
    const saved = steps.find((st) => st.id === step.from);
    const same = saved && subsOf(saved.id).length === step.ids.length && step.ids.every((id) => subsOf(saved.id).includes(id));
    if (same && saved.summary?.trim()) return saved.summary.trim();
    return step.ids.length === 1 ? own(step.ids[0]) : "";
  };
  const needsText = (step) => step.ids.length > 0 && (step.dirty || !textOf(step));
  const changed = (step) => { step.dirty = true; step.summary = ""; };

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
      const text = textOf(step);
      const msg = el("small", { className: "save-state" });
      const ai = btn("AI 요약", async () => {
        const fn = getServices().summarize;
        if (!fn) { msg.textContent = "AI 연결을 준비 중입니다"; msg.className = "save-state err"; return; }
        const src = step.ids.map((id) => { const s = subjects.find((x) => x.id === id); return `${s?.name ?? ""}: ${own(id) || s?.dept_curriculum || ""}`.trim(); }).join("\n");
        ai.disabled = true; msg.textContent = "AI 요약 중…"; msg.className = "save-state";
        try {
          step.summary = (await fn("roadmap", src)).text; step.dirty = false;
          draw();
        } catch (e) { msg.textContent = e.message; msg.className = "save-state err"; ai.disabled = false; }
      }, true);
      ai.disabled = !needsText(step);
      const box = el("div", { className: "v3-step" }, [
        el("div", { className: "v3-stepsubs" }, [el("b", { textContent: `STEP ${i + 1}` }),
          ...(step.ids.length ? step.ids.map((id) => el("span", { className: "v3-tchip" }, [el("span", { className: "v2-grow", textContent: nameOfS(id) }),
            ...(step.removing ? [Object.assign(el("button", { type: "button", className: "v3-x", textContent: "−", title: `${nameOfS(id)} 빼기` }),
              { onclick: () => { step.ids = step.ids.filter((x) => x !== id); changed(step); if (!step.ids.length) step.removing = false; draw(); } })] : [])]))
            : [el("small", { className: "muted", textContent: "여기에 과목을 놓으세요" })])]),
        el("div", { className: "v3-steptext" }, [
          el("p", { textContent: text || (step.ids.length > 1 ? `과목 ${step.ids.length}개의 문구를 요약해야 합니다.` : step.ids.length ? "로드맵 문구가 없습니다." : "왼쪽에서 과목을 끌어 놓으세요.") }),
          ...(needsText(step) ? [chip("문구 필요", "warn")] : []), msg]),
        el("div", { className: "v3-stepbtns" }, [
          Object.assign(btn(step.removing ? "삭제 끝" : "과목 삭제", () => { step.removing = !step.removing; draw(); }), { disabled: !step.ids.length }),
          btn("스텝 삭제", () => { plan.splice(i, 1); draw(); }),
          ai,
        ]),
      ]);
      box.addEventListener("dragover", (e) => { if (!dragged) return; e.preventDefault(); box.classList.add("drop-on"); });
      box.addEventListener("dragleave", () => box.classList.remove("drop-on"));
      box.addEventListener("drop", (e) => {
        e.preventDefault(); box.classList.remove("drop-on");
        const id = dragged; dragged = null;
        if (!id || step.ids.includes(id)) return;
        plan.forEach((st) => { if (st.ids.includes(id)) { st.ids = st.ids.filter((x) => x !== id); changed(st); } }); // 다른 스텝에 있던 과목은 옮긴다
        step.ids.push(id); changed(step);
        draw();
      });
      return box;
    });
    body.replaceChildren(splitGrid(
      panel("과목", [list.length ? el("div", { className: "v2-boxlist" }, items) : empty("이 학과에 과목이 없습니다.")], "과목 통합 커리큘럼 순서 · 끌어서 스텝에 놓기"),
      panel("로드맵 스텝", [
        ...(boxes.length ? boxes : [empty("스텝이 없습니다. 아래 '+ 스텝 추가'를 누르세요.")]),
        Object.assign(el("button", { type: "button", className: "v3-step v3-stepadd", textContent: "+ 스텝 추가" }), { onclick: () => { plan.push({ ids: [], from: null, dirty: true, summary: "", removing: false }); draw(); } }),
        hint("스텝 구성과 AI 요약 문구는 화면에서만 기억합니다(저장 안 됨)."),
      ], "위에서 아래로 한 박스가 한 스텝"),
    ));
  }
  const bar = contextBar(depts, draw);
  bar.querySelector(".v3-switch")?.remove(); // 정규·방특 버튼 없음
  container.append(bar, body);
  draw();
}
