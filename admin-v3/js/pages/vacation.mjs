import { headActions } from "../../../admin-v2/js/ui.mjs";

// 방학 특강(V3): 기존 '방학 특강' 화면(방학 특강 추가·방특 신청 담기·강의 목록)을 바로 보여 준다.
// 선생님이 '방특'에서 고른 방학 특강으로 낸 신청은 그 방학 특강을 고르면 나온다(ctx.v3).
export async function render(container, ctx) {
  headActions(ctx);
  await (await import("../../../admin/js/pages/vacation.mjs")).render(container, { ...ctx, v3: true });
}
