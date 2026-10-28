import { el, btn, headActions } from "../ui.mjs";

// 내 커리큘럼(시안 '내 수업·커리큘럼'): 위에 진행 단계, 아래는 기존 '내 커리큘럼' 화면(담당 과목 고르기·작성·승인 요청) 그대로.
export const steps = (list, done) => el("div", { className: "v2-steps" }, list.map(([t, s], i) =>
  el("div", { className: `v2-step${i < done ? " active" : ""}` }, [el("strong", { textContent: t }), el("span", { textContent: s })])));

export async function render(container, ctx) {
  const work = el("div", { className: "v2-work" });
  headActions(ctx, btn("승인 요청하기", () => work.scrollIntoView?.({ behavior: "smooth" }), true));
  container.append(
    steps([["① 담당 과목 설정", "학과·과목 선택"], ["② 작성", "단계·이미지·준비물"], ["③ 승인 요청", "관리자에게 보내기"], ["④ 결과 확인", "승인 또는 수정 요청"]], 2),
    work,
  );
  await (await import("../../../admin/js/pages/mine.mjs")).render(work, ctx);
}
