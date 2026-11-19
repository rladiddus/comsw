// 사이트 편집: 메인 / 학과 대표 / 로딩 / 하단 메뉴. 입력 옆에 미리보기. 확정은 탭마다(2·5단계).
// 메인·로딩은 여러 개 모두 읽는다(지금 공개 사이트 동작 그대로). 메뉴 이름은 보이는 이름(label)과 이동용(name)이 따로다.
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, media, fill, empty } from "../ui.mjs";

let state = { tab: "main", dept: null };

export async function render({ main }) {
  main.replaceChildren(head("사이트 편집", "메인 화면, 학과 대표 화면, 로딩 화면, 하단 메뉴를 고치고 미리 봅니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [mm, depts, loading, menus] = await Promise.all([data.mainMedia(), data.all("departments", (q) => q.order("sort_order", { nullsFirst: false })), data.loadingItems(), data.menus()]);
    const out = h("div");
    const on = (x) => pill(x.is_active === false ? "끔" : "사용", x.is_active === false ? "neutral" : "");
    const draw = () => {
      let view;
      if (state.tab === "main") {
        view = mediaList("메인 이미지·영상", mm, (m) => m.url, (m) => m.caption, on);
      } else if (state.tab === "dept") {
        state.dept ??= depts[0]?.id;
        const d = depts.find((x) => x.id === state.dept);
        view = [tabs(depts.map((x) => [x.id, x.name]), state.dept, (id) => { state.dept = id; draw(); }, "chips"), h("div", { style: "height:14px" }),
          d ? box(`${d.name} 대표 화면`, h("div", { class: "two" },
            h("div", {}, h("h4", {}, "소개"), h("p", { style: "white-space:pre-wrap" }, d.description || "—"), d.name_en ? h("p", { class: "muted" }, d.name_en) : null),
            h("div", {}, h("h4", {}, "대표 이미지"), media(d.image_url)))) : empty("학과가 없습니다")];
      } else if (state.tab === "loading") {
        view = mediaList("로딩 이미지·문구", loading, (l) => l.image_url, (l) => l.text, on);
      } else {
        const side = (s) => menus.filter((m) => m.side === s);
        const col = (s, title) => h("div", {}, h("h4", {}, title), h("ol", {}, side(s).map((m) =>
          h("li", {}, m.label || m.name, m.label && m.label !== m.name ? h("span", { class: "muted" }, ` (이동: ${m.name})`) : null, " ", m.is_active === false ? pill("끔", "neutral") : null))));
        view = [box("하단 메뉴 배치", h("div", { class: "menucols" }, col("left", "왼쪽"), col("right", "오른쪽")))];
      }
      out.replaceChildren(tabs([["main", "메인 화면"], ["dept", "학과 대표 화면"], ["loading", "로딩 화면"], ["menu", "하단 메뉴"]], state.tab, (t) => { state.tab = t; draw(); }), ...[view].flat());
    };
    draw();
    return out;
  });
}

function mediaList(title, items, urlOf, textOf, on) {
  let pick = items[0];
  const prev = h("div");
  const show = () => prev.replaceChildren(box("미리보기", pick ? [media(urlOf(pick)), h("p", { style: "white-space:pre-wrap" }, textOf(pick) || "")] : empty("항목이 없습니다")));
  const list = box(`${title} ${items.length}개`, table([
    ["", (x) => h("img", { class: "thumb", src: urlOf(x), alt: "", loading: "lazy", onerror: (e) => e.target.replaceWith(h("span", { class: "muted" }, "영상·링크")) })],
    ["문구", (x) => textOf(x) || "—"],
    ["상태", on],
  ], items, { onPick: (x) => { pick = x; show(); } }));
  show();
  return [h("div", { class: "two" }, list, prev)];
}
