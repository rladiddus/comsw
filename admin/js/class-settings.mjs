import { el, rows, rpc, stateLine, teacherPicker } from "./teacher-workspace.mjs";
import { dbErrorMessage } from "./fields.mjs";

// 내 프로필 > 수업 설정: 내 학과(쌤톡 학과와 같은 이름)와 학과별 담당 과목.
// 저장하면 컴수원 강사 정보의 학과·담당 과목과 쌤톡 학과에 함께 반영한다.
// V3 학과장·관리자(pickOthers)는 '타 강사 수업 설정'에 체크하고 강사를 고르면 그 강사의 학과·과목을 고친다
// (컴수원 강사 정보만, 쌤톡 학과는 본인 것만 고칠 수 있어 그대로). 내 커리큘럼 타강사의 학과·과목이 여기서 정한 것.
export async function mountClassSettings(container, opts) {
  if (!opts.pickOthers) return mountOne(container, opts);
  const { supabase, own } = opts;
  const [teachers, depts, links] = await Promise.all([
    rows(supabase, "instructors", (q) => q.order("name")),
    rows(supabase, "departments", (q) => q.eq("is_active", true).order("sort_order")),
    rows(supabase, "instructor_departments"),
  ]);
  const others = teachers.filter((i) => i.id !== own.id);
  // 내 커리큘럼 타강사에서 '수업 설정에서 바꾸기'로 오면 그 강사로 연다.
  let target = null;
  try {
    target = others.find((i) => i.id === sessionStorage.getItem("comsw_profile_as")) ?? null;
    sessionStorage.removeItem("comsw_profile_as");
  } catch {
    // 저장소를 못 쓰면 내 수업 설정부터.
  }
  const toggle = el("input", { type: "checkbox", checked: Boolean(target) });
  toggle.setAttribute("aria-label", "타 강사 수업 설정");
  const toggleLabel = el("label", { className: "consent proxy-toggle" }, [toggle, el("span", { textContent: "타 강사 수업 설정" })]);
  const body = el("div");
  container.append(body);
  // 체크 칸은 수업 설정 박스 제목 줄 오른쪽(내 커리큘럼과 같은 자리), 체크하면 제목 자리에 강사 고르기.
  async function show() {
    const on = toggle.checked;
    const picker = on ? teacherPicker({
      v3: true, depts, teachers: others, links, current: target?.id,
      onPick: (id) => { target = others.find((i) => i.id === id); show(); },
    }) : null;
    body.replaceChildren();
    if (!on) return mountOne(body, { ...opts, tail: toggleLabel });
    if (!target) {
      return body.append(el("section", { className: "workspace-card class-settings" }, [
        el("div", { className: "box-title proxy-title" }, [...picker, toggleLabel]),
        el("p", { className: "muted", textContent: "강사를 고르면 그 강사의 수업 설정이 나옵니다." }),
      ]));
    }
    await mountOne(body, { ...opts, own: target, other: true, isHead: false, lead: picker, tail: toggleLabel });
  }
  toggle.addEventListener("change", () => { if (!toggle.checked) target = null; show(); });
  await show();
}

