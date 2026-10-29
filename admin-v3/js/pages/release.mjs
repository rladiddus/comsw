import { el, pick, chip, hint, btn, locked, panel, check, empty, table, select, headActions } from "../../../admin-v2/js/ui.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { SITE_PAGES } from "../../../admin/js/preview.mjs";
import { computeChanges, siteChecks } from "../../../admin-v2/js/pages/publishing.mjs";
import { audit } from "../v3.mjs";

// 사이트 반영(V3 시안 '연계 작업·게시 센터'): 연계 작업 | 반영 전 검사 | 바뀐 곳. 반영은 승인과 따로(정책 2A).
// 연계 작업 대기열(통합→로드맵)은 아직 없어 기존 AI 작업 기록을 보여 준다. 반영·미리보기는 실제로 동작한다.
const KIND = { week: "단계 요약", department: "학과 커리큘럼", roadmap: "로드맵 문구", profile: "프로필 사진" };
const STATUS = { completed: ["완료", "good"], reserved: ["진행 중", "warn"], failed: ["실패", "red"] };

export async function render(container, ctx) {
  const { supabase, publish, preview } = ctx;
  const [jobs, snaps] = await Promise.all([
    pick(supabase, "comsw_ai_jobs", "kind, status, created_at", (q) => q.order("created_at", { ascending: false }).limit(20)),
    pick(supabase, "site_snapshots", "id, created_at", (q) => q.order("id", { ascending: false }).limit(10)),
  ]);
  const pub = btn("사이트에 반영", async () => { if (await publish()) { container.replaceChildren(); await render(container, ctx); } }, true);
  headActions(ctx, pub);
  const checkBox = el("div", {}, [el("p", { className: "muted", textContent: "검사하는 중…" })]);
  const changeBox = el("div", {}, [el("p", { className: "muted", textContent: "마지막 반영본과 비교하는 중…" })]);
  const pagePick = select("미리볼 페이지", SITE_PAGES.map((p) => [p.name, p.name]));
  container.append(el("div", { className: "v2-grid2" }, [
    el("div", { className: "v2-stack" }, [
      panel("연계 작업", [jobs.length ? table(["작업", "상태", "시각"], jobs, (j) => [KIND[j.kind] ?? j.kind, chip(...(STATUS[j.status] ?? [j.status])), formatSeoul(j.created_at)]).node : empty("작업 기록이 없습니다."),
        hint("V3는 승인 후 '학과 통합 → 로드맵' 작업이 대기열로 돌고 실패하면 다시 시도합니다(DB·서버 추가 필요). 지금은 기존 AI 작업 기록입니다.")], "", [locked("다시 시도", "작업 대기열은 DB 추가 후")]),
      panel("반영 전 바뀐 곳", [changeBox], "마지막 반영 이후 바뀐 사이트 데이터"),
      panel("반영 기록", [table(["번호", "반영 시각", ""], snaps, (s, i) => [`${s.id}번`, formatSeoul(s.created_at),
        s === snaps[0] ? chip("공개 중", "good") : locked("되돌리기", "되돌리기는 DB 함수 추가가 필요합니다")]).node]),
    ]),
    panel("반영 전 검사", [checkBox,
      el("div", { className: "v2-actions" }, [pagePick, btn("PC 미리보기", () => preview(pagePick.value, false)), btn("태블릿 미리보기", () => preview(pagePick.value, true))]),
      hint("반영하면 지금 내용이 바로 공개 사이트에 나갑니다(운영 데이터)."), btn("검사 후 사이트에 반영", () => pub.click(), true)]),
  ]));
  await Promise.all([
    computeChanges(supabase).then((d) => changeBox.replaceChildren(d === null ? empty("반영한 적이 없습니다.")
      : d.length ? table(["사이트 데이터", "바뀐 줄"], d, (x) => [x.label, `${x.changed}줄`]).node : empty("바뀐 내용이 없습니다.")))
      .catch((e) => changeBox.replaceChildren(el("p", { className: "save-state err", textContent: e.message }))),
    Promise.all([siteChecks(supabase), audit(supabase)]).then(([site, v3]) => checkBox.replaceChildren(
      ...site.map(([t, d, w]) => check(t, d, w)),
      el("h4", { textContent: "V3 전환 전 정리할 곳" }),
      ...v3.map(([t, d, list]) => check(`${t} ${list.length}건`, list.length ? `${d} 예: ${list.slice(0, 4).join(", ")}` : d, list.length > 0)),
      check("메인·로딩·특강·채용", "V3에서 바꾸지 않습니다(기존 그대로)."),
    )).catch((e) => checkBox.replaceChildren(el("p", { className: "save-state err", textContent: e.message }))),
  ]);
}
