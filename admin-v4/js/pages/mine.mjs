// 내 커리큘럼(강사): 내 학과(연결된 것만) → 일반/방학 특강 → 과목 → 1~4단계(내용·이미지) + 준비물.
// 바꾸면 떠 있는 창: [임시 저장] = 본인 저장함(v4_teacher_drafts, 공개·검수와 상관없음), [학과장에게 제출] = 기존 제출 함수(대기 줄).
// 과목을 바꿔도 과목마다 입력이 따로 남고, 이미지 올리기는 시작한 과목·단계에만 붙는다.
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, media, fill, empty, note, fail, busy, pickImage } from "../ui.mjs";
import { curriculumUnits, deptOrder, stepState, STEPS } from "../rules.mjs";
import { track, check, stashAll } from "../changes.mjs";

const LABELS = Array.from({ length: STEPS }, (_, i) => `${i + 1}단계`);
// 준비물 분류(저장 칸 이름). 화면은 '한 줄 = 분류 하나 + 내용' 목록, 저장은 예전처럼 분류별 칸(줄바꿈으로 이음, AI는 '이름 | 링크').
export const MAT = [["textbook", "교재"], ["supplies", "준비물"], ["tools", "사용 프로그램"], ["ai", "AI 도구"]];
export function parseMat(m = {}) {
  return MAT.flatMap(([cat]) => String(m[cat] ?? "").split(cat === "ai" ? /[\n\r]+/ : /[,\n\r]+/).map((x) => x.trim()).filter(Boolean).map((line) => {
    if (cat !== "ai") return { cat, content: line, link: "" };
    const [name, ...rest] = line.split("|");
    return { cat, content: name.trim(), link: rest.join("|").trim() };
  }));
}
export function serializeMat(items) {
  return Object.fromEntries(MAT.map(([cat]) => [cat, items.filter((i) => i.cat === cat && i.content.trim())
    .map((i) => (cat === "ai" && i.link.trim() ? `${i.content.trim()} | ${i.link.trim()}` : i.content.trim())).join("\n")]));
}
const matKey = (i) => `${i.cat}|${i.content.replace(/\s/g, "").toLowerCase()}`;
let state = { dept: null, scope: "general", subject: null };
const editors = new Map(); // `${set}|${subject}` → { steps, mat, unit } 지금 편집 중

