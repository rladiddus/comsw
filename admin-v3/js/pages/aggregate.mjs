import { el, rows, pick, chip, hint, btn, panel, empty, search, nameOf } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { applyCrop } from "../../../admin/js/image-crop.mjs";
import { LEVELS } from "../../../admin/js/pages/department-curriculum.mjs";
import { state, deptSubjects, contextBar, isEmployed, modal, sortable, addableSubjects, saveLocal, splitGrid, deleteSubject } from "../v3.mjs";

// 학과 관리(V3 시안 '학과 통합 커리큘럼', 정책 3·4·5·7): 과목 하나를 모든 학과가 같이 쓴다(2026-10-29 결정).
// 정규는 두 탭: [주차별 커리큘럼] 고른 과목의 단계별 문구(AI생성·직접 입력·저장)와 대표 이미지(그 단계 강사 이미지 중 고르기), 실제 저장
//              [과목별 커리큘럼] 학과 과목을 순서대로 표(과목명·기간·학과별 커리큘럼 요약·프로그램·준비물·학습 수준), 수정은 실제 저장(요약은 AI생성 2~4줄), 제외는 V3 학과 순서에서만.
// 방특은 탭 없이 주차별 화면에 통합 문구를 같이 둔다(과목별 표가 없어서).
// 왼쪽 과목 목록: 끌어서 순서, '+ 과목 추가'(검색 팝업), 과목마다 '강사'(넣을 강사 명단)·'삭제'. 처음 강사 = 이 과목 승인본이 있는 재직 강사.
// 바꾼 것은 '저장'을 눌러야 state.orders·state.picks로 옮겨 이 브라우저에 저장된다(DB 칸이 생기기 전까지).
export function sources(approved, sets, mode, subjectId) {
  return approved.filter((c) => c.subject_id === subjectId && Boolean(sets.find((s) => s.id === c.set_id)?.is_vacation) === (mode === "vacation"));
}

// 강사의 이 단계 행: 같은 단계 이름, 없으면 같은 자리(순서)의 단계
export function stepRows(rows, label, index) {
  const own = rows.filter((r) => r.step_label === label);
  if (own.length) return own;
  const at = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[index];
  return at ? [at] : [];
}
export const stepText = (rows, label, index) => stepRows(rows, label, index).map((r) => r.written).filter(Boolean).join("\n");

// AI에 보낼 글: 줄 수 지시 + 단계별 강사 원문. (서버의 학과 커리큘럼 지시는 '두 문장'이라 줄 수는 글 안에서 알려 준다)
export function aiRequest(name, n, parts) {
  const heads = Array.from({ length: n }, (_, i) => `0${i + 1}`).join(", ");
  return `이번에는 반드시 ${n}줄로 정리: 각 줄은 ${heads}로 시작하고 줄바꿈.\n\n${name} 커리큘럼\n${parts.join("\n\n")}`;
}

