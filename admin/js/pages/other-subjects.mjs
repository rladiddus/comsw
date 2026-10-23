import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";
import { showWeeks } from "../subject-weeks.mjs";

// 커리큘럼 관리 > 기타 과목: 어느 학과에도 없는 과목(사이트 '전체 수업'에 안 나옴, 강사 커리큘럼·준비물·방학 특강 등에서 씀).
// '수정'으로 과목명·기간, '단계'로 과목 단계, '학과에 넣기'로 학과 커리큘럼(전체수업 맨 뒤)에 보내고, '삭제'로 과목을 지운다.
// 학과 커리큘럼에서 마지막 학과까지 빼면 여기로 온다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "기타 과목" }),
    el("p", {
      className: "desc",
      textContent: "어느 학과에도 들어 있지 않아 사이트 '전체 수업'에 나오지 않는 과목입니다. 강사 커리큘럼·수업별 준비물 등에서 쓰입니다. '학과에 넣기'를 하면 그 학과 커리큘럼 맨 뒤로 옮겨집니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
  ]);
  const list = el("div", { className: "other-subjects" });
  const weeks = el("section", { className: "subject-weeks" });
  container.append(list, weeks);

  function row(subject) {
    const name = el("input", { type: "text", value: subject.name, readOnly: true });
    name.setAttribute("aria-label", "과목명");
    const duration = el("input", { type: "text", value: subject.duration ?? "", readOnly: true, placeholder: "기간" });
    duration.setAttribute("aria-label", "기간");
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    edit.addEventListener("click", async () => {
      if (name.readOnly) {
        name.readOnly = duration.readOnly = false;
        edit.textContent = "저장";
        edit.className = "publish-btn";
        return;
      }
      if (!name.value.trim()) return setState("과목명을 입력해주세요", true);
      const patch = { name: name.value.trim(), duration: duration.value.trim() || null };
      const { error } = await supabase.from("subjects").update(patch).eq("id", subject.id);
      if (error) return setState(dbErrorMessage(error, { duplicate: "같은 이름의 과목이 이미 있습니다" }), true);
      Object.assign(subject, patch);
      name.readOnly = duration.readOnly = true;
      edit.textContent = "수정";
      edit.className = "ghost-btn";
      setState(`'${subject.name}'을(를) 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    });
    const stepsBtn = el("button", { type: "button", className: "ghost-btn", textContent: "단계" });
    stepsBtn.addEventListener("click", () => showWeeks(weeks, supabase, subject));
    const deptPick = el("select", {}, [
      el("option", { value: "", textContent: "학과 고르기" }),
      ...depts.map((d) => el("option", { value: d.id, textContent: d.name })),
    ]);
    deptPick.setAttribute("aria-label", "넣을 학과");
    const move = el("button", { type: "button", className: "ghost-btn", textContent: "학과에 넣기" });
    move.addEventListener("click", async () => {
      if (!deptPick.value) return setState("넣을 학과를 골라주세요", true);
      const link = { subject_id: subject.id, department_id: deptPick.value };
      let { error } = await supabase.from("subject_departments").insert(link);
      const sort_order = subjects.reduce((m, s) => Math.max(m, s.sort_order ?? -1), -1) + 1;
      if (!error) ({ error } = await supabase.from("subjects").update({ sort_order }).eq("id", subject.id));
      if (error) return setState(dbErrorMessage(error), true);
      links.push(link);
      subject.sort_order = sort_order;
      setState(`'${subject.name}'을(를) ${deptPick.selectedOptions[0].textContent} 커리큘럼에 넣었습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
      draw();
    });
    const remove = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
    remove.addEventListener("click", async () => {
      const message = cascadeMessage("과목", subject.name, [
        ["단계", await countRows(supabase, "subject_weeks", "subject_id", subject.id)],
        ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "subject_id", subject.id)],
        ["강사 담당 과목", await countRows(supabase, "instructor_subjects", "subject_id", subject.id)],
        ["준비물", await countRows(supabase, "course_prep_items", "subject_id", subject.id)],
        ["로드맵 연결", await countRows(supabase, "roadmap_step_subjects", "subject_id", subject.id)],
      ]);
      if (!confirm(message)) return;
      const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
      if (error) return setState(dbErrorMessage(error), true);
      subjects.splice(subjects.indexOf(subject), 1);
      setState(`'${subject.name}' 과목을 삭제했습니다`);
      draw();
    });
    return el("div", { className: "other-subject-row" }, [name, duration, stepsBtn, deptPick, move, remove, edit]);
  }

  function draw() {
    const others = subjects
      .filter((s) => !links.some((l) => l.subject_id === s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    list.replaceChildren(
      el("p", { className: "muted", textContent: `기타 과목 ${others.length}개` }),
      ...(others.length ? others.map(row) : [el("p", { className: "muted", textContent: "기타 과목이 없습니다." })]),
    );
  }
  draw();
}
