import { mountCardList } from "../card-list.mjs";
import { el, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";

// 방학 특강: 그룹(curriculum_sets.is_vacation, 예: '2026년 여름방학특강')마다 강의 목록.
// 선생님이 '방특'에 체크해 낸 커리큘럼(instructor_curricula.vacation, 승인 대기)은 아래 '방특 신청'에 과목·강사별로 모이고,
// '이 그룹에 담기'를 누르면 고른 그룹 세트로 옮겨 승인한다(같은 강사·과목·단계의 예전 줄은 대신함).
// 사이트 방학 특강 페이지에 나오는 그룹과 배경 이미지는 메인 화면 > 기타 설정에서 고른다.
export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "방학 특강" }));
  const setState = stateLine(container);
  const [{ data: settings }, { data: groupRows }, { data: instructors }, { data: subjects }] = await Promise.all([
    supabase.from("site_settings").select("key, value").eq("key", "vacation_set_id"),
    supabase.from("curriculum_sets").select("id, name").eq("is_vacation", true).order("name"),
    supabase.from("instructors").select("id, name").order("sort_order"),
    supabase.from("subjects").select("id, name").order("sort_order"),
  ]);
  const groups = groupRows || [];
  const siteGroup = settings?.[0]?.value;
  const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name ?? "";

  // ── 그룹 고르기·추가 ──
  const groupPick = el("select");
  groupPick.setAttribute("aria-label", "방학 특강 그룹");
  const fillGroups = (value) => {
    groupPick.replaceChildren(...groups.map((g) => el("option", {
      value: g.id,
      textContent: g.id === siteGroup ? `${g.name} (사이트에 나옴)` : g.name,
    })));
    groupPick.value = value ?? (groups.some((g) => g.id === siteGroup) ? siteGroup : groups[0]?.id ?? "");
  };
  const addBtn = el("button", { type: "button", className: "ghost-btn", textContent: "방학특강 추가" });
  const newName = el("input", { type: "text", placeholder: "예: 2027년 겨울방학특강" });
  newName.setAttribute("aria-label", "새 방학 특강 이름");
  const create = el("button", { type: "button", className: "publish-btn", textContent: "만들기" });
  const adding = el("div", { className: "search-bar", hidden: true }, [
    el("label", { className: "form-field" }, [el("span", { textContent: "새 방학 특강" }), newName]),
    create,
  ]);
  addBtn.addEventListener("click", () => {
    adding.hidden = !adding.hidden;
    if (!adding.hidden) newName.focus?.();
  });
  create.addEventListener("click", async () => {
    const name = newName.value.trim();
    if (!name) return setState("방학 특강 이름을 입력해주세요", true);
    create.disabled = true;
    const { data, error } = await supabase.from("curriculum_sets").insert({ name, is_vacation: true }).select().single();
    create.disabled = false;
    if (error) return setState(dbErrorMessage(error, { duplicate: "같은 이름이 이미 있습니다" }), true);
    groups.push(data);
    fillGroups(data.id);
    newName.value = "";
    adding.hidden = true;
    setState(`'${name}'을(를) 만들었습니다. 아래 '방특 신청'에서 강의를 담아주세요.`);
    showGroup();
    drawPool();
  });
  container.append(
    el("p", { className: "desc", textContent: "그룹을 고르면 그 방학 특강의 강의 목록이 나옵니다. 사이트 방학 특강 페이지에 나올 그룹과 배경 이미지는 메인 화면 > 기타 설정에서 고릅니다." }),
    el("div", { className: "search-bar" }, [el("label", { className: "form-field" }, [el("span", { textContent: "방학 특강" }), groupPick]), addBtn]),
    adding,
  );

  // ── 방특 신청: 선생님이 '방특'으로 낸 승인 대기 커리큘럼 ──
  const pool = el("section", { className: "workspace-card vacation-pool" });
  async function drawPool() {
    const { data, error } = await supabase.from("instructor_curricula").select("*")
      .eq("vacation", true).eq("status", "pending").order("sort_order");
    if (error) return setState(dbErrorMessage(error), true);
    const bundles = new Map(); // 강사·과목별 묶음
    for (const r of data || []) {
      const key = `${r.instructor_id}|${r.subject_id}`;
      if (!bundles.has(key)) bundles.set(key, []);
      bundles.get(key).push(r);
    }
    const items = [...bundles.values()].map((steps) => {
      const { instructor_id, subject_id } = steps[0];
      const take = el("button", { type: "button", className: "publish-btn", textContent: "이 그룹에 담기" });
      take.addEventListener("click", (e) => {
        e.preventDefault(); // 펼침/접힘은 그대로
        takeInto(steps, take);
      });
      return el("details", { className: "vacation-pool-item" }, [
        el("summary", {}, [
          el("strong", { textContent: `${nameOf(subjects, subject_id)} · ${nameOf(instructors, instructor_id)}` }),
          el("span", { className: "muted", textContent: ` ${steps.map((s) => s.step_label).join(", ")}` }),
          take,
        ]),
        ...steps.map((s) => el("p", { className: "submission-text", textContent: `${s.step_label} — ${s.written || ""}` })),
      ]);
    });
    pool.replaceChildren(
      el("div", { className: "box-title" }, [el("h3", { textContent: `방특 신청 ${bundles.size}건` })]),
      el("p", { className: "desc", textContent: "선생님이 '방특'에 체크해 낸 커리큘럼입니다(과목 · 강사). 펼치면 단계별 내용이 보이고, '이 그룹에 담기'를 누르면 위에서 고른 방학 특강의 강의 목록(아래)으로 들어갑니다." }),
      ...(items.length ? items : [el("p", { className: "muted", textContent: "새로 들어온 방특 커리큘럼이 없습니다." })]),
    );
  }
  async function takeInto(steps, button) {
    const group = groups.find((g) => g.id === groupPick.value);
    if (!group) return setState("먼저 방학 특강 그룹을 만들거나 골라주세요", true);
    if (!confirm(`${nameOf(subjects, steps[0].subject_id)} · ${nameOf(instructors, steps[0].instructor_id)} 커리큘럼을 '${group.name}'에 담을까요?`)) return;
    button.disabled = true;
    try {
      for (const s of steps) {
        const { error } = await supabase.from("instructor_curricula").update({ set_id: group.id }).eq("id", s.id);
        if (error) throw new Error(dbErrorMessage(error));
        const { error: approveError } = await supabase.rpc("comsw_approve_curriculum", { p_id: s.id });
        if (approveError) throw new Error(dbErrorMessage(approveError));
      }
      setState(`'${group.name}'에 담았습니다. 공개 사이트에는 '사이트에 반영' 후 반영됩니다.`);
      await Promise.all([drawPool(), showGroup()]);
    } catch (e) {
      setState(e.message, true);
      button.disabled = false;
    }
  }

  // ── 고른 그룹의 강의 목록 ──
  const list = el("div");
  async function showGroup() {
    list.replaceChildren();
    const group = groups.find((g) => g.id === groupPick.value);
    if (!group) {
      list.append(el("p", { className: "muted", textContent: "방학 특강 그룹이 없습니다. '방학특강 추가'로 만들어주세요." }));
      return;
    }
    await mountCardList(list, {
      supabase,
      table: "instructor_curricula",
      title: `강의 목록 — ${group.name}`,
      description: "이 방학 특강에 나오는 강의입니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다.",
      imageKey: "media_url",
      imageLabel: "이미지·영상",
      uploadKind: "curriculum",
      activeKey: null,
      query: (q) => q.eq("set_id", group.id).eq("status", "approved"),
      fields: [
        // 윗줄: 과목 / 단계 / 수업 시간 / 강사, 아랫줄: 커리큘럼(사이트 문구) / 교재·준비물 / 교재 설명.
        // 선생님 원문(written)은 이 목록에 두지 않는다(사용자 요청, DB에는 그대로 남음, 방특 신청에서 봄).
        { key: "subject_id", label: "과목", type: "select", span: 3, options: () => (subjects || []).map((s) => [s.id, s.name]) },
        { key: "step_label", label: "단계", type: "text", required: true, span: 3 },
        { key: "class_time", label: "수업 시간", type: "text", span: 3 },
        { key: "instructor_id", label: "강사", type: "select", span: 3, options: () => (instructors || []).map((i) => [i.id, i.name]) },
        { key: "summary", label: "커리큘럼", type: "textarea", span: 4 },
        { key: "supplies", label: "교재·준비물", type: "textarea", span: 4 },
        { key: "supplies_detail", label: "교재 설명", type: "textarea", span: 4 },
      ],
      defaults: () => ({
        set_id: group.id,
        status: "approved",
        step_label: "1단계",
        instructor_id: instructors?.[0]?.id,
        subject_id: subjects?.[0]?.id,
      }),
      itemName: (row) => `${nameOf(instructors, row.instructor_id)} ${nameOf(subjects, row.subject_id)} ${row.step_label}`,
      deleteConfirm: async (row) =>
        `${nameOf(instructors, row.instructor_id)} 선생님 · ${nameOf(subjects, row.subject_id)} · ${row.step_label} 강의를 삭제할까요?`,
    });
  }
  groupPick.addEventListener("change", () => {
    setState("");
    showGroup();
  });
  fillGroups();
  container.append(pool, list);
  await Promise.all([showGroup(), drawPool()]);
}
