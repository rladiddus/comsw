import { el, rows } from "../../../admin/js/teacher-workspace.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { panel } from "./dashboard.mjs";

// 과목 관리 › 전체 과목: 흩어져 있던 과목(학과 과목·신규·기타·방특)을 한 목록에서 찾는다. 보기 전용 —
// 고치는 곳은 옆 탭(과목 정보·학과별 과목·신규·기타)으로 안내한다.
const pick = async (supabase, table, cols) => {
  const { data, error } = await supabase.from(table).select(cols);
  if (error) throw new Error(dbErrorMessage(error));
  return data || [];
};

export function subjectState(s, deptIds, weekCount) {
  if (s.is_vacation && !deptIds.length) return ["방학 특강", "vacation"];
  if (!deptIds.length) return ["기타(학과 없음)", "other"];
  if (!weekCount) return ["단계 없음", "warn"];
  return ["학과 수업", "good"];
}

export async function render(container, { supabase }) {
  const [subjects, depts, links, weeks, curricula, steps, prep] = await Promise.all([
    rows(supabase, "subjects", (q) => q.order("sort_order", { nullsFirst: false }).order("name")),
    rows(supabase, "departments", (q) => q.order("sort_order")),
    pick(supabase, "subject_departments", "subject_id, department_id"),
    pick(supabase, "subject_weeks", "subject_id"),
    pick(supabase, "instructor_curricula", "subject_id, instructor_id, status"),
    pick(supabase, "roadmap_step_subjects", "subject_id"),
    pick(supabase, "course_prep_items", "subject_id"),
  ]);
  const count = (list, id) => list.filter((x) => x.subject_id === id).length;
  const info = subjects.map((s) => {
    const deptIds = links.filter((l) => l.subject_id === s.id).map((l) => l.department_id);
    const weekCount = count(weeks, s.id);
    const teachers = new Set(curricula.filter((c) => c.subject_id === s.id && c.status === "approved").map((c) => c.instructor_id));
    return { s, deptIds, weekCount, teachers: teachers.size, state: subjectState(s, deptIds, weekCount) };
  });
  const deptName = (id) => depts.find((d) => d.id === id)?.name ?? "";

  const search = el("input", { type: "search", className: "v2-field", placeholder: "과목 이름 검색" });
  const deptPick = el("select", { className: "v2-field" }, [
    el("option", { value: "", textContent: "모든 학과" }),
    ...depts.map((d) => el("option", { value: d.id, textContent: d.name })),
    el("option", { value: "none", textContent: "학과 없음" }),
  ]);
  const statePick = el("select", { className: "v2-field" }, [
    el("option", { value: "", textContent: "모든 상태" }),
    ...[["good", "학과 수업"], ["warn", "단계 없음"], ["other", "기타(학과 없음)"], ["vacation", "방학 특강"]]
      .map(([v, t]) => el("option", { value: v, textContent: t })),
  ]);
  [search, deptPick, statePick].forEach((x) => x.setAttribute("aria-label", x.placeholder || "필터"));
  const total = el("span", { className: "muted" });
  const tbody = el("tbody");
  const detail = el("div");
  const goTab = (tab) => container.closest(".v2-body")?.querySelector(`.tab-bar [data-tab="${tab}"]`)?.click();
  let selected = null;

  function showDetail(it) {
    selected = it.s.id;
    const used = [
      ["단계(학과 커리큘럼)", it.weekCount], ["강사 커리큘럼", count(curricula, it.s.id)],
      ["로드맵", count(steps, it.s.id)], ["수업별 준비물", count(prep, it.s.id)],
    ];
    const btn = (text, tab) => Object.assign(el("button", { type: "button", className: "ghost-btn", textContent: text }), { onclick: () => goTab(tab) });
    detail.replaceChildren(panel(it.s.name, [
      el("dl", { className: "v2-dl" }, [
        el("dt", { textContent: "상태" }), el("dd", {}, [el("span", { className: `v2-chip ${it.state[1]}`, textContent: it.state[0] })]),
        el("dt", { textContent: "기간" }), el("dd", { textContent: it.s.duration || "—" }),
        el("dt", { textContent: "수준" }), el("dd", { textContent: it.s.level || "—" }),
        el("dt", { textContent: "학과" }), el("dd", { textContent: it.deptIds.map(deptName).join(", ") || "연결된 학과 없음" }),
      ]),
      el("h4", { textContent: "쓰이는 곳" }),
      el("ul", { className: "v2-uses" }, used.map(([k, n]) => el("li", {}, [el("span", { textContent: k }), el("b", { textContent: `${n}` })]))),
      el("p", { className: "v2-hint", textContent: "지금은 모든 학과가 과목 순서 하나를 같이 씁니다. 학과마다 다른 순서는 다음 단계(DB 변경)에서 이곳에 추가합니다." }),
      el("div", { className: "v2-actions" }, [btn("과목 정보 고치기", "manage"), btn("학과 연결 바꾸기", "by-dept"),
        ...(it.deptIds.length ? [] : [btn("기타 과목에서 보기", "other")])]),
    ], "고치는 곳은 아래 버튼으로 이동합니다."));
    for (const tr of tbody.children) tr.classList.toggle("selected", tr.dataset.id === selected);
  }

  function draw() {
    const q = search.value.trim().toLowerCase();
    const list = info.filter((it) =>
      (!q || it.s.name.toLowerCase().includes(q))
      && (!deptPick.value || (deptPick.value === "none" ? !it.deptIds.length : it.deptIds.includes(deptPick.value)))
      && (!statePick.value || it.state[1] === statePick.value));
    total.textContent = `${list.length}개 / 전체 ${info.length}개`;
    tbody.replaceChildren(...list.map((it) => {
      const tr = el("tr", {}, [
        el("td", { className: "v2-strong", textContent: it.s.name }),
        el("td", { textContent: it.deptIds.map(deptName).join(", ") || "—" }),
        el("td", { textContent: it.s.duration || "—" }),
        el("td", { textContent: `${it.weekCount}단계` }),
        el("td", { textContent: `${it.teachers}명` }),
        el("td", {}, [el("span", { className: `v2-chip ${it.state[1]}`, textContent: it.state[0] })]),
      ]);
      tr.dataset.id = it.s.id;
      tr.classList.toggle("selected", it.s.id === selected);
      tr.addEventListener("click", () => showDetail(it));
      return tr;
    }));
  }
  search.addEventListener("input", draw);
  deptPick.addEventListener("change", draw);
  statePick.addEventListener("change", draw);

  container.append(el("div", { className: "v2-grid2" }, [
    el("section", { className: "v2-panel" }, [
      el("div", { className: "v2-filter" }, [search, deptPick, statePick, total]),
      el("div", { className: "v2-table-wrap" }, [el("table", { className: "v2-table" }, [
        el("thead", {}, [el("tr", {}, ["과목", "학과", "기간", "단계", "강사", "상태"].map((t) => el("th", { textContent: t })))]),
        tbody,
      ])]),
    ]),
    detail,
  ]));
  draw();
  if (info.length) showDetail(info[0]);
}
