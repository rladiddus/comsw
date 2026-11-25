// 과목 공통 4단계 정리(일반 수업): 참고할 강사(검수 완료본만) 고르기 → [AI 공통 정리](고른 자료만 AI에) → 단계마다 문구·대표 이미지 1장 → [확정].
// 4단계가 아닌 강사 자료는 단계를 4묶음으로 나눠 넣고, 그 강사 이미지는 어느 단계에서든 후보(사용자 결정 2026-11-19).
// 공통이 비어 있으면 체크한 강사의 글·이미지로 초안을 채워 보인다(2026-11-24 사용자 요청). [수정]을 누르기 전에는 '바뀐 설정'이 아니다.
// 바꾸면 떠 있는 창: [임시 저장](공개 안 됨) / [사이트 적용](그 과목만 공개). AI는 버튼으로만, 결과는 고칠 수 있는 초안.
import * as data from "../data.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { h, box, pill, media, busy, note, fail, empty } from "../ui.mjs";
import { curriculumUnits, stepState, STEPS } from "../rules.mjs";
import { track, applyNotice } from "../changes.mjs";

// i번째(0부터) 단계가 n개 중이면 4묶음 중 몇 번째인가
export const bucket = (i, n) => (n === STEPS ? i : Math.min(STEPS - 1, Math.floor((i * STEPS) / n)));

// 고른 강사 자료로 4단계 채우기: 글은 강사 모두(여럿이면 줄바꿈), 이미지는 먼저 작성한 강사 것(없으면 다음 강사).
// 작성 순서 = 검수 완료 줄의 시각(작성한 날을 따로 남기지 않아 마지막으로 확정·수정한 시각).
export function fillFrom(chosen) {
  const at = (u) => Math.min(...u.approved.map((r) => Date.parse(r.updated_at ?? "") || 0));
  const order = [...chosen].sort((a, b) => at(a) - at(b));
  return Array.from({ length: STEPS }, (_, n) => {
    const rows = order.flatMap((u) => u.approved.filter((r, i) => bucket(i, u.approved.length) === n));
    return {
      summary: [...new Set(rows.map((r) => (r.summary || r.written || "").trim()).filter(Boolean))].join("\n"),
      image_url: rows.find((r) => r.media_url)?.media_url ?? "",
    };
  });
}

// 처음 체크할 강사(일반 수업): 지금 담당인 강사만. 담당인 강사가 아무도 없으면 자료가 있는 강사 모두(초안이 비지 않게).
// mine = 이 과목을 담당하는 강사 id
export function assignedFirst(units, mine) {
  const on = units.filter((u) => mine.has(u.instructor_id));
  return on.length ? on : units;
}

