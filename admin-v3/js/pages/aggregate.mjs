import { el, rows, pick, chip, hint, btn, panel, empty, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { state, deptSubjects, contextBar, typeChip, isEmployed } from "../v3.mjs";

// 과목 통합 커리큘럼(V3 시안 '학과 통합 커리큘럼', 정책 3·4·5·7): 과목 하나를 모든 학과가 같이 쓴다(2026-10-29 결정).
// 출처 = 이 과목의 재직 강사 승인본 전부(어느 학과 묶음으로 냈든). 통합 문구(subjects.dept_curriculum)도 과목에 하나, 모든 학과에 같이 나온다.
// 단계마다 넣을 강사를 빼고 더할 수 있고(state.picks, 저장 안 됨), 'AI생성'은 명단에 든 강사 원문을 모아 2~4줄(01~04)로 요약한다. 문구 '저장'은 실제 저장.
export function sources(approved, sets, mode, subjectId) {
  return approved.filter((c) => c.subject_id === subjectId && Boolean(sets.find((s) => s.id === c.set_id)?.is_vacation) === (mode === "vacation"));
}

// 강사의 이 단계 원문: 같은 단계 이름, 없으면 같은 자리(순서)의 단계
export function stepText(rows, label, index) {
  const own = rows.filter((r) => r.step_label === label);
  if (own.length) return own.map((r) => r.written).join("\n");
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[index]?.written ?? "";
}

// AI에 보낼 글: 줄 수 지시 + 단계별 강사 원문. (서버의 학과 커리큘럼 지시는 '두 문장'이라 줄 수는 글 안에서 알려 준다)
export function aiRequest(name, n, parts) {
  const heads = Array.from({ length: n }, (_, i) => `0${i + 1}`).join(", ");
  return `이번에는 반드시 ${n}줄로 정리: 각 줄은 ${heads}로 시작하고 줄바꿈.\n\n${name} 커리큘럼\n${parts.join("\n\n")}`;
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, approved, idepts, sets, instructors] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, dept_curriculum"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, step_label, written, sort_order, vacation, updated_at", (q) => q.eq("status", "approved")),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "instructors", "id, name"),
  ]);
  const edit = editor("과목 통합 커리큘럼 고치기 (기존 '학과 커리큘럼' 화면)", () => import("../../../admin/js/pages/department-curriculum.mjs"), ctx);
  headActions(ctx, btn("고치기", edit.open, true));
  const data = { subjects, links, curricula: approved, idepts };
  const nameOfI = (id) => instructors.find((i) => i.id === id)?.name ?? "?";
  let subjectId = location.hash.split("/")[2] ?? "";
  let editing = new Set(); // '수정'을 누른 단계
  const body = el("div");

  function draw() {
    const list = deptSubjects(state.dept, state.mode, data);
    if (!list.some((s) => s.id === subjectId)) subjectId = list[0]?.id ?? "";
    const subject = subjects.find((s) => s.id === subjectId);
    const src = sources(approved, sets, state.mode, subjectId);
    const teachers = [...new Set(src.map((c) => c.instructor_id))];
    const active = teachers.filter(isEmployed);
    const steps = [...new Set(src.filter((c) => isEmployed(c.instructor_id)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => c.step_label))];
    // 단계 → 넣을 강사(처음 = 그 단계를 쓴 재직 강사)
    const pickKey = (label) => `${subjectId}|${state.mode}|${label}`;
    const changed = steps.some((label) => state.picks.has(pickKey(label)));
    const picks = (label) => state.picks.get(pickKey(label))
      ?? new Set(src.filter((c) => c.step_label === label && isEmployed(c.instructor_id)).map((c) => c.instructor_id));
    const setPicks = (label, set) => { state.picks.set(pickKey(label), set); draw(); };
    const stale = active.length !== teachers.length || changed;
    const sharedDepts = links.filter((l) => l.subject_id === subjectId);

    const text = el("textarea", { className: "v2-textarea", value: subject?.dept_curriculum || "", rows: 4 });
    const msg = el("p", { className: "save-state" });
    const say = (t, err = false) => { msg.textContent = t; msg.className = `save-state${err ? " err" : ""}`; };
    const lineBtns = [2, 3, 4].map((n) => Object.assign(el("button", { type: "button", className: `v2-tab${state.aiLines === n ? " active" : ""}`, textContent: `${n}` }),
      { onclick: () => { state.aiLines = n; lineBtns.forEach((b, i) => b.classList.toggle("active", i + 2 === n)); } }));
    const gen = btn("AI생성", async () => {
      const fn = getServices().summarize;
      if (!fn) return say("AI 연결을 준비 중입니다", true);
      const parts = steps.map((label, i) => {
        const lines = [...picks(label)].map((id) => stepText(src.filter((c) => c.instructor_id === id), label, i).trim()).filter(Boolean);
        return lines.length ? `[${label}]\n${lines.map((t) => `- ${t}`).join("\n")}` : "";
      }).filter(Boolean);
      if (!parts.length) return say("명단에 든 강사의 커리큘럼이 없습니다.", true);
      const ask = aiRequest(subject.name, state.aiLines, parts);
      if (ask.length > 12000) return say("커리큘럼이 너무 길어 한 번에 요약할 수 없습니다. 단계에서 강사를 줄여 주세요.", true);
      gen.disabled = true;
      say("AI 요약 중…");
      try {
        text.value = (await fn("department", ask)).text;
        say(`${state.aiLines}줄로 만들었습니다. 확인 후 '저장'을 눌러주세요.`);
      } catch (e) { say(e.message, true); }
      gen.disabled = false;
    }, true);
    const save = btn("저장", async () => {
      save.disabled = true;
      const { error } = await supabase.from("subjects").update({ dept_curriculum: text.value.trim() || null }).eq("id", subjectId);
      save.disabled = false;
      if (error) return say(dbErrorMessage(error), true);
      subject.dept_curriculum = text.value.trim();
      say(`저장했습니다. 이 과목을 쓰는 학과 ${sharedDepts.length}곳에 같이 나오고, 공개 사이트에는 '사이트 반영' 후 보입니다.`);
    });

    const stepBox = (label) => {
      const on = editing.has(label);
      const chosen = picks(label);
      const addable = teachers.filter((id) => !chosen.has(id));
      const add = el("select", {}, [el("option", { value: "", textContent: "+ 강사 추가" }),
        ...addable.map((id) => el("option", { value: id, textContent: `${nameOfI(id)}${isEmployed(id) ? "" : " (퇴사)"}` }))]);
      add.setAttribute("aria-label", `${label} 강사 추가`);
      add.addEventListener("change", () => add.value && setPicks(label, new Set([...chosen, add.value])));
      return el("div", { className: "v2-mini-card" }, [
        el("div", { className: "v2-row" }, [el("b", { className: "v2-grow", textContent: label }),
          btn(on ? "완료" : "수정", () => { on ? editing.delete(label) : editing.add(label); draw(); })]),
        el("div", { className: "v2-row v2-gap" }, [
          ...[...chosen].map((id) => el("span", { className: "v2-chip vacation" }, [document.createTextNode(nameOfI(id)),
            ...(on ? [Object.assign(el("button", { type: "button", className: "v3-x", textContent: "×", title: `${nameOfI(id)} 빼기` }),
              { onclick: () => setPicks(label, new Set([...chosen].filter((x) => x !== id))) })] : [])])),
          ...(chosen.size ? [] : [el("small", { className: "muted", textContent: "넣은 강사가 없습니다" })]),
          ...(on && addable.length ? [add] : []),
        ]),
      ]);
    };

    body.replaceChildren(el("div", { className: "v3-grid39" }, [
      panel("과목", list.length ? [el("div", { className: "v2-boxlist" }, list.map((s, i) => Object.assign(el("div", { className: `v2-listitem${s.id === subjectId ? " active" : ""}` }, [
        el("b", { textContent: `${i + 1}. ${s.name}` }), el("small", { textContent: `승인 강사 ${new Set(sources(approved, sets, state.mode, s.id).map((c) => c.instructor_id)).size}명` }),
      ]), { onclick: () => { subjectId = s.id; editing = new Set(); draw(); } })))] : [empty("이 학과·유형에 과목이 없습니다.")], "학과별 과목 순서대로"),
      panel(`과목 통합본 · ${subject?.name ?? ""}`, subject ? [
        el("div", { className: "v2-row v2-gap" }, [chip(!active.length ? "출처 없음 · 검토 필요" : stale ? "다시 만들기 필요" : "출처 확인", !active.length ? "red" : stale ? "warn" : "good"), typeChip(subject)]),
        el("div", { className: "v2-row v2-gap" }, [el("p", { className: "v2-label v2-grow", textContent: "과목 통합 커리큘럼 문구" }),
          gen, el("div", { className: "v2-tabs v3-lines", title: "요약 줄 수" }, lineBtns), el("small", { className: "muted", textContent: "줄" })]),
        text,
        el("div", { className: "v2-actions v2-end" }, [save]), msg,
        ...(sharedDepts.length > 1 ? [hint(`이 과목을 쓰는 ${sharedDepts.length}개 학과(${sharedDepts.map((l) => depts.find((d) => d.id === l.department_id)?.name ?? "").join(", ")})에 같은 문구가 나옵니다. 고치면 모두 같이 바뀝니다.`)] : []),
        el("p", { className: "v2-label", textContent: `통합할 단계 (재직 강사 승인본 ${active.length}명)` }),
        ...(steps.length ? steps.map(stepBox) : [empty("통합할 승인본이 없습니다. 빈 문구를 자동으로 공개하지 않습니다.")]),
        hint("단계의 강사 빼기·추가는 이 화면에서만 기억합니다(저장 안 됨, 새로고침하면 처음 명단). 'AI생성'은 지금 명단으로 요약합니다."),
        el("div", { className: "v2-actions v2-end" }, [btn("로드맵 보기", () => { location.hash = "#/roadmap"; })]),
      ] : [empty("과목을 고르세요.")]),
    ]));
  }
  container.append(contextBar(depts, draw), body, edit.node);
  draw();
}
