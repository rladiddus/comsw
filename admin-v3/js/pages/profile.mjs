import { el, btn, headActions } from "../../../admin-v2/js/ui.mjs";

// 내 프로필(V3): 진행 단계 박스 없이 기존 '내 프로필' 화면(경력·한마디·사진·승인 요청·수업 설정) 그대로(실제 저장).
export async function render(container, ctx) {
  const work = el("div", { className: "v2-work" });
  headActions(ctx, btn("프로필 승인 요청", () => work.scrollIntoView?.({ behavior: "smooth" }), true));
  container.append(work);
  await (await import("../../../admin/js/pages/profile.mjs")).render(work, ctx);
}
