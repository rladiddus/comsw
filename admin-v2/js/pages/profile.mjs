import { el, btn, headActions } from "../ui.mjs";
import { steps } from "./classes.mjs";

// 내 프로필(시안): 위에 진행 단계, 아래는 기존 '내 프로필' 화면(경력·한마디·사진·승인 요청·수업 설정) 그대로.
export async function render(container, ctx) {
  const work = el("div", { className: "v2-work" });
  headActions(ctx, btn("프로필 승인 요청", () => work.scrollIntoView?.({ behavior: "smooth" }), true));
  container.append(
    steps([["① 작성", "경력·한마디·사진"], ["② 승인 요청", "관리자에게 보내기"], ["③ 검토", "승인 또는 수정 요청"], ["④ 사이트 공개", "사이트 반영 후"]], 1),
    work,
  );
  await (await import("../../../admin/js/pages/profile.mjs")).render(work, ctx);
}
