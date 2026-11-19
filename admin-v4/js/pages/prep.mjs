// 준비물: 기준 과목(끝 숫자 뺀 이름) 단위. '캐드' 준비물 = 캐드1·캐드2 모두에 적용(2026-11-19 사용자 결정).
// 지금 자료는 과목마다(course_prep_items.subject_id) 있어서, 같은 기준 과목의 것을 모아 보여 준다(겹치는 것은 한 번).
import * as data from "../data.mjs";
import { h, head, box, table, tabs, fill, empty, note } from "../ui.mjs";
import { baseName } from "../rules.mjs";

const CATS = [["textbook", "교재"], ["supply", "준비물"], ["ai", "AI 도구"]];
let pick = null;

export async function render({ main }) {
  main.replaceChildren(head("준비물", "기준 과목마다 공통 준비물을 정리합니다. 캐드에 적은 준비물은 캐드1·캐드2에도 적용됩니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, items] = await Promise.all([data.catalog(), data.prepItems()]);
    const subjects = data.live(cat.subjects);
    const bases = [...new Set(subjects.map((s) => baseName(s.name)))].sort((a, b) => a.localeCompare(b, "ko"));
    const deptName = new Map(cat.departments.map((d) => [d.id, d.name]));
    const out = h("div");
    const draw = () => {
      pick = bases.includes(pick) ? pick : bases[0];
      const members = subjects.filter((s) => baseName(s.name) === pick);
      const ids = new Set(members.map((s) => s.id));
      const seen = new Set();
      const mine = items.filter((i) => ids.has(i.subject_id)).filter((i) => {
        const k = `${i.category}|${(i.content ?? "").trim()}|${i.department_id ?? ""}`;
        return !seen.has(k) && seen.add(k);
      });
      out.replaceChildren(h("div", { class: "two" },
        box(`기준 과목 ${bases.length}개`, h("div", { class: "chips" }, bases.map((b) =>
          h("button", { type: "button", "aria-pressed": String(b === pick), onclick: () => { pick = b; draw(); } }, b)))),
        box(`${pick} 공통 준비물`,
          note(`적용 과목: ${members.map((s) => s.name).join(", ")}`),
          mine.length ? CATS.map(([c, label]) => {
            const list = mine.filter((i) => i.category === c);
            return list.length ? [h("h4", {}, label), table([
              ["내용", (i) => i.content || "—"],
              ["링크", (i) => (/^https?:\/\//i.test(i.link_url ?? "") ? h("a", { href: i.link_url, target: "_blank", rel: "noopener" }, "열기") : "—")],
              ["학과", (i) => deptName.get(i.department_id) ?? "전체"],
            ], list)] : null;
          }) : empty("공통 준비물이 없습니다"))));
    };
    draw();
    return out;
  });
}