async function mountOne(
  container,
  { supabase, uid, own, isHead = false, loadMyMajors, saveMyMajors, other = false, lead = null, tail = null },
) {
  // '수정' 버튼은 보기 화면일 때만 제목 옆에 붙는다. lead = 제목 대신(타 강사 고르기), tail = 오른쪽 끝(타 강사 수업 설정 체크).
  const heading = el("h3", { textContent: "수업 설정" });
  const title = el("div", { className: tail ? "box-title proxy-title" : "box-title" });
  const setTitle = (...mid) => title.replaceChildren(...(lead ?? [heading]), ...mid, ...(tail ? [tail] : []));
  setTitle();
  const box = el("section", { className: "workspace-card class-settings" }, [
    title,
    el("p", {
      className: "desc",
      textContent: other
        ? "이 강사의 학과를 고르고, 학과마다 수업하는 과목을 체크해주세요. 저장하면 이 강사의 학과·담당 과목과 내 커리큘럼 '타강사 커리큘럼'에 반영됩니다(쌤톡 학과는 바뀌지 않음, 공개 사이트에는 '사이트에 반영' 후)."
        : "내 학과를 고르고, 학과마다 내가 수업하는 과목을 체크해주세요. 저장하면 쌤톡 학과와 강사소개의 담당 과목에 함께 반영됩니다(공개 사이트에는 '사이트에 반영' 후).",
    }),
  ]);
  // 학과장: 쌤톡 학과엔 본인 학과와 관리 학과가 섞여 있어, 고른 학과 중 메인 학과를 정한다(강사소개는 메인 학과에만).
  const mainBox = el("section", { className: "workspace-card main-dept" }, [
    el("div", { className: "box-title" }, [el("h3", { textContent: "메인 학과" })]),
    el("p", {
      className: "desc",
      textContent: other
        // 2026-11-12: 학과장·관리자가 타 강사(주로 다른 학과장)의 메인 학과도 정한다.
        ? "이 강사가 여러 학과를 관리만 하는 학과장이면 실제 수업하는 학과(메인 학과)를 골라주세요. 공개 사이트 강사소개에는 메인 학과에만 프로필이 나옵니다('사이트에 반영' 후 반영). 고르지 않으면 고른 모든 학과에 나옵니다."
        : "수업 설정에서 고른 학과 중 본인 학과(메인 학과)를 골라주세요. 공개 사이트 강사소개에는 메인 학과에만 프로필이 나오고, 나머지는 관리 학과로 프로필이 나오지 않습니다('사이트에 반영' 후 반영). 메인 학과를 고르면 아래 수업 설정에는 메인 학과만 보입니다(관리 학과는 쌤톡 학과에 그대로 남음).",
    }),
  ]);
  const mainPick = el("select", {});
  mainPick.setAttribute("aria-label", "메인 학과");
  const mainSave = el("button", { type: "button", className: "publish-btn", textContent: "저장" });
  mainBox.append(el("div", { className: "form-actions" }, [mainPick, mainSave]));
  const mainState = stateLine(mainBox);
  let mainId = own.main_department_id ?? null;
  if (isHead || other) container.append(mainBox);
  container.append(box);
  const setState = stateLine(box);
  const [depts, subjects, links, myDepts, mySubjects, majors] = await Promise
    .all([
      rows(supabase, "departments", (q) => q.eq("is_active", true).order("sort_order")),
      rows(supabase, "subjects", (q) => q.order("sort_order")),
      rows(supabase, "subject_departments"),
      rows(supabase, "instructor_departments", (q) => q.eq("instructor_id", own.id)),
      rows(supabase, "instructor_subjects", (q) => q.eq("instructor_id", own.id)),
      other ? null : loadMyMajors(uid).catch(() => null),
    ]);
  const byName = (n) => depts.find((d) => d.name === n);
  // 쌤톡 학과를 기준으로 하고, 못 불러오면 컴수원에 저장된 학과를 보여 준다.
  const selected = new Set(
    majors
      ? majors.map((n) => byName(n)?.id).filter(Boolean)
      : myDepts.map((d) => d.department_id),
  );
  if (!majors && !other) {
    setState("쌤톡 학과를 불러오지 못해 컴수원에 저장된 학과를 보여 드립니다.", true);
  }
  const checked = new Set(mySubjects.map((s) => s.subject_id));
  // 컴수원에 없는 쌤톡 학과는 건드리지 않고 그대로 남긴다.
  const otherMajors = (majors || []).filter((n) => !byName(n));
  // 학과 과목은 학과 관리·학과 커리큘럼과 같은 순서(전체수업 순서, 순서 없는 과목은 뒤에 이름순).
  const subjectsOf = (deptId) =>
    links.filter((l) => l.department_id === deptId)
      .map((l) => subjects.find((s) => s.id === l.subject_id)).filter(Boolean)
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.name.localeCompare(b.name, "ko"));
  const list = el("div", { className: "class-list" });
  const actions = el("div", { className: "form-actions" });
  const save = el("button", {
    type: "button",
    className: "publish-btn",
    textContent: "저장",
  });
  const cancel = el("button", {
    type: "button",
    className: "ghost-btn",
    textContent: "되돌리기",
  });
  // 저장된 설정을 먼저 보여 주고, '수정'을 눌러야 고친다. 고른 학과가 없으면 바로 고치는 화면.
  const summary = el("div", { className: "class-summary" });
  const editor = el("div", {}, [list, actions]);
  box.append(summary, editor);
  let saved = { depts: new Set(selected), subjects: new Set(checked) };
  // 메인 학과를 고른 학과장은 저장된 관리 학과를 수업 설정에서 숨긴다(저장할 때는 그대로 함께 보내 쌤톡 학과에 남김).
  const shown = (d) => !isHead || !mainId || d.id === mainId || !saved.depts.has(d.id);
  // 메인 학과 고르기: 저장된 내 학과만. 메인 학과를 수업 설정에서 빼면 '고르기 전'으로(사이트도 모든 학과에 표시).
  function drawMain() {
    const mine = depts.filter((d) => saved.depts.has(d.id));
    if (!mine.some((d) => d.id === mainId)) mainId = null;
    mainPick.replaceChildren(
      el("option", { value: "", textContent: mine.length ? "메인 학과 고르기" : "수업 설정에서 학과를 먼저 골라주세요" }),
      ...mine.map((d) => el("option", { value: d.id, textContent: d.name, selected: d.id === mainId })),
    );
    mainPick.disabled = mainSave.disabled = !mine.length;
  }
  mainSave.addEventListener("click", async () => {
    mainSave.disabled = true;
    try {
      if (other) {
        // 타 강사: 학과장·관리자는 강사 표를 바로 고칠 수 있다(staff_all). 사이트 반영은 그 강사의 학과일 때만 메인 학과로.
        const { error } = await supabase.from("instructors").update({ main_department_id: mainPick.value || null }).eq("id", own.id);
        if (error) throw new Error(dbErrorMessage(error));
        own.main_department_id = mainPick.value || null;
      } else {
        await rpc(supabase, "comsw_set_my_main_department", { p_department_id: mainPick.value || null });
      }
      mainId = mainPick.value || null;
      mainState(mainId ? "저장했습니다. '사이트에 반영' 후 사이트 강사소개에 메인 학과만 나옵니다." : "메인 학과를 지웠습니다. 고른 모든 학과에 나옵니다.");
      if (editor.hidden) showSummary();
      else draw();
    } catch (e) {
      mainState(e.message, true);
    } finally {
      mainSave.disabled = false;
    }
  });
  drawMain();
  function showSummary() {
    const mine = depts.filter((d) => saved.depts.has(d.id) && shown(d));
    const edit = el("button", {
      type: "button",
      className: "publish-btn",
      textContent: "수정",
    });
    edit.addEventListener("click", () => {
      setTitle();
      summary.hidden = true;
      editor.hidden = false;
      draw();
    });
    summary.replaceChildren(
      ...mine.map((d) =>
        el("div", { className: "profile-item" }, [
          el("span", { className: "field-label", textContent: d.name }),
          el("p", {
            textContent: subjectsOf(d.id).filter((s) => saved.subjects.has(s.id))
              .map((s) => s.name).join(", ") || "고른 과목 없음",
          }),
        ])
      ),
    );
    setTitle(edit);
    summary.hidden = false;
    editor.hidden = true;
  }
  cancel.addEventListener("click", () => {
    selected.clear();
    saved.depts.forEach((d) => selected.add(d));
    checked.clear();
    saved.subjects.forEach((x) => checked.add(x));
    showSummary();
  });

  function draw() {
    const mine = depts.filter((d) => selected.has(d.id) && shown(d));
    list.replaceChildren(...mine.map((d) => {
      const remove = el("button", {
        type: "button",
        className: "ghost-btn danger",
        textContent: "학과 삭제",
      });
      remove.addEventListener("click", () => {
        selected.delete(d.id);
        draw();
      });
      const subs = subjectsOf(d.id);
      return el("section", { className: "class-dept" }, [
        el("div", { className: "class-dept-head" }, [
          el("h4", { textContent: d.name }),
          remove,
        ]),
        subs.length
          ? el("div", { className: "subject-checks" }, subs.map((s) => {
            const box = el("input", { type: "checkbox", checked: checked.has(s.id) });
            box.addEventListener("change", () => {
              if (box.checked) checked.add(s.id);
              else checked.delete(s.id);
            });
            return el("label", { className: "subject-check" }, [
              box,
              el("span", { textContent: s.name }),
            ]);
          }))
          : el("p", { className: "muted", textContent: "이 학과에 등록된 과목이 없습니다." }),
      ]);
    }));
    if (!mine.length) {
      list.append(el("p", {
        className: "muted",
        textContent: "아직 고른 학과가 없습니다. 아래에서 학과를 추가해주세요.",
      }));
    }
    const rest = depts.filter((d) => !selected.has(d.id));
    const pick = el("select", {}, [
      el("option", { value: "", textContent: "추가할 학과 선택" }),
      ...rest.map((d) => el("option", { value: d.id, textContent: d.name })),
    ]);
    pick.setAttribute("aria-label", "추가할 학과");
    const add = el("button", {
      type: "button",
      className: "ghost-btn",
      textContent: "+ 학과 추가",
      disabled: !rest.length,
    });
    add.addEventListener("click", () => {
      if (!pick.value) {
        setState("추가할 학과를 골라주세요", true);
        return;
      }
      selected.add(pick.value);
      draw();
    });
    actions.replaceChildren(pick, add, save, ...(saved.depts.size ? [cancel] : []));
  }

  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const deptIds = depts.filter((d) => selected.has(d.id)).map((d) => d.id);
      // 삭제한 학과의 과목은 빼고 저장한다.
      const allowed = new Set(deptIds.flatMap((id) => subjectsOf(id).map((s) => s.id)));
      if (other) {
        await saveOther(supabase, own.id, deptIds, [...checked].filter((id) => allowed.has(id)), myDepts, mySubjects);
        setState("저장했습니다. 내 커리큘럼 '타강사 커리큘럼'에서 이 학과·과목이 나옵니다.");
        saved = { depts: new Set(selected), subjects: new Set(checked) };
        drawMain();
        showSummary();
        return;
      }
      await rpc(supabase, "comsw_set_my_classes", {
        p_department_ids: deptIds,
        p_subject_ids: [...checked].filter((id) => allowed.has(id)),
      });
      try {
        await saveMyMajors(uid, [
          ...depts.filter((d) => selected.has(d.id)).map((d) => d.name),
          ...otherMajors,
        ]);
        setState("저장했습니다. 쌤톡 학과에도 반영했습니다.");
        saved = { depts: new Set(selected), subjects: new Set(checked) };
        drawMain();
        showSummary();
      } catch {
        setState(
          "컴수원에는 저장했지만 쌤톡 학과 반영에 실패했습니다. 잠시 후 다시 저장해주세요.",
          true,
        );
      }
    } catch (e) {
      setState(e.message, true);
    } finally {
      save.disabled = false;
    }
  });
  if (saved.depts.size) showSummary();
  else draw();
}

