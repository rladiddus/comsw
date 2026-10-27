import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { subsetReorderUpdates } from "../order.mjs";
import { dropTarget } from "../card-list.mjs";

// 학과 관리 > 학과별 과목: 왼쪽 = 고른 학과의 과목(순서대로, ⠿로 위아래), 오른쪽 = 이 학과에 없는 과목(이름 검색, '추가').
// 순서는 학과 커리큘럼과 같은 값(subjects.sort_order = 사이트 '전체 수업' 순서)이라, 여기서 바꾸면 학과 커리큘럼 순서도 같이 바뀐다.
// 그 학과 과목끼리만 자리를 바꾸고 다른 학과 과목 자리는 그대로 둔다(학과 커리큘럼과 같은 계산).
// 기타 과목을 더하면 전체수업 맨 뒤에 넣고, 마지막 학과에서 빼면 DB가 기타 과목으로 보낸다.
// 승인 전 신규 과목(학과 연결 있음, 순서 없음)은 '신규 과목 추가'에서 다루므로 오른쪽 목록에 넣지 않는다.
// 추가·빼기·순서는 화면에서만 바뀌고 '저장'을 눌러야 DB에 들어간다(→ 학과 커리큘럼에 보임, 사이트는 우상단 '적용' 후).
// '되돌리기'는 마지막 저장 상태로. 여러 학과를 오가며 고친 뒤 한 번에 저장할 수 있다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과별 과목" }),
    el("p", {
      className: "desc",
      textContent: "왼쪽에서 학과를 고르면 그 학과 과목이 순서대로 나옵니다. ⠿를 끌어 순서를 바꾸고, 오른쪽에서 과목을 찾아 '추가'하세요. '저장'을 누르면 '커리큘럼 관리 > 학과 커리큘럼'에 먼저 반영되고, 공개 사이트에는 우상단 '적용'을 눌러야 나옵니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
  ]);
  // 마지막 저장 상태(되돌리기·바뀐 것 계산용)
  const linkKey = (l) => `${l.subject_id}|${l.department_id}`;
  let savedLinks = new Set(links.map(linkKey));
  let savedOrder = new Map(subjects.map((x) => [x.id, x.sort_order ?? null]));
  const saveBtn = el("button", { type: "button", className: "publish-btn", textContent: "저장" });
  const undoBtn = el("button", { type: "button", className: "ghost-btn", textContent: "되돌리기" });
  const changeInfo = el("span", { className: "muted" });
  container.append(el("div", { className: "editor-bar" }, [saveBtn, undoBtn, changeInfo]));
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

  function reorder(from, to) {
    for (const u of subsetReorderUpdates(subjects, ordered().map((s) => s.id), from, to)) {
      subjects.find((s) => s.id === u.id).sort_order = u.sort_order;
    }
    draw();
  }
  function add(subject) {
    // 기타 과목(순서 없음)은 전체수업 맨 뒤로.
    if (subject.sort_order == null) subject.sort_order = subjects.reduce((m, s) => Math.max(m, s.sort_order ?? -1), -1) + 1;
    links.push({ subject_id: subject.id, department_id: dept.value });
    draw();
  }
  function remove(subject) {
    links.splice(links.findIndex((l) => l.subject_id === subject.id && l.department_id === dept.value), 1);
    // 어느 학과에도 없게 되면 저장 때 DB가 기타 과목(순서 없음)으로 보낸다.
    if (!links.some((l) => l.subject_id === subject.id)) subject.sort_order = null;
    draw();
  }
  // 바뀐 것: 새 연결 / 빠진 연결 / 순서가 바뀐 과목(기타 과목으로 갈 과목은 DB가 처리)
  const changes = () => {
    const now = new Set(links.map(linkKey));
    const added = links.filter((l) => !savedLinks.has(linkKey(l)));
    const removed = [...savedLinks].filter((k) => !now.has(k)).map((k) => {
      const [subject_id, department_id] = k.split("|");
      return { subject_id, department_id };
    });
    const moved = subjects.filter((x) => x.sort_order != null && x.sort_order !== savedOrder.get(x.id));
    return { added, removed, moved, count: added.length + removed.length + moved.length };
  };
  saveBtn.addEventListener("click", async () => {
    const { added, removed, moved, count } = changes();
    if (!count) return setState("바뀐 것이 없습니다");
    saveBtn.disabled = true;
    try {
      // 학과 커리큘럼과 같은 DB 함수 한 번 = 전부 저장되거나 전부 안 됨
      const { error } = await supabase.rpc("comsw_save_subject_layout", {
        p_add: added,
        p_subjects: moved.map((x) => ({ id: x.id, sort_order: x.sort_order })),
        p_remove: removed,
      });
      if (error) throw error;
      savedLinks = new Set(links.map(linkKey));
      savedOrder = new Map(subjects.map((x) => [x.id, x.sort_order ?? null]));
      setState("저장했습니다. '학과 커리큘럼'에 반영됐고, 공개 사이트에는 우상단 '적용'을 눌러야 나옵니다.");
      draw();
    } catch (error) {
      setState(`${dbErrorMessage(error)} — 아무것도 저장되지 않았습니다. 고친 뒤 다시 저장해주세요.`, true);
    } finally {
      saveBtn.disabled = false;
    }
  });
  undoBtn.addEventListener("click", () => {
    links.splice(0, links.length, ...[...savedLinks].map((k) => {
      const [subject_id, department_id] = k.split("|");
      return { subject_id, department_id };
    }));
    for (const x of subjects) x.sort_order = savedOrder.get(x.id);
    setState("마지막 저장 상태로 되돌렸습니다");
    draw();
  });

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
    const { count } = changes();
    changeInfo.textContent = count ? `저장 안 된 변경 ${count}개` : "";
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
