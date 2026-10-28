import { el, rows } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { groupRequests } from "./dashboard.mjs";

// 승인 대기 › 전체: 종류가 달라도 한 목록으로 본다. 줄을 누르면 그 종류의 탭(기존 승인 화면)으로 간다.
export async function render(container, { supabase }) {
  const [pending, drafts, instructors, subjects, sets] = await Promise.all([
    rows(supabase, "instructor_curricula", (q) => q.eq("status", "pending")),
    rows(supabase, "instructor_profile_drafts", (q) => q.eq("status", "pending")),
    rows(supabase, "instructors"),
    rows(supabase, "subjects"),
    rows(supabase, "curriculum_sets"),
  ]);
  const name = (list, id) => list.find((x) => x.id === id)?.name ?? "";
  const items = [
    ...groupRequests(pending).map((g) => ({
      tab: g.vacation ? "vacation" : "curricula", type: g.vacation ? "방학 특강" : "커리큘럼", at: g.at,
      title: `${name(subjects, g.subject_id)} · ${g.steps}단계`,
      who: `${name(instructors, g.instructor_id)} 선생님${g.vacation ? "" : ` · ${name(sets, g.set_id)}`}`,
    })),
    ...drafts.map((d) => ({ tab: "profiles", type: "프로필", at: d.updated_at, title: "프로필 변경", who: `${name(instructors, d.instructor_id)} 선생님` })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const goTab = (tab) => container.closest(".v2-body")?.querySelector(`.tab-bar [data-tab="${tab}"]`)?.click();
  container.append(
    el("p", { className: "v2-desc", textContent: `승인할 것 ${items.length}건. 줄을 누르면 그 종류의 승인 화면으로 갑니다. 승인한 내용은 '사이트 반영'을 해야 공개 사이트에 보입니다.` }),
    items.length
      ? el("div", { className: "v2-table-wrap" }, [el("table", { className: "v2-table" }, [
        el("thead", {}, [el("tr", {}, ["종류", "내용", "보낸 사람", "보낸 시각", ""].map((t) => el("th", { textContent: t })))]),
        el("tbody", {}, items.map((it) => {
          const tr = el("tr", {}, [
            el("td", {}, [el("span", { className: `v2-chip ${it.tab}`, textContent: it.type })]),
            el("td", { className: "v2-strong", textContent: it.title }),
            el("td", { textContent: it.who }),
            el("td", { className: "muted", textContent: it.at ? formatSeoul(it.at) : "" }),
            el("td", {}, [el("button", { type: "button", className: "v2-mini-btn", textContent: "검토" })]),
          ]);
          tr.addEventListener("click", () => goTab(it.tab));
          return tr;
        })),
      ])])
      : el("p", { className: "v2-empty", textContent: "승인 대기 중인 것이 없습니다." }),
  );
}
