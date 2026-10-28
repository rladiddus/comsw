import { el, rows, pick, chip, hint, btn, stats, panel, empty, headActions, groupRequests, nameOf, parseDate, daysFrom } from "../ui.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { canManage } from "../../../admin/js/roles.mjs";
import { computeChanges } from "./publishing.mjs";

const go = (hash) => () => { location.hash = hash; };
const task = (mark, title, sub, label, hash, status) => el("div", { className: "v2-task" }, [
  el("span", { className: "v2-task-mark", textContent: mark }),
  el("div", { className: "v2-task-text" }, [el("b", { textContent: title }), el("small", { textContent: sub })]),
  ...(status ? [status] : []),
  Object.assign(el("button", { type: "button", className: "v2-mini-btn", textContent: label }), { onclick: go(hash) }),
]);
const timeline = (events) => el("div", { className: "v2-timeline" }, events.map(([at, title, sub]) =>
  el("div", { className: "v2-event" }, [el("b", { textContent: title }), el("small", { textContent: `${sub}${at ? ` · ${formatSeoul(at)}` : ""}` })])));

export async function render(container, ctx) {
  return canManage(ctx.role) ? manager(container, ctx) : teacher(container, ctx);
}

// 운영 대시보드(시안): 승인 대기 · 반영 전 변경 · 정리 필요 과목 · 마감 임박 행사.
async function manager(container, { supabase, ...ctx }) {
  headActions(ctx, btn("새 작업: 과목 추가", go("#/subjects")), btn("사이트 반영 열기", go("#/publishing"), true));
  const [pending, drafts, instructors, subjects, sets, depts, links, weeks, seminars, snaps] = await Promise.all([
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, vacation, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructor_profile_drafts", "instructor_id, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, dept_curriculum"),
    pick(supabase, "curriculum_sets", "id, name"),
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subject_weeks", "subject_id, summary"),
    pick(supabase, "seminars", "id, title, datetime_text"),
    pick(supabase, "site_snapshots", "id, created_at", (q) => q.order("id", { ascending: false }).limit(5)),
  ]);
  const groups = groupRequests(pending);
  const linked = new Set(links.map((l) => l.subject_id));
  const messy = subjects.filter((s) => !linked.has(s.id) || !weeks.some((w) => w.subject_id === s.id));
  const soon = seminars.map((s) => ({ s, d: parseDate(s.datetime_text) })).filter(({ d }) => d && daysFrom(d) >= 0 && daysFrom(d) <= 14);
  const waiting = groups.length + drafts.length;
  const last = snaps[0];

  const statBox = el("div");
  const drawStats = (changes) => statBox.replaceChildren(stats([
    ["승인 대기", `${waiting}`, `커리큘럼 ${groups.filter((g) => !g.vacation).length} · 방학 특강 ${groups.filter((g) => g.vacation).length} · 프로필 ${drafts.length}`, waiting > 0, "#/reviews"],
    ["반영 전 변경", changes === undefined ? "…" : changes === null ? "—" : `${changes.length}`, "마지막 반영 이후 바뀐 사이트 데이터", changes?.length > 0, "#/publishing"],
    ["정리 필요 과목", `${messy.length}`, "학과 미연결 또는 단계 없음", messy.length > 0, "#/subjects"],
    ["마감 임박 행사", `${soon.length}`, "14일 안에 열리는 특강·세미나", soon.length > 0, "#/seminars"],
  ]));
  drawStats();

  const todo = [
    ...groups.map((g) => [g.at, task(g.vacation ? "☀" : "⌁", `${g.vacation ? "방학 특강" : "커리큘럼"} 승인 요청 — ${nameOf(subjects, g.subject_id)}`,
      `${nameOf(instructors, g.instructor_id)} 선생님 · ${g.vacation ? "방특" : nameOf(sets, g.set_id)} · ${formatSeoul(g.at)}`, "검토", "#/reviews", chip("승인 대기", "warn"))]),
    ...drafts.map((d) => [d.updated_at, task("◉", `프로필 승인 요청 — ${nameOf(instructors, d.instructor_id)} 선생님`, formatSeoul(d.updated_at), "검토", "#/reviews", chip("승인 대기", "warn"))]),
  ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([, n]) => n);
  if (messy.length) todo.push(task("▤", `정리 필요 과목 ${messy.length}건`, "학과 미연결 또는 단계 누락", "정리", "#/subjects"));
  const todoBox = el("div");
  const drawTodo = (changes) => {
    const list = [...todo];
    if (changes?.length) list.splice(Math.min(1, list.length), 0, task("↥", `반영 전 변경 ${changes.length}곳 점검`,
      changes.slice(0, 3).map((c) => c.label).join(" · ") + (changes.length > 3 ? " 외" : ""), "확인", "#/publishing"));
    todoBox.replaceChildren(...(list.length ? list : [empty("처리할 일이 없습니다.")]));
  };
  drawTodo();

  // 학과별 콘텐츠 완성도: 학과 과목 중 단계·사이트 문구(단계 요약)가 모두 있는 과목의 비율.
  const done = (sid) => { const ws = weeks.filter((w) => w.subject_id === sid); return ws.length > 0 && ws.every((w) => String(w.summary || "").trim()); };
  const bars = depts.map((d) => {
    const ids = links.filter((l) => l.department_id === d.id).map((l) => l.subject_id);
    const pct = ids.length ? Math.round((ids.filter(done).length / ids.length) * 100) : 0;
    return el("div", { className: "v2-bar-row" }, [
      el("div", { className: "v2-row" }, [el("b", { textContent: d.name }), el("span", { className: "muted", textContent: `${pct}% · 과목 ${ids.length}개` })]),
      el("div", { className: "v2-progress" }, [el("span", { style: `width:${pct}%` })]),
    ]);
  });

  const events = [
    ...groups.slice(0, 5).map((g) => [g.at, `새 ${g.vacation ? "방학 특강" : "커리큘럼"} 제출`, `${nameOf(instructors, g.instructor_id)} · ${nameOf(subjects, g.subject_id)}`]),
    ...drafts.slice(0, 3).map((d) => [d.updated_at, "프로필 제출", nameOf(instructors, d.instructor_id)]),
    ...snaps.map((s) => [s.created_at, "사이트 반영 완료", `${s.id}번째 반영`]),
  ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, 6);

  container.append(statBox, el("div", { className: "v2-grid2" }, [
    el("div", { className: "v2-stack" }, [
      panel("지금 처리할 일", [todoBox]),
      panel("학과별 콘텐츠 완성도", bars, "학과 과목 중 단계와 사이트 문구가 모두 채워진 과목의 비율입니다."),
    ]),
    el("div", { className: "v2-stack" }, [
      panel("현재 사이트 반영 상태", [
        el("div", { className: "v2-row" }, [chip(last ? "정상 공개 중" : "반영 기록 없음", last ? "good" : "warn"), el("span", { className: "muted", textContent: last ? `${last.id}번 반영본` : "" })]),
        el("p", { className: "v2-big", textContent: last ? formatSeoul(last.created_at).slice(0, 10).replaceAll("-", ".") : "—" }),
        el("p", { className: "muted", textContent: last ? `마지막 반영 ${formatSeoul(last.created_at)}` : "" }),
        hint("승인과 사이트 반영은 따로입니다. 바뀐 내용은 '사이트 반영'에서 확인한 뒤 반영하세요."),
        btn("사이트 반영 열기", go("#/publishing"), true),
      ]),
      panel("최근 활동", events.length ? [timeline(events)] : [empty("최근 활동이 없습니다.")], "제출과 사이트 반영만 기록됩니다(다른 수정은 기록이 없음)."),
    ]),
  ]));

  const changes = await computeChanges(supabase).catch(() => null);
  drawStats(changes);
  drawTodo(changes);
}

