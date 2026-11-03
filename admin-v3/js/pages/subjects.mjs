import { el, pick, btn, chip, empty, select, table, tabBox, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { deleteSubject, modal } from "../v3.mjs";

// 과목 관리(V3, 2026-11-03 사용자와 합의)
// [과목 생성] 학과를 고르고 과목명을 적어 그 학과 맨 뒤에 만든다(comsw_create_subject).
// [과목 정리] 만들었지만 ① 강사 커리큘럼(승인·대기·방특)이 하나도 없거나 ② 어느 학과·방학 특강에도 없는 과목(방특 전용 과목은 포함으로 봄).
//   하위 과목이 있는 대표 과목은 빼고 본다. 줄마다 [삭제] [연결]:
//   연결 ① 하위 과목 연결 = 이 과목을 대표 과목으로(예: '캐드 과정' ← 캐드1·캐드2, 한 단계만, subjects.parent_id)
//        ② 학과·방학 특강 지정 = 학과(맨 뒤 순서) 또는 방학 특강(vacation_set_subjects)에 넣기
// [과목 묶음] 대표 과목과 하위 과목, '−'로 연결 풀기.
// 대표 과목 칸·방학 특강 과목 표는 20261103020000 실행 전에는 없어서 그 기능만 잠긴다.
const TABS = ["과목 생성", "과목 정리", "과목 묶음"];
const norm = (t) => String(t ?? "").replace(/\s+/g, "").toLowerCase();
const fail = (say, text) => { say.textContent = text; say.className = "save-state err"; };
const done = (say, text) => { say.textContent = text; say.className = "save-state"; };

export async function render(container, ctx) {
  const { supabase } = ctx;
  headActions(ctx);
  const [depts, subjects, links, curricula, sets, vacTable] = await Promise.all([
    pick(supabase, "departments", "id, name, sort_order", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "*", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "subject_id, vacation"),
    pick(supabase, "curriculum_sets", "id, name, is_vacation, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "vacation_set_subjects", "set_id, subject_id").catch(() => null),
  ]);
  const vacSets = sets.filter((x) => x.is_vacation);
  const vacLinks = vacTable ?? [];
  const hasParent = subjects.some((s) => "parent_id" in s);
  const childrenOf = (id) => subjects.filter((c) => c.parent_id === id);
  const isParent = (s) => childrenOf(s.id).length > 0;
  const deptNames = (id) => links.filter((l) => l.subject_id === id).map((l) => nameOf(depts, l.department_id)).join(", ");
  const noCurriculum = (s) => !curricula.some((c) => c.subject_id === s.id);
  const nowhere = (s) => !s.is_vacation && !links.some((l) => l.subject_id === s.id)
    && !curricula.some((c) => c.subject_id === s.id && c.vacation) && !vacLinks.some((v) => v.subject_id === s.id);

  function createView() {
    const deptSel = select("학과", depts.map((d) => [d.id, d.name]));
    const name = el("input", { type: "text", className: "v2-field", maxLength: 80, placeholder: "과목 이름" });
    name.setAttribute("aria-label", "과목 이름");
    const say = el("p", { className: "save-state" });
    const make = btn("생성", async () => {
      const n = name.value.trim();
      if (!n) return fail(say, "과목 이름을 입력해주세요");
      make.disabled = true;
      const { data: id, error } = await supabase.rpc("comsw_create_subject", { p_name: n, p_department_ids: [deptSel.value] });
      make.disabled = false;
      if (error) return fail(say, dbErrorMessage(error));
      subjects.push({ id, name: n, is_vacation: false, sort_order: 1e9, ...(hasParent ? { parent_id: null } : {}) });
      links.push({ subject_id: id, department_id: deptSel.value });
      name.value = "";
      done(say, `'${n}' 과목을 ${nameOf(depts, deptSel.value)} 맨 뒤에 만들었습니다. 그 학과 선생님은 바로 커리큘럼을 낼 수 있고, 공개 사이트에는 '사이트 반영' 후 보입니다.`);
    }, true);
    return [el("div", { className: "v3-newsubject" }, [
      el("label", { className: "form-field" }, [el("span", { textContent: "학과" }), deptSel]),
      el("label", { className: "form-field" }, [el("span", { textContent: "과목 이름" }), name]),
      el("div", {}, [make]),
      say,
    ])];
  }

  // [연결] 팝업: ① 하위 과목 연결 ② 학과·방학 특강 지정
  function linkPopup(s, redraw) {
    const say = el("p", { className: "save-state" });
    const body = el("div", { className: "v3-linkbody" });
    let d;
    const close = () => { d.close?.(); d.remove(); redraw(); };

    function childPane() {
      if (!hasParent) return [empty("대표 과목 칸은 운영 SQL(20261103020000) 실행 뒤에 쓸 수 있습니다.")];
      if (s.parent_id) return [empty(`이 과목은 '${nameOf(subjects, s.parent_id)}'의 하위 과목이라 대표 과목이 될 수 없습니다.`)];
      // 후보: 자기 자신·다른 대표 과목은 빼고, 이름이 이 과목으로 시작하는 과목을 앞에 두고 미리 체크
      const like = (c) => norm(c.name).startsWith(norm(s.name));
      const cands = subjects.filter((c) => c.id !== s.id && !isParent(c))
        .sort((a, b) => Number(like(b)) - Number(like(a)) || a.name.localeCompare(b.name, "ko"));
      const chosen = new Set(cands.filter((c) => c.parent_id === s.id || (like(c) && !c.parent_id)).map((c) => c.id));
      const q = el("input", { type: "search", className: "v2-field", placeholder: "과목 검색" });
      q.setAttribute("aria-label", "과목 검색");
      const list = el("div", { className: "v3-linklist" });
      const fill = () => list.replaceChildren(...cands.filter((c) => norm(c.name).includes(norm(q.value))).map((c) => {
        const box = el("input", { type: "checkbox", checked: chosen.has(c.id) });
        box.addEventListener("change", () => { if (box.checked) chosen.add(c.id); else chosen.delete(c.id); });
        const now = c.parent_id && c.parent_id !== s.id ? ` (지금: ${nameOf(subjects, c.parent_id)})` : "";
        return el("label", { className: "consent" }, [box, el("span", { textContent: `${c.name}${now}` })]);
      }));
      q.addEventListener("input", fill);
      fill();
      const save = btn("연결", async () => {
        const add = [...chosen];
        const drop = childrenOf(s.id).map((c) => c.id).filter((id) => !chosen.has(id));
        if (!add.length && !drop.length) return fail(say, "연결할 과목을 골라주세요");
        save.disabled = true;
        const r1 = add.length ? await supabase.from("subjects").update({ parent_id: s.id }).in("id", add) : {};
        const r2 = !r1.error && drop.length ? await supabase.from("subjects").update({ parent_id: null }).in("id", drop) : {};
        save.disabled = false;
        const error = r1.error || r2.error;
        if (error) return fail(say, dbErrorMessage(error));
        subjects.forEach((c) => { if (add.includes(c.id)) c.parent_id = s.id; if (drop.includes(c.id)) c.parent_id = null; });
        close();
      }, true);
      return [el("p", { className: "muted", textContent: `'${s.name}'을(를) 대표 과목으로 두고 아래 고른 과목을 하위 과목으로 묶습니다.` }), q, list, el("div", {}, [save])];
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

    const panes = ["하위 과목 연결", "학과·방학 특강 지정"];
    body.append(...tabBox(panes, (i) => (i === 0 ? childPane() : placePane())), say);
    d = modal(`${s.name} · 연결`, [body], [], "닫기");
    d.classList.add("v3-narrow", "v3-linkpop");
  }

  function cleanupView() {
    const box = el("div");
    const say = el("p", { className: "save-state" });
    const draw = () => {
      const list = subjects.filter((s) => !isParent(s) && (noCurriculum(s) || nowhere(s)));
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
            subjects.forEach((c) => { if (c.parent_id === s.id) c.parent_id = null; });
            done(say, `'${s.name}' 과목을 삭제했습니다. 공개 사이트에서는 '사이트 반영' 후 빠집니다.`);
            draw();
          }),
          btn("연결", () => linkPopup(s, draw)),
        ]),
      ]);
      box.replaceChildren(el("p", { className: "muted", textContent: `${list.length}개 · 커리큘럼 미입력 = 선생님 커리큘럼(승인·대기·방특)이 하나도 없음, 학과·방특 미포함 = 어느 학과·방학 특강에도 없음. 하위 과목이 있는 대표 과목은 빼고 봅니다.` }), t.node, say);
    };
    draw();
    return [box];
  }

  function groupsView() {
    if (!hasParent) return [empty("과목 묶음은 운영 SQL(20261103020000) 실행 뒤에 쓸 수 있습니다.")];
    const box = el("div");
    const say = el("p", { className: "save-state" });
    const draw = () => {
      const parents = subjects.filter(isParent);
      if (!parents.length) return box.replaceChildren(empty("묶은 과목이 없습니다. 과목 정리에서 [연결]로 묶습니다."), say);
      const t = table(["대표 과목", "하위 과목", "학과(하위 과목)"], parents, (p) => [
        p.name,
        el("span", { className: "v2-row v2-gap v3-wrap" }, childrenOf(p.id).map((c) => el("span", { className: "v3-tchip" }, [
          el("span", { textContent: c.name }),
          Object.assign(el("button", { type: "button", className: "v3-x", textContent: "−", title: `${c.name} 연결 풀기` }), {
            onclick: async () => {
              const { error } = await supabase.from("subjects").update({ parent_id: null }).eq("id", c.id);
              if (error) return fail(say, dbErrorMessage(error));
              c.parent_id = null;
              done(say, `'${c.name}'을(를) '${p.name}'에서 풀었습니다.`);
              draw();
            },
          }),
        ]))),
        [...new Set(childrenOf(p.id).flatMap((c) => links.filter((l) => l.subject_id === c.id).map((l) => nameOf(depts, l.department_id))))].join(", ") || "—",
      ]);
      box.replaceChildren(t.node, say);
    };
    draw();
    return [box];
  }

  container.append(el("section", { className: "v2-panel" }, tabBox(TABS, (i) => [createView, cleanupView, groupsView][i]())));
}
