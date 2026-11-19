// 학과 구성 편집: 이 학과의 과목과 순서. 끌어서 옮기면(놓을 자리 경계에 점선) 순서가 바뀐다. 키보드는 Alt+↑/↓.
// 바꾸면 떠 있는 창 [임시 저장]/[사이트 적용](이 학과만, 학과별 커리큘럼·학과 전체 커리큘럼 순서).
import * as data from "../data.mjs";
import { h, box, note } from "../ui.mjs";
import { track } from "../changes.mjs";

// from번째를 to번째 자리(옮기기 전 기준, 0..length) 앞으로
export function moveItem(list, from, to) {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to > from ? to - 1 : to, 0, x);
  return next;
}

export function deptLayout(dept, ordered, allSubjects, { reload, stepPill, openSubject, rename }) {
  let list = [...ordered];
  const listEl = h("div", { class: "drag-list" });
  const add = h("select", { "aria-label": "넣을 과목" });
  let dragFrom = null;
  const clearMarks = () => listEl.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
  const draw = () => {
    listEl.replaceChildren(...(list.length ? list.map((s, i) => {
      const row = h("div", {
        class: "drag-row", draggable: "true", tabindex: "0", "aria-label": `${i + 1}. ${s.name} (끌어서 순서 바꾸기, Alt+↑/↓)`,
        ondragstart: (e) => { dragFrom = i; row.classList.add("dragging"); e.dataTransfer?.setData("text/plain", String(i)); },
        ondragend: () => { dragFrom = null; row.classList.remove("dragging"); clearMarks(); },
        ondragover: (e) => {
          if (dragFrom == null) return;
          e.preventDefault();
          const r = row.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          clearMarks();
          row.classList.add(after ? "drop-after" : "drop-before");
        },
        ondrop: (e) => {
          e.preventDefault();
          if (dragFrom == null) return;
          const to = i + (row.classList.contains("drop-after") ? 1 : 0);
          list = moveItem(list, dragFrom, to);
          dragFrom = null;
          draw();
        },
        onkeydown: (e) => {
          if (!e.altKey || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          const to = e.key === "ArrowUp" ? i - 1 : i + 2;
          if (to < 0 || to > list.length) return;
          list = moveItem(list, i, to);
          draw();
          listEl.children[e.key === "ArrowUp" ? i - 1 : i + 1]?.focus();
        },
      },
      h("span", { class: "drag-handle", "aria-hidden": "true" }, "⠿"),
      h("span", { class: "muted" }, `${i + 1}`),
      h("button", { type: "button", class: "subject-chip", onclick: () => openSubject(s.id) }, s.name), stepPill(s),
      h("button", { type: "button", class: "btn danger", style: "margin-left:auto", onclick: () => { list.splice(i, 1); draw(); } }, "이 학과에서 빼기"));
      return row;
    }) : [h("p", { class: "muted" }, "과목이 없습니다")]));
    const rest = allSubjects.filter((s) => !list.includes(s)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    add.replaceChildren(h("option", { value: "" }, "과목 넣기…"), ...rest.map((s) => h("option", { value: s.id }, s.name)));
  };
  add.onchange = () => {
    const s = allSubjects.find((x) => x.id === add.value);
    if (s) { list.push(s); draw(); }
  };
  const byId = new Map(allSubjects.map((x) => [x.id, x]));
  track({
    id: `layout:${dept.id}`, slot: "dept-layout", title: `${dept.name} 과목 구성`, baseline: ordered.map((x) => x.id),
    read: () => list.map((x) => x.id), write: (ids) => { list = ids.map((id) => byId.get(id)).filter(Boolean); draw(); },
    apply: (ids) => data.call("comsw_v4_save_department_layout", { p_department: dept.id, p_subjects: ids }),
    onApplied: reload,
  });
  draw();
  return box(null,
    h("div", { class: "row" },
      h("div", { class: "actions" }, h("h3", { style: "margin:0" }, `${dept.name} · 과목 ${ordered.length}개`),
        h("button", { type: "button", class: "btn", onclick: rename }, "학과명 수정")),
      h("span", { class: "pill neutral" }, "이 순서 = 학과별 커리큘럼·로드맵 순서")),
    note("과목을 끌어서 순서를 바꿉니다. '이 학과에서 빼기'는 이 학과에서만 빠지고, 과목 자체 삭제는 '전체 과목'에서 합니다. 과목을 누르면 공통 커리큘럼이 열립니다."),
    listEl, h("div", { class: "actions", style: "margin-top:12px" }, add));
}
