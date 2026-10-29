import { el, rows, pick, chip, hint, btn, empty, tabBox, headActions } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { state, CAT, deptSubjects, contextBar, typeChip } from "../v3.mjs";

// 수업별 준비물(V3 시안 '준비물·교재·AI 도구', 정책 9D): 4분류 탭마다 그 분류의 등록·수정을 바로 한다(실제 저장).
// 교재·물품·AI 도구 = 기존 '수업별 준비물' 화면의 그 분류(course_prep_items), 사용 프로그램 = 과목의 '프로그램' 칸(subjects.tools).
// 위에서 고른 학과·유형의 과목 항목만 보여 준다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, curricula, idepts] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, is_vacation, sort_order, tools"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "instructor_curricula", "instructor_id, subject_id, vacation"),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
  ]);
  headActions(ctx, btn("준비물 검토 화면", () => { location.hash = "#/validation"; }));
  const body = el("div");
  const cats = Object.keys(CAT);
  let tab = 0;

  // 사용 프로그램: 과목마다 '프로그램' 칸 고치기
  function software(list) {
    if (!list.length) return [empty("이 학과·유형에 과목이 없습니다.")];
    return [
      ...list.map((s) => {
        const box = el("textarea", { className: "v2-textarea", rows: 2, value: s.tools ?? "", placeholder: "예: 포토샵, 일러스트레이터" });
        const msg = el("span", { className: "save-state" });
        const save = btn("저장", async () => {
          save.disabled = true;
          const { error } = await supabase.from("subjects").update({ tools: box.value.trim() || null }).eq("id", s.id);
          save.disabled = false;
          if (error) { msg.textContent = dbErrorMessage(error); msg.className = "save-state err"; return; }
          s.tools = box.value.trim();
          msg.textContent = "저장했습니다";
          msg.className = "save-state";
        }, true);
        return el("div", { className: "v2-mini-card" }, [el("div", { className: "v2-row v2-gap" }, [el("b", { textContent: s.name }), typeChip(s)]), box, el("div", { className: "v2-actions" }, [save, msg])]);
      }),
      hint("과목 공통 값입니다. 이 과목을 쓰는 모든 학과에 같이 나옵니다. 공개 사이트에는 '사이트 반영' 후 보입니다."),
    ];
  }

  function draw() {
    const keep = tab; // tabBox가 만들 때 첫 탭을 열어 tab이 0으로 바뀌므로 먼저 기억
    const list = deptSubjects(state.dept, state.mode, { subjects, links, curricula, idepts });
    const [bar, panelBody] = tabBox(cats.map((c) => CAT[c]), (i) => {
      tab = i;
      if (cats[i] === "software") return software(list);
      const box = el("div");
      import("../../../admin/js/pages/prep.mjs")
        .then(({ render: prep }) => prep(box, { ...ctx, prepCategory: cats[i], prepLabel: CAT[cats[i]], prepSubjects: new Set(list.map((s) => s.id)) }))
        .catch((e) => box.append(el("p", { className: "save-state err", textContent: e.message })));
      return [box];
    });
    body.replaceChildren(el("section", { className: "v2-panel" }, [bar, panelBody]));
    if (keep) bar.children[keep].click(); // 학과를 바꿔도 보던 탭 유지
  }
  container.append(
    el("div", { className: "v3-callout" }, [chip("9D", "vacation"), document.createTextNode(" 선생님이 분류를 정하고, 검사는 제안만 기록하며, 학과장이 확정한 것만 과목별 준비물에 올라갑니다. 준비물은 과목 하나에 하나(모든 학과 공용)입니다.")]),
    contextBar(depts, draw), body,
  );
  draw();
}
