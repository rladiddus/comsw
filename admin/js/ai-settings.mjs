import { el, rows, stateLine } from "./teacher-workspace.mjs";
import { getServices } from "./services.mjs";
import { PROMPTS } from "../../supabase/functions/comsw-tools/policy.mjs";

export async function mountAiSettings(container, supabase) {
  const details = el("details", { className: "workspace-card ai-settings" });
  details.append(el("summary", { textContent: "AI 설정·이번 달 사용량" }));
  container.append(details);
  const setState = stateLine(details);
  const refresh = el("button", {
    type: "button",
    className: "ghost-btn",
    textContent: "연결·사용량 확인",
  });
  refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    try {
      const service = getServices().status;
      if (!service) throw new Error("AI 연결을 준비 중입니다");
      const status = await service();
      setState(
        `드라이브 ${status.drive ? "연결됨" : "설정 필요"} · AI ${
          status.ai ? "연결됨" : "설정 필요"
        } · ${status.budget.month} 사용·예약 ${status.budget.used.toLocaleString()}원 / 3,000원`,
      );
    } catch (e) {
      setState(e.message, true);
    } finally {
      refresh.disabled = false;
    }
  });
  details.append(refresh);
  try {
    const settings = await rows(supabase, "site_settings");
    const labels = {
      week: "주차별 커리큘럼 요약",
      department: "학과별 커리큘럼 요약",
      roadmap: "로드맵 요약",
      profile: "프로필 사진 지시문",
    };
    for (const [kind, defaultPrompt] of Object.entries(PROMPTS)) {
      const key = `ai_prompt_${kind}`;
      const textarea = el("textarea", {
        rows: 4,
        maxLength: 4000,
        value: settings.find((s) => s.key === key)?.value || defaultPrompt,
      });
      textarea.addEventListener("change", async () => {
        try {
          const { error } = await supabase.from("site_settings").upsert({
            key,
            value: textarea.value.trim() || null,
          });
          if (error) throw new Error(error.message);
          setState("지시문을 저장했습니다. 다음 AI 작업부터 사용합니다.");
        } catch (e) {
          setState(e.message, true);
        }
      });
      details.append(
        el("label", { className: "form-field" }, [
          el("span", { textContent: labels[kind] }),
          textarea,
        ]),
      );
    }
    details.append(
      el("p", {
        className: "muted",
        textContent:
          "사용액은 토큰 사용량에 여유 있는 단가·환율을 적용한 예산 집계입니다. 처리 중인 작업과 응답이 불확실한 실패는 예약액을 포함합니다.",
      }),
    );
  } catch (e) {
    setState(e.message, true);
  }
}
