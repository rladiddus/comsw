// 로드맵: 모든 학과의 과목 흐름을 학과 구성 순서로. 순서 수정은 학과·과목의 학과 구성으로 바로 간다.
// 과목 문구는 지금 쓰는 subjects.roadmap_summary 그대로(복제·자동 AI 없음).
import * as data from "../data.mjs";
import { h, head, box, fill, empty } from "../ui.mjs";
import { deptOrder } from "../rules.mjs";

export async function render({ main }) {
  main.replaceChildren(head("로드맵", "학과 구성 순서대로 과목 흐름을 보여 줍니다. 순서는 학과·과목에서 바꿉니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const cat = await data.catalog();
    const subjects = data.live(cat.subjects);
    return cat.departments.map((d) => {
      const list = deptOrder(cat.links.filter((l) => l.department_id === d.id), subjects);
      return box(null,
        h("div", { class: "row" }, h("h3", {}, `${d.name} · ${list.length}과목`),
          h("button", { type: "button", class: "btn", onclick: () => { location.hash = `#/courses/depts/${d.id}`; } }, "순서 수정")),
        list.length
          ? h("ol", {}, list.map((s) => h("li", {}, h("b", {}, s.name), s.roadmap_summary ? h("span", { class: "muted" }, ` — ${s.roadmap_summary}`) : null)))
          : empty("이 학과에 과목이 없습니다"));
    });
  });
}
