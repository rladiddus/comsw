// 로드맵: 학과 구성 순서 그대로(순서 수정은 학과 구성에서). 과목 사이 [+]를 켜면 앞뒤 과목이 한 단계에 함께 들어간다.
// 한 단계 이름: 끝 숫자만 다르면 'AI웹툰 1~6', 아니면 줄바꿈(사용자 결정 2026-11-19). 요약은 직접 쓰거나 [AI 요약](버튼으로만).
// [저장] = 이 학과 로드맵만 바로 공개(예전 단계는 보관).
import * as data from "../data.mjs";
import { h, head, box, tabs, fill, empty, note, fail, busy, publishBanner } from "../ui.mjs";
import { deptOrder, roadmapLabel } from "../rules.mjs";

let pick = null;
const drafts = new Map(); // 학과 id → { joins, summaries } 이 화면에서 고치는 중인 것

export async function render({ main }) {
  main.replaceChildren(head("로드맵", "학과 구성 순서대로 로드맵 단계를 만듭니다. 과목 사이 [+]를 켜면 두 과목이 한 단계로 묶입니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, rm, weeks] = await Promise.all([data.catalog(), data.roadmap(), data.weeks()]);
    const subjects = data.live(cat.subjects);
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    const draw = () => {
      pick = cat.departments.some((d) => d.id === pick) ? pick : cat.departments[0]?.id;
      const dept = cat.departments.find((d) => d.id === pick);
      if (!dept) return out.replaceChildren(empty("학과가 없습니다"));
      const list = deptOrder(cat.links.filter((l) => l.department_id === dept.id), subjects);
      // 지금 공개 중인 로드맵 단계(과목 묶음)
      const track = rm.tracks.find((t) => t.department_id === dept.id);
      const steps = rm.steps.filter((s) => s.track_id === track?.id).sort((a, b) => a.position - b.position)
        .map((s) => ({ ...s, ids: rm.links.filter((l) => l.step_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((l) => l.subject_id) }));
      const stepOf = (id) => steps.find((s) => s.ids.includes(id));
      const kept = drafts.get(dept.id);
      const d = (kept?.joins.length === Math.max(0, list.length - 1) ? kept : null) ?? {
        joins: list.slice(0, -1).map((s, i) => { const a = stepOf(s.id); return !!a && a === stepOf(list[i + 1].id); }),
        summaries: new Map(),
      };
      drafts.set(dept.id, d);
      const groups = [];
      list.forEach((s, i) => { if (i > 0 && d.joins[i - 1]) groups.at(-1).push(s); else groups.push([s]); });
      const gkey = (g) => g.map((s) => s.id).join(",");
      const summaryOf = (g) => {
        if (d.summaries.has(gkey(g))) return d.summaries.get(gkey(g));
        const same = steps.find((s) => s.ids.join(",") === gkey(g));
        return same?.summary ?? (g.length === 1 ? g[0].roadmap_summary ?? "" : "");
      };
      const matches = steps.length === groups.length && steps.every((s, i) => s.ids.join(",") === gkey(groups[i]));
      const plus = (i) => h("button", {
        type: "button", class: `btn${d.joins[i] ? " primary" : ""}`, "aria-pressed": String(d.joins[i]),
        title: d.joins[i] ? "묶음 풀기" : "앞뒤 과목을 한 단계로 묶기", "aria-label": `${list[i].name}와 ${list[i + 1].name} 묶기`,
        onclick: () => { d.joins[i] = !d.joins[i]; draw(); },
      }, "+");
      const card = (g) => {
        const area = h("textarea", { rows: 2, value: summaryOf(g), style: "width:100%", "aria-label": `${roadmapLabel(g.map((s) => s.name))} 요약`,
          oninput: (e) => d.summaries.set(gkey(g), e.target.value) });
        const aiBtn = h("button", { type: "button", class: "btn" }, "AI 요약");
        aiBtn.onclick = () => busy(aiBtn, msg, async () => {
          const text = g.map((s) => {
            const w = weeks.filter((x) => x.subject_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((x) => x.summary || x.written).filter(Boolean);
            return `[${s.name}]\n${(w.length ? w : [s.roadmap_summary ?? s.dept_curriculum ?? ""]).join("\n")}`;
          }).join("\n\n");
          area.value = await data.ai("roadmap", text);
          d.summaries.set(gkey(g), area.value);
        });
        return h("div", { class: "step" }, h("b", { style: "white-space:pre-line" }, roadmapLabel(g.map((s) => s.name))), area, aiBtn);
      };
      const save = h("button", { type: "button", class: "btn primary" }, "저장(바로 공개)");
      save.onclick = () => busy(save, msg, async () => {
        if (!confirm(`${dept.name} 로드맵을 저장할까요? 홈페이지 로드맵에 바로 반영됩니다(다른 학과는 그대로).`)) return;
        await data.call("comsw_v4_save_roadmap", { p_department: dept.id, p_groups: groups.map((g) => ({ subjects: g.map((s) => s.id), summary: summaryOf(g) })) });
        drafts.delete(dept.id);
        render({ main });
      });
      out.replaceChildren(banner, msg,
        tabs(cat.departments.map((x) => [x.id, x.name]), pick, (id) => { pick = id; msg.replaceChildren(); draw(); }, "chips"),
        h("div", { style: "height:14px" }),
        box(null,
          h("div", { class: "row" }, h("h3", {}, `${dept.name} · 과목 ${list.length}개 → 로드맵 ${groups.length}단계`),
            h("a", { class: "btn", href: `#/courses/depts/${dept.id}` }, "순서 수정(학과 구성)")),
          track && !matches ? fail("홈페이지 로드맵이 지금 학과 구성과 다릅니다. 확인한 뒤 [저장]하면 학과 구성 순서로 바뀝니다.") : null,
          list.length ? h("ol", { style: "list-style:none;padding:0;margin:0" }, list.flatMap((s, i) => [
            h("li", { style: "padding:6px 0" }, h("b", {}, s.name)),
            i < list.length - 1 ? h("li", { style: "padding-left:16px" }, plus(i)) : null,
          ])) : empty("이 학과에 과목이 없습니다")),
        groups.length ? box("로드맵 단계(홈페이지에 보이는 모양)", note("이름 끝 숫자만 다른 과목은 '이름 1~6'으로, 다른 과목은 줄을 나눠 보여 줍니다."),
          h("div", { class: "steps" }, groups.map(card)), h("div", { class: "actions", style: "margin-top:12px" }, save)) : null);
    };
    draw();
    return out;
  });
}
