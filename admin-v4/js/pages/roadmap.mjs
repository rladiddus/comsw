// 로드맵: 기본은 학과·과목 순서. 과목 상자를 끌어서 로드맵 순서만 따로 바꿀 수 있다(2026-11-20, 학과·과목 순서는 그대로).
// 따로 바꾸면 'custom_order'로 공개되고, [학과·과목의 순서와 동기화]로 되돌린다. 과목 사이 [+]를 켜면 앞뒤 과목이 한 단계에 함께.
// 한 단계 이름: 끝 숫자만 다르면 'AI웹툰 1~6', 아니면 줄바꿈(사용자 결정 2026-11-19). 요약은 직접 쓰거나 [AI 요약](버튼으로만).
// 바꾸면 떠 있는 창 [임시 저장] / [사이트 적용](이 학과 로드맵만 공개, 예전 단계는 보관).
import * as data from "../data.mjs";
import { h, head, box, tabs, fill, empty, note, busy, publishBanner } from "../ui.mjs";
import { deptOrder, roadmapLabel } from "../rules.mjs";
import { track, canSwitch, applyNotice } from "../changes.mjs";
import { moveItem } from "./dept-layout.mjs";

let pick = null;

// 순서를 바꿔도 붙어 있던 두 과목의 묶음은 그대로, 떨어지면 풀림
export function remapJoins(order, from, joins) {
  const keep = new Set(from.slice(0, -1).flatMap((x, i) => (joins[i] ? [`${x}|${from[i + 1]}`] : [])));
  return order.slice(0, -1).map((x, i) => keep.has(`${x}|${order[i + 1]}`));
}

