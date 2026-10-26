import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { subsetReorderUpdates } from "../order.mjs";
import { dropTarget } from "../card-list.mjs";

// 학과 관리 > 학과별 과목: 왼쪽 = 고른 학과의 과목(순서대로, ⠿로 위아래), 오른쪽 = 이 학과에 없는 과목(이름 검색, '추가').
// 순서는 학과 커리큘럼과 같은 값(subjects.sort_order = 사이트 '전체 수업' 순서)이라, 여기서 바꾸면 학과 커리큘럼 순서도 같이 바뀐다.
// 그 학과 과목끼리만 자리를 바꾸고 다른 학과 과목 자리는 그대로 둔다(학과 커리큘럼과 같은 계산).
// 기타 과목을 더하면 전체수업 맨 뒤에 넣고, 마지막 학과에서 빼면 DB가 기타 과목으로 보낸다.
// 승인 전 신규 과목(학과 연결 있음, 순서 없음)은 '신규 과목 추가'에서 다루므로 오른쪽 목록에 넣지 않는다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과별 과목" }),
    el("p", {
      className: "desc",
      textContent: "왼쪽에서 학과를 고르면 그 학과 과목이 순서대로 나옵니다. ⠿를 끌어 순서를 바꾸면 '커리큘럼 관리 > 학과 커리큘럼'과 사이트 '전체 수업' 순서도 같이 바뀝니다. 오른쪽에서 과목을 찾아 '추가'하세요.",
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
  const search = el("input", { type: "search", placeholder: "과목 이름 검색" });
  search.setAttribute("aria-label", "과목 검색");
  const left = el("div", { className: "dept-subject-list" });
  const right = el("div", { className: "dept-subject-list" });
  container.append(el("div", { className: "dept-subject-columns" }, [
    el("section", { className: "workspace-card" }, [
      el("label", { className: "form-field" }, [el("span", { textContent: "학과" }), dept]),
      left,
    ]),
    el("section", { className: "workspace-card" }, [
      el("label", { className: "form-field" }, [el("span", { textContent: "다른 과목" }), search]),
      right,
    ]),
  ]));

  const linked = (s) => links.some((l) => l.subject_id === s.id && l.department_id === dept.value);
  const pending = (s) => s.sort_order == null && links.some((l) => l.subject_id === s.id);
  const ordered = () => subjects.filter((s) => linked(s) && s.sort_order != null).sort((a, b) => a.sort_order - b.sort_order);
  let dragFrom = -1;

  async function reorder(from, to) {
    for (const u of subsetReorderUpdates(subjects, ordered().map((s) => s.id), from, to)) {
      const { error } = await supabase.from("subjects").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) return setState(dbErrorMessage(error), true);
      subjects.find((s) => s.id === u.id).sort_order = u.sort_order;
    }
    setState("순서를 바꿨습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
    draw();
  }
  async function add(subject) {
    let { error } = await supabase.from("subject_departments").insert({ subject_id: subject.id, department_id: dept.value });
    if (!error && subject.sort_order == null) {
      const sort_order = subjects.reduce((m, s) => Math.max(m, s.sort_order ?? -1), -1) + 1;
      ({ error } = await supabase.from("subjects").update({ sort_order }).eq("id", subject.id));
      if (!error) subject.sort_order = sort_order;
    }
    if (error) return setState(dbErrorMessage(error), true);
    links.push({ subject_id: subject.id, department_id: dept.value });
    setState(`'${subject.name}'을(를) 더했습니다`);
    draw();
  }
  async function remove(subject) {
    const name = depts.find((d) => d.id === dept.value)?.name;
    if (!confirm(`'${name}'에서 '${subject.name}' 과목을 뺄까요? (과목 자체는 지워지지 않습니다)`)) return;
    const { error } = await supabase.from("subject_departments").delete()
      .eq("subject_id", subject.id).eq("department_id", dept.value);
    if (error) return setState(dbErrorMessage(error), true);
    links.splice(links.findIndex((l) => l.subject_id === subject.id && l.department_id === dept.value), 1);
    const last = !links.some((l) => l.subject_id === subject.id);
    if (last) subject.sort_order = null; // DB가 기타 과목으로 보낸 것과 같게
    setState(`'${subject.name}'을(를) 뺐습니다.${last ? " 어느 학과에도 없어 '기타 과목'으로 옮겼습니다." : ""}`);
    draw();
  }

  function leftRow(subject, index) {
    const handle = el("span", { className: "drag-handle", textContent: "⠿", title: "끌어서 순서 바꾸기" });
    const out = el("button", { type: "button", className: "ghost-btn danger", textContent: "빼기" });
    out.addEventListener("click", () => remove(subject));
    const box = el("div", { className: "dept-subject-row" }, [handle, el("span", { textContent: subject.name }), out]);
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
    const mine = ordered();
    const waiting = subjects.filter((s) => linked(s) && s.sort_order == null);
    left.replaceChildren(
      el("p", { className: "muted", textContent: `과목 ${mine.length + waiting.length}개` }),
      ...mine.map(leftRow),
      ...waiting.map((s) => el("div", { className: "dept-subject-row muted" }, [el("span"), el("span", { textContent: `${s.name} (승인 전 신규 과목)` }), el("span")])),
    );
    const word = search.value.trim().toLowerCase();
    const rest = subjects
      .filter((s) => !linked(s) && !pending(s) && (!word || s.name.toLowerCase().includes(word)))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    right.replaceChildren(
      el("p", { className: "muted", textContent: `${rest.length}개` }),
      ...rest.map((s) => {
        const plus = el("button", { type: "button", className: "ghost-btn", textContent: "추가" });
        plus.addEventListener("click", () => add(s));
        return el("div", { className: "dept-subject-row" }, [el("span", { textContent: s.name }), plus]);
      }),
    );
  }
  dept.addEventListener("change", () => {
    setState("");
    draw();
  });
  search.addEventListener("input", draw);
  draw();
}
