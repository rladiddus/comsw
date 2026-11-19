// 학과 구성 편집: 이 학과의 과목과 순서. 바꾸면 떠 있는 창 [임시 저장]/[사이트 적용](이 학과만, 학과별 커리큘럼·학과 전체 커리큘럼 순서).
// '빼기'는 이 학과에서만 빠지는 것(과목·자료·다른 학과는 그대로). 과목 자체 삭제는 전체 과목에서.
import * as data from "../data.mjs";
import { h, box, pill, note } from "../ui.mjs";
import { track } from "../changes.mjs";

export function deptLayout(dept, ordered, allSubjects, { msg, reload, stepPill, openSubject }) {
  let list = [...ordered];
  const listEl = h("div");
  const add = h("select", { "aria-label": "넣을 과목" });
  const draw = () => {
    listEl.replaceChildren(list.length ? h("ol", { style: "padding-left:22px;margin:0" }, list.map((s, i) => h("li", { style: "margin:6px 0" },
      h("div", { class: "row" },
        h("span", {}, h("button", { type: "button", class: "btn", style: "border:0;padding:0;text-decoration:underline", onclick: () => openSubject(s.id) }, s.name), " ", stepPill(s)),
        h("span", { class: "actions" },
          h("button", { type: "button", class: "btn", "aria-label": `${s.name} 위로`, disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
          h("button", { type: "button", class: "btn", "aria-label": `${s.name} 아래로`, disabled: i === list.length - 1, onclick: () => move(i, 1) }, "↓"),
          h("button", { type: "button", class: "btn danger", onclick: () => { list.splice(i, 1); changed(); } }, "이 학과에서 빼기")))))) : h("p", { class: "muted" }, "과목이 없습니다"));
    const rest = allSubjects.filter((s) => !list.includes(s)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    add.replaceChildren(h("option", { value: "" }, "과목 넣기…"), ...rest.map((s) => h("option", { value: s.id }, s.name)));
  };
  const changed = () => draw();
  const move = (i, d) => { [list[i], list[i + d]] = [list[i + d], list[i]]; changed(); };
  add.onchange = () => {
    const s = allSubjects.find((x) => x.id === add.value);
    if (s) { list.push(s); changed(); }
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
    h("div", { class: "row" }, h("h3", {}, `${dept.name} · 과목 ${ordered.length}개`), pill("이 순서 = 학과별 커리큘럼·로드맵 순서", "neutral")),
    note("'이 학과에서 빼기'는 이 학과에서만 빠집니다. 과목 자체 삭제는 '전체 과목'에서 합니다."),
    listEl, h("div", { class: "actions", style: "margin-top:12px" }, add));
}
