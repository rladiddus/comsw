import { dbErrorMessage } from "./fields.mjs";

export const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
export function field(form, label, name, type = "text", value = "") {
  const input = type === "textarea"
    ? el("textarea", { name, value, rows: 5 })
    : el("input", { name, type, value });
  const wrap = el("label", { className: "form-field" }, [
    el("span", { textContent: label }),
    input,
  ]);
  form.append(wrap);
  return input;
}
export function stateLine(container) {
  const node = el("p", { className: "save-state" });
  node.setAttribute("role", "status");
  container.append(node);
  return (text, error = false) => {
    node.textContent = text;
    node.classList.toggle("err", error);
  };
}
export async function rpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(dbErrorMessage(error));
  return data;
}
export async function rows(supabase, table, filter = (q) => q) {
  const { data, error } = await filter(supabase.from(table).select("*"));
  if (error) throw new Error(dbErrorMessage(error));
  return data || [];
}

// 같은 이름 강사 구분: "시각편집학과, AI학과 · 포토샵, 일러스트, 포토웍스 외 8개"
export function instructorHint({ departments = [], subjects = [] }) {
  const more = subjects.length > 3 ? ` 외 ${subjects.length - 3}개` : "";
  return [
    departments.join(", "),
    subjects.length ? subjects.slice(0, 3).join(", ") + more : "",
  ].filter(Boolean).join(" · ") || "학과·과목 정보 없음";
}

// 강사 id → "학과 · 과목 3개 외 N개". 후보 RPC(comsw_instructor_candidates)와 같은 순서.
export async function instructorHints(supabase) {
  const [links, departments, subjectLinks, subjects] = await Promise.all([
    rows(supabase, "instructor_departments"),
    rows(supabase, "departments"),
    rows(supabase, "instructor_subjects"),
    rows(supabase, "subjects"),
  ]);
  const order = (a, b) => (a ?? Infinity) - (b ?? Infinity);
  return (id) => {
    const depts = links.filter((l) => l.instructor_id === id)
      .map((l) => departments.find((d) => d.id === l.department_id))
      .filter(Boolean).sort((a, b) =>
        order(a.sort_order, b.sort_order) || a.name.localeCompare(b.name)
      );
    const subs = subjectLinks.filter((l) => l.instructor_id === id)
      .map((l) => ({ l, s: subjects.find((s) => s.id === l.subject_id) }))
      .filter((x) => x.s).sort((a, b) =>
        order(a.l.sort_order, b.l.sort_order) ||
        order(a.s.sort_order, b.s.sort_order) ||
        a.s.name.localeCompare(b.s.name)
      );
    return instructorHint({
      departments: depts.map((d) => d.name),
      subjects: subs.map((x) => x.s.name),
    });
  };
}

// 강사 정보가 없는 선생님(관리자가 '계정 연결'로 잇지 않은 새 선생님)은 쌤톡 이름으로 본인 강사 정보를 만든다.
// 새 강사 정보는 사이트에 표시하지 않은 채 시작하고, 커리큘럼 승인 때 학과·과목이 붙는다.
export async function requireInstructor({ supabase, uid, displayName = "", loadMyName }) {
  const mine = async () =>
    (await rows(supabase, "instructors", (q) => q.eq("account_uid", uid)))[0];
  const own = await mine();
  if (own) return own;
  loadMyName ??= (await import("./ssamtalk-members.mjs")).loadMyName;
  const name = String((await loadMyName(uid).catch(() => "")) || displayName)
    .trim();
  if (!name) {
    throw new Error(
      "쌤톡 이름을 확인할 수 없습니다. 관리자에게 계정 연결을 요청해주세요",
    );
  }
  // 예전에 남은 연결 요청이 있으면 새 강사 정보를 만들 수 없으므로 먼저 지운다.
  await supabase.from("instructor_link_requests").delete().eq("account_uid", uid);
  await rpc(supabase, "comsw_create_my_instructor", { p_name: name });
  return await mine();
}
