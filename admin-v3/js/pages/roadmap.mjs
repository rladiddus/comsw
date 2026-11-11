import { el, rows, pick, chip, hint, btn, panel, empty, headActions } from "../../../admin-v2/js/ui.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { state, deptSubjects, contextBar, splitGrid, modal, sortable } from "../v3.mjs";

// 로드맵(V3): 학과마다(정규만) 스텝을 위에서 아래로 쌓는다. 왼쪽 = 학과 관리의 과목 순서, 오른쪽 = 스텝 박스.
// 스텝에 과목 넣기 = 왼쪽 과목을 끌어 스텝 박스에 놓기(다른 스텝에 있던 과목이면 옮김). 맨 아래 '+ 스텝 추가'.
// 스텝 안 과목(위아래)과 스텝 자체도 끌어서 순서를 바꾼다. 스텝 안 과목 순서 = 사이트 로드맵에 나오는 순서(roadmap_step_subjects.sort_order).
// 스텝 박스 = 넣은 과목(옆 '−'로 빼기) | 요약 문구 | [스텝 삭제][AI 요약]. AI 요약은 과목을 넣고 빼거나 새 스텝이라 문구가 필요할 때만 켜진다. 문구는 과목마다 하나(모든 학과 공용, 2026-10-29 결정)이고,
// 과목을 여럿 넣은 스텝은 그 과목들의 문구를 요약한 것. 과목 문구 = 과목 칸(subjects.roadmap_summary, 승인 대기에서 만듦), 없으면 그 과목 하나만 든 로드맵 단계의 문구.
// 스텝 구성은 [저장]을 누르기 전까지 이 화면에서만 기억한다(state.roadmap). 처음 = 지금 로드맵(roadmap_steps·roadmap_step_subjects).
// [저장](2026-11-11): 학과의 로드맵 줄(roadmap_tracks, 학과마다 한 줄)에 스텝을 position 1..n, 스텝 안 과목을 sort_order 0..로 저장. 줄이 없으면 학과 이름으로 만든다.
// 공개 사이트에는 '사이트 반영' 후 보인다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, tracks, steps, stepSubjects] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, dept_curriculum"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "roadmap_tracks", "id, name, department_id, sort_order"),
    pick(supabase, "roadmap_steps", "id, track_id, position, source_text, summary"),
    pick(supabase, "roadmap_step_subjects", "step_id, subject_id, sort_order"),
  ]);
  // 과목 로드맵 문구 칸(20261105010000)은 운영 SQL 실행 전이면 없어서 따로 읽는다.
  (await pick(supabase, "subjects", "id, roadmap_summary").catch(() => []))
    .forEach((r) => { const s = subjects.find((x) => x.id === r.id); if (s) s.roadmap_summary = r.roadmap_summary; });
  headActions(ctx);
  state.mode = "regular"; // 로드맵은 정규만
  const data = { subjects, links };
  const body = el("div");
  const nameOfS = (id) => subjects.find((s) => s.id === id)?.name ?? "?";
  const subsOf = (stepId) => stepSubjects.filter((x) => x.step_id === stepId).sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)).map((x) => x.subject_id);
  // 과목 문구: 과목에 저장한 로드맵 문구(승인 대기에서 만듦), 없으면 그 과목 하나만 든 로드맵 단계(어느 학과든)의 문구
  const own = (id) => subjects.find((s) => s.id === id)?.roadmap_summary?.trim() || steps.find((st) => { const xs = subsOf(st.id); return xs.length === 1 && xs[0] === id; })?.summary?.trim() || "";
  let dragged = null;

  // 처음 스텝 = 이 학과 로드맵의 단계(위치 순서)
  const stepsOf = () => {
    if (!state.roadmap.has(state.dept)) {
      const mine = tracks.filter((t) => t.department_id === state.dept).map((t) => t.id);
      state.roadmap.set(state.dept, steps.filter((st) => mine.includes(st.track_id)).sort((a, b) => mine.indexOf(a.track_id) - mine.indexOf(b.track_id) || (a.position ?? 0) - (b.position ?? 0))
        .map((st) => ({ ids: subsOf(st.id).filter((id) => subjects.some((s) => s.id === id)), from: st.id, dirty: false, summary: "" })));
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
  const unsaved = new Set(); // [저장] 안 한 학과
  const changed = (step) => { step.dirty = true; step.summary = ""; unsaved.add(state.dept); };
  const touch = () => unsaved.add(state.dept);
  const saveMsg = el("span", { className: "save-state" });
  const say = (text, err = false) => { saveMsg.textContent = text; saveMsg.className = `save-state${err ? " err" : ""}`; };

  // 저장: 새 스텝을 임시 위치(1000+)에 먼저 넣고 → 과목 연결 → 옛 스텝 삭제 → 위치를 1..n으로. 중간에 실패해도 옛 로드맵이 먼저 지워지지 않는다.
  async function save(button) {
    const dept = state.dept;
    const plan = stepsOf().filter((st) => st.ids.length);
    const mine = tracks.filter((t) => t.department_id === dept);
    if (mine.length > 1) return say("이 학과는 로드맵 줄이 여러 개라 여기서 저장할 수 없습니다. 운영 관리 화면의 로드맵에서 한 줄로 정리해 주세요.", true);
    button.disabled = true; say("저장 중…");
    try {
      let track = mine[0];
      if (!track) {
        const name = depts.find((d) => d.id === dept)?.name ?? "로드맵";
        const sort_order = Math.max(-1, ...tracks.map((t) => t.sort_order ?? -1)) + 1;
        const { data, error } = await supabase.from("roadmap_tracks").insert({ name, department_id: dept, sort_order }).select().single();
        if (error) throw error;
        tracks.push(track = data);
      }
      const old = steps.filter((st) => st.track_id === track.id);
      const rowsNew = plan.map((st, i) => ({ track_id: track.id, position: 1000 + i, summary: textOf(st) || null,
        source_text: steps.find((x) => x.id === st.from)?.source_text ?? null }));
      const { data: made, error: e1 } = rowsNew.length ? await supabase.from("roadmap_steps").insert(rowsNew).select() : { data: [] };
      if (e1) throw e1;
      made.sort((a, b) => a.position - b.position);
      const links = made.flatMap((m, i) => plan[i].ids.map((subject_id, j) => ({ step_id: m.id, subject_id, sort_order: j })));
      if (links.length) { const { error } = await supabase.from("roadmap_step_subjects").insert(links); if (error) throw error; }
      if (old.length) { const { error } = await supabase.from("roadmap_steps").delete().in("id", old.map((x) => x.id)); if (error) throw error; }
      for (const [i, m] of made.entries()) {
        const { error } = await supabase.from("roadmap_steps").update({ position: i + 1 }).eq("id", m.id);
        if (error) throw error;
        m.position = i + 1;
      }
      // 화면 데이터도 새 로드맵으로 바꾸고, 스텝을 저장된 것에서 다시 만든다
      const gone = new Set(old.map((x) => x.id));
      steps.splice(0, steps.length, ...steps.filter((x) => !gone.has(x.id)), ...made);
      stepSubjects.splice(0, stepSubjects.length, ...stepSubjects.filter((x) => !gone.has(x.step_id)), ...links);
      state.roadmap.delete(dept);
      unsaved.delete(dept);
      say("저장했습니다. 공개 사이트에는 '사이트 반영' 후 보입니다.");
    } catch (e) {
      say(`${dbErrorMessage(e)} — 저장되지 않았습니다.`, true);
    }
    button.disabled = false;
    draw();
  }

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
    const saveBtn = btn("저장", (e) => save(e.currentTarget), true);
    saveBtn.disabled = !unsaved.has(state.dept);
    const boxes = plan.map((step, i) => {
      const text = textOf(step);
      const msg = el("small", { className: "save-state" });
      const ai = btn("AI 요약", async () => {
        const fn = getServices().summarize;
        if (!fn) { msg.textContent = "AI 연결을 준비 중입니다"; msg.className = "save-state err"; return; }
        const src = step.ids.map((id) => { const s = subjects.find((x) => x.id === id); return `${s?.name ?? ""}: ${own(id) || s?.dept_curriculum || ""}`.trim(); }).join("\n");
        ai.disabled = true; msg.textContent = "AI 요약 중…"; msg.className = "save-state";
        try {
          step.summary = (await fn("roadmap", src)).text; step.dirty = false; touch();
          draw();
        } catch (e) { msg.textContent = e.message; msg.className = "save-state err"; ai.disabled = false; }
      }, true);
      ai.disabled = !needsText(step);
      const box = el("div", { className: "v3-step" }, [
        el("div", { className: "v3-stepsubs" }, [el("b", { textContent: `STEP ${i + 1}` }),
          ...(step.ids.length ? step.ids.map((id) => el("span", { className: "v3-tchip v3-stepsub" }, [el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("span", { className: "v2-grow", textContent: nameOfS(id) }),
            Object.assign(el("button", { type: "button", className: "v3-x", textContent: "−", title: `${nameOfS(id)} 빼기` }),
              { onclick: () => { step.ids = step.ids.filter((x) => x !== id); changed(step); draw(); } })]))
            : [el("small", { className: "muted", textContent: "여기에 과목을 놓으세요" })])]),
        el("div", { className: "v3-steptext" }, [
          el("b", { textContent: "로드맵 문구" }),
          el("p", { textContent: text || (step.ids.length > 1 ? `과목 ${step.ids.length}개의 문구를 요약해야 합니다.` : step.ids.length ? "로드맵 문구가 없습니다." : "왼쪽에서 과목을 끌어 놓으세요.") }),
          ...(needsText(step) ? [chip("문구 필요", "warn")] : []), msg]),
        el("div", { className: "v3-stepbtns" }, [
          btn("스텝 삭제", () => modal("스텝 삭제", [el("p", { textContent: `정말 STEP ${i + 1}${"013678".includes(String(i + 1).at(-1)) ? "을" : "를"} 삭제하시나요?` })], [["삭제", () => { plan.splice(i, 1); touch(); draw(); }]]).classList.add("v3-narrow")),
          ai,
        ]),
      ]);
      sortable([...box.querySelectorAll(".v3-stepsub")].map((n, j) => [n, step.ids[j]]), step.ids, (a) => { step.ids = a; touch(); draw(); });
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
    sortable(boxes.map((b, i) => [b, plan[i]]), [...plan], (a) => { plan.splice(0, plan.length, ...a); touch(); draw(); });
    body.replaceChildren(splitGrid(
      panel("과목", [list.length ? el("div", { className: "v2-boxlist" }, items) : empty("이 학과에 과목이 없습니다.")], "학과 관리 순서 · 끌어서 스텝에 놓기"),
      panel("로드맵 스텝", [
        boxes.length ? el("div", { className: "v2-boxlist v3-steplist" }, boxes) : empty("스텝이 없습니다. 아래 '+ 스텝 추가'를 누르세요."), // 과목 목록처럼 스텝 박스만 스크롤
        Object.assign(el("button", { type: "button", className: "v3-step v3-stepadd", textContent: "+ 스텝 추가" }), { onclick: () => { plan.push({ ids: [], from: null, dirty: true, summary: "" }); draw(); } }),
        el("div", { className: "v2-row v2-gap" }, [saveBtn, saveMsg]),
        hint("[저장]을 눌러야 로드맵이 저장됩니다(과목 없는 빈 스텝은 빠짐). 공개 사이트에는 '사이트 반영' 후 보입니다."),
      ], "위에서 아래로 한 박스가 한 스텝"),
    ));
  }
  const bar = contextBar(depts, draw);
  bar.querySelector(".v3-switch")?.remove(); // 정규·방특 버튼 없음
  // 학과 칸은 제목 오른쪽에(머리 자리가 없으면 화면 맨 위).
  if (ctx.headBar) ctx.headBar.replaceChildren(bar); else container.append(bar);
  container.append(body);
  draw();
}
