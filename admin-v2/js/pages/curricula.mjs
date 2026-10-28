import { el, rows, pick, chip, hint, btn, locked, panel, empty, select, editor, headActions, nameOf } from "../ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";
import { driveThumbnail } from "../../../admin/js/drive.mjs";

// 커리큘럼 관리(시안 '커리큘럼 스튜디오'): 학과 → 과목 → 보기(표준 커리큘럼 / 강사별 / 사이트 요약).
// 세 층은 다른 데이터다: 표준 = subject_weeks, 강사별 = 승인된 instructor_curricula, 사이트 요약 = subjects.dept_curriculum.
// 여기서는 보기만, 고치기는 아래 기존 화면(학과 커리큘럼·강사 커리큘럼).
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);
const VIEWS = ["표준 커리큘럼", "강사별 보기", "사이트 요약"];
const LAYER = ["과목 공통 원본(학과 커리큘럼 단계)", "강사별 승인 버전", "웹사이트에 보이는 학과 커리큘럼 문구"];

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [depts, subjects, links, weeks, approved, instructors, sets] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, duration, dept_curriculum, sort_order"),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subject_weeks", "id, subject_id, week_label, written, summary, image_url, sort_order"),
    pick(supabase, "instructor_curricula", "id, instructor_id, set_id, subject_id, step_label, written, summary, media_url, sort_order, updated_at", (q) => q.eq("status", "approved")),
    pick(supabase, "instructors", "id, name"),
    pick(supabase, "curriculum_sets", "id, name, department_id"),
  ]);
  const edit = editor("커리큘럼 편집 (기존 학과 커리큘럼·강사 커리큘럼 화면)", async () => ({
    render: subpages("커리큘럼 편집", [
      ["department", "학과 커리큘럼", old("department-curriculum"), { fresh: true }],
      ["instructor", "강사 커리큘럼", old("curricula"), { fresh: true }],
    ]),
  }), ctx);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("변경 저장", edit.open, true));

  const deptPick = select("학과", depts.map((d) => [d.id, d.name]));
  const subjPick = select("과목", []);
  const teacherPick = select("강사", []);
  const viewBtns = VIEWS.map((v, i) => Object.assign(el("button", { type: "button", className: "ghost-btn", textContent: v }), { onclick: () => { view = i; stepIdx = 0; draw(); } }));
  const left = el("section", { className: "v2-panel" });
  const middle = el("section", { className: "v2-panel" });
  const right = el("div", { className: "v2-stack" });
  let view = 0, stepIdx = 0;

  const fillSubjects = () => {
    const ids = links.filter((l) => l.department_id === deptPick.value).map((l) => l.subject_id);
    const list = subjects.filter((s) => ids.includes(s.id)).sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
    subjPick.replaceChildren(...list.map((s) => el("option", { value: s.id, textContent: s.name })));
  };
  const deptSets = () => sets.filter((s) => s.department_id === deptPick.value).map((s) => s.id);
  const teacherRows = () => approved.filter((r) => r.subject_id === subjPick.value && deptSets().includes(r.set_id));
  const fillTeachers = () => {
    const ids = [...new Set(teacherRows().map((r) => r.instructor_id))];
    teacherPick.replaceChildren(...ids.map((id) => el("option", { value: id, textContent: `${nameOf(instructors, id)} 선생님` })));
  };

  // 지금 보기의 단계 목록: { label, written, summary, image }
  const stepsNow = () => {
    const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (view === 1) return teacherRows().filter((r) => r.instructor_id === teacherPick.value).sort(byOrder)
      .map((r) => ({ label: r.step_label, written: r.written, summary: r.summary, image: r.media_url }));
    return weeks.filter((w) => w.subject_id === subjPick.value).sort(byOrder)
      .map((w) => ({ label: w.week_label, written: w.written, summary: w.summary, image: w.image_url }));
  };

  function draw() {
    viewBtns.forEach((b, i) => { b.className = i === view ? "publish-btn" : "ghost-btn"; });
    teacherPick.hidden = view !== 1;
    const subject = subjects.find((s) => s.id === subjPick.value);
    const steps = stepsNow();
    const step = steps[stepIdx];
    const head = (title, desc, extra = []) => el("div", { className: "v2-panel-head" }, [el("div", {}, [el("h3", { textContent: title }), el("p", { className: "v2-desc", textContent: desc })]), ...extra]);
    left.replaceChildren(head("과목 · 단계", subject ? `${subject.duration || "기간 없음"} · 총 ${steps.length}단계` : ""), el("div", { className: "v2-boxlist" },
      steps.length ? steps.map((s, i) => Object.assign(el("div", { className: `v2-listitem${i === stepIdx ? " active" : ""}` }, [
        el("b", { textContent: s.label }), el("small", { textContent: String(s.summary || "").trim() ? "사이트 문구 있음" : "사이트 문구 없음" }),
      ]), { onclick: () => { stepIdx = i; draw(); } })) : [empty(view === 1 && !teacherPick.value ? "이 과목에 승인된 강사 커리큘럼이 없습니다." : "단계가 없습니다.")]));
    const area = (label, text) => [el("p", { className: "v2-label", textContent: label }), el("textarea", { className: "v2-textarea", value: text || "", readOnly: true })];
    middle.replaceChildren(head(view === 2 ? "사이트용 학과 커리큘럼 문구" : step ? step.label : "단계를 고르세요", `현재 층: ${LAYER[view]}`, [chip("보기 전용", "vacation")]),
      el("div", { className: "v2-panel-body" }, view === 2 ? [
        ...area("학과 커리큘럼 문구(사이트 '학과 커리큘럼'에 보임)", subject?.dept_curriculum),
        el("p", { className: "v2-label", textContent: "단계별 사이트 요약" }),
        ...(steps.length ? steps.map((s) => el("div", { className: "v2-mini-card" }, [el("b", { textContent: s.label }), el("small", { textContent: s.summary || "(없음)" })])) : [empty("단계가 없습니다.")]),
      ] : step ? [
        el("div", { className: "v2-editor-card" }, [el("h4", { textContent: step.label }), ...area("상세 원문", step.written)]),
        el("div", { className: "v2-editor-card" }, [el("h4", { textContent: "사이트 노출용 요약" }), ...area("", step.summary),
          el("div", { className: "v2-actions" }, [locked("AI 요약 제안", "아래 편집 화면에서 AI로 만듭니다"), chip("사람 검토 후 사용", "warn")])]),
        el("div", { className: "v2-mini-card" }, [el("b", { textContent: "미디어" }), el("small", { textContent: step.image ? "대표 이미지" : "이미지 없음" }),
          ...(step.image ? [el("img", { className: "v2-thumb wide", src: driveThumbnail(step.image) || step.image, alt: "" })] : [])]),
        hint("고친 내용은 승인된 원본에 저장되고, 공개 사이트는 '사이트 반영' 후 바뀝니다. 고치기는 아래 '커리큘럼 편집'에서 합니다."),
      ] : [empty("왼쪽에서 단계를 고르세요.")]));
    const teachers = [...new Set(approved.filter((r) => r.subject_id === subjPick.value).map((r) => r.instructor_id))];
    right.replaceChildren(
      panel("공개 사이트 미리보기", [el("div", { className: "v2-preview" }, [
        el("b", { textContent: `${subject?.name ?? ""}${step && view !== 2 ? ` · ${step.label}` : ""}` }),
        step?.image && view !== 2 ? el("img", { className: "v2-thumb wide", src: driveThumbnail(step.image) || step.image, alt: "" }) : el("div", { className: "v2-preview-hero", textContent: "커리큘럼 이미지" }),
        el("span", { className: "muted", textContent: (view === 2 ? subject?.dept_curriculum : step?.summary) || "사이트 문구 없음" }),
      ])]),
      panel("연결 콘텐츠", teachers.length ? teachers.map((id) => {
        const mine = approved.filter((r) => r.subject_id === subjPick.value && r.instructor_id === id);
        return el("div", { className: "v2-mini-card" }, [el("b", { textContent: `${nameOf(instructors, id)} 강사` }),
          el("small", { textContent: `승인 ${mine.length}단계 · ${[...new Set(mine.map((r) => nameOf(sets, r.set_id)))].join(", ")}` })]);
      }) : [empty("승인된 강사 커리큘럼이 없습니다.")]),
    );
  }

  deptPick.addEventListener("change", () => { fillSubjects(); fillTeachers(); stepIdx = 0; draw(); });
  subjPick.addEventListener("change", () => { fillTeachers(); stepIdx = 0; draw(); });
  teacherPick.addEventListener("change", () => { stepIdx = 0; draw(); });
  fillSubjects(); fillTeachers();
  container.append(
    el("div", { className: "v2-panel v2-filter v2-bar" }, [el("span", { className: "v2-label", textContent: "학과" }), deptPick,
      el("span", { className: "v2-label", textContent: "과목" }), subjPick, teacherPick, el("div", { className: "v2-grow" }), ...viewBtns]),
    el("div", { className: "v2-grid3" }, [left, middle, right]),
    edit.node,
  );
  draw();
}