// 다른 강사의 학과·담당 과목 저장(학과장·관리자, staff_all 권한으로 표에 바로). 넣을 것 먼저, 뺄 것 나중.
// ponytail: 한 번에 묶이지 않아 중간에 실패하면 일부만 저장됨(다시 저장하면 맞춰짐). 묶어야 하면 DB 함수로.
async function saveOther(supabase, id, deptIds, subjectIds, myDepts, mySubjects) {
  const run = async (q) => { const { error } = await q; if (error) throw new Error(dbErrorMessage(error)); };
  const hadDepts = myDepts.map((x) => x.department_id);
  const hadSubjects = mySubjects.map((x) => x.subject_id);
  const newDepts = deptIds.filter((d) => !hadDepts.includes(d));
  const newSubjects = subjectIds.filter((s) => !hadSubjects.includes(s));
  const top = Math.max(0, ...mySubjects.map((x) => x.sort_order ?? 0));
  if (newDepts.length) await run(supabase.from("instructor_departments").insert(newDepts.map((d) => ({ instructor_id: id, department_id: d }))));
  if (newSubjects.length) await run(supabase.from("instructor_subjects").insert(newSubjects.map((s, n) => ({ instructor_id: id, subject_id: s, sort_order: top + n + 1 }))));
  const goneSubjects = hadSubjects.filter((s) => !subjectIds.includes(s));
  const goneDepts = hadDepts.filter((d) => !deptIds.includes(d));
  if (goneSubjects.length) await run(supabase.from("instructor_subjects").delete().eq("instructor_id", id).in("subject_id", goneSubjects));
  if (goneDepts.length) await run(supabase.from("instructor_departments").delete().eq("instructor_id", id).in("department_id", goneDepts));
  // 다음 저장의 비교 기준을 맞춘다.
  myDepts.splice(0, myDepts.length, ...deptIds.map((d) => ({ instructor_id: id, department_id: d })));
  mySubjects.splice(0, mySubjects.length, ...subjectIds.map((s) => mySubjects.find((x) => x.subject_id === s) ?? { instructor_id: id, subject_id: s, sort_order: top + 1 + newSubjects.indexOf(s) }));
}
