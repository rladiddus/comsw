import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { subsetReorderUpdates } from "../order.mjs";
import { dropTarget } from "../card-list.mjs";
import { showWeeks } from "../subject-weeks.mjs";

export const LEVELS = ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];

// 학과 과목만 끌어 옮기고 다른 학과 과목 자리·순서 없는 과목은 그대로(공용 계산).
export const deptReorderUpdates = subsetReorderUpdates;

// 커리큘럼 관리 > 학과 커리큘럼: 학과를 고르면 그 학과 과목(전체수업에 나오는 과목)을 보여 준다.
// 학과별 커리큘럼 요약은 '신청 과목'에서 정리해 '적용'한 문구가 들어오므로 여기서는 보기만 하고,
// 줄마다 '수정'으로 과목명·기간·프로그램·준비물(따로 고치고 사이트에는 한 칸)·학습 수준(별 1~5개)을 고친다.
// 과목명은 id로 연결돼 있어 선생님 커리큘럼·로드맵 등 모든 곳에 바뀐 이름이 나온다. '단계'는 과목 안의 단계(사이트 '전체 수업').
// 왼쪽 ⠿를 끌면 전체수업 순서가 바뀐다. '+ 과목 추가'는 다른 과목을 이 학과에 넣고, '제외'는 이 학과에서만 뺀다
// (마지막 학과에서까지 빼면 DB가 '기타 과목'으로 보낸다). 승인 전 신규 과목(순서 없음)은 '신규 과목 추가' 탭에만 보인다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent:
        "학과를 고르면 그 학과 과목이 나옵니다. 학과별 커리큘럼 요약은 '신청 과목'에서 적용한 문구가 들어옵니다. '수정'으로 과목명·기간·프로그램·준비물·학습 수준을 고치고(사이트에는 프로그램·준비물이 한 칸에 나옵니다), '단계'로 사이트 '전체 수업'의 과목 단계를 고칩니다. 왼쪽 ⠿를 끌어 순서(사이트 '전체 수업' 순서)를 바꿀 수 있습니다. 선생님이 적은 프로그램·준비물은 승인할 때 합쳐집니다.",
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
  const weeks = el("section", { className: "subject-weeks" });
  // 다른 과목을 이 학과에 넣는다(학과 > 학과별 과목과 같은 연결). 전체 수업에 없던 과목은 맨 뒤에 넣는다.
  const addPick = el("select");
  addPick.setAttribute("aria-label", "추가할 과목");
  const addBtn = el("button", { type: "button", className: "publish-btn", textContent: "+ 과목 추가" });
  container.append(
    el("div", { className: "search-bar" }, [
      el("label", { className: "form-field" }, [el("span", { textContent: "학과" }), dept]),
      el("label", { className: "form-field" }, [el("span", { textContent: "다른 과목" }), addPick]),
      addBtn,
    ]),
    table,
    weeks,
  );
  // 승인 전 신규 과목(학과 연결 있음, 순서 없음)은 여기서 다루지 않는다.
  const pending = (s) => s.sort_order == null && links.some((l) => l.subject_id === s.id);
  const fillAdd = () => {
    const mine = new Set(inDept().map((s) => s.id));
    addPick.replaceChildren(
      el("option", { value: "", textContent: "과목 고르기" }),
      ...subjects.filter((s) => !mine.has(s.id) && !pending(s)).sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .map((s) => el("option", { value: s.id, textContent: s.name })),
    );
  };
  addBtn.addEventListener("click", async () => {
    const subject = subjects.find((s) => s.id === addPick.value);
    if (!subject) return setState("추가할 과목을 골라주세요", true);
    addBtn.disabled = true;
    const link = { subject_id: subject.id, department_id: dept.value };
    let { error } = await supabase.from("subject_departments").insert(link);
    if (!error && subject.sort_order == null) {
      const sort_order = subjects.reduce((m, s) => Math.max(m, s.sort_order ?? -1), -1) + 1;
      ({ error } = await supabase.from("subjects").update({ sort_order }).eq("id", subject.id));
      if (!error) subject.sort_order = sort_order;
    }
    addBtn.disabled = false;
    if (error) return setState(dbErrorMessage(error), true);
    links.push(link);
    setState(`'${subject.name}'을(를) 추가했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    draw();
  });
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
    const name = el("input", { type: "text", value: subject.name ?? "", readOnly: true, placeholder: "과목명" });
    const duration = el("input", { type: "text", value: subject.duration ?? "", readOnly: true, placeholder: "기간" });
    const tools = el("textarea", { value: subject.tools ?? "", rows: 3, readOnly: true, placeholder: "프로그램" });
    const supplies = el("textarea", { value: subject.supplies ?? "", rows: 3, readOnly: true, placeholder: "준비물" });
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
      const inputs = [name, duration, tools, supplies];
      if (tools.readOnly) {
        for (const x of inputs) x.readOnly = false;
        level.disabled = false;
        edit.textContent = "저장";
        edit.className = "publish-btn";
        return;
      }
      if (!name.value.trim()) return setState("과목명을 입력해주세요", true);
      edit.disabled = true;
      const patch = { name: name.value.trim(), duration: duration.value.trim() || null, tools: tools.value.trim() || null, supplies: supplies.value.trim() || null, level: level.value || null };
      const { error } = await supabase.from("subjects").update(patch).eq("id", subject.id);
      edit.disabled = false;
      if (error) return setState(dbErrorMessage(error), true);
      Object.assign(subject, patch);
      for (const x of inputs) x.readOnly = true;
      level.disabled = true;
      edit.textContent = "수정";
      edit.className = "ghost-btn";
      setState(`'${subject.name}'을(를) 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    });
    const exclude = el("button", { type: "button", className: "ghost-btn", textContent: "제외" });
    exclude.addEventListener("click", async () => {
      const name = depts.find((d) => d.id === dept.value)?.name ?? "이 학과";
      if (!confirm(`'${subject.name}'을(를) ${name} 커리큘럼에서 뺄까요? 과목 내용은 지워지지 않습니다.`)) return;
      const { error } = await supabase.from("subject_departments").delete()
        .eq("department_id", dept.value).eq("subject_id", subject.id);
      if (error) return setState(dbErrorMessage(error), true);
      links.splice(links.findIndex((l) => l.department_id === dept.value && l.subject_id === subject.id), 1);
      const last = !links.some((l) => l.subject_id === subject.id);
      if (last) subject.sort_order = null; // DB가 기타 과목으로 보낸 것과 같게
      setState(`'${subject.name}'을(를) 뺐습니다.${last ? " 어느 학과에도 없어 '기타 과목'으로 옮겼습니다." : ""} 공개 사이트에는 '적용' 후 반영됩니다.`);
      draw();
    });
    const stepsBtn = el("button", { type: "button", className: "ghost-btn", textContent: "단계" });
    stepsBtn.addEventListener("click", () => showWeeks(weeks, supabase, subject));
    const handle = el("span", { className: "drag-handle", textContent: "⠿", title: "끌어서 순서 바꾸기" });
    const box = el("div", { className: "dept-curriculum-row" }, [
      handle,
      cell("name", "과목명", name),
      cell("duration", "기간", duration),
      cell("dept_curriculum", "학과별 커리큘럼 요약", fixed(subject.dept_curriculum, "textarea")),
      cell("tools", "프로그램", tools),
      cell("supplies", "준비물", supplies),
      cell("level", "학습 수준", level),
      el("div", { className: "dept-cell cell-actions" }, [stepsBtn, exclude, edit]),
    ]);
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
    return box;
  }

  function draw() {
    fillAdd();
    const main = ordered();
    table.replaceChildren(
      el("div", { className: "dept-curriculum-row dept-curriculum-head" },
        [el("span"), ...["과목명", "기간", "학과별 커리큘럼 요약", "프로그램", "준비물", "학습 수준"].map((t) => el("span", { textContent: t })), el("span")]),
      ...main.map(row),
      ...(!main.length
        ? [el("p", { className: "muted", textContent: "이 학과에 들어간 과목이 없습니다. 위 '+ 과목 추가'로 더해주세요." })]
        : []),
    );
  }
  dept.addEventListener("change", () => {
    setState("");
    draw();
  });
  draw();
}
