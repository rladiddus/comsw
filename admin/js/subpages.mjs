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
      if (t.fresh && rendering.has(id)) {
        rendering.delete(id);
        t.panel.replaceChildren();
      }
      if (!rendering.has(id)) rendering.set(id, t.load().then((mod) => mod.render(t.panel, ctx)));
      return rendering.get(id);
    };
    mountTabs(container, panels.map((p) => [p.id, p.label, p.panel]), undefined, open);
    container.append(...panels.map((p) => p.panel));
    await open(panels[0].id);
  };
}
