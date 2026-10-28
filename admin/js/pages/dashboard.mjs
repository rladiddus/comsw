import { el } from "../teacher-workspace.mjs";

// 대시보드: 지금 숫자와, 누르면 그 일을 하는 메뉴로 간다. 세지 못한 칸은 0이 아니라 '—'.
const count = async (supabase, table, filter = (q) => q) => {
  const { count, error } = await filter(supabase.from(table).select("*", { count: "exact", head: true }));
  return error || typeof count !== "number" ? null : count;
};

export async function render(container, { supabase }) {
  const [listed, drafts, depts, subjects, pending, vacation] = await Promise.all([
    count(supabase, "instructors", (q) => q.eq("is_listed", true)),
    count(supabase, "instructor_profile_drafts", (q) => q.eq("status", "pending")),
    count(supabase, "departments"),
    count(supabase, "subjects"),
    count(supabase, "instructor_curricula", (q) => q.eq("status", "pending").eq("vacation", false)),
    count(supabase, "instructor_curricula", (q) => q.eq("status", "pending").eq("vacation", true)),
  ]);
  const card = (label, n, unit, href, note = "", alert = false) =>
    el("a", { className: `dash-card${alert && n ? " alert" : ""}`, href }, [
      el("span", { className: "dash-label", textContent: label }),
      el("strong", { className: "dash-num", textContent: n === null ? "—" : `${n}${unit}` }),
      ...(note ? [el("span", { className: "dash-note", textContent: note })] : []),
    ]);
  container.append(
    el("h2", { textContent: "대시보드" }),
    el("h3", { textContent: "강사" }),
    el("div", { className: "dash-row" }, [
      card("현재 강사", listed, "명", "#/instructors", "사이트에 보이는 강사"),
      card("신규 신청 강사", drafts, "명", "#/instructors", "강사 관리 › 승인 대기", true),
    ]),
    el("h3", { textContent: "학과·과목·커리큘럼" }),
    el("div", { className: "dash-row" }, [
      card("현재 학과", depts, "개", "#/departments"),
      card("전체 과목", subjects, "개", "#/curriculum-admin"),
      card("검토할 커리큘럼", pending, "건", "#/curriculum-admin",
        vacation ? `커리큘럼 관리 › 신청 과목 (방특 ${vacation}건은 방학 특강)` : "커리큘럼 관리 › 신청 과목", true),
    ]),
  );
}
