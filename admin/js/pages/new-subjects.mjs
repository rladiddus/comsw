import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";

// 커리큘럼 관리 > 신규 과목 추가: 과목명과 학과를 정해 새 과목을 만든다(전체수업 순서 없음).
// 선생님이 '내 프로필 > 수업 설정'에서 이 과목을 고르면 커리큘럼을 쓸 수 있고, 첫 커리큘럼을 승인하면
// DB가 전체수업 맨 뒤에 넣어 학과 커리큘럼·로드맵·강사 커리큘럼에 나온다. 그 전까지는 아래 '승인 기다리는 과목'에만 보인다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "신규 과목 추가" }),
    el("p", {
      className: "desc",
      textContent: "과목명과 학과를 정해 새 과목을 만듭니다. 선생님이 '내 프로필 > 수업 설정'에서 이 과목을 고르고 커리큘럼을 내면 '신청 과목'에서 승인할 수 있고, 승인하면 학과 커리큘럼·로드맵·강사 커리큘럼에 나옵니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("name")),
    rows(supabase, "subject_departments"),
  ]);
  const name = el("input", { type: "text", placeholder: "예: 블렌더 기초" });
  name.setAttribute("aria-label", "과목명");
  const checks = depts.map((d) => {
    const box = el("input", { type: "checkbox", value: d.id });
    return [box, el("label", { className: "consent" }, [box, el("span", { textContent: d.name })])];
  });
  const create = el("button", { type: "button", className: "publish-btn", textContent: "과목 만들기" });
  const list = el("div", { className: "new-subjects" });
  container.append(
    el("label", { className: "form-field" }, [el("span", { textContent: "과목명" }), name]),
    el("div", { className: "form-field" }, [el("span", { textContent: "학과" }), el("div", { className: "subject-checks" }, checks.map(([, l]) => l))]),
    el("div", { className: "form-actions" }, [create]),
    list,
  );

  create.addEventListener("click", async () => {
    const title = name.value.trim();
    const chosen = checks.filter(([b]) => b.checked).map(([b]) => b.value);
    if (!title) return setState("과목명을 입력해주세요", true);
    if (!chosen.length) return setState("학과를 하나 이상 골라주세요", true);
    create.disabled = true;
    try {
      const { data, error } = await supabase.from("subjects").insert({ name: title }).select().single();
      if (error) throw error;
      const made = chosen.map((department_id) => ({ subject_id: data.id, department_id }));
      const { error: linkError } = await supabase.from("subject_departments").insert(made);
      if (linkError) throw linkError;
      subjects.push(data);
      links.push(...made);
      name.value = "";
      for (const [b] of checks) b.checked = false;
      setState(`'${title}' 과목을 만들었습니다. 선생님 커리큘럼을 승인하면 학과 커리큘럼에 나옵니다.`);
      draw();
    } catch (error) {
      setState(dbErrorMessage(error, { duplicate: "같은 이름의 과목이 이미 있습니다" }), true);
    } finally {
      create.disabled = false;
    }
  });

  async function remove(subject) {
    const message = cascadeMessage("과목", subject.name, [
      ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "subject_id", subject.id)],
      ["강사 담당 과목", await countRows(supabase, "instructor_subjects", "subject_id", subject.id)],
    ]);
    if (!confirm(message)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    if (error) return setState(dbErrorMessage(error), true);
    subjects.splice(subjects.indexOf(subject), 1);
    setState(`'${subject.name}' 과목을 삭제했습니다`);
    draw();
  }

  // 승인 기다리는 과목 = 학과 연결은 있고 전체수업 순서는 없는 과목.
  function draw() {
    const waiting = subjects.filter((s) => s.sort_order == null && links.some((l) => l.subject_id === s.id));
    const deptNames = (s) => depts.filter((d) => links.some((l) => l.subject_id === s.id && l.department_id === d.id)).map((d) => d.name).join(", ");
    list.replaceChildren(
      el("h3", { textContent: `승인 기다리는 과목 ${waiting.length}개` }),
      ...(waiting.length
        ? waiting.map((s) => {
          const x = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
          x.addEventListener("click", () => remove(s));
          return el("div", { className: "dept-subject" }, [el("span", { textContent: `${s.name} · ${deptNames(s)}` }), x]);
        })
        : [el("p", { className: "muted", textContent: "없습니다." })]),
    );
  }
  draw();
}
