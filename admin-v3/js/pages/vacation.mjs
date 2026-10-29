import { el, pick, chip, hint, btn, panel, empty, editor, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { typeChip } from "../v3.mjs";

// 방학 특강(V3 시안, 정책 6B): 기수 = 방학 특강 그룹(curriculum_sets.is_vacation). 기수마다 과목 ID가 달라야 한다.
// 지금은 같은 과목이 여러 기수에 쓰일 수 있어 '기수별 ID 분리 필요'로 표시한다. 고치기는 기존 방학 특강 화면.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [cohorts, setting, curricula, instructors, subjects] = await Promise.all([
    pick(supabase, "curriculum_sets", "id, name", (q) => q.eq("is_vacation", true).order("name")),
    pick(supabase, "site_settings", "key, value", (q) => q.eq("key", "vacation_set_id")),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, vacation, status, updated_at", (q) => q.eq("status", "approved")),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, is_vacation, duration"),
  ]);
  const edit = editor("방학 특강 관리 (기존 '방학 특강' 화면: 기수 만들기·담기·승인)", () => import("../../../admin/js/pages/vacation.mjs"), ctx);
  headActions(ctx, btn("기수·강좌 관리", edit.open, true));
  const siteSet = setting[0]?.value;
  let sel = cohorts.find((c) => c.id === siteSet) ?? cohorts[0];
  const left = el("div");
  const right = el("div");
  const usedIn = (subjectId) => new Set(curricula.filter((c) => c.subject_id === subjectId && cohorts.some((x) => x.id === c.set_id)).map((c) => c.set_id)).size;

  function draw() {
    left.replaceChildren(panel("기수", cohorts.length ? cohorts.map((c) => Object.assign(el("div", { className: `v2-listitem${c === sel ? " active" : ""}` }, [
      el("b", { textContent: c.name }), c.id === siteSet ? chip("사이트에 나옴", "profiles") : chip("보관", "warn"),
    ]), { onclick: () => { sel = c; draw(); } })) : [empty("방학 특강 기수가 없습니다.")]));
    const courses = sel ? groupRequests(curricula.filter((c) => c.set_id === sel.id)) : [];
    right.replaceChildren(panel(`방학 특강 전용 과목 · ${sel?.name ?? ""}`, courses.length ? courses.map((g) => {
      const s = subjects.find((x) => x.id === g.subject_id);
      return el("div", { className: "v2-mini-card" }, [
        el("div", { className: "v2-row" }, [el("b", { textContent: s?.name ?? "" }), el("span", {}, [typeChip(s), ...(usedIn(g.subject_id) > 1 ? [chip("기수별 ID 분리 필요", "red")] : [])])]),
        el("small", { textContent: `${nameOf(instructors, g.instructor_id)} · ${g.rows.length}단계 · ${s?.duration || "기간 없음"}` }),
      ]);
    }) : [empty("이 기수에 승인된 강좌가 없습니다.")], "", [btn("과목 목록에서 관리", () => { location.hash = "#/subjects"; })]));
  }
  container.append(
    el("div", { className: "v3-callout" }, [chip("6B", "vacation"), document.createTextNode(" 정규 포토샵과 방특 포토샵은 다른 과목입니다. 2026 겨울과 2026 여름 방특의 포토샵도 따로 과목 ID를 둡니다.")]),
    el("div", { className: "v3-grid48" }, [left, right]),
    hint("사이트에 나오는 기수는 기본 설정 › 메인 화면에서 고릅니다."),
    edit.node,
  );
  draw();
}
