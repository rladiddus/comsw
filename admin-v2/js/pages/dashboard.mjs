import { el, rows } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";

// V2 대시보드: 숫자 카드 · 지금 처리할 일 · 사이트 반영 상태 · 학과별 과목 수 · 최근 활동. 모두 운영 DB 값.
// 커리큘럼 신청은 '묶음'(선생님·학과 탭·과목) 단위로 센다 — 승인 대기 화면과 같은 단위.
export function groupRequests(list) {
  const groups = new Map();
  for (const r of list) {
    const key = `${r.instructor_id}|${r.set_id}|${r.subject_id}`;
    const g = groups.get(key) ?? { ...r, steps: 0, at: r.updated_at };
    g.steps += 1;
    if (r.updated_at > g.at) g.at = r.updated_at;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export const card = (label, value, hint, href, alert = false) =>
  el("a", { className: `v2-stat${alert ? " alert" : ""}`, href }, [
    el("span", { className: "v2-stat-label", textContent: label }),
    el("strong", { className: "v2-stat-num", textContent: value }),
    el("span", { className: "v2-stat-hint", textContent: hint }),
  ]);

export const panel = (title, body, desc = "") => el("section", { className: "v2-panel" }, [
  el("div", { className: "v2-panel-head" }, [
    el("h3", { textContent: title }),
    ...(desc ? [el("p", { className: "v2-desc", textContent: desc })] : []),
  ]),
  el("div", { className: "v2-panel-body" }, body),
]);

export async function render(container, { supabase }) {
  const [pending, drafts, instructors, subjects, sets, depts, links, weeks, snaps] = await Promise.all([
    rows(supabase, "instructor_curricula", (q) => q.eq("status", "pending")),
    rows(supabase, "instructor_profile_drafts", (q) => q.eq("status", "pending")),
    rows(supabase, "instructors"),
    rows(supabase, "subjects"),
    rows(supabase, "curriculum_sets"),
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
    rows(supabase, "subject_weeks"),
    supabase.from("site_snapshots").select("id, created_at").order("id", { ascending: false }).limit(5)
      .then(({ data, error }) => { if (error) throw error; return data || []; }),
  ]);
  const name = (list, id) => list.find((x) => x.id === id)?.name ?? "";
  const groups = groupRequests(pending);
  const normal = groups.filter((g) => !g.vacation);
  const vacation = groups.filter((g) => g.vacation);
  const noWeeks = subjects.filter((s) => links.some((l) => l.subject_id === s.id) && !weeks.some((w) => w.subject_id === s.id));
  const last = snaps[0];
  const waiting = normal.length + vacation.length + drafts.length;

  container.append(el("div", { className: "v2-stats" }, [
    card("승인 대기", `${waiting}건`, `커리큘럼 ${normal.length} · 방학 특강 ${vacation.length} · 프로필 ${drafts.length}`, "#/reviews", waiting > 0),
    card("현재 강사", `${instructors.filter((i) => i.is_listed).length}명`, `전체 ${instructors.length}명 중 사이트 표시`, "#/instructors"),
    card("과목", `${subjects.length}개`, `학과 ${depts.length}개 · 단계 없는 과목 ${noWeeks.length}개`, "#/subjects", noWeeks.length > 0),
    card("마지막 사이트 반영", last ? formatSeoul(last.created_at).slice(0, 10) : "없음", last ? `${formatSeoul(last.created_at)} · ${last.id}번째 반영` : "아직 반영한 적 없음", "#/publishing"),
  ]));

  const task = (mark, title, sub, href, button) => el("div", { className: "v2-task" }, [
    el("span", { className: "v2-task-mark", textContent: mark }),
    el("div", { className: "v2-task-text" }, [el("b", { textContent: title }), el("small", { textContent: sub })]),
    el("a", { className: "v2-mini-btn", href, textContent: button }),
  ]);
  const todo = [
    ...normal.map((g) => [g.at, task("✎", `커리큘럼 승인 요청 — ${name(subjects, g.subject_id)}`,
      `${name(instructors, g.instructor_id)} 선생님 · ${name(sets, g.set_id)} · ${g.steps}단계 · ${formatSeoul(g.at)}`, "#/reviews", "검토")]),
    ...vacation.map((g) => [g.at, task("☀", `방학 특강 신청 — ${name(subjects, g.subject_id)}`,
      `${name(instructors, g.instructor_id)} 선생님 · ${g.steps}단계 · ${formatSeoul(g.at)}`, "#/reviews", "검토")]),
    ...drafts.map((d) => [d.updated_at ?? "", task("◉", `프로필 승인 요청 — ${name(instructors, d.instructor_id)} 선생님`,
      d.updated_at ? formatSeoul(d.updated_at) : "", "#/reviews", "검토")]),
    ...(noWeeks.length ? [["", task("▤", `단계 없는 과목 ${noWeeks.length}개`,
      noWeeks.slice(0, 4).map((s) => s.name).join(", ") + (noWeeks.length > 4 ? " 외" : ""), "#/subjects", "정리")]] : []),
  ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([, node]) => node);

  const maxCount = Math.max(1, ...depts.map((d) => links.filter((l) => l.department_id === d.id).length));
  const deptBars = depts.map((d) => {
    const n = links.filter((l) => l.department_id === d.id).length;
    return el("div", { className: "v2-bar-row" }, [
      el("div", { className: "v2-row" }, [el("b", { textContent: d.name }), el("span", { className: "muted", textContent: `${n}개 과목` })]),
      el("div", { className: "v2-progress" }, [el("span", { style: `width:${Math.round((n / maxCount) * 100)}%` })]),
    ]);
  });

  // 최근 활동: 최근 신청(커리큘럼·방특)과 사이트 반영. 다른 수정은 기록이 없어 보이지 않는다.
  const events = [
    ...groups.slice(0, 5).map((g) => [g.at, `${g.vacation ? "방학 특강" : "커리큘럼"} 신청 — ${name(subjects, g.subject_id)}`, `${name(instructors, g.instructor_id)} 선생님`]),
    ...snaps.map((s) => [s.created_at, "사이트 반영", `${s.id}번째 반영`]),
  ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, 6);

  container.append(el("div", { className: "v2-grid2" }, [
    el("div", { className: "v2-stack" }, [
      panel("지금 처리할 일", todo.length ? todo : [el("p", { className: "v2-empty", textContent: "처리할 일이 없습니다." })]),
      panel("학과별 과목 수", deptBars, "학과에 연결된 과목 수입니다."),
    ]),
    el("div", { className: "v2-stack" }, [
      panel("사이트 반영 상태", [
        el("p", { className: "v2-big", textContent: last ? formatSeoul(last.created_at) : "아직 반영 안 함" }),
        el("p", { className: "v2-hint", textContent: "승인과 사이트 반영은 따로입니다. 승인한 내용은 '사이트 반영'에서 바뀐 곳을 확인한 뒤 반영하세요." }),
        el("a", { className: "publish-btn v2-link-btn", href: "#/publishing", textContent: "사이트 반영 열기" }),
      ]),
      panel("최근 활동", events.length ? [el("div", { className: "v2-timeline" }, events.map(([at, title, sub]) =>
        el("div", { className: "v2-event" }, [el("b", { textContent: title }), el("small", { textContent: `${sub} · ${formatSeoul(at)}` })])))]
        : [el("p", { className: "v2-empty", textContent: "최근 활동이 없습니다." })], "최근 신청과 사이트 반영만 보입니다(다른 수정은 기록이 없음)."),
    ]),
  ]));
}
