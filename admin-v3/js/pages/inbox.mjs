import { el, pick, chip, hint, btn, locked, panel, empty, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { rpc } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { applyCrop, stripCrop } from "../../../admin/js/image-crop.mjs";
import { state, CAT, materialsOf, typeChip } from "../v3.mjs";

// 승인 대기(V3 시안 '통합 승인함'): 승인 단위 = 한 강사 × 한 과목 × 전체 단계(정책 1A). 프로필은 따로.
// 준비물은 '준비물 검토'에서 학과장이 전부 확인해야 승인 버튼이 열린다(정책 9D). 검토 결과는 아직 DB에 칸이 없어 이 화면에만 남는다.
// 승인 = 단계마다 사이트 문구 저장 + 기존 단계 승인 함수(comsw_approve_curriculum)를 전체 단계에 차례로. 방특은 고른 시기로 옮긴 뒤 승인(기존 '방학 특강'과 같음).
// ponytail: 단계별로 따로 승인해서 중간에 끊기면 일부만 승인됨(남은 단계는 목록에 남아 다시 누르면 됨). 한 번에 묶으려면 DB 함수 추가.
// 준비물 검토 결과(최종 분류)는 아직 DB에 칸이 없어 저장되지 않고, 승인 함수는 선생님이 적은 칸 그대로 과목 값에 합친다.
const CURR = "id, instructor_id, set_id, subject_id, step_label, written, summary, media_url, status, vacation, sort_order, updated_at";
const short = (s, n = 90) => { const t = String(s || "").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

export const reviewedCount = (key, mats) => mats.filter((m) => state.reviews.get(key)?.has(m.id)).length;
export const reviewDone = (key, mats) => mats.length ? reviewedCount(key, mats) === mats.length : state.reviews.get(key)?.has("none") === true;

// 커리큘럼 이미지: 작게 보여 주고 누르면 크게(선생님 '내 커리큘럼'과 같은 방식). 대시보드도 같이 쓴다.
export function imageZoom() {
  const zoom = el("dialog", { className: "image-zoom" });
  zoom.addEventListener("click", () => zoom.close?.());
  const thumb = (url, alt) => {
    if (!url) return el("div", { className: "submission-thumb empty", textContent: "이미지 없음" });
    const b = el("button", { type: "button", className: "submission-thumb", title: "크게 보기" }, [applyCrop(el("img", { src: driveThumbnail(url), alt }), url)]);
    b.addEventListener("click", () => {
      zoom.replaceChildren(el("img", { src: driveThumbnail(stripCrop(url)), alt }));
      if (zoom.showModal) zoom.showModal(); else zoom.setAttribute("open", "");
    });
    return b;
  };
  return { zoom, thumb };
}
export const sortSteps = (rows) => [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.step_label).localeCompare(String(b.step_label)));
export const submittedTitle = (who, subject) => `${who} 선생님의 ${subject?.name ?? ""} 제출 커리큘럼`;
// 제출된 커리큘럼: 단계마다 이미지 왼쪽, 글 오른쪽. extra(r) = { below: 글 아래, right: 맨 오른쪽 }(승인 대기의 AI 요약·적용 스위치)
export const submittedSteps = (steps, thumb, extra) => el("div", { className: "v2-diff v3-submitted" }, [
  el("div", { className: "v2-diff-cols v2-diff-head" }, [el("div", { textContent: "제출된 커리큘럼" })]),
  ...steps.map((r) => {
    const more = extra?.(r);
    return el("div", { className: `v2-diff-cols${more ? " with-right" : ""}` }, [
      el("div", {}, [thumb(r.media_url, `${r.step_label} 이미지`)]),
      el("div", {}, [el("b", { textContent: r.step_label }), el("div", { textContent: String(r.written || "").trim() || "(원문 없음)" }), ...(more?.below ?? [])]),
      ...(more ? [el("div", {}, more.right)] : []),
    ]);
  }),
]);

export async function render(container, ctx) {
  const { supabase } = ctx;
  const pending = await pick(supabase, "instructor_curricula", CURR, (q) => q.eq("status", "pending"));
  const who = [...new Set(pending.map((r) => r.instructor_id))];
  const [approved, drafts, instructors, subjects, sets, depts, materials, nowCohort] = await Promise.all([
    who.length ? pick(supabase, "instructor_curricula", CURR, (q) => q.eq("status", "approved").in("instructor_id", who)) : [],
    pick(supabase, "instructor_profile_drafts", "*", (q) => q.eq("status", "pending")),
    pick(supabase, "instructors", "id, name, career, message, photo_url"),
    pick(supabase, "subjects", "id, name, is_vacation"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "instructor_subject_materials", "instructor_id, subject_id, tools, supplies"),
    pick(supabase, "site_settings", "key, value", (q) => q.eq("key", "vacation_set_id")),
  ]);
  const cohorts = sets.filter((s) => s.is_vacation);
  headActions(ctx, btn("과목 전체 승인", () => selected?.g && approve(selected), true));

  const items = [
    ...groupRequests(pending).map((g) => {
      const set = sets.find((s) => s.id === g.set_id);
      return {
        key: g.key, g, at: g.at, subject: subjects.find((s) => s.id === g.subject_id),
        before: approved.filter((a) => a.instructor_id === g.instructor_id && a.set_id === g.set_id && a.subject_id === g.subject_id),
        mats: materialsOf(materials.find((m) => m.instructor_id === g.instructor_id && m.subject_id === g.subject_id)),
        who: nameOf(instructors, g.instructor_id), scope: g.vacation ? (set?.is_vacation ? set.name : "방특(시기 담기 전)") : nameOf(depts, set?.department_id) || set?.name || "",
      };
    }),
    ...drafts.map((d) => ({ key: `profile|${d.instructor_id}`, d, at: d.updated_at, who: nameOf(instructors, d.instructor_id) })),
  ];
  const want = decodeURIComponent(location.hash.split("/")[2] ?? "");
  let selected = items.find((it) => it.key === want) ?? items[0];
  const listBox = el("div", { className: "v2-boxlist" });
  const mid = el("div", { className: "v2-stack" });
  const status = el("p", { className: "save-state" });
  const { zoom, thumb } = imageZoom();

  const say = (text, err = false) => { status.textContent = text; status.className = `save-state${err ? " err" : ""}`; };

  // 단계마다 AI 요약 칸과 적용 스위치(켜면 AI 요약, 끄면 선생님 원문이 공개 사이트 문구), 방특은 담을 시기
  function inputs(it) {
    it.steps ??= new Map(it.g.rows.map((r) => {
      const text = el("textarea", { className: "v2-textarea", value: r.summary ?? "", placeholder: "AI 요약", maxLength: 2000 });
      text.setAttribute("aria-label", `${r.step_label} AI 요약`);
      text.hidden = !text.value;
      const on = el("input", { type: "checkbox", className: "v3-onoff", checked: Boolean(r.summary) });
      on.setAttribute("aria-label", `${r.step_label} AI 요약 적용`);
      return [r.id, { text, on }];
    }));
    if (it.g.vacation && !it.cohort) {
      const set = sets.find((s) => s.id === it.g.set_id);
      const pre = set?.is_vacation ? set.id : nowCohort[0]?.value ?? "";
      it.cohort = el("select", {}, [el("option", { value: "", textContent: "방특 시기 고르기" }), ...cohorts.map((c) => el("option", { value: c.id, textContent: c.name, selected: c.id === pre }))]);
    }
    return it;
  }

  // 한 단계 AI 요약(학과 관리 '단계별 AI 요약'과 같은 프롬프트 week). 만들면 적용이 켜진다.
  async function aiStep(r, s, b) {
    const fn = getServices().summarize;
    if (!fn) return say("AI 연결을 준비 중입니다", true);
    if (!String(r.written || "").trim()) return say(`${r.step_label}: 선생님 원문이 없어 AI로 요약할 수 없습니다`, true);
    b.disabled = true;
    try {
      say("AI 요약 중…");
      s.text.value = (await fn("week", r.written)).text;
      s.text.hidden = false;
      s.on.checked = true;
      say(`${r.step_label} AI 요약을 만들었습니다. 고칠 곳이 있으면 칸에서 바로 고쳐주세요.`);
    } catch (e) { say(e.message, true); }
    b.disabled = false;
  }
  const siteText = (it, r) => { const s = it.steps.get(r.id); return (s.on.checked ? s.text.value : String(r.written || "")).trim(); };

  async function approve(it, b) {
    if (!reviewDone(it.key, it.mats)) { location.hash = `#/validation/${encodeURIComponent(it.key)}`; return; }
    inputs(it);
    const blank = it.g.rows.filter((r) => !siteText(it, r));
    if (blank.length) return say(`${blank.map((r) => r.step_label).join(", ")}: 사이트에 보일 글이 없습니다. AI 요약을 만들거나, 적용을 끄면 선생님 원문이 쓰입니다.`, true);
    const setId = it.g.vacation ? it.cohort.value : null;
    if (it.g.vacation && !setId) return say("담을 방특 시기를 골라주세요", true);
    const where = it.g.vacation ? `'${nameOf(cohorts, setId)}' 방특` : it.scope;
    if (!confirm(`${it.who} 선생님의 ${it.subject?.name ?? ""} 전체 ${it.g.rows.length}단계를 ${where}에 승인할까요?`)) return;
    if (b) b.disabled = true;
    try {
      for (const r of it.g.rows) {
        const { error } = await supabase.from("instructor_curricula").update({ summary: siteText(it, r), ...(setId ? { set_id: setId } : {}) }).eq("id", r.id);
        if (error) throw new Error(dbErrorMessage(error));
        await rpc(supabase, "comsw_approve_curriculum", { p_id: r.id });
      }
      say("승인했습니다. 학과 관리·로드맵 문구는 해당 메뉴에서 확인하고, 공개 사이트에는 '사이트 반영' 후 보입니다.");
      items.splice(items.indexOf(it), 1);
      selected = items[0];
      setTimeout(draw, 1200);
    } catch (e) {
      say(`${e.message} (앞 단계는 승인됐을 수 있습니다. 다시 누르면 남은 단계까지 승인합니다.)`, true);
      if (b) b.disabled = false;
    }
  }

  function draw() {
    listBox.replaceChildren(...(items.length ? items.map((it) => Object.assign(el("div", { className: `v2-listitem${it === selected ? " active" : ""}` }, [
      el("div", { className: "v2-row" }, [el("b", { textContent: it.g ? `${it.who} · ${it.subject?.name ?? ""}` : `${it.who} · 프로필` }), it.g ? typeChip(it.subject) : chip("프로필", "profiles")]),
      el("small", { textContent: it.g ? `${it.scope} · ${it.g.rows.length}단계${it.before.length ? " · 재제출" : ""}` : "개별 검토 및 승인" }),
      el("div", {}, [it.g ? chip(reviewDone(it.key, it.mats) ? "준비물 검토 완료" : "승인 대기", reviewDone(it.key, it.mats) ? "good" : "warn") : chip("별도 승인 대기", "warn")]),
    ]), { onclick: () => { selected = it; say(""); draw(); } })) : [empty("승인 대기 중인 제출이 없습니다.")]));
    mid.replaceChildren(...(selected ? (selected.g ? curriculum(selected) : profile(selected)) : []));
  }

  function curriculum(it) {
    const steps = sortSteps(it.g.rows);
    const n = reviewedCount(it.key, it.mats);
    const done = reviewDone(it.key, it.mats);
    inputs(it);
    const go = btn("과목 전체 승인", () => approve(it, go), done);
    const extra = (r) => {
      const s = it.steps.get(r.id);
      const ai = btn("AI 요약", () => aiStep(r, s, ai));
      return { below: [el("div", { className: "v2-actions" }, [ai]), s.text], right: [el("label", { className: "v3-onoff-label", title: "켜면 AI 요약, 끄면 선생님 원문이 사이트 문구" }, [s.on, el("span", { textContent: "적용" })])] };
    };
    return [panel(submittedTitle(it.who, it.subject), [
      el("div", { className: "v3-callout" }, [el("b", { textContent: "대상  " }), document.createTextNode(`${it.scope} / ${it.g.vacation ? "방특" : "정규"} / ${it.subject?.name ?? ""} / ${it.who} · 전체 ${steps.length}단계`)]),
      submittedSteps(steps, thumb, extra),
      ...(it.g.vacation ? [el("h4", { textContent: "담을 방특 시기" }), it.cohort] : []),
      el("h4", {}, [document.createTextNode("준비물 검토 상태 "), chip(done ? "모두 학과장 검토 완료" : "검토 대기", done ? "good" : "warn")]),
      el("small", { className: "muted", textContent: it.mats.length ? `교재·물품·사용 프로그램·AI 도구 ${it.mats.length}개 · 검토 ${n}/${it.mats.length}` : "선생님이 적은 준비물(교재·물품·프로그램·AI 도구)이 없습니다(‘준비물 없음 확인’ 필요)" }),
      ...it.mats.map((m) => el("div", { className: "v3-line" }, [chip(state.reviews.get(it.key)?.has(m.id) ? "확정" : "대기", state.reviews.get(it.key)?.has(m.id) ? "good" : "warn"),
        document.createTextNode(` ${m.label} — ${CAT[state.reviews.get(it.key)?.get(m.id) ?? m.teacher]}`)])),
      el("div", { className: "v2-actions v2-end" }, [
        locked("수정 요청", "커리큘럼 수정 요청은 DB 추가가 필요합니다"),
        btn("준비물 검토 보기", () => { location.hash = `#/validation/${encodeURIComponent(it.key)}`; }, !done),
        go,
      ]),
      status,
      hint("검사 제안만으로는 승인하지 않습니다. 준비물을 모두 확인해야 승인 버튼이 열립니다. 승인해도 공개 사이트는 '사이트 반영' 전까지 바뀌지 않습니다. 준비물 검토의 최종 분류는 아직 저장되지 않아(DB 추가 후), 지금은 선생님이 적은 칸 그대로 과목에 합쳐집니다."),
    ], formatSeoul(it.at), [typeChip(it.subject)])];
  }

  function profile(it) {
    const now = instructors.find((i) => i.id === it.d.instructor_id) ?? {};
    const note = el("textarea", { className: "v2-textarea", placeholder: "수정 요청 내용", maxLength: 2000 });
    const msg = el("p", { className: "save-state" });
    const run = async (b, name, args) => {
      b.disabled = true;
      try { await rpc(supabase, name, args); msg.textContent = "처리했습니다. '사이트 반영'을 눌러야 공개 사이트에 보입니다."; items.splice(items.indexOf(it), 1); selected = items[0]; setTimeout(draw, 900); }
      catch (e) { msg.textContent = e.message; msg.classList.add("err"); b.disabled = false; }
    };
    const ask = btn("수정 요청", () => note.value.trim() ? run(ask, "comsw_request_profile_changes", { p_id: it.d.instructor_id, p_note: note.value.trim(), p_updated_at: it.d.updated_at })
      : (msg.textContent = "수정 요청할 내용을 적어주세요"));
    const ok = btn("프로필 승인", () => confirm(`${it.who} 선생님의 프로필을 승인할까요?`) && run(ok, "comsw_approve_profile", { p_id: it.d.instructor_id, p_updated_at: it.d.updated_at }), true);
    const side2 = (x) => [el("b", { textContent: x.name || "" }), el("div", { textContent: short(x.career, 200) || "(경력 없음)" }),
      el("div", { className: "muted", textContent: short(x.message, 120) || "(한마디 없음)" }),
      ...(x.photo_url ? [el("img", { className: "v2-thumb", src: x.photo_url, alt: "" })] : [el("div", { className: "muted", textContent: "사진 없음" })])];
    return [panel(`${it.who} · 프로필`, [
      hint("프로필은 과목 승인과 따로 승인합니다(정책 1A)."),
      el("div", { className: "v2-diff" }, [
        el("div", { className: "v2-diff-cols v2-diff-head" }, [el("div", { textContent: "지금 사이트 프로필" }), el("div", { textContent: "이번 제출본" })]),
        el("div", { className: "v2-diff-cols" }, [el("div", {}, side2(now)), el("div", {}, side2(it.d))]),
      ]),
      note, el("div", { className: "v2-actions v2-end" }, [ask, ok]), msg,
    ], formatSeoul(it.at), [chip("프로필", "profiles")])];
  }

  container.append(
    el("div", { className: "v3-dash" }, [
      el("section", { className: "v2-panel" }, [el("div", { className: "v2-panel-head" }, [el("h3", { textContent: "제출 목록" }), chip(`${items.length}건`, "warn")]), listBox]),
      mid,
    ]),
    zoom,
  );
  draw();
}
