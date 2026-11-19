// 강사: 목록(홈페이지 노출 스위치·이번 제출) → 강사를 누르면 팝업(프로필 / 커리큘럼: 왼쪽 과목, 오른쪽 내용). 이번 제출만 보고, AI는 버튼으로만, [확정] = 그 한 건만 공개.
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, media, dl, fill, empty, note, busy, publishBanner, modal, toggleSwitch } from "../ui.mjs";
import { curriculumUnits, stepState } from "../rules.mjs";
import { track } from "../changes.mjs";

let keep = { id: null, tab: "profile", unit: null };

export async function render({ main }) {
  const reload = () => render({ main });
  main.replaceChildren(head("강사", "홈페이지 노출과 이번 제출을 확인합니다. 강사를 누르면 프로필과 커리큘럼이 팝업으로 열립니다."));
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
    const msg = h("div");
    const listBox = h("section", { class: "box" });
    let pop = null;
    const picksWidth = widestTitle(view.flatMap((p) => p.units.map((u) => unitTitleOf(u, cat))));
    const list = () => table([
      ["이름", (p) => p.name],
      ["학과", (p) => p.depts.join(", ") || "—"],
      ["홈페이지 노출", (p) => toggleSwitch(listed[p.id], `${p.name} 홈페이지 노출([사이트 적용] 때 반영, 계정 로그인과는 상관없음)`, (next) => { listed[p.id] = next; draw(); })],
      ["계정", (p) => (p.account_uid ? "연결" : pill("미연결", "neutral"))],
      ["이번 제출", (p) => {
        const n = p.units.filter((u) => u.pending.length).length;
        const marks = [p.draft && pill("프로필"), n && pill(`커리큘럼 ${n}건`)].filter(Boolean);
        return marks.length ? h("div", { class: "chips" }, marks) : "—";
      }],
    ], view, { onPick: (p) => { keep.id = p.id; keep.unit = null; openPop(p); } });
    const draw = () => listBox.replaceChildren(h("h3", {}, `강사 ${view.length}명`), list());
    // 팝업: 다시 그려도(탭·과목 바꿈) 같은 팝업 안에서
    const openPop = (p) => {
      const inner = h("div", { class: "modal-body" });
      const popMsg = h("div");
      const again = () => {
        inner.replaceChildren(popMsg,
          h("div", { class: "row" }, h("span", { class: "muted" }, p.depts.join(", ")), pill(p.is_listed ? "홈페이지 노출" : "홈페이지 숨김", p.is_listed ? "" : "neutral")),
          tabs([["profile", "프로필"], ["curriculum", "커리큘럼"]], keep.tab, (t) => { keep.tab = t; again(); }),
          h("div", { class: "modal-main" }, keep.tab === "profile" ? box(null, profile(p, { msg: popMsg, reload })) : curriculum(p, cat, { msg: popMsg, reload, again })));
      };
      again();
      pop?.close();
      pop = modal(p.name, inner, { onClose: () => { keep.id = null; pop = null; } });
      // 모든 강사 팝업이 같은 너비: 왼쪽 과목 칸 = 가장 긴 과목 이름이 다 보이는 너비, 오른쪽 = 단계 4개
      pop.dlg.style.setProperty("--picks", `${picksWidth}px`);
      pop.dlg.style.width = `min(calc(100vw - 32px), ${picksWidth + 16 + 900}px)`;
    };
    // 홈페이지 노출: 스위치는 화면에서만 바뀌고 [사이트 적용] 때 반영(사용자 요청 2026-11-19)
    const base = Object.fromEntries(view.map((p) => [p.id, !!p.is_listed]));
    const listed = { ...base };
    track({
      id: "instructors-listed", title: "홈페이지 노출", baseline: base,
      read: () => ({ ...listed }), write: (st) => { Object.assign(listed, st); draw(); },
      apply: async (st) => {
        for (const p of view) if (st[p.id] !== base[p.id]) await data.call("comsw_v4_set_instructor_listed", { p_id: p.id, p_listed: st[p.id] });
      },
      onApplied: reload,
    });
    draw();
    const again = view.find((p) => p.id === keep.id);
    if (again) setTimeout(() => openPop(again)); // 확정 뒤 다시 불러오면 보던 팝업을 다시 연다
    return [await publishBanner(data.unpublished), msg, listBox];
  });
}

function profile(p, { msg, reload }) {
  const d = p.draft;
  if (!d) return h("div", { class: "two" },
    h("div", {}, h("h4", {}, "공개 중"), dl([["이름", p.name], ["경력", p.career], ["한마디", p.message]])),
    h("div", {}, h("h4", {}, "사진"), media(p.photo_url)));
  const f = { career: d.career ?? "", message: d.message ?? "" };
  const area = (k, rows) => h("textarea", { rows, value: f[k], style: "width:100%", oninput: (e) => { f[k] = e.target.value; } });
  const photoBtn = h("button", { type: "button", class: "btn" }, "AI 프로필 사진 만들기");
  photoBtn.onclick = () => busy(photoBtn, msg, async () => {
    if (!d.source_asset_id) throw new Error("강사가 올린 본인 사진이 없습니다");
    const { getServices } = await import("../../../admin/js/services.mjs");
    await getServices().generateProfile(p.id);
    reload();
  });
  const ok = h("button", { type: "button", class: "btn primary" }, "확정");
  ok.onclick = () => busy(ok, msg, async () => {
    if (!confirm(`${p.name} 프로필을 확정할까요? 홈페이지에 바로 반영됩니다(노출 설정은 그대로).`)) return;
    await data.call("comsw_v4_confirm_profile", { p_instructor: p.id, p_updated_at: d.updated_at, p_career: f.career, p_message: f.message });
    reload();
  });
  return h("div", {},
    note("이번 제출입니다. 고친 문구로 확정하며, 확정 전에는 홈페이지에 공개되지 않습니다. 강사 원문은 기록에 남습니다."),
    h("div", { class: "two" },
      h("div", {}, dl([["이름", d.name]]), h("h4", {}, "경력"), area("career", 6), h("h4", {}, "한마디"), area("message", 3)),
      h("div", {}, h("h4", {}, "사진(확정되면 공개)"), media(d.photo_url || p.photo_url),
        h("p", { class: "muted" }, d.photo_url ? "AI로 만든 사진입니다." : d.source_asset_id ? "강사가 본인 사진을 올렸습니다. AI 사진을 만든 뒤 확정하세요." : "새 사진 없음(지금 사진 그대로)."),
        d.source_asset_id ? photoBtn : null)),
    h("div", { class: "actions" }, ok));
}

