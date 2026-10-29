import { el, pick, chip, hint, btn, panel, empty, select, table, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { state, CAT, norm, splitItems, materialsOf, checkMaterials, typeChip } from "../v3.mjs";
import { reviewedCount, reviewDone } from "./inbox.mjs";

// 재료 검토(V3 시안 '재료 AI 검증·확정', 정책 9D): 선생님 분류 | 검사 제안 | 학과장 최종 분류.
// 검사는 AI 대신 이름 규칙으로만 한다(AI 검증 작업은 DB·서버 추가 후). 결정은 이 화면에만 남고 DB에 저장하지 않는다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  const [pending, instructors, subjects, materials, prep] = await Promise.all([
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, vacation, updated_at", (q) => q.eq("status", "pending")),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "subjects", "id, name, is_vacation"),
    pick(supabase, "instructor_subject_materials", "instructor_id, subject_id, tools, supplies"),
    pick(supabase, "course_prep_items", "subject_id, content"),
  ]);
  const groups = groupRequests(pending);
  const want = decodeURIComponent(location.hash.split("/")[2] ?? "");
  const pickBox = select("제출", groups.map((g) => [g.key, `${nameOf(instructors, g.instructor_id)} · ${nameOf(subjects, g.subject_id)} ${g.vacation ? "(방특)" : "(정규)"}`]));
  if (groups.some((g) => g.key === want)) pickBox.value = want;
  const body = el("div");
  headActions(ctx, btn("승인 화면으로", () => { location.hash = `#/inbox/${encodeURIComponent(pickBox.value)}`; }, true));

  function draw() {
    const g = groups.find((x) => x.key === pickBox.value);
    if (!g) { body.replaceChildren(panel("재료 검토", [empty("승인 대기 중인 제출이 없습니다.")])); return; }
    const subject = subjects.find((s) => s.id === g.subject_id);
    const mats = materialsOf(materials.find((m) => m.instructor_id === g.instructor_id && m.subject_id === g.subject_id));
    // 같은 과목 ID 안에서만 중복 후보를 찾는다(다른 학과·정규/방특 과목과는 비교하지 않음).
    const others = [
      ...materials.filter((m) => m.subject_id === g.subject_id && m.instructor_id !== g.instructor_id).flatMap((m) => [...splitItems(m.tools), ...splitItems(m.supplies)]),
      ...prep.filter((p) => p.subject_id === g.subject_id).map((p) => p.content),
    ].map(norm);
    const checked = checkMaterials(mats, others);
    const decided = state.reviews.get(g.key) ?? new Map();
    state.reviews.set(g.key, decided);
    const decide = (id, cat) => { decided.set(id, cat); draw(); };
    const n = reviewedCount(g.key, mats);
    const flagged = checked.filter((m) => m.issues.length).length;

    const t = table(["선생님이 적은 항목", "선생님 분류", "검사 제안", "학과장 최종 분류·결정"], checked, (m) => {
      const final = decided.get(m.id);
      const change = select("분류 바꾸기", [["", "다른 분류로…"], ...Object.entries(CAT)]);
      change.addEventListener("change", () => change.value && decide(m.id, change.value));
      return [
        el("div", {}, [el("b", { textContent: m.label }), el("small", { className: "muted v3-block", textContent: "원본 · 바뀌지 않음" })]),
        chip(CAT[m.teacher], "vacation"),
        el("div", {}, [chip(CAT[m.suggested], m.issues.length ? "warn" : "good"),
          el("small", { className: "muted v3-block", textContent: m.issues.map(([c, d]) => `${c}: ${d}`).join(" / ") || "문제 없음" })]),
        final ? el("div", {}, [chip("검토 완료", "good"), el("b", { textContent: ` ${CAT[final]}` }), " ", btn("다시 검토", () => { decided.delete(m.id); draw(); })])
          : el("div", { className: "v2-actions" }, [btn("원본 유지", () => decide(m.id, m.teacher)),
            ...(m.suggested !== m.teacher ? [btn("제안 수용", () => decide(m.id, m.suggested), true)] : []), change]),
      ];
    });
    body.replaceChildren(el("div", { className: "v2-grid2" }, [
      el("div", { className: "v2-stack" }, [panel(`${nameOf(instructors, g.instructor_id)} · ${subject?.name ?? ""}`, [
        mats.length ? t.node : empty("선생님이 적은 교재·준비물·프로그램이 없습니다."),
        hint("지금 DB는 선생님이 '사용 프로그램'과 '준비물' 두 칸에 적습니다. 그래서 칸 이름을 선생님 분류로 봅니다(교재·AI 도구를 직접 고르는 입력은 DB 추가 후)."),
      ], "같은 과목 ID 안에서만 중복을 찾습니다", [typeChip(subject), chip(`검토 ${n}/${mats.length}`, reviewDone(g.key, mats) ? "good" : "warn")])]),
      panel("승인 조건", [
        el("div", { className: "v3-impact" }, [el("div", { textContent: "검사" }), chip("이름 규칙 검사 (AI 미연결)", "vacation")]),
        el("div", { className: "v3-impact" }, [el("div", { textContent: `검토 완료 ${n}/${mats.length}건` }), chip(reviewDone(g.key, mats) ? "승인 가능" : "검토 남음", reviewDone(g.key, mats) ? "good" : "warn")]),
        el("div", { className: "v3-impact" }, [el("div", { textContent: `검사가 짚은 항목 ${flagged}건` }), chip("학과장이 직접 판단", "")]),
        mats.length ? btn("전체 원본 유지로 검토 확정", () => { mats.forEach((m) => decided.has(m.id) || decided.set(m.id, m.teacher)); draw(); })
          : btn("재료 없음 확인", () => decide("none", "none")),
        btn("과목 승인 화면으로", () => { location.hash = `#/inbox/${encodeURIComponent(g.key)}`; }, true),
        hint("전체 확인도 학과장이 직접 누르는 것입니다. 원본은 자동으로 바뀌지 않습니다. 검토 결과는 새로고침하면 사라집니다(저장은 DB 추가 후)."),
      ]),
    ]));
  }
  pickBox.addEventListener("change", draw);
  container.append(
    el("div", { className: "v3-callout" }, [chip("9D", "vacation"), document.createTextNode(" 분류는 선생님이 정합니다. 검사는 제안만 하고, 분류 변경·합치기·승인·공개를 스스로 하지 않습니다.")]),
    el("div", { className: "v2-panel v2-filter v2-bar" }, [el("span", { className: "v2-label", textContent: "검토할 제출" }), pickBox]),
    body,
  );
  draw();
}
