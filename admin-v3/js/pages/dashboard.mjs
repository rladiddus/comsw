import { el, pick, chip, btn, stats, panel, empty, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { canManage } from "../../../admin/js/roles.mjs";
import { computeChanges } from "../../../admin-v2/js/pages/publishing.mjs";
import { render as teacherDashboard } from "../../../admin-v2/js/pages/dashboard.mjs";
import { audit, typeChip } from "../v3.mjs";
import { imageZoom, sortSteps, submittedSteps } from "./inbox.mjs";

const go = (hash) => () => { location.hash = hash; };
// 할 일 한 줄: 누르면 onClick(커리큘럼은 오른쪽에 검토 내용, 나머지는 그 메뉴로)
const item = (title, sub, chipNode, onClick) => Object.assign(el("div", { className: "v2-listitem" }, [
  el("div", { className: "v2-row" }, [el("b", { textContent: title }), chipNode]), el("small", { textContent: sub }),
]), { onclick: onClick });

// 업무 대시보드(V3 시안): 승인 대기 · 데이터 검증 경고 · 최근 게시. 지금 처리할 일 목록에서 커리큘럼을 누르면 오른쪽에 제출된 커리큘럼.
// 선생님은 V2와 같은 '내 작업'.
export async function render(container, ctx) {
  if (!canManage(ctx.role)) return teacherDashboard(container, ctx);
  const { supabase } = ctx;
  headActions(ctx, btn("제출물 검토", go("#/inbox"), true));
  const [pending, drafts, instructors, subjects, sets, depts, snaps, checks] = await Promise.all([
    pick(supabase, "instructor_curricula", "id, instructor_id, set_id, subject_id, step_label, written, media_url, vacation, sort_order, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructor_profile_drafts", "instructor_id, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, is_vacation"),
    pick(supabase, "curriculum_sets", "id, name, department_id, is_vacation"),
    pick(supabase, "departments", "id, name"),
    pick(supabase, "site_snapshots", "id, created_at", (q) => q.order("id", { ascending: false }).limit(1)),
    audit(supabase),
  ]);
  const groups = groupRequests(pending);
  const warns = checks.filter(([, , list]) => list.length);
  const last = snaps[0];

  const statBox = el("div");
  const drawStats = (changes) => statBox.replaceChildren(stats([
    ["승인 대기", `${groups.length + drafts.length}`, `과목 제출 ${groups.length} · 프로필 ${drafts.length}`, groups.length + drafts.length > 0, "#/inbox"],
    ["반영 전 변경", changes === undefined ? "…" : changes === null ? "—" : `${changes.length}`, "승인·수정 후 아직 공개 안 된 곳", changes?.length > 0, "#/release"],
    ["데이터 검증 경고", `${warns.length}`, "V3 정책과 어긋나는 지금 데이터", warns.length > 0, "#/release"],
    ["최근 게시", last ? formatSeoul(last.created_at).slice(5, 16) : "없음", "사이트 반영은 승인과 따로", false, "#/release"],
  ]));
  drawStats();

  const { zoom, thumb } = imageZoom();
  const review = el("div", { className: "v2-stack" });
  const subjectOf = (g) => subjects.find((s) => s.id === g.subject_id);
  const show = (g, row) => {
    for (const x of container.querySelectorAll(".v3-dash .v2-listitem.active")) x.classList.remove("active");
    row?.classList.add("active");
    if (!g) return review.replaceChildren(panel("제출된 커리큘럼", [empty("검토할 커리큘럼이 없습니다.")]));
    const who = nameOf(instructors, g.instructor_id), subject = subjectOf(g), set = sets.find((s) => s.id === g.set_id);
    const scope = g.vacation ? (set?.is_vacation ? set.name : "방특(시기 담기 전)") : nameOf(depts, set?.department_id) || set?.name || "";
    const steps = sortSteps(g.rows);
    review.replaceChildren(panel(`${who}의 ${subject?.name ?? ""} 전체 승인 범위`, [
      el("div", { className: "v3-callout" }, [el("b", { textContent: "대상  " }), document.createTextNode(`${scope} / ${g.vacation ? "방특" : "정규"} / ${subject?.name ?? ""} / ${who} · 전체 ${steps.length}단계`)]),
      submittedSteps(steps, thumb),
      el("div", { className: "v2-actions v2-end" }, [btn("승인 대기에서 승인하기", go(`#/inbox/${encodeURIComponent(g.key)}`), true)]),
    ], formatSeoul(g.at), [typeChip(subject)]));
  };

  const rows = groups.slice(0, 6).map((g) => {
    const row = item(`${nameOf(instructors, g.instructor_id)} · ${subjectOf(g)?.name ?? ""} ${g.vacation ? "(방특)" : "(정규)"}`,
      `${g.rows.length}단계 · ${formatSeoul(g.at)} 제출`, chip("승인 대기", "warn"), () => show(g, row));
    return row;
  });
  const todo = [
    ...rows,
    ...drafts.slice(0, 3).map((d) => item(`${nameOf(instructors, d.instructor_id)} · 프로필`, "프로필은 과목과 따로 승인합니다.", chip("별도 승인 대기", "warn"), go("#/inbox"))),
    ...warns.map(([t, d, list, hash]) => item(`${t} ${list.length}건`, `${d} 예: ${list.slice(0, 3).join(", ")}`, chip("V3 전환 전 정리", "red"), go(hash))),
  ];
  container.append(
    statBox,
    el("div", { className: "v3-callout" }, [el("b", { textContent: "새 데이터 흐름  " }),
      document.createTextNode("강사 승인본 → 같은 과목의 재직 강사 모음 → 학과 관리 → 로드맵 문구 → 사이트 반영")]),
    el("div", { className: "v3-dash" }, [
      panel("지금 처리할 일", todo.length ? [el("div", { className: "v2-boxlist" }, todo)] : [empty("처리할 일이 없습니다.")]),
      review,
    ]),
    zoom,
  );
  show(groups[0], rows[0]);
  const changes = await computeChanges(supabase).catch(() => null);
  drawStats(changes);
}