export function commonEditor(subject, cat, current, { msg, reload, set = null, extraLeft = [], startEditing = true }) {
  // set이 있으면 그 방학 특강의 공통(그 특강 검수본만), 없으면 일반 수업 공통
  const target = set ? `${subject.id}|${set.id}` : subject.id;
  const el = h("div");
  el.trackId = `common:${target}`; // 팝업을 닫을 때 떠 있는 창 등록을 빼려고
  // 보기 / 수정(팝업 [수정]으로 켬). 임시 저장한 것을 불러오면 수정으로.
  let editing = startEditing;
  let redraw = () => {};
  el.isEditing = () => editing;
  let touched = startEditing; // 초안은 [수정]을 눌러야 '바뀐 설정'(열기만 하면 창이 안 뜸)
  el.setEditing = (v) => { editing = v; if (v) touched = true; redraw(); };
  el.onEditing = null;
  (async () => {
    try {
      el.replaceChildren(h("div", { class: "muted" }, "강사 자료 불러오는 중..."));
      const [rows, people, meta, isubs] = await Promise.all([
        data.curricula((q) => q.eq("subject_id", subject.id).eq("status", "approved").order("sort_order", { nullsFirst: false })),
        data.instructors(),
        // 지난번 [사이트 적용] 때 고른 강사 자료(있으면 그 강사를 처음부터 체크)
        data.all(set ? "v4_vacation_meta" : "v4_common_meta", (q) => (set ? q.eq("set_id", set.id) : q).eq("subject_id", subject.id)).catch(() => []),
        data.all("instructor_subjects", (q) => q.eq("subject_id", subject.id)),
      ]);
      const mine = new Set(isubs.map((x) => x.instructor_id));
      const vac = new Set(cat.vacations.map((v) => v.id));
      const units = curriculumUnits(rows).filter((u) => (set ? u.set_id === set.id : !vac.has(u.set_id)) && u.approved.length);
      const nameOf = new Map(people.map((p) => [p.id, p.name]));
      const usedIds = new Set((meta[0]?.sources ?? []).map((x) => x.id));
      // 처음 체크: V4로 반영한 기록이 있으면 그때 쓴 강사, 없으면 검수 완료 강사(2026-11-20 사용자 요청, 일반 수업은 담당 강사 먼저 2026-11-24)
      const used = units.filter((u) => u.approved.some((r) => usedIds.has(r.id)));
      const baseline = { picked: (used.length ? used : set ? units : assignedFirst(units, mine)).map((u) => u.key), steps: Array.from({ length: STEPS }, (_, i) => ({ summary: current[i]?.summary ?? "", image_url: current[i]?.image_url ?? "" })) };
      let st = JSON.parse(JSON.stringify(baseline));
      const picked = () => units.filter((u) => st.picked.includes(u.key));
      // 공통이 비어 있으면 강사 자료로 초안. 체크를 바꾸면 빈칸과 자동으로 채운 칸만 다시 채운다(사람이 고친 글·고른 이미지는 그대로)
      let auto = fillFrom(picked());
      const blank = baseline.steps.every((s) => !s.summary.trim() && !s.image_url);
      if (blank) st.steps = JSON.parse(JSON.stringify(auto));
      const refill = () => {
        const next = fillFrom(picked());
        st.steps.forEach((s, n) => {
          if (!s.summary.trim() || s.summary === auto[n].summary) s.summary = next[n].summary;
          if (!s.image_url || s.image_url === auto[n].image_url) s.image_url = next[n].image_url;
        });
        auto = next;
      };
      const aiOn = Array(STEPS).fill(true); // 단계별 'AI로 만들기' 체크(화면에서만, 저장 안 함)
      const has = (k) => st.picked.includes(k);
      const draw = () => el.replaceChildren(view());
      redraw = draw;
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
            h("input", { type: "checkbox", checked: has(u.key), disabled: !editing, onchange: (e) => { st.picked = e.target.checked ? [...st.picked, u.key] : st.picked.filter((k) => k !== u.key); refill(); draw(); } }),
            nameOf.get(u.instructor_id) ?? "—", " ", pill(s2.label, s2.kind), set || mine.has(u.instructor_id) ? null : pill("담당 아님", "neutral"), " ", h("span", { class: "muted" }, `이미지 ${u.approved.filter((r) => r.media_url).length}장`));
        })) : empty("검수 완료된 강사 자료가 없습니다(강사 메뉴에서 먼저 확정해주세요)");
        // [강사 내용 가져오기]: 체크한 단계를 체크한 강사의 글로 바꾼다(이미지는 비었거나 고른 강사 것이 아닐 때만)
        const bringBtn = h("button", { type: "button", class: "btn", disabled: !chosen.length || !aiOn.some(Boolean), title: "체크한 단계의 내용을 체크한 강사의 글로 바꿉니다", onclick: () => {
          auto = fillFrom(chosen);
          st.steps.forEach((s, n) => {
            if (!aiOn[n]) return;
            s.summary = auto[n].summary;
            if (!s.image_url || !chosenImgs.has(s.image_url)) s.image_url = auto[n].image_url;
          });
          draw();
        } }, "강사 내용 가져오기");
        const isDraft = blank && chosen.length && JSON.stringify(st.steps) === JSON.stringify(auto);
        const draftText = `강사 ${chosen.length}명의 내용으로 채운 초안입니다(아직 홈페이지에 공개되지 않음). `;
        const aiTip = chosen.length > 1 ? "[AI 공통 정리]로 글을 정리한 뒤 " : "";
        const draftNote = !isDraft ? null
          : editing ? note(`${draftText}${aiTip || "확인한 뒤 "}오른쪽 아래 [사이트 적용]을 누르세요.`)
          : applyNotice(`${draftText}이대로 공개하려면 [이대로 사이트 적용], 고치려면 [수정]을 누르${aiTip ? "고 [AI 공통 정리]로 글을 정리하" : ""}세요.`, `common:${target}`, { msg, kind: "note", state: () => st });
        const aiBtn = h("button", { type: "button", class: "btn", disabled: !chosen.length || !aiOn.some(Boolean) }, "AI 공통 정리");
        aiBtn.onclick = () => busy(aiBtn, msg, async () => {
          const parts = Array.from({ length: STEPS }, () => []);
          for (const u of chosen) u.approved.forEach((r, i) => { const t = (r.summary || r.written || "").trim(); if (t) parts[bucket(i, u.approved.length)].push(t); });
          // 4단계를 동시에 요청(차례로 하면 4배 기다림)
          const outs = await Promise.all(parts.map((p, n) => (aiOn[n] && p.length ? data.ai("common", p.map((t) => `- ${t}`).join("\n")) : null)));
          outs.forEach((text, n) => { if (text != null) st.steps[n].summary = text; });
          draw();
          msg.replaceChildren(note("AI로 4단계 문구를 만들었습니다. 확인·수정한 뒤 [사이트 적용]을 누르거나, 오른쪽 아래 창의 [임시 저장]으로 보관하세요."));
        });
        // 단계 카드(강사 팝업 커리큘럼과 같은 모양): 제목·AI 체크, 대표 이미지, 후보(누르면 대표, 고른 것을 다시 누르면 빼기), 아래쪽 '내용'(높이 맞춤)
        const stepCard = (s, n) => (!editing ? h("div", { class: "step step-col" }, h("b", {}, `${n + 1}단계`),
          s.image_url ? media(s.image_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "이미지 없음")),
          h("div", { class: "step-foot" }, h("h4", {}, "내용"), h("p", {}, s.summary || "—"))) : h("div", { class: "step step-col" },
          h("label", { class: "cstep-title" }, `${n + 1}단계 `,
            h("input", { type: "checkbox", checked: aiOn[n], title: "체크한 단계만 [강사 내용 가져오기]·[AI 공통 정리]로 문구를 만듭니다", "aria-label": `${n + 1}단계 AI로 문구 만들기`,
              onchange: (e) => { aiOn[n] = e.target.checked; draw(); } })),
          s.image_url ? media(s.image_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "이미지 없음")),
          lost[n] ? fail(lost[n]) : null,
          h("div", { class: "cand" }, candidates(n).length ? candidates(n).map((c) => {
            const on = c.r.media_url === s.image_url;
            return h("button", { type: "button", "aria-pressed": String(on), title: `${nameOf.get(c.u.instructor_id)} ${c.r.step_label}${on ? " (다시 누르면 빼기)" : ""}`,
              onclick: () => { s.image_url = on ? "" : c.r.media_url; draw(); } },
            h("img", { src: driveThumbnail(c.r.media_url), alt: `${nameOf.get(c.u.instructor_id)} ${c.r.step_label}`, class: "thumb" }), // 드라이브 링크도 사진으로
            c.u.approved.length !== STEPS ? h("span", { class: "muted" }, ` ${c.r.step_label} 자료`) : null);
          }) : h("span", { class: "muted" }, "강사를 체크하면 후보 이미지가 나옵니다")),
          h("div", { class: "step-foot" }, h("h4", {}, "내용"),
            h("textarea", { rows: 4, value: s.summary, style: "width:100%", "aria-label": `${n + 1}단계 공통 문구`, oninput: (e) => { s.summary = e.target.value; } }))));
        // 강사 팝업과 같은 모양: 왼쪽 = 강사(넣기·빼기), 오른쪽 = 공통 4단계(문구·대표 이미지)
        return h("div", { class: "side-list" },
          box(`강사(${set ? set.name : "일반"} · 검수 완료만)`, pickList, ...extraLeft),
          box(null, h("div", { class: "row" }, h("h3", { style: "margin:0" }, `${set ? `${set.name} ` : ""}공통 4단계`), editing ? h("div", { class: "actions" }, bringBtn, aiBtn) : null),
            draftNote,
            h("div", { class: "steps", style: "margin-top:10px" }, st.steps.map(stepCard))));
      };
      track({
        id: `common:${target}`, slot: set ? "vacation-common" : "common", title: `${subject.name}${set ? `(${set.name})` : ""} 공통 4단계`, baseline,
        read: () => (touched ? st : baseline), write: (x) => { touched = true; st = { picked: (x.picked ?? []).filter((k) => units.some((u) => u.key === k)), steps: x.steps }; if (!editing) { editing = true; el.onEditing?.(); } draw(); },
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
