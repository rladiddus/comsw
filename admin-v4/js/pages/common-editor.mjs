// 과목 공통 4단계 정리(일반 수업): 참고할 강사(검수 완료본만) 고르기 → [AI 공통 정리](고른 자료만 AI에) → 단계마다 문구·대표 이미지 1장 → [확정].
// 4단계가 아닌 강사 자료는 단계를 4묶음으로 나눠 넣고, 그 강사 이미지는 어느 단계에서든 후보(사용자 결정 2026-11-19).
// 바꾸면 떠 있는 창: [임시 저장](공개 안 됨) / [사이트 적용](그 과목만 공개). AI는 버튼으로만, 결과는 고칠 수 있는 초안.
import * as data from "../data.mjs";
import { h, box, pill, media, busy, note, fail, empty } from "../ui.mjs";
import { curriculumUnits, stepState, STEPS } from "../rules.mjs";
import { track } from "../changes.mjs";

// i번째(0부터) 단계가 n개 중이면 4묶음 중 몇 번째인가
export const bucket = (i, n) => (n === STEPS ? i : Math.min(STEPS - 1, Math.floor((i * STEPS) / n)));

export function commonEditor(subject, cat, current, { msg, reload, set = null, extraLeft = [] }) {
  // set이 있으면 그 방학 특강의 공통(그 특강 검수본만), 없으면 일반 수업 공통
  const target = set ? `${subject.id}|${set.id}` : subject.id;
  const el = h("div");
  el.trackId = `common:${target}`; // 팝업을 닫을 때 떠 있는 창 등록을 빼려고
  (async () => {
    try {
      el.replaceChildren(h("div", { class: "muted" }, "강사 자료 불러오는 중..."));
      const [rows, people] = await Promise.all([
        data.curricula((q) => q.eq("subject_id", subject.id).eq("status", "approved").order("sort_order", { nullsFirst: false })),
        data.instructors(),
      ]);
      const vac = new Set(cat.vacations.map((v) => v.id));
      const units = curriculumUnits(rows).filter((u) => (set ? u.set_id === set.id : !vac.has(u.set_id)) && u.approved.length);
      const nameOf = new Map(people.map((p) => [p.id, p.name]));
      const baseline = { picked: [], steps: Array.from({ length: STEPS }, (_, i) => ({ summary: current[i]?.summary ?? "", image_url: current[i]?.image_url ?? "" })) };
      let st = JSON.parse(JSON.stringify(baseline));
      const has = (k) => st.picked.includes(k);
      const draw = () => el.replaceChildren(view());
      const view = () => {
        const chosen = units.filter((u) => has(u.key));
        const candidates = (n) => chosen.flatMap((u) => u.approved.map((r, i) => ({ r, u, i }))
          .filter(({ r, i }) => r.media_url && (u.approved.length !== STEPS || i === n)));
        const lost = st.steps.map((s, n) => s.image_url && !candidates(n).some((c) => c.r.media_url === s.image_url));
        const pickList = units.length ? h("div", {}, units.map((u) => {
          const s2 = stepState(u.approved.length);
          return h("label", { style: "display:flex;gap:8px;align-items:center;margin:4px 0" },
            h("input", { type: "checkbox", checked: has(u.key), onchange: (e) => { st.picked = e.target.checked ? [...st.picked, u.key] : st.picked.filter((k) => k !== u.key); draw(); } }),
            nameOf.get(u.instructor_id) ?? "—", " ", pill(s2.label, s2.kind), " ", h("span", { class: "muted" }, `이미지 ${u.approved.filter((r) => r.media_url).length}장`));
        })) : empty("검수 완료된 강사 자료가 없습니다(강사 메뉴에서 먼저 확정해주세요)");
        const aiBtn = h("button", { type: "button", class: "btn", disabled: !chosen.length }, "AI 공통 정리");
        aiBtn.onclick = () => busy(aiBtn, msg, async () => {
          const parts = Array.from({ length: STEPS }, () => []);
          for (const u of chosen) u.approved.forEach((r, i) => { const t = (r.summary || r.written || "").trim(); if (t) parts[bucket(i, u.approved.length)].push(t); });
          for (let n = 0; n < STEPS; n++) {
            if (!parts[n].length) continue;
            st.steps[n].summary = await data.ai("week", parts[n].map((t) => `- ${t}`).join("\n"));
          }
          draw();
          msg.replaceChildren(note("AI로 4단계 문구를 만들었습니다. 확인·수정한 뒤 오른쪽 아래 [임시 저장] 또는 [사이트 적용]을 눌러주세요."));
        });
        const stepCard = (s, n) => h("div", { class: "step" },
          h("b", {}, `${n + 1}단계`),
          h("textarea", { rows: 3, value: s.summary, style: "width:100%", "aria-label": `${n + 1}단계 공통 문구`, oninput: (e) => { s.summary = e.target.value; } }),
          h("h4", {}, "대표 이미지"),
          s.image_url ? media(s.image_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "이미지 없음")),
          lost[n] ? fail("고른 이미지의 강사를 뺐습니다. 다시 골라주세요.") : null,
          h("div", { class: "chips", style: "margin-top:6px" },
            candidates(n).map((c) => h("button", { type: "button", "aria-pressed": String(c.r.media_url === s.image_url), title: `${nameOf.get(c.u.instructor_id)} ${c.r.step_label}`,
              onclick: () => { s.image_url = c.r.media_url; draw(); } },
            h("img", { src: c.r.media_url, alt: `${nameOf.get(c.u.instructor_id)} ${c.r.step_label}`, class: "thumb" }),
            c.u.approved.length !== STEPS ? h("span", { class: "muted" }, ` ${c.r.step_label} 자료`) : null)),
            s.image_url ? h("button", { type: "button", onclick: () => { s.image_url = ""; draw(); } }, "빼기") : null));
        // 강사 팝업과 같은 모양: 왼쪽 = 강사(넣기·빼기), 오른쪽 = 공통 4단계(문구·대표 이미지)
        return h("div", { class: "side-list" },
          box(`강사(${set ? set.name : "일반"} · 검수 완료만)`, pickList, h("div", { class: "actions", style: "margin-top:10px" }, aiBtn), ...extraLeft),
          box(`${set ? `${set.name} ` : ""}공통 4단계`, h("div", { class: "steps" }, st.steps.map(stepCard))));
      };
      track({
        id: `common:${target}`, slot: set ? "vacation-common" : "common", title: `${subject.name}${set ? `(${set.name})` : ""} 공통 4단계`, baseline,
        read: () => st, write: (x) => { st = { picked: (x.picked ?? []).filter((k) => units.some((u) => u.key === k)), steps: x.steps }; draw(); },
        apply: async (x) => {
          const chosen = units.filter((u) => x.picked.includes(u.key));
          if (!chosen.length) throw new Error(`${subject.name}: 참고할 강사 자료를 골라주세요`);
          if (x.steps.some((s) => !s.summary.trim())) throw new Error(`${subject.name}: 4단계 문구를 모두 채워주세요`);
          const imgs = new Set(chosen.flatMap((u) => u.approved.map((r) => r.media_url)).filter(Boolean));
          if (x.steps.some((s) => s.image_url && !imgs.has(s.image_url))) throw new Error(`${subject.name}: 고른 이미지의 강사를 뺐습니다. 이미지를 다시 골라주세요`);
          await data.call(set ? "comsw_v4_confirm_vacation_common" : "comsw_v4_confirm_common", {
            ...(set ? { p_set: set.id } : {}),
            p_subject: subject.id,
            p_sources: chosen.flatMap((u) => u.approved.map((r) => ({ id: r.id, updated_at: r.updated_at }))),
            p_steps: x.steps.map((s) => ({ summary: s.summary.trim(), image_url: s.image_url || "" })),
          });
        },
        onApplied: reload,
      });
      draw();
    } catch (err) {
      el.replaceChildren(fail(`불러오지 못했습니다: ${err.message}`));
    }
  })();
  return el;
}
