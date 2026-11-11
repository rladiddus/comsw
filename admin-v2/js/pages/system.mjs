import { el, pick, chip, hint, stats, panel, dl, empty, table, tabBox, headActions } from "../ui.mjs";
import { rpc } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { roleLabel } from "../../../admin/js/roles.mjs";
import { mountAiSettings } from "../../../admin/js/ai-settings.mjs";

// 시스템 설정(시안): 계정·권한(안내), AI 설정(기존), 올린 파일, AI 작업 기록. 감사 기록·역할 변경은 지금 없음.
const KIND = { week: "단계 요약", department: "학과 커리큘럼", roadmap: "로드맵", profile: "프로필 사진" };
const MEDIA = { curriculum: "커리큘럼 이미지", image: "사이트 이미지", "profile-source": "프로필 원본(비공개)", "profile-generated": "프로필 사진" };
const STATUS = { completed: ["완료", "good"], reserved: ["진행 중", "warn"], failed: ["실패", "red"] };

export async function render(container, ctx) {
  const { supabase, role, email } = ctx;
  headActions(ctx);
  const [budget, jobs, media, linked] = await Promise.all([
    rpc(supabase, "comsw_ai_budget").catch(() => null),
    pick(supabase, "comsw_ai_jobs", "kind, status, budget_krw, month, created_at", (q) => q.order("created_at", { ascending: false }).limit(200)),
    pick(supabase, "media_assets", "kind, filename, byte_size, created_at", (q) => q.order("created_at", { ascending: false }).limit(500)),
    pick(supabase, "instructors", "id", (q) => q.not("account_uid", "is", null)),
  ]);
  const month = budget?.month ?? "";
  const thisMonth = jobs.filter((j) => j.month === month);
  container.append(
    stats([
      ["AI 이번 달 예약액", budget ? `₩${budget.used.toLocaleString()}` : "—", budget ? "" : "확인 실패"], // 한도·남은 금액 문구는 안 보임(2026-11-11 사용자 요청)
      ["AI 작업", `${thisMonth.length}`, `${month} 요청 수`],
      ["올린 파일", `${media.length >= 500 ? "500+" : media.length}`, "이미지·프로필 사진"],
      ["실패한 작업", `${thisMonth.filter((j) => j.status === "failed").length}`, "이번 달 AI 실패", thisMonth.some((j) => j.status === "failed")],
    ]),
    el("section", { className: "v2-panel" }, tabBox(["계정·권한", "프롬프트", "올린 파일", "작업 기록"], (i) => {
      if (i === 0) return [
        dl([["내 계정", email], ["내 역할", roleLabel(role)], ["계정 연결된 강사", `${linked.length}명`]]),
        hint("역할(관리자·학과장·선생님)은 쌤톡 계정에서 정해집니다. 이 화면에서 역할을 바꿀 수 없고, 바꾸려면 쌤톡 관리자에게 요청합니다."),
        hint("누가 언제 무엇을 고쳤는지(감사 기록)는 아직 기록하지 않습니다. DB 추가가 필요합니다.", "warn"),
      ];
      if (i === 1) { const box = el("div"); mountAiSettings(box, supabase, { plain: true }); return [box, hint("AI 결과는 바로 공개되지 않습니다. 사람이 확인하고 저장한 문구만 사이트 반영 대상이 됩니다.")]; }
      if (i === 2) {
        const byKind = Object.entries(MEDIA).map(([k, label]) => [label, `${media.filter((m) => m.kind === k).length}개`]);
        return [dl(byKind), el("h4", { textContent: "최근 올린 파일" }),
          media.length ? table(["파일", "종류", "크기", "올린 시각"], media.slice(0, 30), (m) => [m.filename, MEDIA[m.kind] ?? m.kind, `${Math.round(m.byte_size / 1024)}KB`, formatSeoul(m.created_at)]).node : empty("올린 파일이 없습니다.")];
      }
      return [jobs.length ? table(["작업 유형", "상태", "실행 시각", "예약액"], jobs.slice(0, 50), (j) => [KIND[j.kind] ?? j.kind, chip(...(STATUS[j.status] ?? [j.status])), formatSeoul(j.created_at), `₩${j.budget_krw}`]).node
        : empty("AI 작업 기록이 없습니다."), hint("예약액은 AI를 부를 때 잡아 두는 추정 금액이며 실제 청구액과 다릅니다.")];
    })),
  );
}
