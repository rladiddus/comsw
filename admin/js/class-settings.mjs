import { el, rows, rpc, stateLine } from "./teacher-workspace.mjs";

// 내 프로필 > 수업 설정: 내 학과(쌤톡 학과와 같은 이름)와 학과별 담당 과목.
// 저장하면 컴수원 강사 정보의 학과·담당 과목과 쌤톡 학과에 함께 반영한다.
export async function mountClassSettings(
  container,
  { supabase, uid, own, isHead = false, loadMyMajors, saveMyMajors },
) {
  // '수정' 버튼은 보기 화면일 때만 제목 옆에 붙는다.
  const heading = el("h3", { textContent: "수업 설정" });
  const title = el("div", { className: "box-title" }, [heading]);
  const box = el("section", { className: "workspace-card class-settings" }, [
    title,
    el("p", {
      className: "desc",
      textContent:
        "내 학과를 고르고, 학과마다 내가 수업하는 과목을 체크해주세요. 저장하면 쌤톡 학과와 강사소개의 담당 과목에 함께 반영됩니다(공개 사이트에는 '적용' 후).",
    }),
  ]);
  // 학과장: 쌤톡 학과엔 본인 학과와 관리 학과가 섞여 있어, 고른 학과 중 메인 학과를 정한다(강사소개는 메인 학과에만).
  const mainBox = el("section", { className: "workspace-card main-dept" }, [
    el("div", { className: "box-title" }, [el("h3", { textContent: "메인 학과" })]),
    el("p", {
      className: "desc",
      textContent:
        "수업 설정에서 고른 학과 중 본인 학과(메인 학과)를 골라주세요. 공개 사이트 강사소개에는 메인 학과에만 프로필이 나오고, 나머지는 관리 학과로 프로필이 나오지 않습니다('적용' 후 반영). 쌤톡 학과는 그대로입니다.",
    }),
  ]);
  const mainPick = el("select", {});
  mainPick.setAttribute("aria-label", "메인 학과");
  const mainSave = el("button", { type: "button", className: "publish-btn", textContent: "저장" });
  mainBox.append(el("div", { className: "form-actions" }, [mainPick, mainSave]));
  const mainState = stateLine(mainBox);
  let mainId = own.main_department_id ?? null;
  if (isHead) container.append(mainBox);
  container.append(box);
  const setState = stateLine(box);
  const [depts, subjects, links, myDepts, mySubjects, majors] = await Promise
    .all([
      rows(supabase, "departments", (q) => q.eq("is_active", true).order("sort_order")),
      rows(supabase, "subjects", (q) => q.order("sort_order")),
      rows(supabase, "subject_departments"),
      rows(supabase, "instructor_departments", (q) => q.eq("instructor_id", own.id)),
      rows(supabase, "instructor_subjects", (q) => q.eq("instructor_id", own.id)),
      loadMyMajors(uid).catch(() => null),
    ]);
  const byName = (n) => depts.find((d) => d.name === n);
  // 쌤톡 학과를 기준으로 하고, 못 불러오면 컴수원에 저장된 학과를 보여 준다.
  const selected = new Set(
    majors
      ? majors.map((n) => byName(n)?.id).filter(Boolean)
      : myDepts.map((d) => d.department_id),
  );
  if (!majors) {
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
      await rpc(supabase, "comsw_set_my_main_department", { p_department_id: mainPick.value || null });
      mainId = mainPick.value || null;
      mainState(mainId ? "저장했습니다. '적용' 후 사이트 강사소개에 메인 학과만 나옵니다." : "메인 학과를 지웠습니다. 고른 모든 학과에 나옵니다.");
    } catch (e) {
      mainState(e.message, true);
    } finally {
      mainSave.disabled = false;
    }
  });
  drawMain();
  function showSummary() {
    const mine = depts.filter((d) => saved.depts.has(d.id));
    const edit = el("button", {
      type: "button",
      className: "publish-btn",
      textContent: "수정",
    });
    edit.addEventListener("click", () => {
      title.replaceChildren(heading);
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
    title.replaceChildren(heading, edit);
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
    const mine = depts.filter((d) => selected.has(d.id));
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
