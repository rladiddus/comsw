import { el, btn, hint, panel, tabBox, headActions } from "../../../admin-v2/js/ui.mjs";
import { SITE_PAGES } from "../../../admin/js/preview.mjs";
import { modal } from "../v3.mjs";
import { menuEditor } from "./site-menu.mjs";

// 기본 설정(V3): 왼쪽 사이트 페이지, 오른쪽 사이트 화면(PC·태블릿 비율). [페이지 편집]은 그 페이지 내용을 팝업으로 고친다.
// '메뉴'는 화면 자리에 알약 메뉴 편집을 바로 보여 준다. 화면이 없는 페이지 편집은 해당 V3 메뉴로 간다.
const page = (name) => SITE_PAGES.find((p) => p.name === name);
const PAGES = [
  { name: "메인·로딩화면", file: "index", edit: "main" },
  { name: "메뉴", menu: true },
  { ...page("전체 수업"), go: "#/roadmap" },
  { ...page("학과별 자료"), edit: "depts" },
  { ...page("학과 커리큘럼"), go: "#/aggregate" },
  { ...page("특강/세미나"), go: "#/seminars" },
  { ...page("수업별 준비물"), go: "#/materials" },
  { ...page("방학 특강"), edit: "vacation" },
  { name: "로고 이미지", file: "roadmap", edit: "logo" },
];

async function mount(box, load) {
  try { await load(); } catch (e) { box.append(el("p", { className: "save-state err", textContent: e.message })); }
}

// 팝업 안 내용. 저장은 각 편집 칸이 바로 한다(기존 화면과 같음).
function editPopup(kind, ctx, onClose) {
  const { supabase } = ctx;
  const scroll = (fill, cls = "") => { const b = el("div", { className: `v3-popscroll ${cls}` }); mount(b, () => fill(b)); return b; };
  const main = (b) => import("../../../admin/js/media-carousel.mjs").then((m) => m.mountMediaCarousel(b, { supabase }));
  const loading = (b) => import("../../../admin/js/pages/loading.mjs").then((m) => m.render(b, { supabase }));
  const depts = (b) => import("../../../admin/js/pages/departments.mjs").then((m) => m.render(b, { ...ctx, categories: false }));
  const setting = (only) => (b) => import("../../../admin/js/pages/main-page.mjs").then((m) => m.settingsForm(b, supabase, only));
  let body;
  // 탭을 오갈 때 다시 불러오면 내용이 비었다 차면서 창 크기가 바뀌어 깜빡인다 → 탭 내용은 한 번만 그리고, 두 탭 높이를 같게.
  const panes = [];
  if (kind === "main") body = tabBox(["메인 화면", "로딩 화면"], (i) => (panes[i] ??= scroll(i ? loading : main, "v3-popfixed")));
  else body = [scroll(kind === "depts" ? depts : setting(kind), kind === "depts" ? "v3-deptpop" : "")];
  const title = { main: "메인·로딩화면 편집", depts: "학과 소개", vacation: "방학 특강 편집", logo: "로고 이미지" }[kind];
  const d = modal(title, body, [], "닫기");
  d.classList.add("v3-wide");
  d.addEventListener("close", onClose);
}

export async function render(container, ctx) {
  headActions(ctx);
  let sel = PAGES[0], tablet = false, draft = false;
  const list = el("div", { className: "v2-boxlist v3-sitelist" });
  const frame = el("iframe", { className: "v2-frame v3-siteframe", title: "공개 사이트 페이지" });
  const editBtn = btn("페이지 편집", () => {
    if (sel.edit) editPopup(sel.edit, ctx, () => { frame.src = frame.src; });
    else if (sel.go) location.hash = sel.go;
  }, true);
  const head = el("div", { className: "v2-actions" });
  const stage = el("div", { className: "v2-panel-body" });

  // 사이트 페이지는 <base target="_top">·window.top으로 이동해서, 그대로 두면 관리 화면 전체가 사이트로 바뀐다.
  // 링크는 화면 안에서 열리게 바꾸고, 그래도 바깥으로 나가려는 이동(Navigation API 지원 브라우저)은 화면 안으로 돌린다.
  frame.addEventListener("load", () => {
    try { frame.contentDocument?.querySelectorAll("base").forEach((b) => b.setAttribute("target", "_self")); } catch { /* 다른 주소 */ }
  });
  const nav = globalThis.navigation;
  const keepInside = (e) => {
    if (!frame.isConnected) { nav.removeEventListener("navigate", keepInside); return; }
    const url = new URL(e.destination.url);
    if (!e.cancelable || url.origin !== location.origin || url.pathname.includes("/admin")) return;
    e.preventDefault();
    frame.src = url.href;
  };
  nav?.addEventListener("navigate", keepInside);

  async function draw() {
    list.replaceChildren(...PAGES.map((p) => Object.assign(el("div", { className: `v2-listitem${p === sel ? " active" : ""}` }, [
      el("b", { textContent: `▤  ${p.name}` }),
    ]), { onclick: () => { sel = p; draw(); } })));
    const toggle = (text, on, fn) => Object.assign(el("button", { type: "button", className: on ? "publish-btn" : "ghost-btn", textContent: text }), { onclick: fn });
    editBtn.hidden = Boolean(sel.menu);
    editBtn.disabled = Boolean(sel.off);
    editBtn.title = sel.off ?? "";
    head.replaceChildren(...(sel.menu ? [] : [
      toggle("PC", !tablet, () => { tablet = false; draw(); }), toggle("태블릿", tablet, () => { tablet = true; draw(); }),
      toggle("지금 공개본", !draft, () => { draft = false; draw(); }), toggle("반영 전 미리보기", draft, () => { draft = true; draw(); }),
    ]));
    if (sel.menu) { stage.replaceChildren(); await menuEditor(stage, ctx); return; }
    // 사이트에서 꺼 둔 메뉴의 페이지(예: 방학 특강)는 공개본이 '준비 중'만 보이므로 미리보기로 설정된 모습을 보여 준다.
    const { data: menus } = await ctx.supabase.from("menus").select("name, is_active");
    const key = (v) => String(v ?? "").replace(/\s+/g, "");
    const hidden = (menus ?? []).some((m) => key(m.name) === key(sel.name) && !m.is_active);
    // 반영 전 미리보기: 로그인 토큰을 같은 사이트 저장소에 두면 공개 페이지가 반영 전 내용을 읽는다.
    let preview = draft || hidden;
    if (preview) { try { localStorage.setItem("comsw_preview_token", await ctx.getToken()); } catch { preview = draft = false; } }
    // 미리보기 표시는 이 탭 저장소에 남아 다음 페이지에도 이어지므로, 공개본을 볼 때는 지운다.
    else try { sessionStorage.removeItem("comsw_preview"); } catch { /* 저장소 막힘 */ }
    frame.classList.toggle("tablet", tablet);
    frame.src = `../${sel.file}${tablet ? "_tablet" : ""}.html${preview ? "?preview=1" : ""}`;
    stage.replaceChildren(...(hidden && preview ? [hint("사이트에 숨겨 둔 페이지라 공개본에는 '준비 중입니다'만 보입니다. 지금 설정된 모습을 미리보기로 보여 줍니다.", "warn")] : []), frame);
  }
  container.append(el("div", { className: "v3-sitegrid" }, [
    panel("사이트 페이지", [list]),
    el("section", { className: "v2-panel" }, [
      el("div", { className: "v2-panel-head" }, [el("div", { className: "v2-row v2-gap" }, [el("h3", { textContent: "사이트 화면" }), editBtn]), head]),
      stage,
    ]),
  ]));
  await draw();
}