export async function render({ main, session }) {
  editors.clear(); // 화면을 새로 열면 편집기도 새로(떠 있는 창 등록이 다시 되도록)
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
    // 내 준비물(재사용 목록): 본인 저장함(curriculum/prep-library) + 내가 낸 모든 과목 준비물. 임시 저장·제출할 때 자동으로 더한다.
    let library = [];
    try { library = (await data.teacherDraft(me.id, "curriculum", "prep-library"))?.payload?.items ?? []; } catch { library = []; }
    const remember = async (items) => {
      const seen = new Set(library.map(matKey));
      const add = items.filter((i) => i.content.trim() && !seen.has(matKey(i)) && seen.add(matKey(i))).map((i) => ({ cat: i.cat, content: i.content.trim(), link: i.link?.trim() ?? "" }));
      if (!add.length) return;
      library = [...library, ...add];
      await data.saveTeacherDraft(me.id, "curriculum", "prep-library", { items: library }).catch(() => {});
    };
    const libraryAll = () => {
      const seen = new Set();
      return [...library, ...mats.flatMap((m) => parseMat(m))].filter((i) => !seen.has(matKey(i)) && seen.add(matKey(i)));
    };
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

    function editorFor(set, sub) {
      const key = `${set.id}|${sub.id}`;
      if (editors.has(key)) return editors.get(key);
      const unit = curriculumUnits(rows).find((u) => u.set_id === set.id && u.subject_id === sub.id);
      const src = unit?.pending.length ? unit.pending : unit?.approved ?? [];
      const byLabel = (l) => src.find((r) => r.step_label === l);
      const m = mats.find((x) => x.subject_id === sub.id) ?? {};
      // 기준 = 지금 제출(또는 검수 완료)된 내용. 임시 저장한 것이 있으면 track이 불러와 채운다.
      const baseline = {
        steps: LABELS.map((l) => ({ written: byLabel(l)?.written ?? "", media_url: byLabel(l)?.media_url ?? "" })),
        mat: serializeMat(parseMat(m)),
      };
      const ed = { ...JSON.parse(JSON.stringify(baseline)), unit };
      ed.items = parseMat(ed.mat);
      editors.set(key, ed);
      track({
        id: key, slot: "mine", title: `${sub.name} 커리큘럼`, baseline, applyLabel: "학과장에게 제출",
        store: {
          load: async () => (await data.teacherDraft(me.id, "curriculum", key))?.payload ?? null,
          save: async (x) => { await data.saveTeacherDraft(me.id, "curriculum", key, x); await remember(parseMat(x.mat)); },
          drop: () => data.dropTeacherDraft(me.id, "curriculum", key),
        },
        read: () => ({ steps: ed.steps, mat: serializeMat(ed.items) }),
        write: (x) => { ed.steps = x.steps; ed.items = parseMat(x.mat); draw(); },
        apply: async (x) => {
          const missing = x.steps.map((st, i) => (st.written.trim() ? null : LABELS[i])).filter(Boolean);
          if (missing.length) throw new Error(`${missing.join(", ")} 내용을 채워주세요. 4단계를 모두 써야 제출할 수 있습니다.`);
          await data.call("comsw_submit_curriculum", {
            p_set_id: set.id, p_vacation: !!set.is_vacation, p_instructor_id: null,
            p_subjects: [{ subject_id: sub.id, ...x.mat, steps: x.steps.map((st, i) => ({ step_label: LABELS[i], written: st.written.trim(), media_url: st.media_url || "" })) }],
          });
        },
        onApplied: async () => {
          await remember(ed.items);
          rows = await data.curricula((q) => q.eq("instructor_id", me.id).order("sort_order", { nullsFirst: false }));
          editors.delete(key);
          msg.replaceChildren(note(`${sub.name}: 제출했습니다. 학과장이 확정하면 홈페이지에 나옵니다.`));
          draw();
        },
      });
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
      // 한 줄 드롭다운: 수업 구분 → (일반) 학과 / (방학 특강) 특강 → 과목. 바꾸기 전 임시 저장 안 한 변경이 있으면 묻는다.
      // 고르기는 '변경'이 아니라 선택: 묻지 않고, 고치던 내용은 조용히 임시 저장해 두고 넘어간다(돌아오면 그대로)
      const go = (fn) => async (e) => { const v = e.target.value; await stashAll(); editors.clear(); fn(v); draw(); };
      const kind = state.scope === "general" ? "general" : "vacation";
      const select = (label, value, opts, onChange) => h("label", { class: "form-field" }, h("b", {}, label),
        h("select", { "aria-label": label, onchange: go(onChange), disabled: !opts.length },
          opts.length ? opts.map(([v, l]) => h("option", { value: v, selected: v === value }, l)) : h("option", { value: "" }, "없음")));
      const picker = [box(null, h("div", { class: "pick-row" },
        select("수업 구분", kind, [["general", "일반 수업"], ...(cat.vacations.length ? [["vacation", "방학 특강"]] : [])],
          (v) => { state.scope = v === "general" ? "general" : cat.vacations[0].id; state.subject = null; }),
        kind === "general"
          ? select("학과", state.dept, depts.map((d) => [d.id, d.name]), (v) => { state.dept = v; state.subject = null; })
          : select("방학 특강", state.scope, cat.vacations.map((v) => [v.id, v.name]), (v) => { state.scope = v; state.subject = null; }),
        select("과목", sub?.id, pool.map((s) => [s.id, `${s.name}${chosen.has(s.id) ? " ✓" : ""}`]), (v) => { state.subject = v; })),
        pool.length ? null : empty("이 구분에 과목이 없습니다"))];
      if (!sub) return out.replaceChildren(msg, ...picker);
      if (!set) return out.replaceChildren(msg, ...picker, box(null, fail("이 학과의 커리큘럼 탭이 없어 제출할 수 없습니다. 학과장에게 알려주세요.")));
      const ed = editorFor(set, sub);
      out.replaceChildren(msg, ...picker, editor(set, sub, ed));
    };

    function editor(set, sub, ed) {
      const key = `${set.id}|${sub.id}`;
      const u = ed.unit;
      const old = u && !u.pending.length && u.approved.length !== STEPS ? u.approved : u?.pending.length && u.pending.length !== STEPS ? u.pending : null;
      // 단계 카드: 이미지(없으면 '설명 이미지 없음')를 누르면 이미지 바꾸기 팝업(파일 고르기·끌어다 놓기), 카드에 바로 끌어다 놓아도 됨.
      // 이미지는 썸네일 영역을 고른 뒤 올라가고, 시작한 과목·단계에만 붙는다.
      const card = (st, i) => {
        const view = () => (st.media_url ? media(st.media_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "설명 이미지 없음 · 눌러서 올리기")));
        const set = (url) => { st.media_url = url; if (editors.get(key) === ed) img.replaceChildren(view()); check(); };
        const img = h("button", { type: "button", class: "img-pick", title: "눌러서 이미지 바꾸기(파일 고르기·끌어다 놓기)", "aria-label": `${LABELS[i]} 이미지 바꾸기`,
          onclick: async () => { const url = await pickImage(`${LABELS[i]} 이미지`, "curriculum"); if (url) set(url); } }, view());
        // 카드에 끌어다 놓은 파일을 받는 숨은 칸(눈에 안 보임)
        const file = h("input", { type: "file", hidden: true, accept: "image/png,image/jpeg,image/webp", "aria-label": `${LABELS[i]} 이미지` });
        file.onchange = async () => {
          const f = file.files[0];
          if (!f) return;
          img.replaceChildren(h("div", { class: "muted" }, "올리는 중..."));
          try { set((await data.upload(f, "curriculum")).url); } catch (err) {
            msg.replaceChildren(fail(`${sub.name} ${LABELS[i]} 이미지: ${err.message}`));
            img.replaceChildren(view());
          }
          file.value = "";
        };
        return h("div", { class: "step step-col" },
          h("b", {}, LABELS[i]),
          h("textarea", { rows: 6, "aria-label": `${LABELS[i]} 수업 내용`, value: st.written, style: "width:100%",
            oninput: (e) => { st.written = e.target.value; } }),
          img, file,
          h("div", { class: "actions", style: "margin-top:6px" },
            h("button", { type: "button", class: "btn small", onclick: () => img.click() }, "이미지 수정"),
            st.media_url ? h("button", { type: "button", class: "btn small", onclick: () => { st.media_url = ""; draw(); } }, "이미지 빼기") : null));
      };
      const status = u?.pending.length ? pill("제출함 · 검수 전") : u ? pill("검수 완료", "neutral") : pill("아직 제출 전", "neutral");
      return h("div", {},
        box(null,
          h("div", { class: "row" }, h("h3", {}, `${sub.name} · ${set.is_vacation ? set.name : "일반 수업"}`), h("div", { class: "actions" }, status)),
          old ? note(`예전 자료가 ${old.length}단계입니다(${stepState(old.length).label}). 아래 참고 자료를 보고 4단계로 새로 써서 제출해주세요. 확정 전까지 예전 공개 내용은 그대로입니다.`) : null,
          h("div", { class: "steps" }, ed.steps.map(card))),
        matBox(ed),
        h("p", { class: "muted" }, "고치면 오른쪽 아래 창에서 [임시 저장] 또는 [학과장에게 제출]을 누르세요."),
        old ? box(`참고: 예전 ${old.length}단계`, h("div", { class: "steps" }, old.map((r) => h("div", { class: "step" },
          h("b", {}, r.step_label), h("p", {}, r.written || "—"), r.media_url ? media(r.media_url) : null)))) : null);
    }

    // 준비물: 한 줄에 분류(드롭다운) 하나 + 내용(AI 도구는 링크도). [+ 준비물], [빼기], 내 준비물에서 불러오기.
    function matBox(ed) {
      const list = h("div", { class: "mat-list" });
      const drawList = () => {
        list.replaceChildren(...(ed.items.length ? ed.items.map((it, n) => h("div", { class: "mat-row" },
          h("select", { "aria-label": `준비물 ${n + 1} 분류`, onchange: (e) => { it.cat = e.target.value; drawList(); } },
            MAT.map(([c, l]) => h("option", { value: c, selected: c === it.cat }, l))),
          h("input", { value: it.content, "aria-label": `준비물 ${n + 1} 내용`, placeholder: it.cat === "ai" ? "예: ChatGPT" : it.cat === "tools" ? "예: Photoshop" : it.cat === "textbook" ? "예: 멘토시리즈 포토샵" : "예: 마우스",
            oninput: (e) => { it.content = e.target.value; } }),
          it.cat === "ai" ? h("input", { value: it.link, "aria-label": `준비물 ${n + 1} 링크`, placeholder: "https:// (선택)", oninput: (e) => { it.link = e.target.value; } }) : h("span"),
          h("button", { type: "button", class: "btn danger small", onclick: () => { ed.items.splice(n, 1); drawList(); } }, "빼기")))
          : [h("p", { class: "muted" }, "준비물이 없습니다. [+ 준비물]로 하나씩 더하세요.")]));
        const have = new Set(ed.items.map(matKey));
        const lib = libraryAll().filter((i) => !have.has(matKey(i)));
        load.replaceChildren(h("option", { value: "" }, lib.length ? `내 준비물에서 불러오기 (${lib.length})` : "내 준비물 없음"),
          ...lib.map((i, k) => h("option", { value: String(k) }, `${MAT.find(([c]) => c === i.cat)?.[1]} · ${i.content}`)));
        load.disabled = !lib.length;
        load._lib = lib;
      };
      const load = h("select", { "aria-label": "내 준비물에서 불러오기", onchange: (e) => {
        const i = load._lib?.[Number(e.target.value)];
        if (i) { ed.items.push({ ...i }); drawList(); }
      } });
      drawList();
      return box("준비물",
        h("p", { class: "muted" }, "분류를 고르고 하나씩 적어주세요(여러 개 가능). 적은 준비물은 '내 준비물'에 모여 다른 과목에서 불러올 수 있습니다. 학과장이 과목 공통 준비물로 정리합니다."),
        list,
        h("div", { class: "actions", style: "margin-top:10px" },
          h("button", { type: "button", class: "btn", onclick: () => { ed.items.push({ cat: "supplies", content: "", link: "" }); drawList(); list.querySelector(".mat-row:last-child input")?.focus(); } }, "+ 준비물"),
          load));
    }

    await draw();
    return out;
  });
}
