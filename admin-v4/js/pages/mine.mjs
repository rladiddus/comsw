// 내 커리큘럼(강사): 내 학과(연결된 것만) → 일반/방학 특강 → 과목 → 1~4단계(내용·이미지) + 준비물.
// [저장] = 본인 저장함(v4_teacher_drafts, 공개·검수와 상관없음). [학과장에게 제출] = 기존 제출 함수(대기 줄).
// 과목을 바꿔도 과목마다 입력이 따로 남고, 이미지 올리기는 시작한 과목·단계에만 붙는다.
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, media, fill, empty, note, fail, busy } from "../ui.mjs";
import { curriculumUnits, deptOrder, stepState, STEPS } from "../rules.mjs";

const LABELS = Array.from({ length: STEPS }, (_, i) => `${i + 1}단계`);
const MAT = [["textbook", "교재"], ["supplies", "준비물"], ["tools", "사용 프로그램"], ["ai", "AI 도구(한 줄에 하나, 이름 | 링크)"]];
let state = { dept: null, scope: "general", subject: null };
const editors = new Map(); // `${set}|${subject}` → { steps, mat, dirty, from }

globalThis.addEventListener?.("beforeunload", (e) => { if ([...editors.values()].some((x) => x.dirty)) e.preventDefault(); });

