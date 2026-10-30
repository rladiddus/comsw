import { headActions } from "../../../admin-v2/js/ui.mjs";

// 학과 관리(V3 시안): 기존 '학과' 화면(추가·수정)을 펼친 채로 바로 보여 준다.
export async function render(container, ctx) {
  headActions(ctx);
  await (await import("../../../admin/js/pages/departments.mjs")).render(container, ctx);
}
