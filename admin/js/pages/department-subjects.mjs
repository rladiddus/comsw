import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";

// 학과 > 학과별 과목: 학과를 고르면 그 학과의 과목이 나온다('과목·단계'의 학과 칸과 같은 연결표).
// 여기서 과목을 더하거나 빼면 과목·단계 화면과 선생님 수업 설정의 과목 목록에도 그대로 반영된다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과별 과목" }),
    el("p", {
      className: "desc",
      textContent: "학과를 고르면 그 학과에 들어간 과목이 나옵니다. 과목을 더하거나 빼면 '과목·단계'의 학과 칸에도 반영됩니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
  ]);
  const dept = el("select", {}, depts.map((d) => el("option", { value: d.id, textContent: d.name })));
  dept.setAttribute("aria-label", "학과");
  const list = el("div", { className: "dept-subjects" });
  container.append(
    el("label", { className: "form-field settings-select" }, [el("span", { textContent: "학과" }), dept]),
    list,
  );
  const inDept = () => subjects.filter((s) => links.some((l) => l.department_id === dept.value && l.subject_id === s.id));

  async function add(subjectId) {
    const { error } = await supabase.from("subject_departments").insert({ subject_id: subjectId, department_id: dept.value });
    if (error) return setState(dbErrorMessage(error), true);
    links.push({ subject_id: subjectId, department_id: dept.value });
    setState("과목을 더했습니다");
    draw();
  }
  async function remove(subject) {
    const name = depts.find((d) => d.id === dept.value)?.name;
    if (!confirm(`'${name}'에서 '${subject.name}' 과목을 뺄까요? (과목 자체는 지워지지 않습니다)`)) return;
    const { error } = await supabase.from("subject_departments").delete()
      .eq("subject_id", subject.id).eq("department_id", dept.value);
    if (error) return setState(dbErrorMessage(error), true);
    links.splice(links.findIndex((l) => l.subject_id === subject.id && l.department_id === dept.value), 1);
    setState("과목을 뺐습니다");
    draw();
  }
  function draw() {
    const mine = inDept();
    const rest = subjects.filter((s) => !mine.includes(s));
    const pick = el("select", { className: "link-pick" }, [
      el("option", { value: "", textContent: "+ 과목 추가" }),
      ...rest.map((s) => el("option", { value: s.id, textContent: s.name })),
    ]);
    pick.setAttribute("aria-label", "과목 추가");
    pick.addEventListener("change", () => pick.value && add(pick.value));
    list.replaceChildren(
      el("p", { className: "muted", textContent: `과목 ${mine.length}개` }),
      el("div", { className: "subject-checks" }, mine.map((s) => {
        const x = el("button", { type: "button", className: "ghost-btn danger", textContent: "빼기" });
        x.addEventListener("click", () => remove(s));
        return el("div", { className: "dept-subject" }, [el("span", { textContent: s.name }), x]);
      })),
      el("div", { className: "form-actions" }, [pick]),
    );
  }
  dept.addEventListener("change", () => {
    setState("");
    draw();
  });
  draw();
}
