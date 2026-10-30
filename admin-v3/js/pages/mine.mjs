import { el, btn, headActions } from "../../../admin-v2/js/ui.mjs";

// 내 커리큘럼(V3): 진행 단계·안내 박스 없이 기존 '내 커리큘럼' 화면(작성·승인 요청·조회) 그대로(실제 저장). v3 = 과목명 동일·방특 시기 고르기.
export async function render(container, ctx) {
  const work = el("div", { className: "v2-work" });
  headActions(ctx, btn("승인 요청하기", () => work.scrollIntoView?.({ behavior: "smooth" }), true));
  container.append(work);
  await (await import("../../../admin/js/pages/mine.mjs")).render(work, { ...ctx, v3: true });
}
