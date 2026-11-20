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
      const [rows, people, meta] = await Promise.all([
        data.curricula((q) => q.eq("subject_id", subject.id).eq("status", "approved").order("sort_order", { nullsFirst: false })),
        data.instructors(),
        // 지난번 [사이트 적용] 때 고른 강사 자료(있으면 그 강사를 처음부터 체크)
        data.all(set ? "v4_vacation_meta" : "v4_common_meta", (q) => (set ? q.eq("set_id", set.id) : q).eq("subject_id", subject.id)).catch(() => []),
      ]);
      const vac = new Set(cat.vacations.map((v) => v.id));
      const units = curriculumUnits(rows).filter((u) => (set ? u.set_id === set.id : !vac.has(u.set_id)) && u.approved.length);
      const nameOf = new Map(people.map((p) => [p.id, p.name]));
      const usedIds = new Set((meta[0]?.sources ?? []).map((x) => x.id));
      // 처음 체크: V4로 반영한 기록이 있으면 그때 쓴 강사, 없으면 검수 완료 강사 모두(2026-11-20 사용자 요청)
      const used = units.filter((u) => u.approved.some((r) => usedIds.has(r.id)));
      const baseline = { picked: (used.length ? used : units).map((u) => u.key), steps: Array.from({ length: STEPS }, (_, i) => ({ summary: current[i]?.summary ?? "", image_url: current[i]?.image_url ?? "" })) };
      let st = JSON.parse(JSON.stringify(baseline));
      const has = (k) => st.picked.includes(k);
      const draw = () => el.replaceChildren(view());
      const view = () => {
        const chosen = units.filter((u) => has(u.key));
        const candidates = (n) => chosen.flatMap((u) => u.approved.map((r, i) => ({ r, u, i }))
          .filter(({ r, i }) => r.media_url && (u.approved.length !== STEPS || i === n || r.media_url === st.steps[n].image_url)));
        // 대표 이미지가 고른 강사 자료에 없으면 알림: 뺀 강사의 이미지인지, 강사 자료에 없는 이미지(예전 화면에서 넣은 것)인지
        const imgsOf = (us) => new Set(us.flatMap((u) => u.approved.map((r) => r.media_url)).filter(Boolean));
        const chosenImgs = imgsOf(chosen), allImgs = imgsOf(units);
        const lost = st.steps.map((s) => (!s.image_url || chosenImgs.has(s.image_url) ? null
          : allImgs.has(s.image_url) ? "고른 이미지의 강사를 뺐습니다. 강사를 다시 체크하거나 다른 이미지를 골라주세요."
          : "지금 대표 이미지는 강사 자료에 없는 이미지입니다(예전 관리 화면에서 넣은 것). 아래 후보에서 골라주세요."));
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
            st.steps[n].summary = await data.ai("common", parts[n].map((t) => `- ${t}`).join("\n"));
          }
          draw();
          msg.replaceChildren(note("AI로 4단계 문구를 만들었습니다. 확인·수정한 뒤 오른쪽 아래 [임시 저장] 또는 [사이트 적용]을 눌러주세요."));
        });
        // 한 단계 = 한 줄(2026-11-20 사용자 디자인): 왼쪽 대표 이미지, 오른쪽 내용 + 후보 이미지(누르면 대표, 고른 것을 다시 누르면 빼기)
        const stepCard = (s, n) => h("div", { class: "cstep" },
          h("b", { class: "cstep-title" }, `${n + 1}단계`),
          h("div", { class: "cstep-body" },
            h("div", {}, h("h4", {}, "대표 이미지"),
              s.image_url ? media(s.image_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "이미지 없음"))),
            h("div", {},
              h("h4", {}, "내용"),
              h("textarea", { rows: 2, value: s.summary, style: "width:100%", "aria-label": `${n + 1}단계 공통 문구`, oninput: (e) => { s.summary = e.target.value; } }),
              lost[n] ? fail(lost[n]) : null,
              h("div", { class: "cand" }, candidates(n).length ? candidates(n).map((c) => {
                const on = c.r.media_url === s.image_url;
                return h("button", { type: "button", "aria-pressed": String(on), title: `${nameOf.get(c.u.instructor_id)} ${c.r.step_label}${on ? " (다시 누르면 빼기)" : ""}`,
                  onclick: () => { s.image_url = on ? "" : c.r.media_url; draw(); } },
                h("img", { src: c.r.media_url, alt: `${nameOf.get(c.u.instructor_id)} ${c.r.step_label}`, class: "thumb" }),
                c.u.approved.length !== STEPS ? h("span", { class: "muted" }, ` ${c.r.step_label} 자료`) : null);
              }) : h("span", { class: "muted" }, "강사를 체크하면 후보 이미지가 나옵니다")))));
        // 강사 팝업과 같은 모양: 왼쪽 = 강사(넣기·빼기), 오른쪽 = 공통 4단계(문구·대표 이미지)
        return h("div", { class: "side-list" },
          box(`강사(${set ? set.name : "일반"} · 검수 완료만)`, pickList, ...extraLeft),
          box(null, h("div", { class: "row" }, h("h3", { style: "margin:0" }, `${set ? `${set.name} ` : ""}공통 4단계`), aiBtn),
            h("div", { style: "margin-top:6px" }, st.steps.map(stepCard))));
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
