import { el, rows, pick, chip, hint, btn, panel, empty, editor, headActions, search } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { applyCrop } from "../../../admin/js/image-crop.mjs";
import { LEVELS } from "../../../admin/js/pages/department-curriculum.mjs";
import { state, deptSubjects, contextBar, typeChip, isEmployed, modal, sortable } from "../v3.mjs";

// 과목 통합 커리큘럼(V3 시안 '학과 통합 커리큘럼', 정책 3·4·5·7): 과목 하나를 모든 학과가 같이 쓴다(2026-10-29 결정).
// 정규는 두 탭: [주차별 커리큘럼] 고른 과목의 단계별 문구(AI생성·직접 입력·저장)와 대표 이미지(그 단계 강사 이미지 중 고르기), 실제 저장
//              [과목별 커리큘럼] 학과 과목을 순서대로 표(과목명·기간·학과별 커리큘럼 요약·프로그램·준비물·학습 수준), 수정은 실제 저장(요약은 AI생성 2~4줄), 제외는 V3 학과 순서에서만.
// 방특은 탭 없이 주차별 화면에 통합 문구를 같이 둔다(과목별 표가 없어서).
// 과목마다 넣을 강사(순서 포함)는 왼쪽 '강사' 팝업에서 고친다(state.picks, 저장 안 됨). 처음 = 이 과목 승인본이 있는 재직 강사.
// 왼쪽 과목 목록의 '수정'은 V3 학과 순서(state.orders, 저장 안 됨)를 바꾼다: 끌어서 순서, '+ 과목 추가'(검색).
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

