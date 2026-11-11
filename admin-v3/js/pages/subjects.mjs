import { el, pick, btn, chip, empty, select, table, tabBox, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { deleteSubject, modal } from "../v3.mjs";

// 과목 관리(V3, 2026-11-03 사용자와 합의)
// [과목 생성] 학과를 고르고 과목명을 적어 그 학과 맨 뒤에 만든다(comsw_create_subject). '전체 학과'면 모든 학과에 넣는다.
// [과목 삭제](2026-11-11) [학과 ▾(전체 학과)] + 과목명 검색 → 과목 / 강사(커리큘럼을 냈거나 담당인 강사) / 체크, 체크한 과목을 [삭제]로 한 번에 지운다.
// [과목 정리] 그룹에 넣지 않았고 ① 강사 커리큘럼(승인·대기·방특)이 하나도 없거나 ② 어느 학과·방학 특강에도 없는 과목(방특 전용 과목은 포함으로 봄).
//   줄마다 [삭제] [연결]:
//   연결 ① 그룹 연결(라디오 하나만): ⓐ 새 그룹 만들기(이름은 이 과목 이름, 이름이 이 과목으로 시작하는 과목 미리 체크) ⓑ 기존 그룹에 넣기
//        ② 학과·방학 특강 지정 = 학과(맨 뒤 순서) 또는 방학 특강(vacation_set_subjects)에 넣기
// [그룹 만들기] 그룹(subject_groups, 과목이 아닌 이름만 있는 묶음, 관리 화면 정리용)과 그 과목, '−'로 빼기, [그룹 만들기], 줄마다 [과목 고르기]·[그룹 삭제].
//   그룹 이름은 과목 이름과 겹쳐도 된다(예: 그룹 '포토샵' ← 포토샵·포토샵1·포토샵2).
// 그룹 표는 20261103030000, 방학 특강 과목 표는 20261103020000 실행 전에는 없어서 그 기능만 잠긴다.
const TABS = ["과목 생성", "과목 삭제", "과목 정리", "그룹 만들기"];
const norm = (t) => String(t ?? "").replace(/\s+/g, "").toLowerCase();
const fail = (say, text) => { say.textContent = text; say.className = "save-state err"; };
const done = (say, text) => { say.textContent = text; say.className = "save-state"; };

// 그룹 과목 고르기(체크) + 그룹 이름. gx = { supabase, subjects, groups }(subjects에 group_id). g = 기존 그룹(이름 바꾸기 가능) 또는 null(새 그룹, first = 이 과목으로 시작).
// 이미 다른 그룹에 있는 과목은 '(지금: 그룹)'으로 보이고 체크하면 이 그룹으로 옮긴다. 저장하면 onSaved()
export function groupPicker(gx, g, say, onSaved, first = null) {
  const { supabase, subjects, groups } = gx;
  const membersOf = (id) => subjects.filter((c) => c.group_id === id);
  const name = el("input", { type: "text", className: "v2-field", maxLength: 80, placeholder: "그룹 이름", value: g?.name ?? first?.name ?? "" });
  name.setAttribute("aria-label", "그룹 이름");
  const base = norm(name.value);
  const like = (c) => base && norm(c.name).startsWith(base);
  const chosen = new Set(subjects.filter((c) => (g && c.group_id === g.id) || c === first || (!c.group_id && like(c))).map((c) => c.id));
  const cands = [...subjects].sort((a, b) => Number(chosen.has(b.id)) - Number(chosen.has(a.id)) || a.name.localeCompare(b.name, "ko"));
  const q = el("input", { type: "search", className: "v2-field", placeholder: "과목 검색" });
  q.setAttribute("aria-label", "과목 검색");
  const list = el("div", { className: "v3-linklist" });
  const fill = () => list.replaceChildren(...cands.filter((c) => norm(c.name).includes(norm(q.value))).map((c) => {
    const box = el("input", { type: "checkbox", checked: chosen.has(c.id) });
    box.addEventListener("change", () => { if (box.checked) chosen.add(c.id); else chosen.delete(c.id); });
    const now = c.group_id && c.group_id !== g?.id ? ` (지금: ${nameOf(groups, c.group_id)})` : "";
    return el("label", { className: "consent" }, [box, el("span", { textContent: `${c.name}${now}` })]);
  }));
  q.addEventListener("input", fill);
  fill();
  const save = btn(g ? "저장" : "그룹 만들기", async () => {
    const n = name.value.trim();
    if (!n) return fail(say, "그룹 이름을 입력해주세요");
    if (!g && !chosen.size) return fail(say, "그룹에 넣을 과목을 골라주세요");
    save.disabled = true;
    try {
      const dup = { duplicate: "같은 이름의 그룹이 이미 있습니다" };
      let id = g?.id;
      if (!g) {
        const { data, error } = await supabase.from("subject_groups").insert({ name: n }).select().single();
        if (error) return fail(say, dbErrorMessage(error, dup));
        groups.push(data);
        id = data.id;
      } else if (n !== g.name) {
        const { error } = await supabase.from("subject_groups").update({ name: n }).eq("id", g.id);
        if (error) return fail(say, dbErrorMessage(error, dup));
        g.name = n;
      }
      const add = [...chosen];
      const drop = membersOf(id).map((c) => c.id).filter((x) => !chosen.has(x));
      const r1 = add.length ? await supabase.from("subjects").update({ group_id: id }).in("id", add) : {};
      const r2 = !r1.error && drop.length ? await supabase.from("subjects").update({ group_id: null }).in("id", drop) : {};
      if (r1.error || r2.error) return fail(say, dbErrorMessage(r1.error || r2.error));
      subjects.forEach((c) => { if (add.includes(c.id)) c.group_id = id; if (drop.includes(c.id)) c.group_id = null; });
      onSaved();
    } finally { save.disabled = false; }
  }, true);
  return [el("label", { className: "form-field" }, [el("span", { textContent: "그룹 이름" }), name]), q, list, el("div", {}, [save])];
}

// 기존 그룹에 넣기(라디오)
export function joinPicker(gx, s, say, onSaved) {
  const { supabase, subjects, groups } = gx;
  const membersOf = (id) => subjects.filter((c) => c.group_id === id);
  let chosen = "";
  const list = el("div", { className: "v3-linklist" }, [...groups].sort((a, b) => a.name.localeCompare(b.name, "ko")).map((g) => {
    const r = el("input", { type: "radio", name: "v3-group", value: g.id });
    r.addEventListener("change", () => { chosen = g.id; });
    return el("label", { className: "consent" }, [r, el("span", { textContent: `${g.name} (${membersOf(g.id).length}개)` })]);
  }));
  const save = btn("넣기", async () => {
    if (!chosen) return fail(say, "그룹을 골라주세요");
    save.disabled = true;
    const { error } = await supabase.from("subjects").update({ group_id: chosen }).eq("id", s.id);
    save.disabled = false;
    if (error) return fail(say, dbErrorMessage(error));
    s.group_id = chosen;
    onSaved();
  }, true);
  return [list, el("div", {}, [save])];
}

// 그룹 연결(라디오 하나만): ⓐ 새 그룹 만들기(first = 이 과목) ⓑ 기존 그룹에 넣기. 과목 정리 [연결]과 승인 대기 [그룹 설정]이 같이 쓴다.
export function groupChooser(gx, s, say, onSaved) {
  const mode = (value, text, off) => {
    const r = el("input", { type: "radio", name: "v3-linkmode", value, disabled: Boolean(off) });
    return [r, el("label", { className: "consent", title: off || "" }, [r, el("span", { textContent: text })])];
  };
  const [ra, la] = mode("a", "새 그룹 만들기");
  const [rb, lb] = mode("b", "기존 그룹에 넣기", !gx.groups.length && "아직 만든 그룹이 없습니다");
  const area = el("div", { className: "v3-linkbody" });
  const show = () => area.replaceChildren(...(ra.checked ? groupPicker(gx, null, say, onSaved, s) : joinPicker(gx, s, say, onSaved)));
  ra.checked = true;
  ra.addEventListener("change", show);
  rb.addEventListener("change", show);
  show();
  return [el("div", { className: "v3-linkmode" }, [la, lb]), area];
}

export async function render(container, ctx) {
  const { supabase } = ctx;
  headActions(ctx);
  const [depts, subjects, links, curricula, sets, vacTable, groupTable, instructors, isubjects] = await Promise.all([
    pick(supabase, "departments", "id, name, sort_order", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "*", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "subject_id, vacation, instructor_id"),
    pick(supabase, "curriculum_sets", "id, name, is_vacation, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "vacation_set_subjects", "set_id, subject_id").catch(() => null),
    pick(supabase, "subject_groups", "id, name", (q) => q.order("name")).catch(() => null),
    pick(supabase, "instructors", "id, name, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "instructor_subjects", "instructor_id, subject_id"),
  ]);
  const vacSets = sets.filter((x) => x.is_vacation);
  const vacLinks = vacTable ?? [];
  const groups = groupTable ?? [];
  const hasGroup = Boolean(groupTable) && subjects.some((s) => "group_id" in s);
  const membersOf = (id) => subjects.filter((c) => c.group_id === id);
  const gx = { supabase, subjects, groups };
  const LOCKED = "그룹은 운영 SQL(20261103030000) 실행 뒤에 쓸 수 있습니다.";
  const deptNames = (id) => links.filter((l) => l.subject_id === id).map((l) => nameOf(depts, l.department_id)).join(", ");
  const noCurriculum = (s) => !curricula.some((c) => c.subject_id === s.id);
  const nowhere = (s) => !s.is_vacation && !links.some((l) => l.subject_id === s.id)
    && !curricula.some((c) => c.subject_id === s.id && c.vacation) && !vacLinks.some((v) => v.subject_id === s.id);

  function createView() {
    const deptSel = select("학과", [...depts.map((d) => [d.id, d.name]), ["", "전체 학과"]]);
    const name = el("input", { type: "text", className: "v2-field", maxLength: 80, placeholder: "과목 이름" });
    name.setAttribute("aria-label", "과목 이름");
    const say = el("p", { className: "save-state" });
    const make = btn("생성", async () => {
      const n = name.value.trim();
      if (!n) return fail(say, "과목 이름을 입력해주세요");
      const ids = deptSel.value ? [deptSel.value] : depts.map((d) => d.id);
      if (!deptSel.value && !confirm(`'${n}' 과목을 모든 학과(${ids.length}개)에 넣을까요?`)) return;
      make.disabled = true;
      const { data: id, error } = await supabase.rpc("comsw_create_subject", { p_name: n, p_department_ids: ids });
      make.disabled = false;
      if (error) return fail(say, dbErrorMessage(error));
      subjects.push({ id, name: n, is_vacation: false, sort_order: 1e9, ...(hasGroup ? { group_id: null } : {}) });
      ids.forEach((d) => links.push({ subject_id: id, department_id: d }));
      name.value = "";
      done(say, `'${n}' 과목을 ${deptSel.value ? nameOf(depts, deptSel.value) : "모든 학과"} 맨 뒤에 만들었습니다. 그 학과 선생님은 바로 커리큘럼을 낼 수 있고, 공개 사이트에는 '사이트 반영' 후 보입니다.`);
    }, true);
    return [el("div", { className: "v3-newsubject" }, [
      el("label", { className: "form-field" }, [el("span", { textContent: "학과" }), deptSel]),
      el("label", { className: "form-field" }, [el("span", { textContent: "과목 이름" }), name]),
      el("div", {}, [make]),
      say,
    ])];
  }

  // 과목의 강사: 커리큘럼을 냈거나(승인·대기·방특) 담당 과목으로 고른 강사(강사 순서)
  const teachersOf = (id) => instructors.filter((i) => curricula.some((c) => c.subject_id === id && c.instructor_id === i.id)
    || isubjects.some((x) => x.subject_id === id && x.instructor_id === i.id)).map((i) => i.name);

  function deleteView() {
    const deptSel = select("학과", [["", "전체 학과"], ...depts.map((d) => [d.id, d.name])]);
    const q = el("input", { type: "search", className: "v2-field", placeholder: "과목명 검색" });
    q.setAttribute("aria-label", "과목명 검색");
    const chosen = new Set();
    const say = el("p", { className: "save-state" });
    const box = el("div");
    const del = btn("삭제", async () => {
      const list = subjects.filter((s) => chosen.has(s.id));
      del.disabled = true;
      let ok = false;
      try { ok = await deleteSubject(supabase, list); } catch (err) { fail(say, err.message); }
      if (ok) {
        for (const s of list) subjects.splice(subjects.indexOf(s), 1);
        for (let i = links.length - 1; i >= 0; i--) if (chosen.has(links[i].subject_id)) links.splice(i, 1);
        chosen.clear();
        done(say, `과목 ${list.length}개를 삭제했습니다. 공개 사이트에서는 '사이트 반영' 후 빠집니다.`);
      }
      draw();
    }, true);
    const draw = () => {
      const list = subjects.filter((s) => (!deptSel.value || links.some((l) => l.subject_id === s.id && l.department_id === deptSel.value))
        && norm(s.name).includes(norm(q.value)));
      del.disabled = !chosen.size;
      del.textContent = chosen.size ? `삭제 (${chosen.size})` : "삭제";
      if (!list.length) return box.replaceChildren(empty("과목이 없습니다."));
      const t = table(["과목", "강사", "선택"], list, (s) => {
        const c = el("input", { type: "checkbox", checked: chosen.has(s.id), title: `${s.name} 선택` });
        c.addEventListener("change", () => { if (c.checked) chosen.add(s.id); else chosen.delete(s.id); del.disabled = !chosen.size; del.textContent = chosen.size ? `삭제 (${chosen.size})` : "삭제"; });
        return [s.name, teachersOf(s.id).join(", ") || "—", c];
      });
      t.node.classList.add("v3-deltable");
      box.replaceChildren(t.node);
    };
    deptSel.addEventListener("change", draw);
    q.addEventListener("input", draw);
    draw();
    return [el("div", { className: "v2-row v2-gap v3-delbar" }, [deptSel, q, el("span", { className: "v2-grow" }), del]), box, say,
      el("p", { className: "muted", textContent: "체크한 과목을 [삭제]로 한 번에 지웁니다. 지우기 전에 쓰이는 곳(커리큘럼·로드맵·준비물 등) 개수를 보여 주고 확인을 받으며, 그것들도 함께 지워집니다. 다른 학과에서 쓰던 과목이면 그 학과에서도 빠집니다." })];
  }

  // [연결] 팝업: ① 그룹 연결(ⓐ/ⓑ 라디오) ② 학과·방학 특강 지정
  function linkPopup(s, redraw) {
    const say = el("p", { className: "save-state" });
    const body = el("div", { className: "v3-linkbody" });
    let d;
    const close = () => { d.close?.(); d.remove(); redraw(); };

    function groupPane() {
      if (!hasGroup) return [empty(LOCKED)];
      return groupChooser(gx, s, say, close);
    }

    function placePane() {
      const pickTo = el("select", { className: "v2-field" }, [
        el("optgroup", { label: "학과" }, depts.map((x) => el("option", { value: `d:${x.id}`, textContent: x.name }))),
        ...(vacSets.length ? [el("optgroup", { label: "방학 특강" }, vacSets.map((x) => el("option", { value: `v:${x.id}`, textContent: x.name })))] : []),
      ]);
      pickTo.setAttribute("aria-label", "학과 또는 방학 특강");
      const save = btn("지정", async () => {
        const [kind, id] = pickTo.value.split(":");
        save.disabled = true;
        let error;
        if (kind === "d") {
          // 학과에 넣고 순서가 없으면 맨 뒤(학과 관리 저장과 같은 함수)
          const next = Math.max(-1, ...subjects.map((x) => x.sort_order ?? -1).filter((n) => n < 1e9)) + 1; // 1e9 = 방금 만든 과목(DB가 맨 뒤 순서를 줌)
          ({ error } = await supabase.rpc("comsw_save_subject_layout", {
            p_add: [{ subject_id: s.id, department_id: id }],
            p_subjects: s.sort_order == null ? [{ id: s.id, sort_order: next }] : [],
            p_remove: [],
          }));
          if (!error) { links.push({ subject_id: s.id, department_id: id }); if (s.sort_order == null) s.sort_order = next; }
        } else if (!vacTable) {
          save.disabled = false;
          return fail(say, "방학 특강 지정은 운영 SQL(20261103020000) 실행 뒤에 쓸 수 있습니다.");
        } else {
          ({ error } = await supabase.from("vacation_set_subjects").insert({ set_id: id, subject_id: s.id }));
          if (!error) vacLinks.push({ set_id: id, subject_id: s.id });
        }
        save.disabled = false;
        if (error) return fail(say, dbErrorMessage(error));
        close();
      }, true);
      return [el("p", { className: "muted", textContent: "비슷한 과목이 없으면 학과(맨 뒤 순서) 또는 방학 특강에 바로 넣습니다." }), pickTo, el("div", {}, [save])];
    }

    const panes = ["그룹 연결", "학과·방학 특강 지정"];
    body.append(...tabBox(panes, (i) => (i === 0 ? groupPane() : placePane())), say);
    d = modal(`${s.name} · 연결`, [body], [], "닫기");
    d.classList.add("v3-narrow", "v3-linkpop");
  }

  function cleanupView() {
    const box = el("div");
    const say = el("p", { className: "save-state" });
    const draw = () => {
      const list = subjects.filter((s) => !s.group_id && (noCurriculum(s) || nowhere(s)));
      if (!list.length) return box.replaceChildren(empty("정리할 과목이 없습니다."), say);
      const t = table(["과목", "학과", "정리할 이유", ""], list, (s) => [
        s.name, deptNames(s.id) || "—",
        el("span", { className: "v2-row v2-gap" }, [
          ...(noCurriculum(s) ? [chip("커리큘럼 미입력", "warn")] : []),
          ...(nowhere(s) ? [chip("학과·방특 미포함", "warn")] : []),
        ]),
        el("span", { className: "v2-row v2-gap" }, [
          btn("삭제", async (e) => {
            const b = e.currentTarget;
            b.disabled = true;
            try {
              if (!(await deleteSubject(supabase, s))) return;
            } catch (err) { return fail(say, err.message); } finally { b.disabled = false; }
            subjects.splice(subjects.indexOf(s), 1);
            done(say, `'${s.name}' 과목을 삭제했습니다. 공개 사이트에서는 '사이트 반영' 후 빠집니다.`);
            draw();
          }),
          btn("연결", () => linkPopup(s, draw)),
        ]),
      ]);
      box.replaceChildren(el("p", { className: "muted", textContent: `${list.length}개 · 커리큘럼 미입력 = 선생님 커리큘럼(승인·대기·방특)이 하나도 없음, 학과·방특 미포함 = 어느 학과·방학 특강에도 없음. 그룹에 넣은 과목은 빼고 봅니다.` }), t.node, say);
    };
    draw();
    return [box];
  }

  function groupsView() {
    if (!hasGroup) return [empty(LOCKED)];
    const box = el("div");
    const say = el("p", { className: "save-state" });
    const popup = (title, g) => {
      const psay = el("p", { className: "save-state" });
      let d;
      const saved = () => { d.close?.(); d.remove(); draw(); };
      d = modal(title, [el("div", { className: "v3-linkbody" }, [...groupPicker(gx, g, psay, saved), psay])], [], "닫기");
      d.classList.add("v3-narrow", "v3-linkpop");
    };
    const make = btn("그룹 만들기", () => popup("그룹 만들기", null), true);
    const draw = () => {
      const head = el("div", { className: "v3-headbar" }, [make]);
      if (!groups.length) return box.replaceChildren(head, empty("만든 그룹이 없습니다. [그룹 만들기] 또는 과목 정리의 [연결]로 묶습니다."), say);
      const list = [...groups].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      const t = table(["그룹", "과목", "학과", ""], list, (g) => [
        g.name,
        el("span", { className: "v2-row v2-gap v3-wrap" }, membersOf(g.id).map((c) => el("span", { className: "v3-tchip" }, [
          el("span", { textContent: c.name }),
          Object.assign(el("button", { type: "button", className: "v3-x", textContent: "−", title: `${c.name} 그룹에서 빼기` }), {
            onclick: async () => {
              const { error } = await supabase.from("subjects").update({ group_id: null }).eq("id", c.id);
              if (error) return fail(say, dbErrorMessage(error));
              c.group_id = null;
              done(say, `'${c.name}'을(를) '${g.name}' 그룹에서 뺐습니다.`);
              draw();
            },
          }),
        ]))),
        [...new Set(membersOf(g.id).flatMap((c) => links.filter((l) => l.subject_id === c.id).map((l) => nameOf(depts, l.department_id))))].join(", ") || "—",
        el("span", { className: "v2-row v2-gap" }, [
          btn("과목 고르기", () => popup(`${g.name} · 과목 고르기`, g)),
          btn("그룹 삭제", async () => {
            if (!confirm(`'${g.name}' 그룹을 삭제할까요? 과목은 그대로 남고 그룹에서만 빠집니다.`)) return;
            const { error } = await supabase.from("subject_groups").delete().eq("id", g.id);
            if (error) return fail(say, dbErrorMessage(error));
            membersOf(g.id).forEach((c) => { c.group_id = null; });
            groups.splice(groups.indexOf(g), 1);
            done(say, `'${g.name}' 그룹을 삭제했습니다.`);
            draw();
          }),
        ]),
      ]);
      box.replaceChildren(head, t.node, say);
    };
    draw();
    return [box];
  }

  container.append(el("section", { className: "v2-panel" }, tabBox(TABS, (i) => [createView, deleteView, cleanupView, groupsView][i]())));
}