export const thumb = (url, alt) => url ? applyCrop(el("img", { className: "v3-weekimg", src: driveThumbnail(url), alt }), url) : el("div", { className: "v3-weekimg empty", textContent: "이미지 없음" });
const sayIn = (msg) => (t, err = false) => { msg.textContent = t; msg.className = `save-state${err ? " err" : ""}`; };

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, approved, idepts, sets, instructors, weeks] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, duration, dept_curriculum, tools, supplies, level"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, step_label, written, media_url, sort_order, vacation, updated_at", (q) => q.eq("status", "approved")),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "instructors", "id, name, sort_order"),
    pick(supabase, "subject_weeks", "id, subject_id, week_label, written, summary, image_url, sort_order"),
  ]);
  const data = { subjects, links, curricula: approved, idepts };
  const nameOfI = (id) => instructors.find((i) => i.id === id)?.name ?? "?";
  state.mode = "regular"; // 정규만(방특은 '방학 특강' 메뉴)
  const key = () => `${state.dept}:${state.mode}`; // 학과 순서 key
  const pk = (id) => `${id}|${state.mode}`; // 강사 명단 key
  const srcOf = (id) => sources(approved, sets, state.mode, id);
  let subjectId = location.hash.split("/")[2] ?? "";
  const body = el("div");
  // 저장 전 바꾼 것(과목 순서·추가·삭제, 강사 명단). '저장'을 누르면 state로 옮기고 이 브라우저에 저장한다.
  const dOrders = new Map(); // "학과id:mode" → [과목id]
  const dPicks = new Map(); // "과목id|mode" → [강사id]
  const listOf = () => dOrders.get(key())?.map((id) => subjects.find((s) => s.id === id)).filter(Boolean) ?? deptSubjects(state.dept, state.mode, data);
  const saveMsg = el("span", { className: "save-state" });
  const saveSay = sayIn(saveMsg);
  // 저장(2026-11-03): 학과 과목 넣기·빼기·순서는 DB에(기존 '학과별 과목'과 같은 함수·계산), 강사 명단은 아직 이 브라우저에.
  // 순서는 전체 하나(사이트 '전체 수업')라, 이 학과 과목이 있던 자리끼리만 새 순서로 바꾸고 다른 과목 자리는 그대로 둔다.
  async function saveDraft() {
    const p_add = [], p_remove = [];
    const order = new Map(subjects.map((s) => [s.id, s.sort_order ?? null]));
    let next = Math.max(-1, ...subjects.map((s) => s.sort_order ?? -1)) + 1;
    for (const [k, after] of dOrders) {
      const dept = k.split(":")[0];
      const before = deptSubjects(dept, "regular", data).map((s) => s.id);
      after.filter((id) => !before.includes(id)).forEach((id) => p_add.push({ subject_id: id, department_id: dept }));
      before.filter((id) => !after.includes(id)).forEach((id) => p_remove.push({ subject_id: id, department_id: dept }));
      for (const id of after) if (order.get(id) == null) order.set(id, next++); // 순서 없던 과목은 맨 뒤
      const slots = after.map((id) => order.get(id)).sort((a, b) => a - b);
      after.forEach((id, i) => order.set(id, slots[i]));
    }
    const moved = subjects.filter((s) => order.get(s.id) !== (s.sort_order ?? null));
    if (p_add.length || p_remove.length || moved.length) {
      const { error } = await supabase.rpc("comsw_save_subject_layout", { p_add, p_subjects: moved.map((s) => ({ id: s.id, sort_order: order.get(s.id) })), p_remove });
      if (error) return saveSay(`${dbErrorMessage(error)} — 저장되지 않았습니다.`, true);
      moved.forEach((s) => { s.sort_order = order.get(s.id); });
      links.push(...p_add);
      for (const r of p_remove) links.splice(links.findIndex((l) => l.subject_id === r.subject_id && l.department_id === r.department_id), 1);
    }
    dPicks.forEach((v, k) => state.picks.set(k, v));
    dOrders.clear(); dPicks.clear();
    saveLocal();
    saveSay("저장했습니다. 공개 사이트에는 '사이트 반영' 후 보입니다.");
    draw();
  }

  // 과목에 넣을 강사(순서대로). 처음 = 이 과목 승인본이 있는 재직 강사(강사 순서).
  const teachersOf = (id) => instructors.map((i) => i.id).filter((i) => srcOf(id).some((c) => c.instructor_id === i));
  const picks = (id) => dPicks.get(pk(id)) ?? state.picks.get(pk(id)) ?? teachersOf(id).filter(isEmployed);
  // 다시 만들기 필요: 강사 명단을 바꿨거나 퇴사 강사가 있는데, 지금 명단으로 아직 AI생성을 안 했을 때
  const stale = (id) => (dPicks.has(pk(id)) || state.picks.has(pk(id)) || teachersOf(id).some((i) => !isEmployed(i)))
    && state.made.get(pk(id)) !== picks(id).join(",");
  const deptsOf = (id) => links.filter((l) => l.subject_id === id).map((l) => depts.find((d) => d.id === l.department_id)?.name ?? "");

  const tabs = el("div", { className: "v2-tabs v3-aggtabs" }, [["weeks", "주차별 커리큘럼"], ["subjects", "과목별 커리큘럼"]].map(([k, t]) =>
    Object.assign(el("button", { type: "button", className: "v2-tab", textContent: t }), { onclick: () => { state.aggTab = k; draw(); } })));

  // 과목 통합 문구 AI생성 [AI생성] [2 3 4] 줄: 넣은 강사(순서대로)의 단계별 원문을 모아 n줄로 요약해 text에 넣는다.
  function aiControls(subject, text, say, onMade = () => {}) {
    const lineBtns = [2, 3, 4].map((n) => Object.assign(el("button", { type: "button", className: `v2-tab${state.aiLines === n ? " active" : ""}`, textContent: `${n}` }),
      { onclick: () => { state.aiLines = n; lineBtns.forEach((b, i) => b.classList.toggle("active", i + 2 === n)); } }));
    const gen = btn("AI생성", async () => {
      const fn = getServices().summarize;
      if (!fn) return say("AI 연결을 준비 중입니다", true);
      const src = srcOf(subject.id);
      const own = (id) => src.filter((c) => c.instructor_id === id);
      const chosen = picks(subject.id);
      const labels = [...new Set(chosen.flatMap((id) => own(id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => c.step_label)))];
      const parts = labels.map((label, i) => {
        const lines = chosen.map((id) => stepText(own(id), label, i).trim()).filter(Boolean);
        return lines.length ? `[${label}]\n${lines.map((t) => `- ${t}`).join("\n")}` : "";
      }).filter(Boolean);
      if (!parts.length) return say("넣은 강사의 커리큘럼이 없습니다. '주차별 커리큘럼' 왼쪽 '강사'에서 강사를 넣어주세요.", true);
      const ask = aiRequest(subject.name, state.aiLines, parts);
      if (ask.length > 12000) return say("커리큘럼이 너무 길어 한 번에 요약할 수 없습니다. 왼쪽 '강사'에서 강사를 줄여 주세요.", true);
      gen.disabled = true;
      say("AI 요약 중…");
      try {
        text.value = (await fn("department", ask)).text;
        state.made.set(pk(subject.id), chosen.join(",")); saveLocal(); onMade();
        say(`${state.aiLines}줄로 만들었습니다. 확인 후 '저장'을 눌러주세요.`);
      } catch (e) { say(e.message, true); }
      gen.disabled = false;
    }, true);
    return el("div", { className: "v2-row v2-gap v3-aicontrols" }, [gen, el("div", { className: "v2-tabs v3-lines", title: "요약 줄 수" }, lineBtns), el("small", { className: "muted", textContent: "줄" })]);
  }

  // 강사 팝업: 한 줄에 두 명, 이름 옆 '−'로 바로 빼기, [추가]는 더 넣을 강사가 있을 때만. '완료'로 반영, 왼쪽 '저장'으로 저장.
  function teacherPopup(subject) {
    let list = [...picks(subject.id)];
    let adding = false;
    const box = el("div");
    const addBtn = Object.assign(el("button", { type: "button", className: "ghost-btn", textContent: "추가" }), { onclick: () => { adding = !adding; drawList(); } });
    const drawList = () => {
      const addable = teachersOf(subject.id).filter((id) => !list.includes(id));
      if (!addable.length) adding = false;
      addBtn.disabled = !addable.length;
      const name = (id) => `${nameOfI(id)}${isEmployed(id) ? "" : " (퇴사)"}`;
      box.replaceChildren(
        list.length ? el("div", { className: "v3-tgrid" }, list.map((id) => el("div", { className: "v3-tchip" }, [el("b", { className: "v2-grow", textContent: name(id) }),
          Object.assign(el("button", { type: "button", className: "v3-x", textContent: "−", title: `${nameOfI(id)} 빼기` }), { onclick: () => { list = list.filter((x) => x !== id); drawList(); } })]))) : empty("넣은 강사가 없습니다."),
        ...(adding ? [el("p", { className: "v2-label", textContent: "추가할 강사" }), el("div", { className: "v3-tgrid" }, addable.map((id) =>
          Object.assign(el("button", { type: "button", className: "v3-tchip v3-tadd", textContent: `+ ${name(id)}` }), { onclick: () => { list.push(id); drawList(); } })))] : []),
      );
    };
    drawList();
    modal(`${subject.name} · 기여 강사`, [box], [addBtn, ["완료", () => { dPicks.set(pk(subject.id), list); draw(); }]]).classList.add("v3-narrow");
  }

  // 대표 이미지 팝업: 그 단계에서 넣은 강사(강사 팝업 명단)의 이미지 중 고르면 사이트 단계 이미지로 저장
  function imagePopup(subject, week, index) {
    const src = srcOf(subject.id);
    const cands = picks(subject.id).flatMap((id) => stepRows(src.filter((c) => c.instructor_id === id), week.week_label, index)).filter((c) => c.media_url);
    const msg = el("p", { className: "save-state" });
    const d = modal(`${subject.name} · ${week.week_label} 대표 이미지`, [
      cands.length ? el("div", { className: "v3-imggrid" }, cands.map((c) => Object.assign(el("button", { type: "button", className: `v3-imgpick${c.media_url === week.image_url ? " active" : ""}`, title: "이 이미지로" },
        [thumb(c.media_url, `${nameOfI(c.instructor_id)} ${c.step_label}`), el("small", { textContent: `${nameOfI(c.instructor_id)} · ${c.step_label}` })]), {
        onclick: async () => {
          const { error } = await supabase.from("subject_weeks").update({ image_url: c.media_url }).eq("id", week.id);
          if (error) return sayIn(msg)(dbErrorMessage(error), true);
          week.image_url = c.media_url;
          d.close?.(); d.remove();
          draw();
        },
      }))) : empty("이 단계에 넣은 강사의 이미지가 없습니다."),
      msg,
    ], []);
  }

  // 단계 카드: 대표 이미지 + 사이트 문구(AI생성 또는 직접 입력 → 저장)
  function weekCard(subject, w, i) {
    const text = el("textarea", { className: "v2-textarea", rows: 3, value: w.summary || "", placeholder: w.written || "사이트에 나올 단계 문구" });
    const msg = el("p", { className: "save-state" });
    const say = sayIn(msg);
    const gen = btn("AI생성", async () => {
      const fn = getServices().summarize;
      if (!fn) return say("AI 연결을 준비 중입니다", true);
      const src = srcOf(subject.id);
      const raw = picks(subject.id).map((id) => stepText(src.filter((c) => c.instructor_id === id), w.week_label, i).trim()).filter(Boolean).join("\n") || w.written || "";
      if (!raw) return say("이 단계에 넣은 강사의 원문이 없습니다.", true);
      gen.disabled = true;
      say("AI 요약 중…");
      try {
        text.value = (await fn("week", raw)).text;
        say("만들었습니다. 확인 후 '저장'을 눌러주세요.");
      } catch (e) { say(e.message, true); }
      gen.disabled = false;
    }, true);
    const save = btn("저장", async () => {
      save.disabled = true;
      const { error } = await supabase.from("subject_weeks").update({ summary: text.value.trim() || null }).eq("id", w.id);
      save.disabled = false;
      if (error) return say(dbErrorMessage(error), true);
      w.summary = text.value.trim();
      say("저장했습니다. 공개 사이트에는 '사이트 반영' 후 보입니다.");
    });
    return el("div", { className: "v2-mini-card v3-week" }, [
      thumb(w.image_url, `${w.week_label} 대표 이미지`),
      el("div", { className: "v2-grow" }, [el("b", { textContent: w.week_label }), text, msg]),
      el("div", { className: "v3-weekbtns" }, [btn("대표 이미지 수정", () => imagePopup(subject, w, i)), gen, save]),
    ]);
  }

  // 과목 추가 팝업: 위에 검색, 아래 목록. '추가'로 고르고 '완료'를 누르면 목록 끝에 붙는다('저장' 전까지는 저장 안 됨).
  function addPopup(ids, setOrder) {
    const rest = addableSubjects(subjects, ids, state.mode);
    const chosen = [];
    const q = search("과목 검색");
    const found = el("div", { className: "v3-scroll v3-addlist" });
    const fill = () => {
      const word = q.value.trim().toLowerCase();
      const hit = rest.filter((s) => s.name.toLowerCase().includes(word));
      found.replaceChildren(...(hit.length ? hit.map((s) => {
        const on = chosen.includes(s.id);
        return el("div", { className: "v2-row v2-gap" }, [el("span", { className: "v2-grow", textContent: s.name }), ...(s.is_vacation ? [chip("방특", "vacation")] : []),
          Object.assign(el("button", { type: "button", className: on ? "publish-btn" : "ghost-btn", textContent: on ? "선택됨" : "추가" }),
            { onclick: () => { if (on) chosen.splice(chosen.indexOf(s.id), 1); else chosen.push(s.id); fill(); } })]);
      }) : [empty(rest.length ? "검색한 과목이 없습니다." : "더 넣을 과목이 없습니다.")]));
    };
    q.addEventListener("input", fill);
    fill();
    modal("과목 추가", [q, found], [["완료", () => { if (chosen.length) setOrder([...ids, ...chosen]); }]]).classList.add("v3-narrow");
    q.focus?.();
  }

  // 왼쪽 과목 목록: 늘 끌어서 순서, 과목마다 [강사][삭제], 위에 [+ 과목 추가][저장](바꾼 것이 있을 때만 켜짐).
  function subjectList(list) {
    const ids = list.map((s) => s.id);
    const setOrder = (a) => { dOrders.set(key(), a); draw(); };
    const items = list.map((s, i) => Object.assign(el("div", { className: `v2-listitem${s.id === subjectId ? " active" : ""}` }, [
      el("div", { className: "v2-row" }, [el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("b", { className: "v2-grow", textContent: `${i + 1}. ${s.name}` })]),
      el("div", { className: "v2-row" }, [el("small", { className: "v2-grow", textContent: `통합 강사 ${picks(s.id).length}명` }),
        btn("강사", (e) => { e.stopPropagation(); teacherPopup(s); }),
        btn("삭제", (e) => { e.stopPropagation(); setOrder(ids.filter((x) => x !== s.id)); })]),
    ]), { onclick: () => { subjectId = s.id; draw(); } }));
    sortable(items.map((r, i) => [r, ids[i]]), ids, setOrder);
    const save = btn("저장", async () => { save.disabled = true; await saveDraft(); }, true);
    save.disabled = !dOrders.size && !dPicks.size;
    return panel("과목", [list.length ? el("div", { className: "v2-boxlist" }, items) : empty("이 학과에 과목이 없습니다."), saveMsg],
      "끌어서 순서를 바꿉니다", [btn("+ 과목 추가", () => addPopup(ids, setOrder)), save]);
  }

  function weeksView(list) {
    if (!list.some((s) => s.id === subjectId)) subjectId = list[0]?.id ?? "";
    const subject = subjects.find((s) => s.id === subjectId);
    const myWeeks = weeks.filter((w) => w.subject_id === subjectId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const shared = deptsOf(subjectId);

    return splitGrid(subjectList(list), panel(`주차별 커리큘럼 · ${subject?.name ?? ""}`, subject ? [
        ...(myWeeks.length ? myWeeks.map((w, i) => weekCard(subject, w, i)) : [empty("이 과목은 사이트 단계가 없습니다. 운영 관리 화면의 '학과 커리큘럼 > 단계'에서 만듭니다.")]),
        ...(shared.length > 1 ? [hint(`이 과목을 쓰는 ${shared.length}개 학과(${shared.join(", ")})에 같은 단계가 나옵니다. 고치면 모두 같이 바뀝니다.`)] : []),
      ] : [empty("과목을 고르세요.")], "사이트 '전체 수업'의 단계"));
  }

  // 과목 삭제: 쓰이는 곳 개수를 확인받고 지운다(과목 관리 › 과목 정리와 같음).
  async function removeSubject(s, button, say) {
    button.disabled = true;
    try {
      if (!(await deleteSubject(supabase, s))) return;
    } catch (e) { return say(e.message, true); } finally { button.disabled = false; }
    subjects.splice(subjects.indexOf(s), 1);
    for (let i = links.length - 1; i >= 0; i--) if (links[i].subject_id === s.id) links.splice(i, 1);
    dOrders.forEach((v, k) => dOrders.set(k, v.filter((id) => id !== s.id)));
    say(`'${s.name}' 과목을 삭제했습니다. 공개 사이트에서는 '사이트 반영' 후 빠집니다.`);
    draw();
  }

  // 과목별 커리큘럼: 기존 '학과 커리큘럼' 표 모양. 수정 → 저장(실제), 제외 → 학과 순서에서 바로 뺌(이 브라우저에 저장)
  function subjectsView(list) {
    const ids = list.map((s) => s.id);
    const msg = el("p", { className: "save-state" });
    const say = sayIn(msg);
    const rowOf = (s, i) => {
      let on = false;
      const f = {
        name: el("input", { type: "text", value: s.name ?? "", placeholder: "과목명" }),
        duration: el("input", { type: "text", value: s.duration ?? "", placeholder: "기간" }),
        dept_curriculum: el("textarea", { rows: 3, value: s.dept_curriculum ?? "", placeholder: "학과별 커리큘럼 요약" }),
        tools: el("textarea", { rows: 3, value: s.tools ?? "", placeholder: "프로그램" }),
        supplies: el("textarea", { rows: 3, value: s.supplies ?? "", placeholder: "준비물" }),
        level: el("select", {}, [el("option", { value: "", textContent: "선택 안 함" }), ...[...new Set([...LEVELS, ...(s.level ? [s.level] : [])])].map((v) => el("option", { value: v, textContent: v }))]),
      };
      f.level.value = s.level ?? "";
      const staleChip = stale(s.id) ? chip("다시 만들기 필요", "warn") : null;
      const ai = aiControls(s, f.dept_curriculum, say, () => staleChip?.remove());
      const lock = () => { ai.hidden = !on; Object.values(f).forEach((x) => { if (x.tagName === "SELECT") x.disabled = !on; else x.readOnly = !on; }); };
      lock();
      const toggle = btn("수정", async () => {
        if (!on) { on = true; toggle.textContent = "저장"; lock(); return; }
        const patch = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, k === "name" ? x.value.trim() : x.value.trim() || null]));
        if (!patch.name) return say("과목명을 입력해주세요", true);
        toggle.disabled = true;
        const { error } = await supabase.from("subjects").update(patch).eq("id", s.id);
        toggle.disabled = false;
        if (error) return say(dbErrorMessage(error, { duplicate: "같은 이름의 과목이 있습니다" }), true);
        Object.assign(s, patch);
        on = false; toggle.textContent = "수정"; lock();
        say(`'${s.name}'을(를) 저장했습니다. 이 과목을 쓰는 모든 학과에 같이 반영되고, 공개 사이트에는 '사이트 반영' 후 보입니다.`);
      });
      const cell = (k, label, extra = []) => el("div", { className: `dept-cell cell-${k}` }, [el("span", { className: "cell-label", textContent: label }), ...extra, f[k]]);
      return el("div", { className: "dept-curriculum-row" }, [
        el("span", { className: "v2-num", textContent: `${i + 1}` }),
        cell("name", "과목명"), cell("duration", "기간"),
        cell("dept_curriculum", "학과별 커리큘럼 요약", [...(staleChip ? [staleChip] : []), ai]),
        cell("tools", "프로그램"), cell("supplies", "준비물"), cell("level", "학습 수준"),
        el("div", { className: "dept-cell cell-actions" }, [
          btn("제외", () => { if (!confirm(`'${s.name}'을(를) 이 학과에서 뺄까요? 과목은 남습니다.`)) return; dOrders.set(key(), ids.filter((x) => x !== s.id)); saveDraft(); }),
          btn("과목 삭제", (e) => removeSubject(s, e.currentTarget, say)),
          toggle,
        ]),
      ]);
    };
    return panel("과목별 커리큘럼", [
      el("div", { className: "dept-curriculum-row v3-headrow" }, ["", "과목명", "기간", "학과별 커리큘럼 요약", "프로그램", "준비물", "학습 수준", ""].map((t) => el("b", { textContent: t }))),
      ...(list.length ? list.map(rowOf) : [empty("이 학과에 과목이 없습니다.")]),
      msg,
      hint("순서는 '주차별 커리큘럼' 왼쪽 과목 목록에서 정한 순서입니다. '수정' 후 '저장'은 실제 저장(과목 공통이라 쓰는 모든 학과에 같이 반영). '수정' 중에는 요약을 AI생성(2~4줄)할 수 있습니다. 강사 명단·순서는 '주차별 커리큘럼' 왼쪽 '강사'에서 정합니다. '제외'는 이 학과에서 바로 빠지고(과목은 남음), '과목 삭제'는 과목 자체를 지웁니다."),
    ], "왼쪽 과목 순서대로");
  }

  function draw() {
    [...tabs.children].forEach((b, i) => b.classList.toggle("active", (i === 0) === (state.aggTab === "weeks")));
    const list = listOf();
    body.replaceChildren(state.aggTab === "subjects" ? subjectsView(list) : weeksView(list));
  }
  // 학과 칸과 주차별/과목별 탭은 제목 오른쪽에(머리 자리가 없으면 화면 맨 위). 정규·방특 버튼 없음.
  const filter = contextBar(depts, draw, [tabs]);
  filter.querySelector(".v3-switch")?.remove();
  if (ctx.headBar) ctx.headBar.replaceChildren(filter); else container.append(filter);
  container.append(body);
  draw();
}
