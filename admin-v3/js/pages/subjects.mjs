import { el, pick, btn, chip, empty, select, table, tabBox, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { deleteSubject } from "../v3.mjs";

// 과목 관리(V3, 2026-11-03 사용자 요청): [과목 생성] 학과를 고르고 과목명을 적어 그 학과 맨 뒤에 만든다(comsw_create_subject).
// [과목 정리] 만들었지만 ① 강사 커리큘럼(승인·대기·방특)이 하나도 없거나 ② 어느 학과에도 없고 방특에도 안 쓰인 과목(방특 전용 과목은 포함으로 봄). [삭제]로 지운다.
// 과목 순서·학과에 넣기/빼기는 '학과 관리'에서.
const TABS = ["과목 생성", "과목 정리"];

export async function render(container, ctx) {
  const { supabase } = ctx;
  headActions(ctx);
  const [depts, subjects, links, curricula] = await Promise.all([
    pick(supabase, "departments", "id, name, sort_order", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "subject_id, vacation"),
  ]);
  const deptNames = (id) => links.filter((l) => l.subject_id === id).map((l) => nameOf(depts, l.department_id)).join(", ");
  const noCurriculum = (s) => !curricula.some((c) => c.subject_id === s.id);
  const nowhere = (s) => !s.is_vacation && !links.some((l) => l.subject_id === s.id) && !curricula.some((c) => c.subject_id === s.id && c.vacation);

  function createView() {
    const deptSel = select("학과", depts.map((d) => [d.id, d.name]));
    const name = el("input", { type: "text", className: "v2-field", maxLength: 80, placeholder: "과목 이름" });
    name.setAttribute("aria-label", "과목 이름");
    const say = el("p", { className: "save-state" });
    const make = btn("생성", async () => {
      const n = name.value.trim();
      if (!n) { say.textContent = "과목 이름을 입력해주세요"; say.className = "save-state err"; return; }
      make.disabled = true;
      const { data: id, error } = await supabase.rpc("comsw_create_subject", { p_name: n, p_department_ids: [deptSel.value] });
      make.disabled = false;
      if (error) { say.textContent = dbErrorMessage(error); say.className = "save-state err"; return; }
      subjects.push({ id, name: n, is_vacation: false, sort_order: 1e9 });
      links.push({ subject_id: id, department_id: deptSel.value });
      name.value = "";
      say.textContent = `'${n}' 과목을 ${nameOf(depts, deptSel.value)} 맨 뒤에 만들었습니다. 그 학과 선생님은 바로 커리큘럼을 낼 수 있고, 공개 사이트에는 '사이트 반영' 후 보입니다.`;
      say.className = "save-state";
    }, true);
    return [el("div", { className: "v3-newsubject" }, [
      el("label", { className: "form-field" }, [el("span", { textContent: "학과" }), deptSel]),
      el("label", { className: "form-field" }, [el("span", { textContent: "과목 이름" }), name]),
      el("div", {}, [make]),
      say,
    ])];
  }

  function cleanupView() {
    const say = el("p", { className: "save-state" });
    const list = subjects.filter((s) => noCurriculum(s) || nowhere(s));
    if (!list.length) return [empty("정리할 과목이 없습니다.")];
    const t = table(["과목", "학과", "정리할 이유", ""], list, (s) => [
      s.name, deptNames(s.id) || "—",
      el("span", { className: "v2-row v2-gap" }, [
        ...(noCurriculum(s) ? [chip("커리큘럼 미입력", "warn")] : []),
        ...(nowhere(s) ? [chip("학과·방특 미포함", "warn")] : []),
      ]),
      btn("삭제", async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          if (!(await deleteSubject(supabase, s))) return;
        } catch (err) { say.textContent = err.message; say.className = "save-state err"; return; } finally { b.disabled = false; }
        subjects.splice(subjects.indexOf(s), 1);
        list.splice(list.indexOf(s), 1);
        t.draw(list);
        say.textContent = `'${s.name}' 과목을 삭제했습니다. 공개 사이트에서는 '사이트 반영' 후 빠집니다.`;
        say.className = "save-state";
      }),
    ]);
    return [el("p", { className: "muted", textContent: `${list.length}개 · 커리큘럼 미입력 = 선생님 커리큘럼(승인·대기·방특)이 하나도 없음, 학과·방특 미포함 = 어느 학과에도 없고 방학 특강에도 안 쓰임` }), t.node, say];
  }

  container.append(el("section", { className: "v2-panel" }, tabBox(TABS, (i) => (i === 0 ? createView() : cleanupView()))));
}
