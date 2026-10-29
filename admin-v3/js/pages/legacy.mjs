import { el, hint, tabBox, headActions } from "../../../admin-v2/js/ui.mjs";

// 기존 유지(V3 시안 '기본 설정 등'): 메인·로딩·특강·채용·시스템 설정은 V3에서 바꾸지 않는다. V2 화면을 탭으로 그대로 연다.
const TABS = [["기본 설정", "site-editor"], ["특강·세미나", "seminars"], ["채용 공고", "recruitment"], ["시스템 설정", "system"]];

export async function render(container, ctx) {
  headActions(ctx);
  container.append(
    hint("이번 개편에서 바꾸지 않는 화면입니다. 지금과 같이 저장·동작합니다."),
    el("section", { className: "v2-panel" }, tabBox(TABS.map(([n]) => n), (i) => {
      const actions = el("div", { className: "v2-actions v2-end" });
      const box = el("div");
      import(`../../../admin-v2/js/pages/${TABS[i][1]}.mjs`).then((m) => m.render(box, { ...ctx, headActions: actions }))
        .catch((e) => box.append(el("p", { className: "save-state err", textContent: e.message })));
      return [actions, box];
    })),
  );
}