const thumb = (url, alt) => url ? applyCrop(el("img", { className: "v3-weekimg", src: driveThumbnail(url), alt }), url) : el("div", { className: "v3-weekimg empty", textContent: "이미지 없음" });
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
  const edit = editor("과목 통합 커리큘럼 고치기 (기존 '학과 커리큘럼' 화면)", () => import("../../../admin/js/pages/department-curriculum.mjs"), ctx);
  headActions(ctx, btn("고치기", edit.open, true));
  const data = { subjects, links, curricula: approved, idepts };
  const nameOfI = (id) => instructors.find((i) => i.id === id)?.name ?? "?";
  const key = () => `${state.dept}:${state.mode}`;
  let subjectId = location.hash.split("/")[2] ?? "";
  let listEditing = false;
  let adding = false;
  const body = el("div");

  // 과목에 넣을 강사(순서대로). 처음 = 이 과목 승인본이 있는 재직 강사(강사 순서).
  const teachersOf = (id) => instructors.map((i) => i.id).filter((i) => sources(approved, sets, state.mode, id).some((c) => c.instructor_id === i));
  const picks = (id) => state.picks.get(`${id}|${state.mode}`) ?? teachersOf(id).filter(isEmployed);
  const stale = (id) => state.picks.has(`${id}|${state.mode}`) || teachersOf(id).some((i) => !isEmployed(i));
  const deptsOf = (id) => links.filter((l) => l.subject_id === id).map((l) => depts.find((d) => d.id === l.department_id)?.name ?? "");

  const tabs = el("div", { className: "v2-tabs v3-aggtabs" }, [["weeks", "주차별 커리큘럼"], ["subjects", "과목별 커리큘럼"]].map(([k, t]) =>
    Object.assign(el("button", { type: "button", className: "v2-tab", textContent: t }), { onclick: () => { state.aggTab = k; draw(); } })));

  // 과목 통합 문구 AI생성 [AI생성] [2 3 4] 줄: 넣은 강사(순서대로)의 단계별 원문을 모아 n줄로 요약해 text에 넣는다.
  function aiControls(subject, text, say) {
    const lineBtns = [2, 3, 4].map((n) => Object.assign(el("button", { type: "button", className: `v2-tab${state.aiLines === n ? " active" : ""}`, textContent: `${n}` }),
      { onclick: () => { state.aiLines = n; lineBtns.forEach((b, i) => b.classList.toggle("active", i + 2 === n)); } }));
    const gen = btn("AI생성", async () => {
      const fn = getServices().summarize;
      if (!fn) return say("AI 연결을 준비 중입니다", true);
      const src = sources(approved, sets, state.mode, subject.id);
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
        say(`${state.aiLines}줄로 만들었습니다. 확인 후 '저장'을 눌러주세요.`);
      } catch (e) { say(e.message, true); }
      gen.disabled = false;
    }, true);
    return el("div", { className: "v2-row v2-gap v3-aicontrols" }, [gen, el("div", { className: "v2-tabs v3-lines", title: "요약 줄 수" }, lineBtns), el("small", { className: "muted", textContent: "줄" })]);
  }

  // 강사 팝업: 목록(끌어서 순서), '수정'이면 × 로 빼기, '추가'로 넣기. '완료'를 눌러야 반영.
  function teacherPopup(subject) {
    let list = [...picks(subject.id)];
    let editing = false;
    const box = el("div");
    const drawList = () => {
      const addable = teachersOf(subject.id).filter((id) => !list.includes(id));
      const add = el("select", {}, [el("option", { value: "", textContent: "+ 강사 추가" }), ...addable.map((id) => el("option", { value: id, textContent: `${nameOfI(id)}${isEmployed(id) ? "" : " (퇴사)"}` }))]);
      add.setAttribute("aria-label", "강사 추가");
      add.addEventListener("change", () => { if (add.value) { list.push(add.value); drawList(); } });
      const rowsEl = list.map((id, i) => el("div", { className: "v3-orderrow" }, [el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("span", { className: "v2-num", textContent: `${i + 1}` }),
        el("b", { className: "v2-grow", textContent: nameOfI(id) }), ...(isEmployed(id) ? [] : [chip("퇴사", "red")]),
        ...(editing ? [Object.assign(el("button", { type: "button", className: "v3-x", textContent: "×", title: `${nameOfI(id)} 빼기` }), { onclick: () => { list = list.filter((x) => x !== id); drawList(); } })] : [])]));
      sortable(rowsEl.map((r, i) => [r, list[i]]), list, (a) => { list = a; drawList(); });
      box.replaceChildren(
        el("div", { className: "v2-row v2-gap" }, [
          btn(editing ? "수정 끝" : "수정", () => { editing = !editing; drawList(); }),
          ...(addable.length ? [add] : [el("small", { className: "muted", textContent: "더 넣을 강사가 없습니다" })]),
        ]),
        ...(rowsEl.length ? rowsEl : [empty("넣은 강사가 없습니다.")]),
      );
    };
    drawList();
    modal(`${subject.name} · 기여 강사`, [el("p", { className: "muted", textContent: "이 과목 통합 커리큘럼에 들어가는 강사입니다. 끌어서 순서를 바꿉니다. 화면에서만 기억합니다(저장 안 됨)." }), box],
      [["완료", () => { state.picks.set(`${subject.id}|${state.mode}`, list); draw(); }]]);
  }

  // 대표 이미지 팝업: 그 단계의 강사 이미지 중 고르면 사이트 단계 이미지로 저장
  function imagePopup(subject, week, index) {
    const src = sources(approved, sets, state.mode, subject.id);
    const cands = teachersOf(subject.id).flatMap((id) => stepRows(src.filter((c) => c.instructor_id === id), week.week_label, index)).filter((c) => c.media_url);
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
      }))) : empty("이 단계에 강사가 올린 이미지가 없습니다."),
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
      const src = sources(approved, sets, state.mode, subject.id);
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

  // 왼쪽 과목 목록. '수정'이면 끌어서 순서, '+ 과목 추가'(검색). 바꾼 순서는 V3 학과 순서(저장 안 됨).
  function subjectList(list) {
    const ids = list.map((s) => s.id);
    const setOrder = (a) => { state.orders.set(key(), a); draw(); };
    const items = list.map((s, i) => Object.assign(el("div", { className: `v2-listitem${s.id === subjectId ? " active" : ""}` }, [
      el("div", { className: "v2-row" }, [...(listEditing ? [el("span", { className: "v3-handle", textContent: "⋮⋮" })] : []), el("b", { className: "v2-grow", textContent: `${i + 1}. ${s.name}` }),
        btn("강사", (e) => { e.stopPropagation(); teacherPopup(s); })]),
      el("small", { textContent: `통합 강사 ${picks(s.id).length}명` }),
    ]), { onclick: () => { subjectId = s.id; draw(); } }));
    if (listEditing) sortable(items.map((r, i) => [r, ids[i]]), ids, setOrder);
    const top = [];
    if (listEditing) {
      top.push(btn(adding ? "추가 닫기" : "+ 과목 추가", () => { adding = !adding; draw(); }));
      if (adding) {
        const q = search("과목 검색");
        const found = el("div", { className: "v3-scroll v3-addlist" });
        const rest = subjects.filter((s) => Boolean(s.is_vacation) === (state.mode === "vacation") && !ids.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
        const fill = () => {
          const word = q.value.trim().toLowerCase();
          const hit = rest.filter((s) => s.name.toLowerCase().includes(word));
          found.replaceChildren(...(hit.length ? hit.map((s) => el("div", { className: "v2-row v2-gap" }, [el("span", { className: "v2-grow", textContent: s.name }), btn("추가", () => setOrder([...ids, s.id]))]))
            : [empty(rest.length ? "검색한 과목이 없습니다." : "더 넣을 과목이 없습니다.")]));
        };
        q.addEventListener("input", fill);
        fill();
        top.push(q, found);
      }
      top.push(el("small", { className: "muted", textContent: "끌어서 순서를 바꿉니다(화면에서만, 저장 안 됨)." }));
    }
    return panel("과목", [...top, list.length ? el("div", { className: "v2-boxlist" }, items) : empty("이 학과·유형에 과목이 없습니다.")], "학과별 과목 순서대로",
      [btn(listEditing ? "수정 끝" : "수정", () => { listEditing = !listEditing; adding = false; draw(); })]);
  }

  function weeksView(list) {
    if (!list.some((s) => s.id === subjectId)) subjectId = list[0]?.id ?? "";
    const subject = subjects.find((s) => s.id === subjectId);
    const chosen = picks(subjectId);
    const myWeeks = weeks.filter((w) => w.subject_id === subjectId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const shared = deptsOf(subjectId);

    // 방특만: 통합 문구(정규는 '과목별 커리큘럼' 탭의 '학과별 커리큘럼 요약'에서 고친다)
    const merged = [];
    if (subject && state.mode === "vacation") {
      const text = el("textarea", { className: "v2-textarea", value: subject.dept_curriculum || "", rows: 4 });
      const msg = el("p", { className: "save-state" });
      const say = sayIn(msg);
      const save = btn("저장", async () => {
        save.disabled = true;
        const { error } = await supabase.from("subjects").update({ dept_curriculum: text.value.trim() || null }).eq("id", subjectId);
        save.disabled = false;
        if (error) return say(dbErrorMessage(error), true);
        subject.dept_curriculum = text.value.trim();
        say("저장했습니다. 공개 사이트에는 '사이트 반영' 후 보입니다.");
      });
      merged.push(el("div", { className: "v2-row v2-gap" }, [el("p", { className: "v2-label v2-grow", textContent: "과목 통합 커리큘럼 문구" }), aiControls(subject, text, say)]),
        text, el("div", { className: "v2-actions v2-end" }, [save]), msg);
    }

    return el("div", { className: "v3-gridagg" }, [
      subjectList(list),
      panel(`주차별 커리큘럼 · ${subject?.name ?? ""}`, subject ? [
        el("div", { className: "v2-row v2-gap" }, [...(stale(subjectId) ? [chip("다시 만들기 필요", "warn")] : []), typeChip(subject),
          el("small", { className: "muted", textContent: `통합 강사: ${chosen.map(nameOfI).join(", ") || "없음"}` })]),
        ...merged,
        ...(myWeeks.length ? myWeeks.map((w, i) => weekCard(subject, w, i)) : [empty("이 과목은 사이트 단계가 없습니다. '고치기'(기존 학과 커리큘럼 > 단계)에서 만듭니다.")]),
        ...(shared.length > 1 ? [hint(`이 과목을 쓰는 ${shared.length}개 학과(${shared.join(", ")})에 같은 단계가 나옵니다. 고치면 모두 같이 바뀝니다.`)] : []),
      ] : [empty("과목을 고르세요.")], "사이트 '전체 수업'의 단계"),
    ]);
  }

  // 과목별 커리큘럼: 기존 '학과 커리큘럼' 표 모양. 수정 → 저장(실제), 제외 → V3 학과 순서에서 뺌(저장 안 됨)
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
      const ai = aiControls(s, f.dept_curriculum, say);
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
        cell("dept_curriculum", "학과별 커리큘럼 요약", [...(stale(s.id) ? [chip("다시 만들기 필요", "warn")] : []), ai]),
        cell("tools", "프로그램"), cell("supplies", "준비물"), cell("level", "학습 수준"),
        el("div", { className: "dept-cell cell-actions" }, [
          btn("제외", () => { state.orders.set(key(), ids.filter((x) => x !== s.id)); draw(); }),
          toggle,
        ]),
      ]);
    };
    return panel("과목별 커리큘럼", [
      el("div", { className: "dept-curriculum-row v3-headrow" }, ["", "과목명", "기간", "학과별 커리큘럼 요약", "프로그램", "준비물", "학습 수준", ""].map((t) => el("b", { textContent: t }))),
      ...(list.length ? list.map(rowOf) : [empty("이 학과에 과목이 없습니다.")]),
      msg,
      hint("순서는 '학과별 과목 순서'에서 정한 순서입니다. '수정' 후 '저장'은 실제 저장(과목 공통이라 쓰는 모든 학과에 같이 반영). '수정' 중에는 요약을 AI생성(2~4줄)할 수 있습니다. 강사 명단·순서는 '주차별 커리큘럼' 왼쪽 '강사'에서 정합니다. '제외'는 V3 학과 순서에서만 빠집니다(저장 안 됨)."),
    ], "학과별 과목 순서대로", [state.orders.has(key()) ? chip("바꾼 순서 · 저장 안 됨", "warn") : chip("지금 순서", "good")]);
  }

  function draw() {
    const regular = state.mode === "regular";
    tabs.hidden = !regular;
    [...tabs.children].forEach((b, i) => b.classList.toggle("active", (i === 0) === (state.aggTab === "weeks")));
    const list = deptSubjects(state.dept, state.mode, data);
    body.replaceChildren(regular && state.aggTab === "subjects" ? subjectsView(list) : weeksView(list));
  }
  container.append(contextBar(depts, draw, [tabs]), body, edit.node);
  draw();
}
