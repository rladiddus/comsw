import { el, pick, chip, hint, btn, locked, panel, check, empty, select, editor, headActions, groupRequests, nameOf } from "../ui.mjs";
import { rpc } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";

// 승인 대기(시안 '통합 승인함'): 왼쪽 요청 목록, 오른쪽 '기존 승인본 vs 이번 제출본' 비교·검사·처리.
// 프로필은 여기서 바로 승인·수정 요청한다. 커리큘럼·방특 승인은 문구 다듬기·학과/로드맵 문구가 함께라 기존 승인 화면을 아래에 연다.
// 커리큘럼 '수정 요청'·'반려'는 DB에 칸이 없어 잠가 둔다(다음 단계).
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);
const CURR = "id, instructor_id, set_id, subject_id, step_label, written, summary, media_url, status, vacation, sort_order, updated_at";
const short = (s, n = 90) => { const t = String(s || "").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

export async function render(container, ctx) {
  const { supabase } = ctx;
  headActions(ctx, locked("검토 기준 보기", "준비 중"));
  const pending = await pick(supabase, "instructor_curricula", CURR, (q) => q.eq("status", "pending"));
  const who = [...new Set(pending.map((r) => r.instructor_id))];
  const [approved, drafts, instructors, subjects, sets, depts, mySubjects, materials] = await Promise.all([
    who.length ? pick(supabase, "instructor_curricula", CURR, (q) => q.eq("status", "approved").in("instructor_id", who)) : [],
    pick(supabase, "instructor_profile_drafts", "*", (q) => q.eq("status", "pending")),
    pick(supabase, "instructors", "id, name, career, message, photo_url"),
    pick(supabase, "subjects", "id, name"),
    pick(supabase, "curriculum_sets", "id, name, department_id"),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "instructor_subjects", "instructor_id, subject_id"),
    pick(supabase, "instructor_subject_materials", "instructor_id, subject_id, tools, supplies"),
  ]);

  const items = [
    ...groupRequests(pending).map((g) => {
      const before = approved.filter((a) => a.instructor_id === g.instructor_id && a.set_id === g.set_id && a.subject_id === g.subject_id);
      return {
        kind: g.vacation ? "vacation" : "curricula", type: g.vacation ? "방학 특강" : "커리큘럼", g, before, at: g.at,
        title: `${nameOf(subjects, g.subject_id)} ${g.vacation ? "방학 특강" : "커리큘럼"}`,
        who: `${nameOf(instructors, g.instructor_id)} · ${g.vacation ? "방특" : nameOf(sets, g.set_id)}`,
        dept: sets.find((s) => s.id === g.set_id)?.department_id ?? "", again: before.length > 0,
      };
    }),
    ...drafts.map((d) => ({ kind: "profiles", type: "프로필", d, at: d.updated_at, title: "강사 프로필 수정", who: nameOf(instructors, d.instructor_id), dept: "", again: false })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const typePick = select("유형", [["", "전체 유형"], ["curricula", "커리큘럼"], ["vacation", "방학 특강"], ["profiles", "프로필"]]);
  const deptPick = select("학과", [["", "전체 학과"], ...depts.map((d) => [d.id, d.name])]);
  const statePick = select("상태", [["", "승인 대기 전체"], ["new", "첫 제출"], ["again", "재제출"]]);
  const listBox = el("div", { className: "v2-boxlist" });
  const detailBox = el("div", { className: "v2-stack" });
  const listTitle = el("h3");
  const editors = {
    curricula: editor("커리큘럼 승인 화면 (기존 '신청 과목')", old("curriculum-requests"), ctx),
    vacation: editor("방학 특강 승인 화면 (기존 '방학 특강')", old("vacation"), ctx),
    profiles: editor("프로필 승인 화면 (기존 '승인 대기')", old("instructor-pending"), ctx),
  };
  let selected = items[0];

  function drawList() {
    const list = items.filter((it) => (!typePick.value || it.kind === typePick.value) && (!deptPick.value || it.dept === deptPick.value)
      && (!statePick.value || (statePick.value === "again") === it.again));
    listTitle.replaceChildren(document.createTextNode("승인 요청 목록 "), chip(`${list.length}건`, "warn"));
    if (!list.includes(selected)) selected = list[0];
    listBox.replaceChildren(...(list.length ? list.map((it) => {
      const node = el("div", { className: `v2-listitem${it === selected ? " active" : ""}` }, [
        el("div", { className: "v2-row" }, [el("b", { textContent: it.title }), chip(it.again ? "재제출" : "승인 대기", it.again ? "red" : "warn")]),
        el("small", { textContent: `${it.type} · ${it.who} · ${formatSeoul(it.at)}` }),
      ]);
      node.addEventListener("click", () => { selected = it; drawList(); });
      return node;
    }) : [empty("승인 대기 중인 요청이 없습니다.")]));
    detailBox.replaceChildren(...(selected ? [detail(selected)] : []));
  }

  function curriculaDiff(it) {
    const steps = [...it.g.rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.step_label).localeCompare(String(b.step_label)));
    return el("div", { className: "v2-diff" }, [
      el("div", { className: "v2-diff-cols v2-diff-head" }, [el("div", { textContent: "기존 승인본" }), el("div", { textContent: "이번 제출본" })]),
      ...steps.map((r) => {
        const a = it.before.find((b) => b.step_label === r.step_label);
        const same = a && a.written === r.written && a.summary === r.summary && a.media_url === r.media_url;
        const side = (x) => x ? [el("b", { textContent: x.step_label }), el("div", { textContent: short(x.written) || "(원문 없음)" }),
          el("div", { className: "muted", textContent: x.summary ? `사이트 문구: ${short(x.summary, 60)}` : "사이트 문구 없음" }),
          el("div", { className: "muted", textContent: x.media_url ? "이미지 있음" : "이미지 없음" })] : [el("span", { className: "muted", textContent: `${r.step_label} — 없음(새 단계)` })];
        return el("div", { className: "v2-diff-cols" }, [el("div", {}, side(a)), el("div", {}, [...side(r), chip(!a ? "새 단계" : same ? "같음" : "내용 변경", !a ? "good" : same ? "" : "vacation")])]);
      }),
    ]);
  }

  function profileDiff(d) {
    const now = instructors.find((i) => i.id === d.instructor_id) ?? {};
    const side = (x) => [el("b", { textContent: x.name || "" }), el("div", { textContent: short(x.career, 200) || "(경력 없음)" }),
      el("div", { className: "muted", textContent: short(x.message, 120) || "(한마디 없음)" }),
      ...(x.photo_url ? [el("img", { className: "v2-thumb", src: x.photo_url, alt: "" })] : [el("div", { className: "muted", textContent: "사진 없음" })])];
    return el("div", { className: "v2-diff" }, [
      el("div", { className: "v2-diff-cols v2-diff-head" }, [el("div", { textContent: "지금 사이트 프로필" }), el("div", { textContent: "이번 제출본" })]),
      el("div", { className: "v2-diff-cols" }, [el("div", {}, side(now)), el("div", {}, side(d))]),
    ]);
  }

  function detail(it) {
    const note = el("textarea", { className: "v2-textarea", placeholder: "선생님께 전달할 수정 요청 / 검토 의견", maxLength: 2000 });
    note.setAttribute("aria-label", "검토 의견");
    const state = el("p", { className: "save-state" });
    let checks, actions;
    if (it.kind === "profiles") {
      const run = async (b, name, args) => {
        b.disabled = true;
        try { await rpc(supabase, name, args); state.textContent = "처리했습니다. '사이트 반영'을 눌러야 공개 사이트에 보입니다."; items.splice(items.indexOf(it), 1); setTimeout(drawList, 900); }
        catch (e) { state.textContent = e.message; state.classList.add("err"); b.disabled = false; }
      };
      const ask = btn("수정 요청", () => note.value.trim() ? run(ask, "comsw_request_profile_changes", { p_id: it.d.instructor_id, p_note: note.value.trim(), p_updated_at: it.d.updated_at })
        : (state.textContent = "수정 요청할 내용을 위 칸에 적어주세요"));
      const ok = btn("승인", () => confirm(`${it.who} 선생님의 경력·한마디·프로필 사진을 승인할까요?`) && run(ok, "comsw_approve_profile", { p_id: it.d.instructor_id, p_updated_at: it.d.updated_at }), true);
      checks = [check("본인 제출", "선생님이 직접 올린 프로필입니다."), check("사진", it.d.photo_url ? "프로필 사진이 있습니다." : "사진이 없습니다.", !it.d.photo_url)];
      actions = [ask, locked("반려", "반려는 수정 요청으로 대신합니다"), ok];
    } else {
      const g = it.g;
      const empties = g.rows.filter((r) => !String(r.summary || "").trim()).length;
      const linked = mySubjects.some((s) => s.instructor_id === g.instructor_id && s.subject_id === g.subject_id);
      const mat = materials.find((m) => m.instructor_id === g.instructor_id && m.subject_id === g.subject_id && (m.tools || m.supplies));
      checks = [
        check("담당 과목 연결", linked ? "이미 이 과목의 담당 강사입니다." : "승인하면 이 과목의 담당 강사로 연결됩니다."),
        check("사이트 문구", empties ? `${empties}단계에 사이트 문구가 비어 있습니다. 승인 화면에서 채우거나 AI로 만드세요.` : "모든 단계에 사이트 문구가 있습니다.", empties > 0),
        check("프로그램·준비물 제안", mat ? "지금은 승인하면 과목 공통 프로그램·준비물에 합쳐집니다(자동 합치기 끄기는 다음 단계)." : "제안한 프로그램·준비물이 없습니다.", !!mat),
      ];
      actions = [locked("수정 요청", "커리큘럼 수정 요청은 DB 추가가 필요합니다(다음 단계)"), locked("반려", "DB 추가가 필요합니다(다음 단계)"),
        btn("승인 화면 열기", () => editors[it.kind].open(), true)];
    }
    return panel(it.title, [
      hint("여기서 승인해도 공개 사이트는 바로 바뀌지 않습니다. '사이트 반영'에서 반영해야 바뀝니다."),
      el("h4", { textContent: "변경 사항 비교" }),
      it.kind === "profiles" ? profileDiff(it.d) : curriculaDiff(it),
      el("h4", { textContent: "검토 체크리스트" }), ...checks,
      el("h4", { textContent: "수정 요청 / 검토 의견" }), note,
      el("div", { className: "v2-actions v2-end" }, actions), state,
    ], `${it.who} · ${formatSeoul(it.at)}`, [chip(it.type, it.kind)]);
  }

  [typePick, deptPick, statePick].forEach((s) => s.addEventListener("change", drawList));
  container.append(
    el("div", { className: "v2-split" }, [
      el("section", { className: "v2-panel" }, [
        el("div", { className: "v2-panel-head" }, [listTitle]),
        el("div", { className: "v2-filter" }, [typePick, deptPick, statePick]),
        listBox,
      ]),
      detailBox,
    ]),
    editors.curricula.node, editors.vacation.node, editors.profiles.node,
  );
  drawList();
}
