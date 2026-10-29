import { el, rows, pick, chip, hint, btn, panel, empty, editor, headActions } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { applyCrop } from "../../../admin/js/image-crop.mjs";
import { LEVELS } from "../../../admin/js/pages/department-curriculum.mjs";
import { state, deptSubjects, contextBar, typeChip, isEmployed, modal } from "../v3.mjs";

// 과목 통합 커리큘럼(V3 시안 '학과 통합 커리큘럼', 정책 3·4·5·7): 과목 하나를 모든 학과가 같이 쓴다(2026-10-29 결정).
// 정규는 두 탭: [주차별 커리큘럼] 고른 과목의 통합 문구(AI생성 2~4줄·저장) + 단계별 커리큘럼·대표 이미지(강사 이미지 중 고르기, 실제 저장)
//              [과목별 커리큘럼] 학과 과목을 순서대로 표(과목명·기간·학과별 커리큘럼 요약·프로그램·준비물·학습 수준), 수정은 실제 저장, 제외는 V3 학과 순서에서만.
// 과목마다 넣을 강사(순서 포함)는 왼쪽 '강사' 팝업에서 고친다(state.picks, 저장 안 됨). 처음 = 이 과목 승인본이 있는 재직 강사.
export function sources(approved, sets, mode, subjectId) {
  return approved.filter((c) => c.subject_id === subjectId && Boolean(sets.find((s) => s.id === c.set_id)?.is_vacation) === (mode === "vacation"));
}

// 강사의 이 단계 원문: 같은 단계 이름, 없으면 같은 자리(순서)의 단계
export function stepText(rows, label, index) {
  const own = rows.filter((r) => r.step_label === label);
  if (own.length) return own.map((r) => r.written).filter(Boolean).join("\n");
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[index]?.written ?? "";
}

// AI에 보낼 글: 줄 수 지시 + 단계별 강사 원문. (서버의 학과 커리큘럼 지시는 '두 문장'이라 줄 수는 글 안에서 알려 준다)
export function aiRequest(name, n, parts) {
  const heads = Array.from({ length: n }, (_, i) => `0${i + 1}`).join(", ");
  return `이번에는 반드시 ${n}줄로 정리: 각 줄은 ${heads}로 시작하고 줄바꿈.\n\n${name} 커리큘럼\n${parts.join("\n\n")}`;
}

