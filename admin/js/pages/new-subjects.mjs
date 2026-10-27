import { el, rows, rpc, stateLine } from "../teacher-workspace.mjs";

// 커리큘럼 관리 > 신규 과목 추가: 과목명과 학과를 정해 새 과목을 만든다(승인 없이 바로 전체수업 맨 뒤).
// 학과 커리큘럼·로드맵·선생님 수업 설정에 바로 나오고, 공개 사이트는 '사이트에 반영' 후.
// 선생님이 '+ 개월 추가'로 만든 승인 전 과목·안 쓰는 과목 정리는 학과 관리 › 과목 관리 › 정리 필요.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "신규 과목 추가" }),
    el("p", {
      className: "desc",
      textContent: "과목명과 학과를 정해 새 과목을 만듭니다. 승인 없이 바로 학과 커리큘럼 맨 뒤에 들어가고, 선생님은 '내 프로필 > 수업 설정'에서 골라 바로 커리큘럼을 쓸 수 있습니다(공개 사이트는 '사이트에 반영' 후). 승인 전 과목과 안 쓰는 과목은 학과 관리 > 과목 관리에서 정리합니다.",
    }),
  );
  const setState = stateLine(container);
  const depts = await rows(supabase, "departments", (q) => q.order("sort_order"));
  const name = el("input", { type: "text", placeholder: "예: 블렌더 기초" });
  name.setAttribute("aria-label", "과목명");
  const checks = depts.map((d) => {
    const box = el("input", { type: "checkbox", value: d.id });
    return [box, el("label", { className: "dept-choice" }, [box, el("span", { textContent: d.name })])];
  });
  const create = el("button", { type: "button", className: "publish-btn", textContent: "과목 만들기" });
  container.append(
    // 학과(한 줄씩 상자) → 과목명 순서.
    el("div", { className: "form-field" }, [el("span", { textContent: "학과" }), el("div", { className: "dept-choices" }, checks.map(([, l]) => l))]),
    el("label", { className: "form-field" }, [el("span", { textContent: "과목명" }), name]),
    el("div", { className: "form-actions" }, [create]),
  );

  create.addEventListener("click", async () => {
    const title = name.value.trim();
    const chosen = checks.filter(([b]) => b.checked).map(([b]) => b.value);
    if (!title) return setState("과목명을 입력해주세요", true);
    if (!chosen.length) return setState("학과를 하나 이상 골라주세요", true);
    create.disabled = true;
    try {
      // 과목과 학과 연결을 DB 함수 한 번으로(한쪽만 남지 않게), 순서는 DB가 맨 뒤로.
      await rpc(supabase, "comsw_create_subject", { p_name: title, p_department_ids: chosen });
      name.value = "";
      for (const [b] of checks) b.checked = false;
      setState(`'${title}' 과목을 만들었습니다. 학과 커리큘럼 맨 뒤에 들어갔습니다(공개 사이트는 '사이트에 반영' 후).`);
    } catch (e) {
      setState(e.message, true);
    } finally {
      create.disabled = false;
    }
  });
}