// 선생님 대시보드(시안 '내 작업 대시보드'): 담당 과목 · 작성 중 · 승인 대기 · 수정 요청.
async function teacher(container, { supabase, uid, ...ctx }) {
  headActions(ctx, btn("내 커리큘럼 작성", go("#/mine"), true));
  const me = (await pick(supabase, "instructors", "id, name", (q) => q.eq("account_uid", uid)))[0];
  if (!me) {
    container.append(panel("시작하기", [empty("아직 강사 정보가 없습니다. '내 커리큘럼'을 열면 쌤톡 이름으로 시작합니다."), btn("내 커리큘럼 열기", go("#/mine"), true)]));
    return;
  }
  const [mySubjects, mine, subjects, drafts] = await Promise.all([
    pick(supabase, "instructor_subjects", "subject_id", (q) => q.eq("instructor_id", me.id)),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, vacation, status, updated_at", (q) => q.eq("instructor_id", me.id)),
    pick(supabase, "subjects", "id, name"),
    pick(supabase, "instructor_profile_drafts", "status, review_note, updated_at", (q) => q.eq("instructor_id", me.id)),
  ]);
  const pendingGroups = groupRequests(mine.filter((r) => r.status === "pending"));
  const approvedGroups = groupRequests(mine.filter((r) => r.status === "approved"));
  const draft = drafts[0];
  const changesRequested = draft?.status === "changes_requested";
  container.append(
    stats([
      ["담당 과목", `${mySubjects.length}`, "승인되어 연결된 과목"],
      ["승인된 커리큘럼", `${approvedGroups.length}`, "과목·학과 탭 묶음"],
      ["승인 대기", `${pendingGroups.length}`, "관리자 검토 중", pendingGroups.length > 0],
      ["수정 요청", changesRequested ? "1" : "0", "프로필 수정 요청", changesRequested],
    ]),
    el("div", { className: "v2-grid2" }, [
      el("div", { className: "v2-stack" }, [
        panel("내가 처리할 일", [
          ...(changesRequested ? [task("!", "프로필 수정 요청", draft.review_note || "관리자 의견 확인 필요", "확인", "#/profile")] : []),
          ...pendingGroups.map((g) => task("✎", `${nameOf(subjects, g.subject_id)} — 승인 대기`, `${g.rows.length}단계 · ${formatSeoul(g.at)} 제출`, "열기", "#/mine")),
          task("◉", "내 프로필 확인", "강사 소개 · 사진", "열기", "#/profile"),
        ]),
      ]),
      panel("제출 상태", [
        timeline([
          ...pendingGroups.map((g) => [g.at, `${nameOf(subjects, g.subject_id)} — 승인 대기`, `${g.rows.length}단계`]),
          ...approvedGroups.slice(0, 5).map((g) => [g.at, `${nameOf(subjects, g.subject_id)} — 승인됨`, `${g.rows.length}단계`]),
          ...(draft ? [[draft.updated_at, `내 프로필 — ${changesRequested ? "수정 요청" : draft.status === "pending" ? "승인 대기" : "승인됨"}`, ""]] : []),
        ].sort((a, b) => String(b[0]).localeCompare(String(a[0])))),
        hint("승인된 내용은 관리자가 사이트에 반영한 뒤 공개됩니다."),
      ]),
    ]),
  );
}