const thumb = (url, alt) => url ? applyCrop(el("img", { className: "v3-weekimg", src: driveThumbnail(url), alt }), url) : el("div", { className: "v3-weekimg empty", textContent: "이미지 없음" });

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
  let subjectId = location.hash.split("/")[2] ?? "";
  const body = el("div");

  // 과목에 넣을 강사(순서대로). 처음 = 이 과목 승인본이 있는 재직 강사(강사 순서).
  const teachersOf = (id) => instructors.map((i) => i.id).filter((i) => sources(approved, sets, state.mode, id).some((c) => c.instructor_id === i));
  const picks = (id) => state.picks.get(`${id}|${state.mode}`) ?? teachersOf(id).filter(isEmployed);

  const tabs = el("div", { className: "v2-tabs v3-aggtabs" }, [["weeks", "주차별 커리큘럼"], ["subjects", "과목별 커리큘럼"]].map(([k, t]) =>
    Object.assign(el("button", { type: "button", className: "v2-tab", textContent: t }), { onclick: () => { state.aggTab = k; draw(); } })));

  // 강사 팝업: 목록(끌어서 순서), '수정'이면 × 로 빼기, '추가'로 넣기. '완료'를 눌러야 반영.
  function teacherPopup(subject) {
    let list = [...picks(subject.id)];
    let editing = false;
    let dragged = null;
    const box = el("div");
    const drawList = () => {
      const addable = teachersOf(subject.id).filter((id) => !list.includes(id));
      const add = el("select", {}, [el("option", { value: "", textContent: "+ 강사 추가" }), ...addable.map((id) => el("option", { value: id, textContent: `${nameOfI(id)}${isEmployed(id) ? "" : " (퇴사)"}` }))]);
      add.setAttribute("aria-label", "강사 추가");
      add.addEventListener("change", () => { if (add.value) { list.push(add.value); drawList(); } });
      box.replaceChildren(
        el("div", { className: "v2-row v2-gap" }, [
          btn(editing ? "수정 끝" : "수정", () => { editing = !editing; drawList(); }),
          ...(addable.length ? [add] : [el("small", { className: "muted", textContent: "더 넣을 강사가 없습니다" })]),
        ]),
        ...(list.length ? list.map((id, i) => {
          const r = el("div", { className: "v3-orderrow", draggable: true }, [el("span", { className: "v3-handle", textContent: "⋮⋮" }), el("span", { className: "v2-num", textContent: `${i + 1}` }),
            el("b", { className: "v2-grow", textContent: nameOfI(id) }), ...(isEmployed(id) ? [] : [chip("퇴사", "red")]),
            ...(editing ? [Object.assign(el("button", { type: "button", className: "v3-x", textContent: "×", title: `${nameOfI(id)} 빼기` }), { onclick: () => { list = list.filter((x) => x !== id); drawList(); } })] : [])]);
          const after = (e) => { const b = r.getBoundingClientRect(); return e.clientY > b.top + b.height / 2; };
          const clear = () => box.querySelectorAll(".v3-orderrow").forEach((x) => x.classList.remove("drop-before", "drop-after"));
          r.addEventListener("dragstart", (e) => { dragged = id; e.dataTransfer?.setData("text/plain", id); });
          r.addEventListener("dragend", () => { dragged = null; clear(); });
          r.addEventListener("dragover", (e) => { if (!dragged || dragged === id) return; e.preventDefault(); clear(); r.classList.add(after(e) ? "drop-after" : "drop-before"); });
          r.addEventListener("drop", (e) => {
            e.preventDefault(); clear();
            if (!dragged || dragged === id) return;
            const a = list.filter((x) => x !== dragged);
            a.splice(a.indexOf(id) + (after(e) ? 1 : 0), 0, dragged);
            list = a; dragged = null; drawList();
          });
          return r;
        }) : [empty("넣은 강사가 없습니다.")]),
      );
    };
    drawList();
    modal(`${subject.name} · 기여 강사`, [el("p", { className: "muted", textContent: "이 과목 통합 커리큘럼에 들어가는 강사입니다. 끌어서 순서를 바꿉니다. 화면에서만 기억합니다(저장 안 됨)." }), box],
      [["완료", () => { state.picks.set(`${subject.id}|${state.mode}`, list); draw(); }]]);
  }

  // 대표 이미지 팝업: 이 과목 강사 이미지(같은 단계 먼저) 중 고르면 사이트 단계 이미지로 저장
  function imagePopup(subject, week) {
    const cands = sources(approved, sets, state.mode, subject.id).filter((c) => c.media_url)
      .sort((a, b) => (b.step_label === week.week_label) - (a.step_label === week.week_label));
    const msg = el("p", { className: "save-state" });
    const d = modal(`${subject.name} · ${week.week_label} 대표 이미지`, [
      cands.length ? el("div", { className: "v3-imggrid" }, cands.map((c) => Object.assign(el("button", { type: "button", className: `v3-imgpick${c.media_url === week.image_url ? " active" : ""}`, title: "이 이미지로" },
        [thumb(c.media_url, `${nameOfI(c.instructor_id)} ${c.step_label}`), el("small", { textContent: `${nameOfI(c.instructor_id)} · ${c.step_label}` })]), {
        onclick: async () => {
          const { error } = await supabase.from("subject_weeks").update({ image_url: c.media_url }).eq("id", week.id);
          if (error) { msg.textContent = dbErrorMessage(error); msg.className = "save-state err"; return; }
          week.image_url = c.media_url;
          d.close?.(); d.remove();
          draw();
        },
      }))) : empty("이 과목에 강사가 올린 이미지가 없습니다."),
      msg,
    ], []);
  }

  function weeksView(list) {
    if (!list.some((s) => s.id === subjectId)) subjectId = list[0]?.id ?? "";
    const subject = subjects.find((s) => s.id === subjectId);
    const src = sources(approved, sets, state.mode, subjectId);
    const chosen = picks(subjectId);
    const changed = state.picks.has(`${subjectId}|${state.mode}`);
    const stale = changed || teachersOf(subjectId).some((id) => !isEmployed(id));
    const sharedDepts = links.filter((l) => l.subject_id === subjectId);
    const myWeeks = weeks.filter((w) => w.subject_id === subjectId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const text = el("textarea", { className: "v2-textarea", value: subject?.dept_curriculum || "", rows: 4 });
    const msg = el("p", { className: "save-state" });
    const say = (t, err = false) => { msg.textContent = t; msg.className = `save-state${err ? " err" : ""}`; };
    const lineBtns = [2, 3, 4].map((n) => Object.assign(el("button", { type: "button", className: `v2-tab${state.aiLines === n ? " active" : ""}`, textContent: `${n}` }),
      { onclick: () => { state.aiLines = n; lineBtns.forEach((b, i) => b.classList.toggle("active", i + 2 === n)); } }));
    const gen = btn("AI생성", async () => {
      const fn = getServices().summarize;
      if (!fn) return say("AI 연결을 준비 중입니다", true);
      const own = (id) => src.filter((c) => c.instructor_id === id);
      const labels = [...new Set(chosen.flatMap((id) => own(id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => c.step_label)))];
      const parts = labels.map((label, i) => {
        const lines = chosen.map((id) => stepText(own(id), label, i).trim()).filter(Boolean);
        return lines.length ? `[${label}]\n${lines.map((t) => `- ${t}`).join("\n")}` : "";
      }).filter(Boolean);
      if (!parts.length) return say("넣은 강사의 커리큘럼이 없습니다. 왼쪽 '강사'에서 강사를 넣어주세요.", true);
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
    const save = btn("저장", async () => {
      save.disabled = true;
      const { error } = await supabase.from("subjects").update({ dept_curriculum: text.value.trim() || null }).eq("id", subjectId);
      save.disabled = false;
      if (error) return say(dbErrorMessage(error), true);
      subject.dept_curriculum = text.value.trim();
      say(`저장했습니다. 이 과목을 쓰는 학과 ${sharedDepts.length}곳에 같이 나오고, 공개 사이트에는 '사이트 반영' 후 보입니다.`);
    });

    return el("div", { className: "v3-gridagg" }, [
      panel("과목", list.length ? [el("div", { className: "v2-boxlist" }, list.map((s, i) => Object.assign(el("div", { className: `v2-listitem${s.id === subjectId ? " active" : ""}` }, [
        el("div", { className: "v2-row" }, [el("b", { className: "v2-grow", textContent: `${i + 1}. ${s.name}` }),
          btn("강사", (e) => { e.stopPropagation(); teacherPopup(s); })]),
        el("small", { textContent: `통합 강사 ${picks(s.id).length}명` }),
      ]), { onclick: () => { subjectId = s.id; draw(); } })))] : [empty("이 학과·유형에 과목이 없습니다.")], "학과별 과목 순서대로"),
      panel(`과목 통합본 · ${subject?.name ?? ""}`, subject ? [
        el("div", { className: "v2-row v2-gap" }, [chip(!chosen.length ? "출처 없음 · 검토 필요" : stale ? "다시 만들기 필요" : "출처 확인", !chosen.length ? "red" : stale ? "warn" : "good"), typeChip(subject),
          el("small", { className: "muted", textContent: `통합 강사: ${chosen.map(nameOfI).join(", ") || "없음"}` })]),
        el("div", { className: "v2-row v2-gap" }, [el("p", { className: "v2-label v2-grow", textContent: "과목 통합 커리큘럼 문구" }),
          gen, el("div", { className: "v2-tabs v3-lines", title: "요약 줄 수" }, lineBtns), el("small", { className: "muted", textContent: "줄" })]),
        text,
        el("div", { className: "v2-actions v2-end" }, [save]), msg,
        ...(sharedDepts.length > 1 ? [hint(`이 과목을 쓰는 ${sharedDepts.length}개 학과(${sharedDepts.map((l) => depts.find((d) => d.id === l.department_id)?.name ?? "").join(", ")})에 같은 문구가 나옵니다. 고치면 모두 같이 바뀝니다.`)] : []),
        el("p", { className: "v2-label", textContent: "주차별 커리큘럼 (사이트 '전체 수업'의 단계)" }),
        ...(myWeeks.length ? myWeeks.map((w) => el("div", { className: "v2-mini-card v3-week" }, [
          thumb(w.image_url, `${w.week_label} 대표 이미지`),
          el("div", { className: "v2-grow" }, [el("b", { textContent: w.week_label }), el("p", { textContent: w.summary || w.written || "(문구 없음)" })]),
          btn("대표 이미지 수정", () => imagePopup(subject, w)),
        ])) : [empty("이 과목은 사이트 단계가 없습니다. '고치기'(기존 학과 커리큘럼 > 단계)에서 만듭니다.")]),
      ] : [empty("과목을 고르세요.")]),
    ]);
  }

  // 과목별 커리큘럼: 기존 '학과 커리큘럼' 표 모양. 수정 → 저장(실제), 제외 → V3 학과 순서에서 뺌(저장 안 됨)
  function subjectsView(list) {
    const ids = list.map((s) => s.id);
    const msg = el("p", { className: "save-state" });
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
      const lock = () => Object.values(f).forEach((x) => { if (x.tagName === "SELECT") x.disabled = !on; else x.readOnly = !on; });
      lock();
      const toggle = btn("수정", async () => {
        if (!on) { on = true; toggle.textContent = "저장"; lock(); return; }
        const patch = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, k === "name" ? x.value.trim() : x.value.trim() || null]));
        if (!patch.name) { msg.textContent = "과목명을 입력해주세요"; msg.className = "save-state err"; return; }
        toggle.disabled = true;
        const { error } = await supabase.from("subjects").update(patch).eq("id", s.id);
        toggle.disabled = false;
        if (error) { msg.textContent = dbErrorMessage(error, { duplicate: "같은 이름의 과목이 있습니다" }); msg.className = "save-state err"; return; }
        Object.assign(s, patch);
        on = false; toggle.textContent = "수정"; lock();
        msg.textContent = `'${s.name}'을(를) 저장했습니다. 이 과목을 쓰는 모든 학과에 같이 반영되고, 공개 사이트에는 '사이트 반영' 후 보입니다.`;
        msg.className = "save-state";
      });
      const cell = (key, label) => el("div", { className: `dept-cell cell-${key}` }, [el("span", { className: "cell-label", textContent: label }), f[key]]);
      return el("div", { className: "dept-curriculum-row" }, [
        el("span", { className: "v2-num", textContent: `${i + 1}` }),
        cell("name", "과목명"), cell("duration", "기간"), cell("dept_curriculum", "학과별 커리큘럼 요약"), cell("tools", "프로그램"), cell("supplies", "준비물"), cell("level", "학습 수준"),
        el("div", { className: "dept-cell cell-actions" }, [
          btn("제외", () => { state.orders.set(`${state.dept}:${state.mode}`, ids.filter((x) => x !== s.id)); draw(); }),
          toggle,
        ]),
      ]);
    };
    return panel("과목별 커리큘럼", [
      el("div", { className: "dept-curriculum-row v3-headrow" }, ["", "과목명", "기간", "학과별 커리큘럼 요약", "프로그램", "준비물", "학습 수준", ""].map((t) => el("b", { textContent: t }))),
      ...(list.length ? list.map(rowOf) : [empty("이 학과에 과목이 없습니다.")]),
      msg,
      hint("순서는 '학과별 과목 순서'에서 정한 순서입니다. '수정' 후 '저장'은 실제 저장(과목 공통이라 쓰는 모든 학과에 같이 반영). '제외'는 V3 학과 순서에서만 빠집니다(저장 안 됨)."),
    ], "학과별 과목 순서대로", [state.orders.has(`${state.dept}:${state.mode}`) ? chip("바꾼 순서 · 저장 안 됨", "warn") : chip("지금 순서", "good")]);
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
