import { el, pick, rows, chip, hint, btn, locked, panel, dl, empty, select, editor, headActions, nameOf } from "../ui.mjs";

// 로드맵(시안 '로드맵 빌더'): 학과 → 로드맵 → 단계 흐름. 단계는 과목 ID로 연결(과목 원본을 복사하지 않음).
// 보기는 여기서, 고치기는 기존 로드맵 화면.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, tracks, steps, stepSubjects, subjects] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "roadmap_tracks", "id, name, department_id, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "roadmap_steps", "id, track_id, position, source_text, summary"),
    pick(supabase, "roadmap_step_subjects", "step_id, subject_id, sort_order"),
    pick(supabase, "subjects", "id, name"),
  ]);
  const edit = editor("로드맵 편집 (기존 로드맵 화면)", () => import("../../../admin/js/pages/roadmap.mjs"), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("로드맵 저장", edit.open, true));

  const deptPick = select("학과", [["", "학과 없음 포함 전체"], ...depts.map((d) => [d.id, d.name])]);
  const trackPick = select("로드맵", []);
  const canvas = el("div");
  const side = el("div");
  let stepId = null;
  const fillTracks = () => {
    const list = tracks.filter((t) => !deptPick.value || t.department_id === deptPick.value);
    trackPick.replaceChildren(...list.map((t) => el("option", { value: t.id, textContent: t.name })));
  };
  const subjectsOf = (s) => stepSubjects.filter((x) => x.step_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((x) => nameOf(subjects, x.subject_id));

  function draw() {
    const list = steps.filter((s) => s.track_id === trackPick.value).sort((a, b) => a.position - b.position);
    if (!list.some((s) => s.id === stepId)) stepId = list[0]?.id ?? null;
    const road = el("div", { className: "v2-road" });
    list.forEach((s, i) => {
      if (i) road.append(el("span", { className: "v2-arrow", textContent: "→" }));
      road.append(Object.assign(el("div", { className: `v2-roadstep${s.id === stepId ? " active" : ""}` }, [
        el("span", { className: "v2-num", textContent: `STEP ${String(s.position).padStart(2, "0")}` }),
        el("b", { textContent: subjectsOf(s).join(" · ") || "연결 과목 없음" }),
        el("div", { className: "muted", textContent: String(s.summary || "").split("\n")[0] || "" }),
      ]), { onclick: () => { stepId = s.id; draw(); } }));
    });
    canvas.replaceChildren(panel("로드맵 단계 흐름", [list.length ? road : empty("이 로드맵에 단계가 없습니다."),
      hint("단계 순서 변경 · 단계별 과목 연결 · 로드맵 설명은 아래 '로드맵 편집'에서 합니다.")], "", [btn("단계 추가", edit.open)]));
    const s = list.find((x) => x.id === stepId);
    side.replaceChildren(panel("선택 단계 속성", s ? [
      dl([["단계", `${s.position}단계`], ["연결 과목", subjectsOf(s).join(", ")]]),
      el("p", { className: "v2-label", textContent: "로드맵 전용 소개(사이트 '전체 수업'에 보임)" }),
      el("textarea", { className: "v2-textarea", value: s.summary || "", readOnly: true }),
      el("div", { className: "v2-actions v2-end" }, [btn("과목 상세 보기", () => { location.hash = "#/subjects"; }), btn("단계 저장", edit.open, true)]),
    ] : [empty("단계를 고르세요.")]));
  }
  deptPick.addEventListener("change", () => { fillTracks(); draw(); });
  trackPick.addEventListener("change", draw);
  fillTracks();
  container.append(
    el("div", { className: "v2-panel v2-filter v2-bar" }, [el("span", { className: "v2-label", textContent: "학과" }), deptPick,
      el("span", { className: "v2-label", textContent: "로드맵" }), trackPick, el("div", { className: "v2-grow" }), chip(`로드맵 ${tracks.length}개`, "vacation")]),
    el("div", { className: "v2-grid2" }, [canvas, side]),
    edit.node,
  );
  draw();
}
