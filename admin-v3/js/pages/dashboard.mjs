import { el, pick, chip, hint, btn, stats, panel, empty, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { canManage } from "../../../admin/js/roles.mjs";
import { computeChanges } from "../../../admin-v2/js/pages/publishing.mjs";
import { render as teacherDashboard } from "../../../admin-v2/js/pages/dashboard.mjs";
import { audit } from "../v3.mjs";

const go = (hash) => () => { location.hash = hash; };
const card = (title, sub, chipNode, label, hash) => el("div", { className: "v2-mini-card" }, [
  el("div", { className: "v2-row" }, [el("b", { textContent: title }), chipNode]), el("small", { textContent: sub }),
  el("div", { className: "v2-actions", style: "margin-top:8px" }, [btn(label, go(hash))]),
]);
const flow = (label, chipNode) => el("div", { className: "v3-impact v2-row" }, [el("span", { textContent: label }), chipNode]);

// 업무 대시보드(V3 시안): 승인 대기 · 통합 재생성 대기 · 데이터 검증 경고 · 최근 게시. 선생님은 V2와 같은 '내 작업'.
export async function render(container, ctx) {
  if (!canManage(ctx.role)) return teacherDashboard(container, ctx);
  const { supabase } = ctx;
  headActions(ctx, btn("제출물 검토", go("#/inbox"), true));
  const [pending, drafts, instructors, subjects, snaps, jobs, checks] = await Promise.all([
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, vacation, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructor_profile_drafts", "instructor_id, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, is_vacation"),
    pick(supabase, "site_snapshots", "id, created_at", (q) => q.order("id", { ascending: false }).limit(1)),
    pick(supabase, "comsw_ai_jobs", "kind, status, created_at", (q) => q.order("created_at", { ascending: false }).limit(50)),
    audit(supabase),
  ]);
  const groups = groupRequests(pending);
  const warns = checks.filter(([, , list]) => list.length);
  const failed = jobs.filter((j) => j.status === "failed").length;
  const last = snaps[0];

  const statBox = el("div");
  const drawStats = (changes) => statBox.replaceChildren(stats([
    ["승인 대기", `${groups.length + drafts.length}`, `과목 제출 ${groups.length} · 프로필 ${drafts.length}`, groups.length + drafts.length > 0, "#/inbox"],
    ["반영 전 변경", changes === undefined ? "…" : changes === null ? "—" : `${changes.length}`, "승인·수정 후 아직 공개 안 된 곳", changes?.length > 0, "#/release"],
    ["데이터 검증 경고", `${warns.length}`, "V3 정책과 어긋나는 지금 데이터", warns.length > 0, "#/release"],
    ["최근 게시", last ? formatSeoul(last.created_at).slice(5, 16) : "없음", "사이트 반영은 승인과 따로", false, "#/release"],
  ]));
  drawStats();

  const todo = [
    ...groups.slice(0, 6).map((g) => card(`${nameOf(instructors, g.instructor_id)} · ${nameOf(subjects, g.subject_id)} ${g.vacation ? "(방특)" : "(정규)"}`,
      `${g.rows.length}단계 · ${formatSeoul(g.at)} 제출 · 재료 검토 후 과목 전체 승인`, chip("승인 대기", "warn"), "검토하러 가기", `#/inbox/${encodeURIComponent(g.key)}`)),
    ...drafts.slice(0, 3).map((d) => card(`${nameOf(instructors, d.instructor_id)} · 프로필`, "프로필은 과목과 따로 승인합니다.", chip("별도 승인 대기", "warn"), "검토하러 가기", "#/inbox")),
    ...warns.map(([t, d, list, hash]) => card(`${t} ${list.length}건`, `${d} 예: ${list.slice(0, 3).join(", ")}`, chip("V3 전환 전 정리", "red"), "확인", hash)),
    card("학과별 과목 순서", "학과마다 순서를 정하면 전체 수업·학과 커리큘럼·로드맵이 같은 순서를 씁니다.", chip("단일 관리", "vacation"), "순서 화면 열기", "#/order"),
  ];
  container.append(
    statBox,
    el("div", { className: "v3-callout" }, [el("b", { textContent: "새 데이터 흐름  " }),
      document.createTextNode("강사 승인본 → 같은 학과·과목의 재직 강사 모음 → 학과 통합 커리큘럼 → 로드맵 문구 → 사이트 반영")]),
    el("div", { className: "v2-grid2" }, [
      panel("지금 처리할 일", todo.length ? todo : [empty("처리할 일이 없습니다.")]),
      el("div", { className: "v2-stack" }, [
        panel("자동 연계 상태", [
          flow("① 강사 개인 승인본", chip(groups.length ? `대기 ${groups.length}` : "대기 없음", groups.length ? "warn" : "good")),
          flow("② 학과 통합 커리큘럼", chip("확인은 '학과 커리큘럼'에서", "vacation")),
          flow("③ 로드맵 문구", chip("확인은 '로드맵'에서", "vacation")),
          flow("④ 사이트 반영", chip("별도 반영", "vacation")),
          hint("지금은 승인 후 통합·로드맵을 자동으로 다시 만드는 작업 대기열이 없습니다(DB 추가 필요). 기존 AI 작업 기록만 보여 줍니다."),
        ]),
        panel("최근 AI 작업", jobs.length ? [el("p", { textContent: `최근 ${jobs.length}건 · 실패 ${failed}건` }),
          ...(jobs[0] ? [el("small", { className: "muted", textContent: `마지막 ${formatSeoul(jobs[0].created_at)}` })] : [])] : [empty("AI 작업 기록이 없습니다.")], "", [chip(failed ? "실패 있음" : "정상", failed ? "red" : "good")]),
      ]),
    ]),
  );
  const changes = await computeChanges(supabase).catch(() => null);
  drawStats(changes);
}
