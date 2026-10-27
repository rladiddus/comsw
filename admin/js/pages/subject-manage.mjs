import { el, rows, rpc, stateLine } from "../teacher-workspace.mjs";
import { cascadeMessage } from "../format.mjs";

// 학과 관리 > 과목 관리: '학과별 보기'(학과마다 과목과 쓰임새)와 '정리 필요'(학과에는 있지만 승인 전이거나 커리큘럼이 없는 과목).
// 학과가 하나도 없는 과목은 커리큘럼 관리 › 기타 과목에서 다룬다(같은 역할을 두 번 만들지 않음, 사용자 결정).
// 사용처 개수는 DB 함수 하나(comsw_subject_usage)로, 지우기는 DB가 사용처 개수를 다시 센다(comsw_delete_subjects).
const USES = [
  ["weeks", "학과 커리큘럼 단계"], ["approved", "승인된 강사 커리큘럼"], ["pending", "승인 대기 강사 커리큘럼"],
  ["vacation", "방학 특강 커리큘럼"], ["instructors", "담당 강사 연결"], ["materials", "강사별 프로그램·준비물"],
  ["prep", "수업별 준비물"], ["roadmap", "로드맵 연결"],
];
const written = (u) => u.weeks + u.approved + u.pending + u.vacation;
const seen = (u) => USES.reduce((n, [k]) => n + u[k], 0);

export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "과목 관리" }),
    el("p", {
      className: "desc",
      textContent: "학과별로 과목과 쓰임새를 봅니다. '정리 필요'에서는 학과 커리큘럼에 아직 안 들어간 과목을 바로 넣거나, 커리큘럼이 없는 과목을 지웁니다. 학과가 없는 과목은 커리큘럼 관리 > 기타 과목에서 다룹니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links, usage] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
    rpc(supabase, "comsw_subject_usage", {}),
  ]);
  const zero = Object.fromEntries(USES.map(([k]) => [k, 0]));
  const useOf = (s) => ({ ...zero, ...(usage || []).find((u) => u.subject_id === s.id) });
  const deptsOf = (s) => depts.filter((d) => links.some((l) => l.subject_id === s.id && l.department_id === d.id));
  const byOrder = (a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.name.localeCompare(b.name, "ko");
  const summary = (u) => USES.filter(([k]) => u[k] > 0).map(([k, label]) => `${label} ${u[k]}`).join(" · ") || "쓰는 곳 없음";

  const modes = el("div", { className: "segmented", role: "group" });
  const body = el("div", { className: "subject-manage" });
  container.append(modes, body);
  let mode = "dept";
  for (const [key, text] of [["dept", "학과별 보기"], ["cleanup", "정리 필요"]]) {
    const b = el("button", { type: "button", textContent: text });
    b.dataset.mode = key;
    b.addEventListener("click", () => {
      mode = key;
      draw();
    });
    modes.append(b);
  }

  function deptView() {
    return depts.map((d) => {
      const mine = subjects.filter((s) => links.some((l) => l.subject_id === s.id && l.department_id === d.id)).sort(byOrder);
      return el("section", { className: "workspace-card manage-dept" }, [
        el("h3", { textContent: `${d.name} · ${mine.length}개` }),
        ...(mine.length
          ? mine.map((s) => el("div", { className: "manage-row" }, [
            el("strong", { textContent: s.name }),
            ...(s.sort_order == null ? [el("span", { className: "status-pill pending", textContent: "승인 전" })] : []),
            el("span", { className: "muted", textContent: summary(useOf(s)) }),
          ]))
          : [el("p", { className: "muted", textContent: "과목이 없습니다." })]),
      ]);
    });
  }

  async function activate(s, button) {
    button.disabled = true;
    try {
      await rpc(supabase, "comsw_activate_subject", { p_id: s.id });
      s.sort_order = subjects.reduce((m, x) => Math.max(m, x.sort_order ?? -1), -1) + 1;
      setState(`'${s.name}'을(를) 학과 커리큘럼 맨 뒤에 넣었습니다(공개 사이트는 '사이트에 반영' 후).`);
      draw();
    } catch (e) {
      setState(e.message, true);
      button.disabled = false;
    }
  }

  async function remove(s, button) {
    const u = useOf(s);
    if (!confirm(cascadeMessage("과목", s.name, USES.map(([k, label]) => [label, u[k]])))) return;
    button.disabled = true;
    try {
      // 확인창에 보여 준 사용처 개수를 DB가 다시 세어, 그 사이 바뀌었으면 지우지 않는다.
      await rpc(supabase, "comsw_delete_subjects", { p_ids: [s.id], p_seen: seen(u) });
      subjects.splice(subjects.indexOf(s), 1);
      setState(`'${s.name}' 과목을 삭제했습니다. 공개 사이트에서는 '사이트에 반영' 후 빠집니다.`);
      draw();
    } catch (e) {
      setState(e.message, true);
      button.disabled = false;
    }
  }

  function cleanupView() {
    const list = subjects.filter((s) => deptsOf(s).length && (s.sort_order == null || !written(useOf(s)))).sort(byOrder);
    if (!list.length) return [el("p", { className: "muted", textContent: "정리할 과목이 없습니다." })];
    return [el("section", { className: "workspace-card" }, [
      el("h3", { textContent: `정리 필요 ${list.length}개` }),
      ...list.map((s) => {
        const u = useOf(s);
        const reasons = [
          ...(s.sort_order == null ? ["승인 전(학과 커리큘럼에 안 나옴)"] : []),
          ...(!written(u) ? ["커리큘럼 없음"] : []),
        ];
        const actions = [];
        if (s.sort_order == null) {
          const put = el("button", { type: "button", className: "ghost-btn", textContent: "학과 커리큘럼에 넣기" });
          put.addEventListener("click", () => activate(s, put));
          actions.push(put);
        }
        const del = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
        del.addEventListener("click", () => remove(s, del));
        actions.push(del);
        return el("div", { className: "manage-row" }, [
          el("strong", { textContent: s.name }),
          el("span", { textContent: deptsOf(s).map((d) => d.name).join(", ") }),
          ...reasons.map((r) => el("span", { className: "status-pill pending", textContent: r })),
          el("span", { className: "muted", textContent: summary(u) }),
          el("span", { className: "manage-actions" }, actions),
        ]);
      }),
    ])];
  }

  function draw() {
    for (const b of modes.children) b.classList.toggle("active", b.dataset.mode === mode);
    body.replaceChildren(...(mode === "dept" ? deptView() : cleanupView()));
  }
  draw();
}
