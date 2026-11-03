import { el, tabBox, headActions } from "../../../admin-v2/js/ui.mjs";

// 과목 관리(V3): 다른 메뉴에 없는 기능만 남긴다(2026-11-03 사용자 요청).
// [과목 정리] 학과별 쓰임새 보기 · 정리 필요(승인 전 과목 넣기, 안 쓰는 과목 삭제) / [학과별 과목] 학과에 과목 넣기·빼기·순서(DB 저장).
// 과목 목록·상세(강사 커리큘럼·학과 관리에 있음), 새 과목 만들기(학과 관리 › 과목 생성)는 뺐다.
const OLD = "../../../admin/js/pages/";
const TABS = [["과목 정리", "subject-manage"], ["학과별 과목", "department-subjects"]];

export async function render(container, ctx) {
  headActions(ctx);
  container.append(
    el("section", { className: "v2-panel" }, tabBox(TABS.map(([n]) => n), (i) => {
      const box = el("div", { className: "subpage" }); // 기존 화면 맨 위 제목(h2)은 숨김
      import(`${OLD}${TABS[i][1]}.mjs`).then((m) => m.render(box, ctx))
        .catch((e) => box.append(el("p", { className: "save-state err", textContent: e.message })));
      return [box];
    })),
  );
}
