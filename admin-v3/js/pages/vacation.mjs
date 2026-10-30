import { el, pick, chip, btn, panel, empty, headActions, groupRequests, nameOf } from "../../../admin-v2/js/ui.mjs";
import { splitGrid, isEmployed } from "../v3.mjs";
import { thumb } from "./aggregate.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";

// 방학 특강(V3): 방학 특강(시기) 고르기·추가 + 강사 커리큘럼과 같은 모양(왼쪽 강사, 오른쪽 과목 → 단계별 이미지·커리큘럼).
// 선생님 방특 신청 승인(시기에 담기)은 '승인 대기'에서 한다.
export async function render(container, ctx) {
  const { supabase } = ctx;
  headActions(ctx);
  const [groups, setting, curricula, instructors, subjects] = await Promise.all([
    pick(supabase, "curriculum_sets", "id, name", (q) => q.eq("is_vacation", true).order("name")),
    pick(supabase, "site_settings", "key, value", (q) => q.eq("key", "vacation_set_id")),
    pick(supabase, "instructor_curricula", "instructor_id, set_id, subject_id, step_label, written, summary, media_url, status, vacation, sort_order, updated_at", (q) => q.eq("status", "approved")),
    pick(supabase, "instructors", "id, name, sort_order"),
    pick(supabase, "subjects", "id, name, sort_order"),
  ]);
  const siteSet = setting[0]?.value;
  const say = el("span", { className: "save-state" });
  const groupPick = el("select");
  groupPick.setAttribute("aria-label", "방학 특강");
  const fill = (value) => {
    groupPick.replaceChildren(...groups.map((g) => el("option", { value: g.id, textContent: g.id === siteSet ? `${g.name} (사이트에 나옴)` : g.name })));
    groupPick.value = value ?? (groups.some((g) => g.id === siteSet) ? siteSet : groups[0]?.id ?? "");
  };
  // 방학 특강 추가: 이름만 적어 만든다(기존 화면과 같음).
  const newName = el("input", { type: "text", placeholder: "예: 2027년 겨울방학특강" });
  newName.setAttribute("aria-label", "새 방학 특강 이름");
  const create = btn("만들기", async () => {
    const name = newName.value.trim();
    if (!name) { say.textContent = "방학 특강 이름을 입력해주세요"; say.classList.add("err"); return; }
    create.disabled = true;
    const { data, error } = await supabase.from("curriculum_sets").insert({ name, is_vacation: true }).select().single();
    create.disabled = false;
    if (error) { say.textContent = dbErrorMessage(error, { duplicate: "같은 이름이 이미 있습니다" }); say.classList.add("err"); return; }
    groups.push(data);
    fill(data.id);
    newName.value = ""; adding.hidden = true;
    say.textContent = `'${name}'을(를) 만들었습니다.`; say.classList.remove("err");
    left = ""; pickKey = ""; draw();
  }, true);
  const adding = el("div", { className: "v2-row v2-gap", hidden: true }, [newName, create]);
  const bar = el("div", { className: "v2-bar" }, [groupPick, btn("방학특강 추가", () => { adding.hidden = !adding.hidden; if (!adding.hidden) newName.focus?.(); }), adding, say]);

  const body = el("div");
  const byOrder = (list) => (a, b) => (list.find((x) => x.id === a)?.sort_order ?? 1e9) - (list.find((x) => x.id === b)?.sort_order ?? 1e9) || nameOf(list, a).localeCompare(nameOf(list, b));
  let left = "", pickKey = "";
  function draw() {
    const groupsOf = groupRequests(curricula.filter((c) => c.set_id === groupPick.value));
    if (!groupPick.value) return body.replaceChildren(panel("방학 특강", [empty("방학 특강이 없습니다. '방학특강 추가'로 만들어주세요.")]));
    if (!groupsOf.length) return body.replaceChildren(panel("방학 특강", [empty("이 방학 특강에 담긴 강사 커리큘럼이 없습니다. 선생님 방특 신청은 '승인 대기'에서 승인하면 여기에 들어옵니다.")]));
    const teachers = [...new Set(groupsOf.map((g) => g.instructor_id))].sort(byOrder(instructors));
    if (!teachers.includes(left)) left = teachers[0];
    const mine = groupsOf.filter((g) => g.instructor_id === left).sort((a, b) => byOrder(subjects)(a.subject_id, b.subject_id));
    const chosen = mine.find((g) => g.key === pickKey) ?? mine[0];
    pickKey = chosen.key;
    const leftPanel = panel("강사", [el("div", { className: "v2-boxlist" }, teachers.map((id) => Object.assign(
      el("div", { className: `v2-listitem${id === left ? " active" : ""}` }, [
        el("div", { className: "v2-row v2-gap" }, [el("b", { className: "v2-grow", textContent: nameOf(instructors, id) }), ...(!isEmployed(id) ? [chip("퇴사", "red")] : [])]),
        el("small", { textContent: `과목 ${groupsOf.filter((g) => g.instructor_id === id).length}개` }),
      ]), { onclick: () => { left = id; pickKey = ""; draw(); } })))]);
    const steps = [...chosen.rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const right = panel(`${nameOf(instructors, left)} · 과목`, [
      el("div", { className: "v3-picks" }, mine.map((g) => Object.assign(el("button", { type: "button", className: g.key === pickKey ? "publish-btn" : "ghost-btn", textContent: nameOf(subjects, g.subject_id) }),
        { onclick: () => { pickKey = g.key; draw(); } }))),
      el("p", { className: "v2-label", textContent: `${nameOf(instructors, chosen.instructor_id)} · ${nameOf(subjects, chosen.subject_id)} 커리큘럼` }),
      ...steps.map((r) => el("div", { className: "v2-mini-card v3-week" }, [thumb(r.media_url, `${r.step_label} 이미지`),
        el("div", { className: "v2-grow" }, [el("b", { textContent: r.step_label }), el("p", { textContent: r.summary || r.written || "(내용 없음)" })])])),
    ], "과목을 고르면 그 과목의 커리큘럼이 나옵니다");
    body.replaceChildren(splitGrid(leftPanel, right));
  }
  groupPick.addEventListener("change", () => { left = ""; pickKey = ""; say.textContent = ""; draw(); });
  fill();
  container.append(bar, body);
  draw();
}
