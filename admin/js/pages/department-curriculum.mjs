import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { getServices } from "../services.mjs";

// 커리큘럼 관리 > 학과 커리큘럼: 학과를 고르면 그 학과 과목마다 '학과별 커리큘럼 요약'(사이트 학과 커리큘럼 문구)을
// 보고 '수정'으로 고친다. 'AI 생성'은 그 과목의 단계별 요약으로 만든다('과목·단계'의 AI 요약과 같은 방식).
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "학과 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent: "학과를 고르면 그 학과 과목의 학과 커리큘럼 문구가 나옵니다. '수정'으로 고치거나 AI로 다시 만들 수 있습니다.",
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
  const list = el("div", { className: "dept-curriculum" });
  container.append(
    el("label", { className: "form-field settings-select" }, [el("span", { textContent: "학과" }), dept]),
    list,
  );

  function card(subject) {
    const text = el("textarea", { value: subject.dept_curriculum ?? "", rows: 3, readOnly: true });
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
        text.value = (await fn("department", source)).text;
        setState("만들었습니다. 확인 후 '저장'을 눌러주세요.");
      } catch (e) {
        setState(e.message, true);
      } finally {
        gen.disabled = false;
      }
    });
    edit.addEventListener("click", async () => {
      if (text.readOnly) {
        text.readOnly = false;
        gen.hidden = false;
        edit.textContent = "저장";
        edit.className = "publish-btn";
        return;
      }
      edit.disabled = true;
      const value = text.value.trim() || null;
      const { error } = await supabase.from("subjects").update({ dept_curriculum: value }).eq("id", subject.id);
      edit.disabled = false;
      if (error) return setState(dbErrorMessage(error), true);
      subject.dept_curriculum = value;
      text.readOnly = true;
      gen.hidden = true;
      edit.textContent = "수정";
      edit.className = "ghost-btn";
      setState(`'${subject.name}' 학과 커리큘럼을 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    });
    return el("article", { className: "dept-curriculum-item" }, [
      el("h4", { textContent: subject.name }),
      text,
      el("div", { className: "media-actions" }, [gen, edit]),
    ]);
  }
  function draw() {
    const mine = subjects.filter((s) => links.some((l) => l.department_id === dept.value && l.subject_id === s.id));
    list.replaceChildren(...(mine.length
      ? mine.map(card)
      : [el("p", { className: "muted", textContent: "이 학과에 들어간 과목이 없습니다. '학과 > 학과별 과목'에서 더해주세요." })]));
  }
  dept.addEventListener("change", () => {
    setState("");
    draw();
  });
  draw();
}
