// 로드맵: 학과 구성 순서 그대로(순서 수정은 학과 구성에서). 과목 사이 [+]를 켜면 앞뒤 과목이 한 단계에 함께 들어간다.
// 한 단계 이름: 끝 숫자만 다르면 'AI웹툰 1~6', 아니면 줄바꿈(사용자 결정 2026-11-19). 요약은 직접 쓰거나 [AI 요약](버튼으로만).
// 바꾸면 떠 있는 창 [임시 저장] / [사이트 적용](이 학과 로드맵만 공개, 예전 단계는 보관).
import * as data from "../data.mjs";
import { h, head, box, tabs, fill, empty, note, fail, busy, publishBanner } from "../ui.mjs";
import { deptOrder, roadmapLabel } from "../rules.mjs";
import { track, canSwitch } from "../changes.mjs";

let pick = null;

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
    let d = null; // 지금 학과 편집 상태 { dept, joins, summaries }
    const draw = () => {
      pick = cat.departments.some((d) => d.id === pick) ? pick : cat.departments[0]?.id;
      const dept = cat.departments.find((d) => d.id === pick);
      if (!dept) return out.replaceChildren(empty("학과가 없습니다"));
      const list = deptOrder(cat.links.filter((l) => l.department_id === dept.id), subjects);
      // 지금 공개 중인 로드맵 단계(과목 묶음)
      const trk = rm.tracks.find((t) => t.department_id === dept.id);
      const steps = rm.steps.filter((s) => s.track_id === trk?.id).sort((a, b) => a.position - b.position)
        .map((s) => ({ ...s, ids: rm.links.filter((l) => l.step_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((l) => l.subject_id) }));
      const stepOf = (id) => steps.find((s) => s.ids.includes(id));
      const groupsOf = (joins) => { const g = []; list.forEach((x, i) => { if (i > 0 && joins[i - 1]) g.at(-1).push(x); else g.push([x]); }); return g; };
      const gkey = (g) => g.map((x) => x.id).join(",");
      const publishedSummary = (g) => steps.find((x) => x.ids.join(",") === gkey(g))?.summary ?? (g.length === 1 ? g[0].roadmap_summary ?? "" : "");
      const summaryOf = (g) => (gkey(g) in d.summaries ? d.summaries[gkey(g)] : publishedSummary(g));
      const baseJoins = list.slice(0, -1).map((x, i) => { const a = stepOf(x.id); return !!a && a === stepOf(list[i + 1].id); });
      if (d?.dept !== dept.id) {
        d = { dept: dept.id, joins: baseJoins, summaries: {} };
        const baseline = () => { const g = groupsOf(baseJoins); return { joins: baseJoins, summaries: Object.fromEntries(g.map((x) => [gkey(x), publishedSummary(x)])) }; };
        track({
          id: `roadmap:${dept.id}`, slot: "roadmap", title: `${dept.name} 로드맵`, baseline: baseline(),
          read: () => ({ joins: d.joins, summaries: Object.fromEntries(groupsOf(d.joins).map((x) => [gkey(x), summaryOf(x)])) }),
          write: (x) => { d.joins = x.joins; d.summaries = { ...x.summaries }; draw(); },
          apply: (x) => data.call("comsw_v4_save_roadmap", { p_department: dept.id, p_groups: groupsOf(x.joins).map((g) => ({ subjects: g.map((y) => y.id), summary: x.summaries[gkey(g)] ?? "" })) }),
          onApplied: () => { d = null; render({ main }); },
        });
      }
      const groups = groupsOf(d.joins);
      const matches = steps.length === groups.length && steps.every((s, i) => s.ids.join(",") === gkey(groups[i]));
      const plus = (i) => h("button", {
        type: "button", class: "rm-plus", "aria-pressed": String(d.joins[i]),
        title: d.joins[i] ? "묶음 풀기" : "앞뒤 과목을 한 단계로 묶기", "aria-label": `${list[i].name}와 ${list[i + 1].name} 묶기`,
        onclick: () => { d.joins[i] = !d.joins[i]; draw(); },
      }, "+");
      const card = (g) => {
        const area = h("textarea", { rows: 2, value: summaryOf(g), style: "width:100%", "aria-label": `${roadmapLabel(g.map((s) => s.name))} 요약`,
          oninput: (e) => { d.summaries[gkey(g)] = e.target.value; } });
        const aiBtn = h("button", { type: "button", class: "btn" }, "AI 요약");
        aiBtn.onclick = () => busy(aiBtn, msg, async () => {
          const text = g.map((s) => {
            const w = weeks.filter((x) => x.subject_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((x) => x.summary || x.written).filter(Boolean);
            return `[${s.name}]\n${(w.length ? w : [s.roadmap_summary ?? s.dept_curriculum ?? ""]).join("\n")}`;
          }).join("\n\n");
          area.value = await data.ai("roadmap", text);
          d.summaries[gkey(g)] = area.value;
        });
        return h("div", { class: "step" }, h("b", { style: "white-space:pre-line" }, roadmapLabel(g.map((s) => s.name))), area, aiBtn);
      };
      out.replaceChildren(banner, msg,
        tabs(cat.departments.map((x) => [x.id, x.name]), pick, (id) => { if (!canSwitch()) return; pick = id; msg.replaceChildren(); draw(); }, "chips"),
        h("div", { style: "height:14px" }),
        box(null,
          h("div", { class: "row" }, h("h3", {}, `${dept.name} · 과목 ${list.length}개 → 로드맵 ${groups.length}단계`),
            h("a", { class: "btn", href: `#/courses/depts/${dept.id}` }, "순서 수정(학과 구성)")),
          trk && !matches ? fail("홈페이지 로드맵이 지금 학과 구성과 다릅니다. [+]를 확인한 뒤 [사이트 적용]하면 학과 구성 순서로 바뀝니다.") : null,
          // 과목 상자를 가로로 잇고, 상자 경계 위에 [+](끄면 점선, 켜면 초록)
          list.length ? h("div", { class: "rm-chain" }, list.flatMap((s, i) => [
            h("span", { class: "rm-subject" }, s.name),
            i < list.length - 1 ? plus(i) : null,
          ])) : empty("이 학과에 과목이 없습니다")),
        groups.length ? box("로드맵 단계(홈페이지에 보이는 모양)", note("이름 끝 숫자만 다른 과목은 '이름 1~6'으로, 다른 과목은 줄을 나눠 보여 줍니다."),
          h("div", { class: "steps" }, groups.map(card))) : null);
    };
    draw();
    return out;
  });
}