export async function render({ main }) {
  main.replaceChildren(head("로드맵", "학과·과목 순서대로 로드맵 단계를 만듭니다. 과목을 끌어서 로드맵 순서만 바꿀 수 있고, 과목 사이 [+]를 켜면 두 과목이 한 단계로 묶입니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, rm, weeks] = await Promise.all([data.catalog(), data.roadmap(), data.weeks()]);
    const subjects = data.live(cat.subjects);
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    let d = null; // 지금 학과 편집 상태 { dept, order: [과목 id], joins: [과목 사이 묶음], summaries }
    let dragFrom = null;
    const draw = () => {
      pick = cat.departments.some((d) => d.id === pick) ? pick : cat.departments[0]?.id;
      const dept = cat.departments.find((d) => d.id === pick);
      if (!dept) return out.replaceChildren(empty("학과가 없습니다"));
      const deptIds = deptOrder(cat.links.filter((l) => l.department_id === dept.id), subjects).map((x) => x.id);
      const byId = new Map(subjects.map((x) => [x.id, x]));
      // 지금 공개 중인 로드맵 단계(과목 묶음)
      const trk = rm.tracks.find((t) => t.department_id === dept.id);
      const steps = rm.steps.filter((s) => s.track_id === trk?.id).sort((a, b) => a.position - b.position)
        .map((s) => ({ ...s, ids: rm.links.filter((l) => l.step_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((l) => l.subject_id) }));
      const stepOf = (id) => steps.find((s) => s.ids.includes(id));
      // 다른 학과 로드맵에 과목 묶음이 똑같은 단계가 있는 학과(타학과 동기화 후보)
      const setKey = (ids) => [...ids].sort().join(",");
      const othersWith = (g) => {
        const k = setKey(g.map((x) => x.id));
        return [...new Set(rm.steps.filter((s) => s.track_id !== trk?.id && setKey(rm.links.filter((l) => l.step_id === s.id).map((l) => l.subject_id)) === k)
          .map((s) => cat.departments.find((x) => x.id === rm.tracks.find((t) => t.id === s.track_id)?.department_id)?.name).filter(Boolean))];
      };
      const joinsFor = (order) => order.slice(0, -1).map((x, i) => { const a = stepOf(x); return !!a && a === stepOf(order[i + 1]); });
      const groupsOf = (order, joins) => { const g = []; order.forEach((id, i) => { const x = byId.get(id); if (i > 0 && joins[i - 1]) g.at(-1).push(x); else g.push([x]); }); return g; };
      const gkey = (g) => g.map((x) => x.id).join(",");
      const publishedSummary = (g) => steps.find((x) => x.ids.join(",") === gkey(g))?.summary ?? (g.length === 1 ? g[0].roadmap_summary ?? "" : "");
      const summaryOf = (g) => (gkey(g) in d.summaries ? d.summaries[gkey(g)] : publishedSummary(g));
      // 따로 정해 공개한 순서(custom_order)가 있고 과목이 같으면 그 순서, 아니면 학과·과목 순서
      const pubFlat = steps.flatMap((s) => s.ids);
      const sameSet = pubFlat.length === deptIds.length && deptIds.every((id) => pubFlat.includes(id));
      const baseOrder = trk?.custom_order && sameSet ? pubFlat : deptIds;
      if (d?.dept !== dept.id) {
        const baseJoins = joinsFor(baseOrder);
        d = { dept: dept.id, order: [...baseOrder], joins: baseJoins, summaries: {}, sync: [] };
        track({
          id: `roadmap:${dept.id}`, slot: "roadmap", title: `${dept.name} 로드맵`,
          baseline: { order: baseOrder, joins: baseJoins, summaries: Object.fromEntries(groupsOf(baseOrder, baseJoins).map((x) => [gkey(x), publishedSummary(x)])), sync: [] },
          read: () => {
            const gs = groupsOf(d.order, d.joins);
            return { order: d.order, joins: d.joins, summaries: Object.fromEntries(gs.map((x) => [gkey(x), summaryOf(x)])), sync: gs.map(gkey).filter((k) => d.sync.includes(k)) };
          },
          write: (x) => {
            // 예전 임시 저장(순서 없음)이나 과목이 바뀐 보관은 지금 순서로
            const ok = Array.isArray(x.order) && x.order.length === deptIds.length && x.order.every((id) => deptIds.includes(id));
            d.order = ok ? [...x.order] : d.order;
            d.joins = x.joins?.length === d.order.length - 1 ? [...x.joins] : joinsFor(d.order);
            d.summaries = { ...x.summaries };
            d.sync = [...(x.sync ?? [])];
            draw();
          },
          apply: (x) => data.call("comsw_v4_save_roadmap", {
            p_department: dept.id,
            p_groups: groupsOf(x.order, x.joins).map((g) => ({ subjects: g.map((y) => y.id), summary: x.summaries[gkey(g)] ?? "" })),
            ...(x.order.join() !== deptIds.join() ? { p_custom: true } : {}), // 학과·과목 순서와 같으면 따라가기(동기화)
            // 타학과 동기화: 체크한 단계 번호(1부터). 없으면 보내지 않음(예전 함수와도 맞게)
            ...(x.sync.length ? { p_sync: groupsOf(x.order, x.joins).flatMap((g, i) => (x.sync.includes(gkey(g)) ? [i + 1] : [])) } : {}),
          }),
          onApplied: () => { d = null; render({ main }); },
        });
      }
      const reorder = (order) => { d.joins = remapJoins(order, d.order, d.joins); d.order = order; draw(); };
      const list = d.order.map((id) => byId.get(id));
      const groups = groupsOf(d.order, d.joins);
      const custom = d.order.join() !== deptIds.join();
      const matches = steps.length === groups.length && steps.every((s, i) => s.ids.join(",") === gkey(groups[i]));
      const plus = (i) => h("button", {
        type: "button", class: "rm-plus", "aria-pressed": String(d.joins[i]),
        title: d.joins[i] ? "묶음 풀기" : "앞뒤 과목을 한 단계로 묶기", "aria-label": `${list[i].name}와 ${list[i + 1].name} 묶기`,
        onclick: () => { d.joins[i] = !d.joins[i]; draw(); },
      }, "+");
      const chain = h("div", { class: "rm-chain" });
      const clearMarks = () => chain.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
      // 과목 상자: 끌어서 옮김(놓을 자리 경계에 점선)
      const subjectBox = (s, i) => {
        const el = h("span", {
          class: "rm-subject", draggable: "true", title: "끌어서 로드맵 순서 바꾸기",
          ondragstart: (e) => { dragFrom = i; el.classList.add("dragging"); e.dataTransfer?.setData("text/plain", String(i)); },
          ondragend: () => { dragFrom = null; el.classList.remove("dragging"); clearMarks(); },
          ondragover: (e) => {
            if (dragFrom == null) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            clearMarks();
            el.classList.add(e.clientX > r.left + r.width / 2 ? "drop-after" : "drop-before");
          },
          ondrop: (e) => {
            e.preventDefault();
            if (dragFrom == null) return;
            const from = dragFrom;
            dragFrom = null;
            reorder(moveItem(d.order, from, i + (el.classList.contains("drop-after") ? 1 : 0)));
          },
        }, s.name);
        return el;
      };
      chain.append(...list.flatMap((s, i) => (i < list.length - 1 ? [subjectBox(s, i), plus(i)] : [subjectBox(s, i)])));
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
        // 같은 과목 묶음이 다른 학과에도 있으면 [타학과 동기화]: 체크하고 [사이트 적용]하면 그 학과들 문구도 이걸로
        const others = othersWith(g);
        const syncBox = others.length ? h("label", { class: "rm-sync", title: `같은 단계가 있는 학과: ${others.join(", ")}` },
          h("input", { type: "checkbox", checked: d.sync.includes(gkey(g)), "aria-label": `${roadmapLabel(g.map((s) => s.name))} 타학과 동기화`,
            onchange: (e) => { d.sync = e.target.checked ? [...d.sync, gkey(g)] : d.sync.filter((k) => k !== gkey(g)); } }),
          "타학과 동기화") : null;
        // 이름 칸은 두 줄 높이로 고정(과목이 하나든 둘이든 글 상자가 같은 위치)
        return h("div", { class: "step" }, h("b", { class: "rm-label" }, roadmapLabel(g.map((s) => s.name))), area,
          h("div", { class: "actions" }, aiBtn, syncBox));
      };
      out.replaceChildren(banner, msg,
        tabs(cat.departments.map((x) => [x.id, x.name]), pick, (id) => { if (!canSwitch()) return; pick = id; msg.replaceChildren(); draw(); }, "chips"),
        h("div", { style: "height:14px" }),
        box(null,
          h("div", { class: "row" }, h("h3", {}, `${dept.name} · 과목 ${list.length}개 → 로드맵 ${groups.length}단계`),
            custom ? h("div", { class: "actions" }, h("span", { class: "pill warn" }, "학과·과목의 순서와 다릅니다"),
              h("button", { type: "button", class: "btn", onclick: () => reorder([...deptIds]) }, "학과·과목의 순서와 동기화"))
              : h("span", { class: "pill neutral" }, "학과·과목 순서")),
          !list.length || matches ? null
            : trk ? applyNotice("홈페이지 로드맵이 아래 순서·묶음과 다릅니다. 아래 내용이 맞으면 [이대로 사이트 적용]을 누르세요.", `roadmap:${dept.id}`, { msg })
            : applyNotice("이 학과는 아직 홈페이지에 로드맵이 없습니다. 아래 내용으로 만들려면 [이대로 사이트 적용]을 누르세요.", `roadmap:${dept.id}`, { msg, kind: "note" }),
          note("과목을 끌어서 로드맵 순서를 바꿉니다(학과·과목 순서는 그대로). 과목 사이 [+]를 켜면 두 과목이 한 단계로 묶입니다."),
          list.length ? chain : empty("이 학과에 과목이 없습니다")),
        groups.length ? box("로드맵 단계(홈페이지에 보이는 모양)", note("이름 끝 숫자만 다른 과목은 '이름 1~6'으로, 다른 과목은 줄을 나눠 보여 줍니다."),
          h("div", { class: "steps" }, groups.map(card))) : null);
    };
    draw();
    return out;
  });
}