// 과목 칸 이름 '과목 · 일반/특강'
function unitTitleOf(u, cat) {
  const subj = cat.subjects.find((x) => x.id === u.subject_id)?.name ?? "(삭제된 과목)";
  const vac = cat.vacations.find((v) => v.id === u.set_id);
  return `${subj} · ${vac ? vac.name : "일반"}`;
}
// 가장 긴 이름이 한 줄에 다 보이는 왼쪽 칸 너비(px): 글자 폭 + '이번 제출' 표시 + 안쪽 여백·스크롤 막대
function widestTitle(titles) {
  const ctx = globalThis.document?.createElement("canvas").getContext?.("2d");
  if (ctx) ctx.font = "700 13px 'Malgun Gothic', system-ui, sans-serif";
  const w = Math.max(0, ...titles.map((t) => (ctx ? ctx.measureText(t).width : t.length * 13)));
  return Math.ceil(Math.max(180, w + 24 + 70 + 40 + 16));
}

function curriculum(p, cat, { msg, reload, again }) {
  if (!p.units.length) return empty("제출한 커리큘럼이 없습니다");
  const subj = new Map(cat.subjects.map((s) => [s.id, s.name]));
  const setName = new Map(cat.sets.map((s) => [s.id, s.name]));
  const unitTitle = (u) => unitTitleOf(u, cat);
  const sel = p.units.find((u) => u.key === keep.unit) ?? p.units.find((u) => u.pending.length) ?? p.units[0];
  const picks = h("div", { class: "picks" }, p.units.map((u) => h("button", { type: "button", "aria-pressed": String(u === sel), title: unitTitle(u),
    onclick: () => { keep.unit = u.key; again(); } }, unitTitle(u), " ", u.pending.length ? pill("이번 제출") : null)));
  return h("div", { class: "side-list" }, box("과목", picks), [sel].map((u) => {
    const now = u.pending.length ? u.pending : u.approved;
    const st = stepState(now.length);
    const vac = cat.vacations.some((v) => v.id === u.set_id);
    const title = `${subj.get(u.subject_id) ?? "(삭제된 과목)"} · ${vac ? setName.get(u.set_id) : "일반"}`;
    const top = h("div", { class: "row" }, h("h3", {}, title),
      h("div", { class: "actions" }, pill(u.pending.length ? "이번 제출(검수 전)" : "검수 완료", u.pending.length ? "" : "neutral"), pill(st.label, st.kind)));
    if (!u.pending.length) {
      return h("div", { class: "box" }, top, h("div", { class: "steps" }, now.map((r) => h("div", { class: "step" },
        h("b", {}, r.step_label), h("p", {}, r.summary || r.written || "—"), r.media_url ? media(r.media_url) : null))));
    }
    // 이번 제출 검수: 원문은 그대로, 홈페이지 문구(summary)만 고침. AI 다듬기는 버튼으로만.
    const edits = new Map(u.pending.map((r) => [r.id, r.summary ?? ""]));
    const card = (r) => {
      const area = h("textarea", { rows: 3, value: edits.get(r.id), placeholder: "비우면 원문이 그대로 공개됩니다", style: "width:100%",
        "aria-label": `${r.step_label} 홈페이지 문구`, oninput: (e) => edits.set(r.id, e.target.value) });
      const aiBtn = h("button", { type: "button", class: "btn" }, "AI 문장 다듬기");
      aiBtn.onclick = () => busy(aiBtn, msg, async () => {
        area.value = await data.ai("week", r.written ?? "");
        edits.set(r.id, area.value);
      });
      return h("div", { class: "step" }, h("b", {}, r.step_label), h("p", {}, r.written || "—"),
        r.media_url ? media(r.media_url) : null, h("h4", {}, "홈페이지 문구"), area, aiBtn);
    };
    const ok = h("button", { type: "button", class: "btn primary", disabled: u.pending.length !== 4 }, "확정");
    ok.onclick = () => busy(ok, msg, async () => {
      if (!confirm(`${p.name} · ${title}을(를) 확정할까요? 이 4단계가 홈페이지에 바로 반영되고, 예전 검수본은 보관됩니다.`)) return;
      await data.call("comsw_v4_confirm_curriculum", {
        p_instructor: u.instructor_id, p_set: u.set_id, p_subject: u.subject_id,
        p_steps: u.pending.map((r) => ({ id: r.id, updated_at: r.updated_at, summary: edits.get(r.id) ?? "" })),
      });
      reload();
    });
    return h("div", { class: "box" }, top,
      u.pending.length !== 4 ? note(`4단계가 모두 있어야 확정할 수 있습니다(지금 ${u.pending.length}단계). 강사가 채워서 다시 제출해야 합니다.`) : null,
      h("div", { class: "steps" }, u.pending.map(card)),
      h("div", { class: "actions", style: "margin-top:12px" }, ok));
  })[0]);
}
