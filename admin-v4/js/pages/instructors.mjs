// 강사: 목록(홈페이지 노출·이번 제출) → 상세(프로필 / 커리큘럼). 1단계는 실제 자료 읽기만, 확정·AI는 3단계.
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, media, dl, fill, empty, note } from "../ui.mjs";
import { curriculumUnits, stepState } from "../rules.mjs";

export async function render({ main }) {
  main.replaceChildren(head("강사", "홈페이지 노출과 이번 제출을 확인합니다. 상세에서 프로필과 커리큘럼을 함께 봅니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [people, depts, links, drafts, rows, cat] = await Promise.all([
      data.instructors(), data.all("departments"), data.instructorDepartments(), data.profileDrafts(),
      data.curricula((q) => q.order("sort_order", { nullsFirst: false })), data.catalog(),
    ]);
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const units = curriculumUnits(rows);
    const view = people.map((p) => ({
      ...p,
      depts: links.filter((l) => l.instructor_id === p.id).map((l) => deptName.get(l.department_id)).filter(Boolean),
      draft: drafts.find((d) => d.instructor_id === p.id && d.status === "pending"),
      units: units.filter((u) => u.instructor_id === p.id),
    }));
    let selected = null;
    let tab = "profile";
    const detail = h("div");
    const list = () => table([
      ["이름", (p) => p.name],
      ["학과", (p) => p.depts.join(", ") || "—"],
      ["홈페이지", (p) => pill(p.is_listed ? "노출" : "숨김", p.is_listed ? "" : "neutral")],
      ["계정", (p) => (p.account_uid ? "연결" : pill("미연결", "neutral"))],
      ["이번 제출", (p) => {
        const n = p.units.filter((u) => u.pending.length).length;
        const marks = [p.draft && pill("프로필"), n && pill(`커리큘럼 ${n}건`)].filter(Boolean);
        return marks.length ? h("div", { class: "chips" }, marks) : "—";
      }],
    ], view, { selected, onPick: (p) => { selected = p; draw(); } });
    const draw = () => {
      listBox.replaceChildren(h("h3", {}, `강사 ${view.length}명`), list());
      detail.replaceChildren(...(selected ? showDetail(selected) : [box(null, empty("강사를 고르면 프로필과 커리큘럼이 나옵니다"))]));
    };
    const showDetail = (p) => [box(null,
      h("div", { class: "row" }, h("h3", {}, p.name), pill(p.is_listed ? "홈페이지 노출" : "홈페이지 숨김", p.is_listed ? "" : "neutral")),
      tabs([["profile", "프로필"], ["curriculum", "커리큘럼"]], tab, (t) => { tab = t; draw(); }),
      tab === "profile" ? profile(p) : curriculum(p, cat),
    )];
    const listBox = h("section", { class: "box" });
    draw();
    return h("div", { class: "two" }, listBox, detail);
  });
}

function profile(p) {
  const d = p.draft;
  return h("div", {},
    d ? note("이번 제출이 있습니다(아래). 확정 전에는 홈페이지에 공개되지 않습니다.") : null,
    h("div", { class: "two" },
      h("div", {}, h("h4", {}, d ? "이번 제출" : "공개 중"), dl([
        ["이름", (d ?? p).name], ["경력", (d ?? p).career], ["한마디", (d ?? p).message],
      ])),
      h("div", {}, h("h4", {}, "사진"), media((d?.photo_url) || p.photo_url))),
  );
}

function curriculum(p, cat) {
  if (!p.units.length) return empty("제출한 커리큘럼이 없습니다");
  const subj = new Map(cat.subjects.map((s) => [s.id, s.name]));
  const setName = new Map(cat.sets.map((s) => [s.id, s.name]));
  return p.units.map((u) => {
    const now = u.pending.length ? u.pending : u.approved;
    const st = stepState(now.length);
    const vac = cat.vacations.some((v) => v.id === u.set_id);
    return h("div", { class: "box" },
      h("div", { class: "row" },
        h("h3", {}, `${subj.get(u.subject_id) ?? "(삭제된 과목)"} · ${vac ? setName.get(u.set_id) : "일반"}`),
        h("div", { class: "actions" }, pill(u.pending.length ? "이번 제출(검수 전)" : "검수 완료", u.pending.length ? "" : "neutral"), pill(st.label, st.kind))),
      h("div", { class: "steps" }, now.map((r) => h("div", { class: "step" },
        h("b", {}, r.step_label), h("p", {}, r.written || r.summary || "—"), r.media_url ? media(r.media_url) : null))));
  });
}
