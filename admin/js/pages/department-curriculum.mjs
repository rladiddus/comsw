import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { subsetReorderUpdates } from "../order.mjs";
import { dropTarget } from "../card-list.mjs";

export const LEVELS = ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];

// 학과 과목만 끌어 옮기고 다른 학과 과목 자리·순서 없는 과목은 그대로(공용 계산).
export const deptReorderUpdates = subsetReorderUpdates;

// 커리큘럼 관리 > 학과 커리큘럼: 학과를 고르면 그 학과 과목을 '과목·단계'와 같은 칸으로 보여 준다.
// 학과별 커리큘럼 요약은 '신청 과목'에서 정리해 '적용'한 문구가 들어오므로 여기서는 보기만 하고,
// 줄마다 '수정'으로 프로그램·준비물과 학습 수준(별 1~5개)만 고친다. 왼쪽 ⠿를 끌면 전체수업 순서가 바뀐다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent:
        "학과를 고르면 그 학과 과목이 나옵니다. 학과별 커리큘럼 요약은 '신청 과목'에서 적용한 문구가 들어옵니다. '수정'으로 프로그램·준비물과 학습 수준을 고치고, 왼쪽 ⠿를 끌어 순서(사이트 '전체 수업' 순서)를 바꿀 수 있습니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
  ]);
  const dept = el("select", {}, depts.map((d) => el("option", { value: d.id, textContent: d.name })));
  dept.setAttribute("aria-label", "학과");
  const table = el("div", { className: "dept-curriculum-table" });
  container.append(
    el("label", { className: "form-field settings-select" }, [el("span", { textContent: "학과" }), dept]),
    table,
  );
  const inDept = () => subjects.filter((s) => links.some((l) => l.department_id === dept.value && l.subject_id === s.id));
  const ordered = () => inDept().filter((s) => s.sort_order != null).sort((a, b) => a.sort_order - b.sort_order);
  let dragFrom = -1;

  async function reorder(from, to) {
    const updates = deptReorderUpdates(subjects, ordered().map((s) => s.id), from, to);
    for (const u of updates) {
      const { error } = await supabase.from("subjects").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) return setState(dbErrorMessage(error), true);
      subjects.find((s) => s.id === u.id).sort_order = u.sort_order;
    }
    setState("순서를 바꿨습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
    draw();
  }

  function row(subject, index) {
    const cell = (key, label, node) =>
      el("div", { className: `dept-cell cell-${key}` }, [el("span", { className: "cell-label", textContent: label }), node]);
    const fixed = (value, tag = "input") =>
      el(tag, { value: value ?? "", readOnly: true, tabIndex: -1, ...(tag === "textarea" ? { rows: 3 } : { type: "text" }) });
    const program = el("textarea", { value: subject.program ?? "", rows: 3, readOnly: true });
    const level = el("select", { disabled: true }, [
      el("option", { value: "", textContent: "선택 안 함" }),
      ...LEVELS.map((v) => el("option", { value: v, textContent: v })),
    ]);
    if (subject.level && !LEVELS.includes(subject.level)) {
      level.append(el("option", { value: subject.level, textContent: `(현재) ${subject.level}` }));
    }
    level.value = subject.level ?? "";
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    edit.addEventListener("click", async () => {
      if (program.readOnly) {
        program.readOnly = false;
        level.disabled = false;
        edit.textContent = "저장";
        edit.className = "publish-btn";
        return;
      }
      edit.disabled = true;
      const patch = { program: program.value.trim() || null, level: level.value || null };
      const { error } = await supabase.from("subjects").update(patch).eq("id", subject.id);
      edit.disabled = false;
      if (error) return setState(dbErrorMessage(error), true);
      Object.assign(subject, patch);
      program.readOnly = true;
      level.disabled = true;
      edit.textContent = "수정";
      edit.className = "ghost-btn";
      setState(`'${subject.name}'을(를) 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    });
    const draggable = subject.sort_order != null;
    const handle = el("span", {
      className: `drag-handle${draggable ? "" : " off"}`,
      textContent: draggable ? "⠿" : "",
      title: draggable ? "끌어서 순서 바꾸기" : "전체 수업에 나오지 않는 과목(순서 없음)",
    });
    const box = el("div", { className: "dept-curriculum-row" }, [
      handle,
      cell("name", "과목명", fixed(subject.name)),
      cell("duration", "기간", fixed(subject.duration)),
      cell("dept_curriculum", "학과별 커리큘럼 요약", fixed(subject.dept_curriculum, "textarea")),
      cell("program", "프로그램·준비물", program),
      cell("level", "학습 수준", level),
      el("div", { className: "dept-cell cell-actions" }, [edit]),
    ]);
    if (draggable) {
      handle.addEventListener("pointerdown", () => { box.draggable = true; });
      box.addEventListener("dragstart", (e) => {
        dragFrom = index;
        e.dataTransfer?.setData?.("text/plain", String(index));
        box.classList.add("dragging");
      });
      box.addEventListener("dragend", () => {
        dragFrom = -1;
        box.draggable = false;
        box.classList.remove("dragging");
      });
      dropTarget(box, index, () => dragFrom, reorder);
    }
    return box;
  }

  function draw() {
    const main = ordered();
    const others = inDept().filter((s) => s.sort_order == null);
    table.replaceChildren(
      el("div", { className: "dept-curriculum-row dept-curriculum-head" },
        [el("span"), ...["과목명", "기간", "학과별 커리큘럼 요약", "프로그램·준비물", "학습 수준"].map((t) => el("span", { textContent: t })), el("span")]),
      ...main.map(row),
      ...(others.length
        ? [el("p", { className: "muted dept-others", textContent: "전체 수업에 나오지 않는 과목(순서 없음)" }), ...others.map((s) => row(s, -1))]
        : []),
      ...(!main.length && !others.length
        ? [el("p", { className: "muted", textContent: "이 학과에 들어간 과목이 없습니다. '학과 > 학과별 과목'에서 더해주세요." })]
        : []),
    );
  }
  dept.addEventListener("change", () => {
    setState("");
    draw();
  });
  draw();
}
