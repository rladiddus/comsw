// 과목 공통 4단계 정리(일반 수업): 참고할 강사(검수 완료본만) 고르기 → [AI 공통 정리](고른 자료만 AI에) → 단계마다 문구·대표 이미지 1장 → [확정].
// 4단계가 아닌 강사 자료는 단계를 4묶음으로 나눠 넣고, 그 강사 이미지는 어느 단계에서든 후보(사용자 결정 2026-11-19).
// [저장] = v4_drafts(공개 안 됨). [확정] = 그 과목만 바로 공개. AI는 버튼으로만, 결과는 고칠 수 있는 초안.
import * as data from "../data.mjs";
import { h, box, pill, media, busy, note, fail, empty } from "../ui.mjs";
import { curriculumUnits, stepState, STEPS } from "../rules.mjs";

// i번째(0부터) 단계가 n개 중이면 4묶음 중 몇 번째인가
export const bucket = (i, n) => (n === STEPS ? i : Math.min(STEPS - 1, Math.floor((i * STEPS) / n)));

export function commonEditor(subject, cat, current, { msg, reload }) {
  const el = h("div");
  (async () => {
    try {
      el.replaceChildren(h("div", { class: "muted" }, "강사 자료 불러오는 중..."));
      const [rows, people, saved] = await Promise.all([
        data.curricula((q) => q.eq("subject_id", subject.id).eq("status", "approved").order("sort_order", { nullsFirst: false })),
        data.instructors(),
        data.all("v4_drafts", (q) => q.eq("kind", "common").eq("target", subject.id)).catch(() => []),
      ]);
      const vac = new Set(cat.vacations.map((v) => v.id));
      const units = curriculumUnits(rows).filter((u) => !vac.has(u.set_id) && u.approved.length);
      const nameOf = new Map(people.map((p) => [p.id, p.name]));
      const draft = saved[0]?.payload;
      const st = {
        picked: new Set(draft?.picked ?? []),
        steps: draft?.steps ?? Array.from({ length: STEPS }, (_, i) => ({ summary: current[i]?.summary ?? "", image_url: current[i]?.image_url ?? "" })),
      };
      st.picked.forEach((k) => { if (!units.some((u) => u.key === k)) st.picked.delete(k); });
      const draw = () => el.replaceChildren(view(units, nameOf, st, draft));
      const view = () => {
        const chosen = units.filter((u) => st.picked.has(u.key));
        const candidates = (n) => chosen.flatMap((u) => u.approved.map((r, i) => ({ r, u, i }))
          .filter(({ r, i }) => r.media_url && (u.approved.length !== STEPS || i === n)));
        const lost = st.steps.map((s, n) => s.image_url && !candidates(n).some((c) => c.r.media_url === s.image_url));
        const pickList = units.length ? h("div", {}, units.map((u) => {
          const s2 = stepState(u.approved.length);
          return h("label", { style: "display:flex;gap:8px;align-items:center;margin:4px 0" },
            h("input", { type: "checkbox", checked: st.picked.has(u.key), onchange: (e) => { e.target.checked ? st.picked.add(u.key) : st.picked.delete(u.key); draw(); } }),
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
          msg.replaceChildren(note("AI로 4단계 문구를 만들었습니다. 확인·수정한 뒤 [저장] 또는 [확정]을 눌러주세요."));
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
        const save = h("button", { type: "button", class: "btn" }, "저장");
        save.onclick = () => busy(save, msg, async () => {
          const { error } = await data.upsertDraft("common", subject.id, { picked: [...st.picked], steps: st.steps });
          if (error) throw new Error(error);
          msg.replaceChildren(note(`${subject.name}: 저장했습니다(아직 공개 전).`));
        });
        const ok = h("button", { type: "button", class: "btn primary", disabled: !chosen.length || lost.some(Boolean) }, "확정");
        ok.onclick = () => busy(ok, msg, async () => {
          if (st.steps.some((s) => !s.summary.trim())) throw new Error("4단계 문구를 모두 채워주세요");
          if (!confirm(`${subject.name} 공통 4단계를 확정할까요? 홈페이지에 바로 반영되고, 예전 단계는 보관됩니다.`)) return;
          await data.call("comsw_v4_confirm_common", {
            p_subject: subject.id,
            p_sources: chosen.flatMap((u) => u.approved.map((r) => ({ id: r.id, updated_at: r.updated_at }))),
            p_steps: st.steps.map((s) => ({ summary: s.summary.trim(), image_url: s.image_url || "" })),
          });
          await data.dropDraft("common", subject.id).catch(() => {});
          reload();
        });
        return h("div", {},
          box("참고할 강사 자료(일반 · 검수 완료만)", pickList, h("div", { class: "actions", style: "margin-top:10px" }, aiBtn)),
          box(`공통 4단계${draft ? " · 저장한 내용" : ""}`, h("div", { class: "steps" }, st.steps.map(stepCard)),
            h("div", { class: "actions", style: "margin-top:12px" }, save, ok)));
      };
      draw();
    } catch (err) {
      el.replaceChildren(fail(`불러오지 못했습니다: ${err.message}`));
    }
  })();
  return el;
}
