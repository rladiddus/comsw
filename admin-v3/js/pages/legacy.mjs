import { el, tabBox, headActions } from "../../../admin-v2/js/ui.mjs";

// 기본 설정 등: 사이트 화면(V3 site.mjs)과 특강·채용·시스템 설정(V2 화면)을 탭으로 연다.
const V2 = "../../../admin-v2/js/pages/";
const TABS = [["기본 설정", "./site.mjs"], ["특강·세미나", `${V2}seminars.mjs`], ["채용 공고", `${V2}recruitment.mjs`], ["시스템 설정", `${V2}system.mjs`]];

export async function render(container, ctx) {
  headActions(ctx);
  container.append(
    el("section", { className: "v2-panel" }, tabBox(TABS.map(([n]) => n), (i) => {
      const actions = el("div", { className: "v2-actions v2-end" });
      const box = el("div");
      import(TABS[i][1]).then((m) => m.render(box, { ...ctx, headActions: actions }))
        .catch((e) => box.append(el("p", { className: "save-state err", textContent: e.message })));
      return [actions, box];
    })),
  );
}
