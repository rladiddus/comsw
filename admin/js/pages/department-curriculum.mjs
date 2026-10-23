import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { getServices } from "../services.mjs";

// '과목·단계'의 과목 칸들(과목명·기간·학과별 커리큘럼 요약·프로그램·준비물·학습 수준)과 같은 데이터.
const COLUMNS = [
  ["name", "과목명", "input"],
  ["duration", "기간", "input"],
  ["dept_curriculum", "학과별 커리큘럼 요약", "textarea"],
  ["program", "프로그램·준비물", "textarea"],
  ["level", "학습 수준", "input"],
];

// 커리큘럼 관리 > 학과 커리큘럼: 학과를 고르면 그 학과 과목을 '과목·단계'와 같은 칸으로 보여 주고 줄마다 '수정'으로 고친다.
// '학과별 커리큘럼 요약'은 'AI 생성'(그 과목의 단계별 요약으로)도 된다. 신청 과목에서 '적용'한 문구가 여기 요약 칸으로 들어온다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent:
        "학과를 고르면 그 학과 과목이 나옵니다('과목·단계'와 같은 내용). 줄마다 '수정'으로 고칠 수 있고, 학과별 커리큘럼 요약은 AI로 다시 만들 수 있습니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links, weeks] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
    rows(supabase, "subject_weeks", (q) => q.order("sort_order")),
  ]);
  const dept = el("select", {}, depts.map((d) => el("option", { value: d.id, textContent: d.name })));
  dept.setAttribute("aria-label", "학과");
  const table = el("div", { className: "dept-curriculum-table" });
  container.append(
    el("label", { className: "form-field settings-select" }, [el("span", { textContent: "학과" }), dept]),
    table,
  );

  function row(subject) {
    const inputs = Object.fromEntries(COLUMNS.map(([key, , tag]) => [
      key,
      el(tag, { value: subject[key] ?? "", readOnly: true, ...(tag === "textarea" ? { rows: 3 } : { type: "text" }) }),
    ]));
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    const gen = el("button", { type: "button", className: "ghost-btn ai-btn", textContent: "AI 생성", hidden: true });
    gen.addEventListener("click", async () => {
      gen.disabled = true;
      try {
        const source = weeks.filter((w) => w.subject_id === subject.id).map((w) => w.summary || "").filter(Boolean).join("\n");
        if (!source) throw new Error("이 과목의 단계별 요약이 없습니다. '과목·단계'에서 먼저 단계를 정리해주세요");
        const fn = getServices().summarize;
        if (!fn) throw new Error("AI 연결을 준비 중입니다");
        setState("AI로 만드는 중…");
        inputs.dept_curriculum.value = (await fn("department", source)).text;
        setState("만들었습니다. 확인 후 '저장'을 눌러주세요.");
      } catch (e) {
        setState(e.message, true);
      } finally {
        gen.disabled = false;
      }
    });
    const setEditing = (on) => {
      for (const input of Object.values(inputs)) input.readOnly = !on;
      gen.hidden = !on;
      edit.textContent = on ? "저장" : "수정";
      edit.className = on ? "publish-btn" : "ghost-btn";
    };
    edit.addEventListener("click", async () => {
      if (inputs.name.readOnly) return setEditing(true);
      const patch = Object.fromEntries(COLUMNS.map(([key]) => [key, inputs[key].value.trim() || null]));
      if (!patch.name) return setState("과목명을 입력해주세요", true);
      edit.disabled = true;
      const { error } = await supabase.from("subjects").update(patch).eq("id", subject.id);
      edit.disabled = false;
      if (error) return setState(dbErrorMessage(error, { duplicate: "같은 이름의 과목이 이미 있습니다" }), true);
      Object.assign(subject, patch);
      setEditing(false);
      setState(`'${subject.name}'을(를) 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    });
    return el("div", { className: "dept-curriculum-row" }, [
      ...COLUMNS.map(([key, label]) =>
        el("div", { className: `dept-cell cell-${key}` }, [
          el("span", { className: "cell-label", textContent: label }),
          inputs[key],
          ...(key === "dept_curriculum" ? [gen] : []),
        ])
      ),
      el("div", { className: "dept-cell cell-actions" }, [edit]),
    ]);
  }
  function draw() {
    const mine = subjects.filter((s) => links.some((l) => l.department_id === dept.value && l.subject_id === s.id));
    table.replaceChildren(
      el("div", { className: "dept-curriculum-row dept-curriculum-head" },
        [...COLUMNS.map(([, label]) => el("span", { textContent: label })), el("span")]),
      ...(mine.length
        ? mine.map(row)
        : [el("p", { className: "muted", textContent: "이 학과에 들어간 과목이 없습니다. '학과 > 학과별 과목'에서 더해주세요." })]),
    );
  }
  dept.addEventListener("change", () => {
    setState("");
    draw();
  });
  draw();
}
