import { el, pick, tabBox, headActions } from "../../../admin-v2/js/ui.mjs";
import { CAT } from "../v3.mjs";

// 수업별 준비물(V3 시안 '준비물·교재·AI 도구'): 4분류 탭(교재·물품·사용 프로그램·AI 도구), 탭마다 모든 학과를 학과별로 묶어 한 번에 보여 준다.
// 네 탭 모두 기존 '수업별 준비물' 화면의 카드 목록(admin/js/pages/prep.mjs)으로 등록·수정한다(실제 저장).
// 교재·물품·AI 도구 = course_prep_items, 사용 프로그램 = 과목의 '프로그램' 칸(subjects.tools).
// 과목 이름 대신 그룹 이름(subject_groups)으로 보이고, 같은 그룹 과목은 한 묶음(그룹 표가 없거나 그룹이 없는 과목은 과목 이름 그대로).
let tab = 0; // 다른 화면에 갔다 와도 보던 탭

export async function render(container, ctx) {
  headActions(ctx);
  const [subs, groups] = await Promise.all([
    pick(ctx.supabase, "subjects", "id, group_id").catch(() => []),
    pick(ctx.supabase, "subject_groups", "id, name").catch(() => []),
  ]);
  const prepGroupOf = new Map(subs.filter((s) => s.group_id).map((s) => [s.id, groups.find((g) => g.id === s.group_id)]).filter(([, g]) => g));
  const cats = Object.keys(CAT);
  const keep = tab; // tabBox가 만들 때 첫 탭을 열어 tab이 0으로 바뀌므로 먼저 기억
  const [bar, panelBody] = tabBox(cats.map((c) => CAT[c]), (i) => {
    tab = i;
    const box = el("div");
    import("../../../admin/js/pages/prep.mjs")
      .then(({ render: prep }) => prep(box, { ...ctx, prepCategory: cats[i], prepLabel: CAT[cats[i]], prepGroupOf }))
      .catch((e) => box.append(el("p", { className: "save-state err", textContent: e.message })));
    return [box];
  });
  container.append(el("section", { className: "v2-panel" }, [bar, panelBody]));
  if (keep) bar.children[keep].click();
}
