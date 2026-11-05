import { el, pick, chip, hint, btn, locked, panel, empty, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { rpc } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { getServices } from "../../../admin/js/services.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";
import { applyCrop, stripCrop } from "../../../admin/js/image-crop.mjs";
import { state, CAT, norm, splitItems, materialsOf, checkMaterials, typeChip, modal } from "../v3.mjs";
import { aiRequest } from "./aggregate.mjs";
import { groupPicker, groupChooser } from "./subjects.mjs";
import { LEVELS } from "../../../admin/js/pages/department-curriculum.mjs";

// 승인 대기(V3 시안 '통합 승인함'): 승인 단위 = 한 강사 × 한 과목 × 전체 단계(정책 1A). 프로필은 따로.
// 준비물은 '준비물 검토'에서 학과장이 전부 확인해야 승인 버튼이 열린다(정책 9D). 검토 결과는 아직 DB에 칸이 없어 이 화면에만 남는다.
// 정규는 한 화면에서 [이전]/[다음]으로 세 쪽을 넘긴다: ① 제출된 커리큘럼(단계별 AI 요약·적용) → ② 과목별 커리큘럼(학과별 커리큘럼 요약 AI) → ③ 로드맵 문구 → [적용].
// 적용 = 단계마다 사이트 문구 저장 + 기존 단계 승인 함수(comsw_approve_curriculum)를 전체 단계에 차례로, 그다음 바뀐 학과별 커리큘럼 요약·로드맵 문구 저장(기존 '신청 과목' 승인과 같음).
// 방특은 ①만 있고 고른 시기로 옮긴 뒤 승인(기존 '방학 특강'과 같음). 방특은 과목별 표·로드맵이 없다.
// ponytail: 단계별로 따로 승인해서 중간에 끊기면 일부만 승인됨(남은 단계는 목록에 남아 다시 누르면 됨). 한 번에 묶으려면 DB 함수 추가.
// 준비물 검토 결과(최종 분류)는 아직 DB에 칸이 없어 저장되지 않고, 승인 함수는 선생님이 적은 칸 그대로 과목 값에 합친다.
const CURR = "id, instructor_id, set_id, subject_id, step_label, written, summary, media_url, status, vacation, sort_order, updated_at";
// 승인 함수의 comsw_private.merge_items와 같은 규칙: 쉼표·줄바꿈으로 나눠 (띄어쓰기·대소문자 무시) 없는 것만 새 줄에 붙인다.
export function mergeItems(old, add) {
  const key = (x) => x.replace(/\s/g, "").toLowerCase();
  const had = new Set(String(old ?? "").split(/[,\n\r]+/).map(key));
  const added = [...new Set(String(add ?? "").split(/[,\n\r]+/).map((x) => x.trim()).filter((x) => x && !had.has(key(x))))];
  if (!added.length) return old ?? "";
  return String(old ?? "").trim() ? `${old}\n${added.join(", ")}` : added.join(", ");
}
const short = (s, n = 90) => { const t = String(s || "").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

export const reviewedCount = (key, mats) => mats.filter((m) => state.reviews.get(key)?.has(m.id)).length;
// 학과장이 [준비물 작성]으로 직접 쓰면("written") 검토도 끝난 것으로 본다.
export const reviewDone = (key, mats) => state.reviews.get(key)?.has("written") === true || (mats.length ? reviewedCount(key, mats) === mats.length : state.reviews.get(key)?.has("none") === true);

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
    pick(supabase, "subjects", "id, name, is_vacation, duration, dept_curriculum, tools, supplies, level"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "instructor_subject_materials", "instructor_id, subject_id, tools, supplies"),
    pick(supabase, "site_settings", "key, value", (q) => q.eq("key", "vacation_set_id")),
  ]);
  const [tracks, rsteps, rsubs] = await Promise.all([
    pick(supabase, "roadmap_tracks", "id, name"),
    pick(supabase, "roadmap_steps", "id, track_id, position, summary"),
    pick(supabase, "roadmap_step_subjects", "step_id, subject_id, sort_order"),
  ]);
  // 과목 로드맵 문구 칸(subjects.roadmap_summary, 20261105010000)은 운영 SQL 실행 전이면 없어서 따로 읽는다. 없으면 로드맵 단계에만 반영.
  const rmap = await pick(supabase, "subjects", "id, roadmap_summary, group_id").catch(() => null);
  const hasRoad = rmap !== null;
  rmap?.forEach((r) => { const s = subjects.find((x) => x.id === r.id); if (s) Object.assign(s, { roadmap_summary: r.roadmap_summary, group_id: r.group_id }); });
  // 과목 그룹(20261103030000): 준비물은 수업별 준비물에 그룹 이름으로 나오므로, 준비물이 있으면 그룹을 먼저 정해야 적용된다.
  const groupTable = await pick(supabase, "subject_groups", "id, name", (q) => q.order("name")).catch(() => null);
  const groups = groupTable ?? [];
  const gx = { supabase, subjects, groups };
  const cohorts = sets.filter((s) => s.is_vacation);
  headActions(ctx);

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
  const summarize = () => { const fn = getServices().summarize; if (!fn) throw new Error("AI 연결을 준비 중입니다"); return fn; };
  // AI 토글(세 쪽 공통): 기본 꺼짐. 켜면 AI로 만들어 칸을 채우고(실패하면 다시 꺼짐), 끄면 처음 글로 되돌린다.
  function aiToggle(name, text, make, label = "AI 요약") {
    const on = el("input", { type: "checkbox", className: "v3-onoff" });
    on.setAttribute("aria-label", name);
    const before = text.value;
    on.addEventListener("change", async () => {
      if (!on.checked) { text.value = before; return say(""); }
      on.disabled = true;
      try {
        say("AI가 만드는 중…");
        text.value = await make();
        say("AI로 만들었습니다. 고칠 곳이 있으면 칸에서 바로 고쳐주세요.");
      } catch (e) { on.checked = false; say(e.message, true); }
      on.disabled = false;
    });
    return { on, el: el("label", { className: "v3-onoff-label" }, [on, el("span", { textContent: label })]) };
  }

  // 단계마다 AI 요약 토글(켜면 AI 요약 칸이 나오고 그 글이, 끄면 선생님 원문이 공개 사이트 문구), 방특은 담을 시기
  // 학과 관리 '단계별 AI 요약'과 같은 프롬프트(week).
  function inputs(it) {
    it.steps ??= new Map(it.g.rows.map((r) => {
      const text = el("textarea", { className: "v2-textarea", placeholder: "AI 요약", maxLength: 2000, hidden: true });
      text.setAttribute("aria-label", `${r.step_label} AI 요약 글`);
      const t = aiToggle(`${r.step_label} AI 요약`, text, async () => {
        if (!String(r.written || "").trim()) throw new Error(`${r.step_label}: 선생님 원문이 없어 AI로 요약할 수 없습니다`);
        return (await summarize()("week", r.written)).text;
      });
      t.on.addEventListener("change", () => { text.hidden = !t.on.checked; });
      return [r.id, { text, on: t.on, toggle: t.el }];
    }));
    if (it.g.vacation && !it.cohort) {
      const set = sets.find((s) => s.id === it.g.set_id);
      const pre = set?.is_vacation ? set.id : nowCohort[0]?.value ?? "";
      it.cohort = el("select", {}, [el("option", { value: "", textContent: "방특 시기 고르기" }), ...cohorts.map((c) => el("option", { value: c.id, textContent: c.name, selected: c.id === pre }))]);
    }
    return it;
  }

  const siteText = (it, r) => { const s = it.steps.get(r.id); return (s.on.checked ? s.text.value : String(r.written || "")).trim(); };
  const blankSteps = (it) => {
    const blank = it.g.rows.filter((r) => !siteText(it, r));
    if (blank.length) say(`${blank.map((r) => r.step_label).join(", ")}: 사이트에 보일 글이 없습니다. AI 요약 칸에 글을 쓰거나, AI 요약을 끄면 선생님 원문이 쓰입니다.`, true);
    return blank.length > 0;
  };

  // 프로그램·준비물 칸에 합칠 것: 학과장이 [준비물 작성]으로 썼으면 그것(사용 프로그램 / 교재·물품), 아니면 선생님이 적은 칸
  const colsOf = (it) => it.prep ? { tools: it.prep.software, supplies: [it.prep.textbook, it.prep.supply].filter(Boolean).join(", ") }
    : materials.find((m) => m.instructor_id === it.g.instructor_id && m.subject_id === it.g.subject_id) ?? {};

  // [준비물 작성] 학과장·부원장이 선생님 대신 네 분류(교재·물품·사용 프로그램·AI 도구)로 쓴다. 처음엔 선생님이 적은 항목을
  // 준비물 검토 결과(없으면 검사 제안) 분류로 나눠 채운다. 저장하면 검토 끝, ② 프로그램·준비물 칸에 들어가고 [적용] 때 수업별 준비물에 넣는다.
  function prepPopup(it) {
    const now = it.prep ?? Object.fromEntries(Object.keys(CAT).map((k) => [k, checkMaterials(it.mats, [])
      .filter((m) => (state.reviews.get(it.key)?.get(m.id) ?? m.suggested) === k).map((m) => m.label).join(", ")]));
    const boxes = Object.entries(CAT).map(([k, label]) => {
      const x = el("textarea", { className: "v2-textarea", rows: 2, value: now[k] ?? "", placeholder: "쉼표나 줄바꿈으로 나눠 적기", maxLength: 2000 });
      x.setAttribute("aria-label", label);
      return [k, label, x];
    });
    modal(`${it.who} · ${it.subject?.name ?? ""} 준비물 작성`, [
      ...boxes.map(([, label, x]) => el("label", { className: "form-field" }, [el("span", { textContent: label }), x])),
      el("small", { className: "muted", textContent: "저장하면 다음 쪽 프로그램(사용 프로그램)·준비물(교재·물품) 칸에 들어가고, [적용]하면 수업별 준비물에도 들어갑니다." }),
    ], [["저장", () => {
      it.prep = Object.fromEntries(boxes.map(([k, , x]) => [k, x.value.trim()]));
      const r = state.reviews.get(it.key) ?? new Map();
      state.reviews.set(it.key, r.set("written", "written"));
      if (it.f) {
        const c = colsOf(it);
        it.f.tools.value = mergeItems(it.subject?.tools, c.tools);
        it.f.supplies.value = mergeItems(it.subject?.supplies, c.supplies);
        it.f.none.checked = it.f.supplies.disabled = false;
      }
      say("준비물을 작성했습니다.");
      draw();
    }]]).classList.add("v3-narrow");
  }

  // [그룹 설정] 과목 관리의 그룹 팝업과 같음: 그룹이 있으면 그 그룹 고치기, 없으면 새 그룹 만들기·기존 그룹에 넣기
  function groupPopup(it) {
    if (!groupTable) return say("그룹은 운영 SQL(20261103030000) 실행 뒤에 쓸 수 있습니다.", true);
    const s = it.subject;
    const g = groups.find((x) => x.id === s.group_id);
    const psay = el("p", { className: "save-state" });
    let d;
    const saved = () => { d.close?.(); d.remove(); say(`'${nameOf(groups, s.group_id)}' 그룹으로 정했습니다.`); draw(); };
    d = modal("그룹 설정", [el("div", { className: "v3-linkbody" }, [...(g ? groupPicker(gx, g, psay, saved) : groupChooser(gx, s, psay, saved)), psay])], [], "닫기");
    d.classList.add("v3-narrow", "v3-linkpop");
  }

  // [적용] 때 학과장이 작성한 준비물 넣기(승인 전에, 한 번만): 선생님 칸(instructor_subject_materials)을 작성한 것으로 바꾸고
  // 교재·물품·AI 도구를 수업별 준비물(course_prep_items)에 분류대로 넣는다(같은 내용이 이미 있으면 건너뜀).
  // 승인 함수는 선생님 준비물 칸을 '물품'으로 넣는데, 같은 내용이 이미 있으면 건너뛰므로 먼저 넣은 분류가 남는다.
  // 사용 프로그램은 과목 '프로그램' 칸(②)으로 저장된다. AI 도구는 선생님 칸에 넣지 않는다(승인 함수가 프로그램 칸에 합치지 않게).
  async function savePrep(it) {
    const p = it.prep, sid = it.g.subject_id;
    const { error } = await supabase.from("instructor_subject_materials").upsert({ instructor_id: it.g.instructor_id, subject_id: sid, tools: p.software || null,
      supplies: [p.textbook, p.supply].filter(Boolean).join(", ") || null }, { onConflict: "instructor_id,subject_id" });
    if (error) throw new Error(dbErrorMessage(error));
    const { data: have, error: e1 } = await supabase.from("course_prep_items").select("category, content, sort_order").eq("subject_id", sid);
    if (e1) throw new Error(dbErrorMessage(e1));
    const seen = new Set((have ?? []).map((x) => norm(x.content)));
    const department_id = sets.find((x) => x.id === it.g.set_id)?.department_id ?? null;
    const add = [];
    for (const category of ["textbook", "supply", "ai"]) {
      let n = Math.max(-1, ...(have ?? []).filter((x) => x.category === category).map((x) => x.sort_order ?? -1));
      for (const content of splitItems(p[category])) {
        if (seen.has(norm(content))) continue;
        seen.add(norm(content));
        add.push({ subject_id: sid, department_id, category, content, sort_order: ++n });
      }
    }
    if (add.length) { const { error: e2 } = await supabase.from("course_prep_items").insert(add); if (e2) throw new Error(dbErrorMessage(e2)); }
    it.prepDone = true;
  }

  // ② 과목별 커리큘럼 한 줄: 기간·학과별 커리큘럼 요약·프로그램·준비물(없음 체크)·학습 수준을 고친다.
  // 프로그램·준비물은 승인 함수가 선생님이 적은 칸을 과목 값에 합치므로(merge_items), 합친 모습을 미리 채우고 적용 때 이 칸 그대로 저장한다.
  function fields(it) {
    if (it.f) return it.f;
    const s = it.subject ?? {};
    const mat = colsOf(it);
    const area = (k, value, label) => { const x = el("textarea", { className: "v2-textarea", rows: k === "dept" ? 4 : 3, value: value ?? "", placeholder: label, maxLength: 2000 }); x.setAttribute("aria-label", label); return x; };
    const f = {
      duration: el("input", { type: "text", value: s.duration ?? "", placeholder: "기간" }),
      dept: area("dept", s.dept_curriculum, "학과별 커리큘럼 요약"),
      tools: area("tools", mergeItems(s.tools, mat.tools), "프로그램"),
      supplies: area("supplies", mergeItems(s.supplies, mat.supplies), "준비물"),
      none: el("input", { type: "checkbox" }),
      level: el("select", {}, [el("option", { value: "", textContent: "선택 안 함" }), ...[...new Set([...LEVELS, ...(s.level ? [s.level] : [])])].map((v) => el("option", { value: v, textContent: v }))]),
    };
    f.level.value = s.level ?? "";
    f.duration.setAttribute("aria-label", "기간");
    f.level.setAttribute("aria-label", "학습 수준");
    f.none.setAttribute("aria-label", "준비물 없음");
    f.none.addEventListener("change", () => { if (f.none.checked) f.supplies.value = ""; f.supplies.disabled = f.none.checked; });
    // AI생성 토글: 학과 관리 '과목별 커리큘럼'의 AI생성과 같은 프롬프트(department, 줄 수 지시). 지금 요약이 있으면 그것과 이번 제출본을 합친다.
    f.ai = aiToggle("학과별 커리큘럼 요약 AI생성", f.dept, async () => {
      const now = String(it.subject?.dept_curriculum ?? "").trim();
      const mine = sortSteps(it.g.rows).map((r) => `[${r.step_label}]\n- ${siteText(it, r)}`).join("\n\n");
      return (await summarize()("department", aiRequest(it.subject?.name ?? "", state.aiLines, [...(now ? [`[지금 학과별 커리큘럼 요약]\n${now}`] : []), `[${it.who} 선생님 새 커리큘럼]\n${mine}`]))).text;
    }, "AI생성").el;
    return (it.f = f);
  }

  // ③ 로드맵 문구: 과목마다 하나(subjects.roadmap_summary, 모든 학과 공용). 로드맵에 아직 안 넣은 과목도 만들어 둔다.
  // 이 과목이 든 로드맵 단계도 함께 바꾼다: 과목 하나뿐인 단계는 문구 전체, 여럿이 든 단계는 이 과목 줄만(기존 '신청 과목'과 같음).
  function road(it) {
    if (it.road) return it.road;
    const sid = it.g.subject_id;
    const steps = rsteps.filter((st) => rsubs.some((x) => x.step_id === st.id && x.subject_id === sid)).map((st) => {
      const members = rsubs.filter((x) => x.step_id === st.id).sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
      const at = members.findIndex((x) => x.subject_id === sid);
      const lines = String(st.summary ?? "").split("\n");
      const merged = (t) => {
        if (members.length < 2) return t;
        const all = [...lines];
        while (all.length < members.length) all.push("");
        all[at] = t.replace(/\n+/g, " ");
        return all.join("\n");
      };
      return { st, members, merged, line: (members.length > 1 ? lines[at] ?? "" : st.summary ?? "").trim() };
    });
    const text = el("textarea", { className: "v2-textarea", rows: 3, value: it.subject?.roadmap_summary ?? steps.find((x) => x.members.length === 1)?.line ?? "", placeholder: "로드맵 문구", maxLength: 2000 });
    text.setAttribute("aria-label", "로드맵 문구");
    // AI 요약 토글: ②의 학과별 커리큘럼 요약으로 로드맵 문구(roadmap 프롬프트)
    const ai = aiToggle("로드맵 문구 AI 요약", text, async () => (await summarize()("roadmap", `[과목] ${it.subject?.name ?? ""}\n${fields(it).dept.value.trim()}`)).text).el;
    return (it.road = { text, steps, ai });
  }

  async function approve(it, b) {
    if (!reviewDone(it.key, it.mats)) return say("[준비물 작성]으로 준비물을 먼저 확인·저장해주세요(또는 준비물 검토 화면에서 검토).", true);
    inputs(it);
    if (blankSteps(it)) return;
    const hasPrep = it.prep ? Object.values(it.prep).some(Boolean) : it.mats.length > 0;
    if (groupTable && hasPrep && !it.subject?.group_id) return say("준비물을 적용하려면 먼저 [그룹 설정]으로 이 과목의 그룹을 정해주세요. 수업별 준비물에는 그룹 이름으로 나옵니다.", true);
    const setId = it.g.vacation ? it.cohort.value : null;
    if (it.g.vacation && !setId) return say("담을 방특 시기를 골라주세요", true);
    const where = it.g.vacation ? `'${nameOf(cohorts, setId)}' 방특` : it.scope;
    const also = it.g.vacation ? "" : "하고 과목별 커리큘럼·로드맵 문구를 적용";
    if (!confirm(`${it.who} 선생님의 ${it.subject?.name ?? ""} 전체 ${it.g.rows.length}단계를 ${where}에 승인${also}할까요?`)) return;
    if (b) b.disabled = true;
    it.ok ??= new Set(); // 이미 승인한 단계(중간에 끊겨 다시 누를 때 건너뜀)
    try {
      if (it.prep && !it.prepDone) await savePrep(it);
      for (const r of it.g.rows.filter((x) => !it.ok.has(x.id))) {
        const { error } = await supabase.from("instructor_curricula").update({ summary: siteText(it, r), ...(setId ? { set_id: setId } : {}) }).eq("id", r.id);
        if (error) throw new Error(dbErrorMessage(error));
        await rpc(supabase, "comsw_approve_curriculum", { p_id: r.id });
        it.ok.add(r.id);
      }
      if (!it.g.vacation) {
        // 승인 함수가 합친 프로그램·준비물 위에 ② 칸 그대로 덮어쓴다(칸에 합친 모습을 미리 채워 둠).
        const f = fields(it), rd = road(it), t = rd.text.value.trim();
        const val = (x) => x.value.trim() || null;
        const patch = { duration: val(f.duration), dept_curriculum: val(f.dept), tools: val(f.tools), supplies: f.none.checked ? null : val(f.supplies), level: f.level.value || null, ...(hasRoad ? { roadmap_summary: t || null } : {}) };
        const { error } = await supabase.from("subjects").update(patch).eq("id", it.g.subject_id);
        if (error) throw new Error(dbErrorMessage(error));
        Object.assign(it.subject, patch);
        for (const x of t ? rd.steps : []) {
          const summary = x.merged(t);
          if (summary === (x.st.summary ?? "")) continue;
          const { error: e2 } = await supabase.from("roadmap_steps").update({ summary }).eq("id", x.st.id);
          if (e2) throw new Error(dbErrorMessage(e2));
          x.st.summary = summary;
        }
      }
      say(`승인했습니다${it.g.vacation ? "" : "(과목별 커리큘럼·로드맵 문구 함께 적용)"}. 공개 사이트에는 '사이트 반영' 후 보입니다.`);
      items.splice(items.indexOf(it), 1);
      selected = items[0];
      setTimeout(draw, 1200);
    } catch (e) {
      say(`${e.message} (앞 단계는 승인됐을 수 있습니다. 다시 누르면 남은 것만 이어서 합니다.)`, true);
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

  const turn = (it, page) => { it.page = page; say(""); draw(); };

  function curriculum(it) {
    inputs(it);
    it.page ??= 1;
    const pages = it.g.vacation ? 1 : 3;
    const body = it.page === 2 ? deptPage(it) : it.page === 3 ? roadPage(it) : stepsPage(it);
    const go = btn("적용", () => approve(it, go), reviewDone(it.key, it.mats));
    const next = it.page === 1 ? btn("학과 커리큘럼 보기", () => !blankSteps(it) && turn(it, 2), true) : btn("로드맵 문구 보기", () => turn(it, 3), true);
    return [panel(submittedTitle(it.who, it.subject), [
      el("div", { className: "v3-callout" }, [el("b", { textContent: "대상  " }), document.createTextNode(`${it.scope} / ${it.g.vacation ? "방특" : "정규"} / ${it.subject?.name ?? ""} / ${it.who} · 전체 ${it.g.rows.length}단계`)]),
      ...body,
      el("div", { className: "v2-actions v2-end" }, [
        ...(it.page === 1 ? [locked("수정 요청", "커리큘럼 수정 요청은 DB 추가가 필요합니다"), btn("그룹 설정", () => groupPopup(it)), btn("준비물 작성", () => prepPopup(it))] : [btn("이전", () => turn(it, it.page - 1))]),
        it.page === pages ? go : next,
      ]),
      status,
      hint(it.g.vacation ? "준비물은 [준비물 작성]으로 확인·저장하고, 준비물이 있으면 [그룹 설정]으로 그룹을 정해야 승인됩니다. 승인해도 공개 사이트는 '사이트 반영' 전까지 바뀌지 않습니다."
        : "제출된 커리큘럼 → 과목별 커리큘럼 → 로드맵 문구를 차례로 확인하고 마지막 쪽 [적용]을 누르면 함께 저장됩니다. 준비물은 [준비물 작성]으로 확인·저장하고, 준비물이 있으면 [그룹 설정]으로 그룹을 정해야 적용됩니다. 공개 사이트는 '사이트 반영' 전까지 바뀌지 않습니다."),
    ], `${formatSeoul(it.at)}${pages > 1 ? ` · ${it.page}/${pages}쪽` : ""}`, [typeChip(it.subject)])];
  }

  // ① 제출된 커리큘럼
  function stepsPage(it) {
    const steps = sortSteps(it.g.rows);
    const n = reviewedCount(it.key, it.mats);
    const done = reviewDone(it.key, it.mats);
    const extra = (r) => {
      const s = it.steps.get(r.id);
      return { below: [s.text], right: [s.toggle] };
    };
    return [
      submittedSteps(steps, thumb, extra),
      ...(it.g.vacation ? [el("h4", { textContent: "담을 방특 시기" }), it.cohort] : []),
      el("h4", {}, [document.createTextNode("준비물 "), chip(it.prep ? "학과장 작성 완료" : done ? "모두 학과장 검토 완료" : "작성·검토 대기", done ? "good" : "warn"),
        document.createTextNode(" "), it.subject?.group_id ? chip(`그룹: ${nameOf(groups, it.subject.group_id)}`, "vacation") : chip("그룹 없음", "warn")]),
      ...(it.prep ? Object.entries(CAT).map(([k, label]) => el("div", { className: "v3-line" }, [el("b", { textContent: `${label} ` }), document.createTextNode(it.prep[k] || "—")])) : [
      el("small", { className: "muted", textContent: it.mats.length ? `교재·물품·사용 프로그램·AI 도구 ${it.mats.length}개 · 검토 ${n}/${it.mats.length}` : "선생님이 적은 준비물(교재·물품·프로그램·AI 도구)이 없습니다(‘준비물 없음 확인’ 필요)" }),
      ...it.mats.map((m) => el("div", { className: "v3-line" }, [chip(state.reviews.get(it.key)?.has(m.id) ? "확정" : "대기", state.reviews.get(it.key)?.has(m.id) ? "good" : "warn"),
        document.createTextNode(` ${m.label} — ${CAT[state.reviews.get(it.key)?.get(m.id) ?? m.teacher]}`)])),
      ]),
    ];
  }

  // ② 과목별 커리큘럼(학과 관리 표 모양, 이 과목 한 줄). AI생성 토글은 글 상자 아래.
  function deptPage(it) {
    const f = fields(it);
    const cell = (k, kids) => el("div", { className: `dept-cell cell-${k}` }, kids);
    return [
      el("h4", { textContent: "과목별 커리큘럼" }),
      el("div", { className: "dept-curriculum-row v3-headrow v3-deptrow" }, ["", "과목명", "기간", "학과별 커리큘럼 요약", "프로그램", "준비물", "학습 수준"].map((t) => el("b", { textContent: t }))),
      el("div", { className: "dept-curriculum-row v3-deptrow" }, [
        el("span", { className: "v2-num", textContent: "1" }),
        cell("name", [el("b", { textContent: it.subject?.name ?? "" })]),
        cell("duration", [f.duration]),
        cell("dept_curriculum", [f.dept, f.ai]),
        cell("tools", [f.tools]),
        cell("supplies", [f.supplies, el("label", { className: "v3-check" }, [f.none, el("span", { textContent: "없음" })])]),
        cell("level", [f.level]),
      ]),
      el("small", { className: "muted", textContent: "AI생성을 켜면 AI가 지금 학과별 커리큘럼 요약과 이번 제출 커리큘럼을 합쳐 만들고, 끄면 지금 문구로 돌아갑니다. 모든 칸을 바로 고칠 수 있습니다. 프로그램·준비물은 선생님이 적은 것을 합친 모습이고, [적용]하면 이 칸 그대로 저장됩니다(이 과목을 쓰는 모든 학과 공통)." }),
    ];
  }

  // ③ 로드맵 문구(로드맵 화면의 박스 모양, 스텝·삭제 버튼 없음). AI 요약 토글은 글 상자 아래.
  function roadPage(it) {
    const rd = road(it);
    const where = rd.steps.map((x) => `${nameOf(tracks, x.st.track_id) || "로드맵"}${x.members.length > 1 ? `(${x.members.map((m) => nameOf(subjects, m.subject_id)).join("·")} 함께)` : ""}`);
    return [
      el("h4", { textContent: "로드맵 문구" }),
      el("div", { className: "v3-step v3-step2" }, [
        el("div", { className: "v3-stepsubs" }, [el("span", { className: "v3-tchip v3-stepsub active", textContent: it.subject?.name ?? "" }),
          el("small", { className: "muted", textContent: where.length ? `${where.join(", ")} 로드맵에 들어 있음` : "아직 로드맵에 넣지 않았습니다. 문구는 과목에 저장해 두고, 로드맵에 넣으면 쓰입니다." })]),
        el("div", { className: "v3-steptext" }, [el("b", { textContent: "로드맵 문구" }), rd.text, rd.ai,
          ...(rd.steps.some((x) => x.members.length > 1) ? [el("small", { className: "muted", textContent: `과목 여럿이 함께 든 로드맵은 ${it.subject?.name ?? ""} 줄만 바뀝니다.` })] : [])]),
      ]),
      ...(hasRoad ? [] : [hint("과목 로드맵 문구 칸이 아직 DB에 없습니다(운영 SQL 실행 전). 지금은 로드맵에 들어 있는 곳에만 반영됩니다.")]),
    ];
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
