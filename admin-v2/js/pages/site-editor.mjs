import { el, hint, btn, locked, panel, dl, editor, headActions } from "../ui.mjs";
import { SITE_PAGES } from "../../../admin/js/preview.mjs";

// 기본 설정(시안 '사이트 편집'): 왼쪽 공개 사이트 페이지, 가운데 실제 페이지(지금 공개본 / 반영 전 미리보기, PC·태블릿),
// 오른쪽 그 페이지 내용을 고치는 곳. 메인·로딩은 여기서(기존 기본 설정 화면), 나머지는 해당 메뉴로 안내.
const WHERE = {
  "메인": [["메인 배경 미디어·하단 메뉴·기타 설정·AI 설정", null]],
  "전체 수업": [["과목·단계 순서", "#/subjects"], ["로드맵 설명", "#/roadmaps"]],
  "학과별 자료": [["학과 소개·이미지", "#/departments"], ["강사 소개", "#/instructors"], ["채용 공고", "#/recruitment"], ["강사 커리큘럼", "#/curricula"]],
  "학과 커리큘럼": [["학과 커리큘럼 문구", "#/curricula"]],
  "특강/세미나": [["특강 일정·포스터", "#/seminars"]],
  "수업별 준비물": [["교재·준비물·AI 도구", "#/materials"]],
  "방학 특강": [["방학 특강 강좌", "#/vacations"], ["사이트에 나오는 기수·배경", null]],
};

export async function render(container, ctx) {
  const edit = editor("메인·로딩 화면 편집 (기존 '기본 설정' 화면)", () => import("../../../admin/js/pages/settings.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("메인·로딩 편집", edit.open, true));
  const pages = [...SITE_PAGES.slice(0, 1), { name: "로딩 화면", file: "index", loading: true }, ...SITE_PAGES.slice(1)];
  let sel = pages[0], tablet = false, draft = false;
  const list = el("div", { className: "v2-boxlist" });
  const frame = el("iframe", { className: "v2-frame", title: "공개 사이트 페이지" });
  const frameHead = el("div", { className: "v2-actions" });
  const side = el("div");

  async function draw() {
    list.replaceChildren(...pages.map((p) => Object.assign(el("div", { className: `v2-listitem${p === sel ? " active" : ""}` }, [
      el("b", { textContent: `▤  ${p.name}` }), el("small", { textContent: p.loading ? "첫 방문 때 잠깐 보이는 화면" : `${p.file}.html` }),
    ]), { onclick: () => { sel = p; draw(); } })));
    const toggle = (text, on, fn) => Object.assign(el("button", { type: "button", className: on ? "publish-btn" : "ghost-btn", textContent: text }), { onclick: fn });
    frameHead.replaceChildren(
      toggle("PC", !tablet, () => { tablet = false; draw(); }), toggle("태블릿", tablet, () => { tablet = true; draw(); }),
      toggle("지금 공개본", !draft, () => { draft = false; draw(); }), toggle("반영 전 미리보기", draft, () => { draft = true; draw(); }),
    );
    // 반영 전 미리보기: 기존 미리보기와 같이 로그인 토큰을 같은 사이트 저장소에 두면 공개 페이지가 반영 전 내용을 읽는다.
    if (draft) { try { localStorage.setItem("comsw_preview_token", await ctx.getToken()); } catch { draft = false; } }
    frame.classList.toggle("tablet", tablet);
    frame.src = `../${sel.file}${tablet ? "_tablet" : ""}.html${draft ? "?preview=1" : ""}`;
    const where = WHERE[sel.loading ? "메인" : sel.name] ?? [];
    side.replaceChildren(panel("페이지 속성", [
      dl([["선택한 페이지", sel.name], ["보이는 내용", draft ? "반영 전 미리보기" : "지금 공개본"], ["화면", tablet ? "태블릿" : "PC"]]),
      el("p", { className: "v2-label", textContent: "이 페이지 내용을 고치는 곳" }),
      ...where.map(([what, hash]) => el("div", { className: "v2-mini-card v2-row" }, [el("b", { textContent: what }),
        btn(hash ? "열기" : "여기서 편집", hash ? () => { location.hash = hash; } : edit.open)])),
      hint("고친 내용은 '반영 전 미리보기'로 확인하고, '사이트 반영'에서 공개 사이트에 반영합니다."),
    ]));
  }
  container.append(
    el("div", { className: "v2-grid3" }, [
      panel("사이트 페이지", [list]),
      el("section", { className: "v2-panel" }, [
        el("div", { className: "v2-panel-head" }, [el("h3", { textContent: "사이트 화면" }), frameHead]),
        el("div", { className: "v2-panel-body" }, [frame]),
      ]),
      side,
    ]),
    edit.node,
  );
  await draw();
}