export async function render({ main, session }) {
  main.replaceChildren(head("내 커리큘럼", "수업할 과목마다 1~4단계 커리큘럼과 준비물을 작성해 학과장에게 제출합니다. 학과장이 확정해야 홈페이지에 나옵니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const me = await data.myInstructor(session.uid);
    if (!me) return box(null, note("이 계정과 연결된 강사 정보가 없습니다. 학과장에게 계정 연결을 요청해주세요."));
    const [cat, myDepts, mySubjects, mats] = await Promise.all([
      data.catalog(), data.all("instructor_departments", (q) => q.eq("instructor_id", me.id)),
      data.instructorSubjects(me.id), data.materials((q) => q.eq("instructor_id", me.id)),
    ]);
    let rows = await data.curricula((q) => q.eq("instructor_id", me.id).order("sort_order", { nullsFirst: false }));
    const depts = cat.departments.filter((d) => myDepts.some((l) => l.department_id === d.id));
    if (!depts.length) return box(null, note("연결된 학과가 없습니다. 학과장에게 소속 학과 연결을 요청해주세요."));
    const subjects = data.live(cat.subjects);
    const chosen = new Set(mySubjects.map((x) => x.subject_id));
    const out = h("div");
    const msg = h("div");

    const setFor = () => (state.scope === "general"
      // 학과 탭: 학과 id로 이어진 것, 없으면 학과와 같은 이름(공개 사이트도 이름으로 찾음)
      ? cat.sets.find((s) => !s.is_vacation && s.department_id === state.dept)
        ?? cat.sets.find((s) => !s.is_vacation && s.name === cat.departments.find((d) => d.id === state.dept)?.name)
      : cat.vacations.find((v) => v.id === state.scope));

    async function editorFor(set, sub) {
      const key = `${set.id}|${sub.id}`;
      if (editors.has(key)) return editors.get(key);
      const unit = curriculumUnits(rows).find((u) => u.set_id === set.id && u.subject_id === sub.id);
      const saved = await data.teacherDraft(me.id, "curriculum", key);
      const src = unit?.pending.length ? unit.pending : unit?.approved ?? [];
      const byLabel = (l) => src.find((r) => r.step_label === l);
      const m = mats.find((x) => x.subject_id === sub.id) ?? {};
      const ed = saved?.payload?.steps ? { ...saved.payload, from: "저장한 내용" } : {
        steps: LABELS.map((l) => ({ written: byLabel(l)?.written ?? "", media_url: byLabel(l)?.media_url ?? "" })),
        mat: Object.fromEntries(MAT.map(([k]) => [k, m[k] ?? ""])),
        from: unit?.pending.length ? "제출한 내용" : unit ? "검수 완료된 내용" : "",
      };
      ed.unit = unit;
      ed.dirty = false;
      editors.set(key, ed);
      return ed;
    }

    const draw = async () => {
      state.dept = depts.some((d) => d.id === state.dept) ? state.dept : depts[0].id;
      const scopes = [["general", "일반 수업"], ...cat.vacations.map((v) => [v.id, v.name])];
      if (!scopes.some(([v]) => v === state.scope)) state.scope = "general";
      const inDept = deptOrder(cat.links.filter((l) => l.department_id === state.dept), subjects);
      const pool = state.scope === "general" ? inDept
        : subjects.filter((s) => cat.vacLinks.some((l) => l.set_id === state.scope && l.subject_id === s.id));
      const sub = pool.find((s) => s.id === state.subject) ?? pool.find((s) => chosen.has(s.id)) ?? pool[0];
      state.subject = sub?.id ?? null;
      const set = setFor();
      const picker = [
        box("내 학과", tabs(depts.map((d) => [d.id, d.name]), state.dept, (id) => { state.dept = id; state.subject = null; draw(); }, "chips")),
        box("수업 구분", tabs(scopes, state.scope, (v) => { state.scope = v; state.subject = null; draw(); }, "chips")),
        box("과목", pool.length ? h("div", { class: "chips" }, pool.map((s) => h("button", {
          type: "button", "aria-pressed": String(s.id === sub?.id), onclick: () => { state.subject = s.id; draw(); },
        }, s.name, chosen.has(s.id) ? " ✓" : ""))) : empty("이 구분에 과목이 없습니다")),
      ];
      if (!sub) return out.replaceChildren(msg, ...picker);
      if (!set) return out.replaceChildren(msg, ...picker, box(null, fail("이 학과의 커리큘럼 탭이 없어 제출할 수 없습니다. 학과장에게 알려주세요.")));
      const ed = await editorFor(set, sub);
      out.replaceChildren(msg, ...picker, editor(set, sub, ed));
    };

    function editor(set, sub, ed) {
      const key = `${set.id}|${sub.id}`;
      const u = ed.unit;
      const old = u && !u.pending.length && u.approved.length !== STEPS ? u.approved : u?.pending.length && u.pending.length !== STEPS ? u.pending : null;
      const card = (st, i) => {
        const img = h("div", {}, st.media_url ? media(st.media_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "설명 이미지 없음")));
        const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": `${LABELS[i]} 이미지` });
        file.onchange = async () => {
          const f = file.files[0];
          if (!f) return;
          const target = ed.steps[i]; // 시작한 과목·단계에만 붙인다
          img.replaceChildren(h("div", { class: "muted" }, "올리는 중..."));
          try {
            target.media_url = (await data.upload(f, "curriculum")).url;
            ed.dirty = true;
          } catch (err) {
            msg.replaceChildren(fail(`${sub.name} ${LABELS[i]} 이미지: ${err.message}`));
          }
          if (editors.get(key) === ed) img.replaceChildren(target.media_url ? media(target.media_url) : h("span", { class: "muted" }, "설명 이미지 없음"));
          file.value = "";
        };
        return h("div", { class: "step" },
          h("b", {}, LABELS[i]),
          h("textarea", { rows: 6, "aria-label": `${LABELS[i]} 수업 내용`, value: st.written, style: "width:100%",
            oninput: (e) => { st.written = e.target.value; ed.dirty = true; } }),
          img, file,
          st.media_url ? h("button", { type: "button", class: "btn", onclick: () => { st.media_url = ""; ed.dirty = true; draw(); } }, "이미지 빼기") : null);
      };
      const save = h("button", { type: "button", class: "btn" }, "저장");
      const send = h("button", { type: "button", class: "btn primary" }, "학과장에게 제출");
      save.onclick = () => busy(save, msg, async () => {
        await data.saveTeacherDraft(me.id, "curriculum", key, { steps: ed.steps, mat: ed.mat });
        ed.dirty = false;
        msg.replaceChildren(note(`${sub.name}: 저장했습니다(아직 제출 전, 홈페이지에는 나오지 않습니다).`));
      });
      send.onclick = () => busy(send, msg, async () => {
        const missing = ed.steps.map((s, i) => (s.written.trim() ? null : LABELS[i])).filter(Boolean);
        if (missing.length) throw new Error(`${missing.join(", ")} 내용을 채워주세요. 4단계를 모두 써야 제출할 수 있습니다.`);
        if (!confirm(`${sub.name} 4단계를 학과장에게 제출할까요? 학과장이 확정하면 홈페이지에 나옵니다.`)) return;
        await data.call("comsw_submit_curriculum", {
          p_set_id: set.id, p_vacation: !!set.is_vacation, p_instructor_id: null,
          p_subjects: [{ subject_id: sub.id, ...ed.mat, steps: ed.steps.map((s, i) => ({ step_label: LABELS[i], written: s.written.trim(), media_url: s.media_url || "" })) }],
        });
        await data.dropTeacherDraft(me.id, "curriculum", key).catch(() => {});
        rows = await data.curricula((q) => q.eq("instructor_id", me.id).order("sort_order", { nullsFirst: false }));
        editors.delete(key);
        msg.replaceChildren(note(`${sub.name}: 제출했습니다. 학과장이 확정하면 홈페이지에 나옵니다.`));
        draw();
      });
      const status = u?.pending.length ? pill("제출함 · 검수 전") : u ? pill("검수 완료", "neutral") : pill("아직 제출 전", "neutral");
      return h("div", {},
        box(null,
          h("div", { class: "row" }, h("h3", {}, `${sub.name} · ${set.is_vacation ? set.name : "일반 수업"}`), h("div", { class: "actions" }, status, ed.from ? pill(`불러온 것: ${ed.from}`, "neutral") : null)),
          old ? note(`예전 자료가 ${old.length}단계입니다(${stepState(old.length).label}). 아래 참고 자료를 보고 4단계로 새로 써서 제출해주세요. 확정 전까지 예전 공개 내용은 그대로입니다.`) : null,
          h("div", { class: "steps" }, ed.steps.map(card))),
        box("준비물", h("p", { class: "muted" }, "쉼표나 줄바꿈으로 나눠 적어주세요. 학과장이 과목 공통 준비물로 정리합니다."),
          h("div", { class: "steps" }, MAT.map(([k, label]) => h("label", { class: "step" }, h("b", {}, label),
            h("textarea", { rows: 3, value: ed.mat[k] ?? "", style: "width:100%", oninput: (e) => { ed.mat[k] = e.target.value; ed.dirty = true; } }))))),
        box(null, h("div", { class: "actions" }, save, send)),
        old ? box(`참고: 예전 ${old.length}단계`, h("div", { class: "steps" }, old.map((r) => h("div", { class: "step" },
          h("b", {}, r.step_label), h("p", {}, r.written || "—"), r.media_url ? media(r.media_url) : null)))) : null);
    }

    await draw();
    return out;
  });
}
