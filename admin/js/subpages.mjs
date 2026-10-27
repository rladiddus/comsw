import { el, mountTabs } from "./teacher-workspace.mjs";

// 하위 탭이 있는 메뉴(기본 설정·학과·강사·커리큘럼 관리). 탭을 처음 열 때 그 화면을 그린다.
// 탭 화면 맨 위 제목(h2)은 메뉴 제목·탭과 겹치므로 CSS로 숨긴다(.subpage > h2:first-child).
export function subpages(title, tabs) {
  return async function render(container, ctx) {
    container.append(el("h2", { textContent: title }));
    // fresh: 열 때마다 새로 그린다(다른 탭에서 바꾼 내용이 바로 보이게).
    const panels = tabs.map(([id, label, load, opts = {}]) => ({ id, label, load, fresh: opts.fresh, panel: el("div", { className: "subpage" }) }));
    const rendering = new Map();
    const open = (id) => {
      const t = panels.find((p) => p.id === id);
      if (!t) return null;
      const prev = rendering.get(id);
      if (prev && !t.fresh) return prev;
      // 앞의 그리기가 끝난 뒤에 비우고 다시 그린다(겹쳐 그리면 같은 내용이 두 번 붙는다).
      const next = (prev ?? Promise.resolve()).catch(() => {}).then(async () => {
        t.panel.replaceChildren();
        return (await t.load()).render(t.panel, ctx);
      });
      rendering.set(id, next);
      return next;
    };
    // 첫 탭은 mountTabs가 연다(여기서 또 열면 열 때마다 새로 그리는 첫 탭이 두 번 그려졌다).
    mountTabs(container, panels.map((p) => [p.id, p.label, p.panel]), undefined, open);
    container.append(...panels.map((p) => p.panel));
    await rendering.get(panels[0].id);
  };
}
