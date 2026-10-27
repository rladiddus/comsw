import { el, rows, rpc, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { cascadeMessage } from "../format.mjs";
import { countRows } from "../count.mjs";
import { showWeeks } from "../subject-weeks.mjs";
import { driveThumbnail } from "../drive.mjs";
import { applyCrop } from "../image-crop.mjs";

// 커리큘럼 관리 > 기타 과목: 어느 학과에도 없는 과목(사이트 '전체 수업'에 안 나옴, 강사 커리큘럼·준비물·방학 특강 등에서 씀).
// '수정'으로 과목명·기간, '단계'로 과목 단계, '커리큘럼'으로 선생님이 쓴 커리큘럼 보기, '방특' 체크(선생님이 방특으로 낼 때 고를 수 있는 과목),
// '학과에 넣기'로 학과 커리큘럼(전체수업 맨 뒤)에 보내고, '삭제'로 과목을 지운다.
// 학과 커리큘럼에서 마지막 학과까지 빼면 여기로 온다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "기타 과목" }),
    el("p", {
      className: "desc",
      textContent: "어느 학과에도 들어 있지 않아 사이트 '전체 수업'에 나오지 않는 과목입니다. 강사 커리큘럼·수업별 준비물 등에서 쓰입니다. '방특'에 체크하면 선생님이 '방특'으로 커리큘럼을 낼 때 이 과목을 고를 수 있습니다. '학과에 넣기'를 하면 그 학과 커리큘럼 맨 뒤로 옮겨집니다.",
    }),
  );
  const setState = stateLine(container);
  const [depts, subjects, links, instructors, sets] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
    rows(supabase, "instructors"),
    rows(supabase, "curriculum_sets"),
  ]);
  const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? "";

  // 이 과목으로 선생님들이 쓴 커리큘럼(승인·대기·방특 모두)을 강사별로 아래에 보여 준다. 고치기는 신청 과목·강사 커리큘럼·방학 특강에서.
  async function showCurricula(subject) {
    weeks.replaceChildren(el("p", { className: "muted", textContent: "불러오는 중…" }));
    try {
      const list = await rows(supabase, "instructor_curricula", (q) => q.eq("subject_id", subject.id).order("sort_order"));
      const byTeacher = new Map();
      for (const r of list) byTeacher.set(r.instructor_id, [...(byTeacher.get(r.instructor_id) ?? []), r]);
      const status = (r) => [r.status === "approved" ? "승인" : "승인 대기", r.vacation && "방특", nameOf(sets, r.set_id)].filter(Boolean).join(" · ");
      weeks.replaceChildren(
        el("h3", { textContent: `작성된 커리큘럼 — ${subject.name} (${list.length}단계)` }),
        el("p", { className: "muted", textContent: "보기만 합니다. 고치려면 승인 대기는 '신청 과목', 승인된 것은 '강사 커리큘럼', 방특은 '방학 특강'에서." }),
        ...(list.length ? [...byTeacher].map(([id, steps]) => el("section", { className: "workspace-card other-curricula" }, [
          el("h4", { textContent: `${nameOf(instructors, id) || "(강사 없음)"} 선생님 · ${steps.length}단계` }),
          ...steps.map((r) => el("div", { className: "other-curriculum" }, [
            el("div", { className: "submission-thumb empty" }, [
              r.media_url ? applyCrop(el("img", { src: driveThumbnail(r.media_url), alt: `${r.step_label} 이미지` }), r.media_url) : el("span", { textContent: "이미지 없음" }),
            ]),
            el("div", {}, [
              el("strong", { textContent: r.step_label }),
              el("span", { className: "status-pill " + (r.status === "approved" ? "approved" : "pending"), textContent: status(r) }),
              el("p", { className: "pre-line", textContent: r.written ?? "" }),
              ...(r.summary ? [el("p", { className: "muted pre-line", textContent: `사이트 문구: ${r.summary}` })] : []),
            ]),
          ])),
        ])) : [el("p", { className: "muted", textContent: "이 과목으로 쓴 커리큘럼이 없습니다." })]),
      );
      weeks.scrollIntoView?.({ behavior: "smooth" });
    } catch (e) {
      weeks.replaceChildren();
      setState(e.message, true);
    }
  }
  const list = el("div", { className: "other-subjects" });
  const weeks = el("section", { className: "subject-weeks" });
  container.append(list, weeks);

  function row(subject) {
    const name = el("input", { type: "text", value: subject.name, readOnly: true });
    name.setAttribute("aria-label", "과목명");
    const duration = el("input", { type: "text", value: subject.duration ?? "", readOnly: true, placeholder: "기간" });
    duration.setAttribute("aria-label", "기간");
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    // 되돌리기: 저장 안 한 고침을 버리고 마지막 저장 값으로
    const revert = el("button", { type: "button", className: "ghost-btn", textContent: "되돌리기", hidden: true });
    const close = () => {
      name.readOnly = duration.readOnly = true;
      revert.hidden = true;
      edit.textContent = "수정";
      edit.className = "ghost-btn";
    };
    revert.addEventListener("click", () => {
      name.value = subject.name;
      duration.value = subject.duration ?? "";
      close();
      setState("마지막 저장 상태로 되돌렸습니다");
    });
    edit.addEventListener("click", async () => {
      if (name.readOnly) {
        name.readOnly = duration.readOnly = false;
        revert.hidden = false;
        edit.textContent = "저장";
        edit.className = "publish-btn";
        return;
      }
      if (!name.value.trim()) return setState("과목명을 입력해주세요", true);
      const patch = { name: name.value.trim(), duration: duration.value.trim() || null };
      const { error } = await supabase.from("subjects").update(patch).eq("id", subject.id);
      if (error) return setState(dbErrorMessage(error, { duplicate: "같은 이름의 과목이 이미 있습니다" }), true);
      Object.assign(subject, patch);
      close();
      setState(`'${subject.name}'을(를) 저장했습니다. 공개 사이트에는 '사이트에 반영' 후 반영됩니다.`);
    });
    const stepsBtn = el("button", { type: "button", className: "ghost-btn", textContent: "단계" });
    stepsBtn.addEventListener("click", () => showWeeks(weeks, supabase, subject));
    const curriculaBtn = el("button", { type: "button", className: "ghost-btn", textContent: "커리큘럼" });
    curriculaBtn.addEventListener("click", () => showCurricula(subject));
    const vac = el("input", { type: "checkbox", checked: Boolean(subject.is_vacation) });
    vac.setAttribute("aria-label", "방특 과목");
    vac.addEventListener("change", async () => {
      const { error } = await supabase.from("subjects").update({ is_vacation: vac.checked }).eq("id", subject.id);
      if (error) {
        vac.checked = !vac.checked;
        return setState(dbErrorMessage(error), true);
      }
      subject.is_vacation = vac.checked;
      setState(vac.checked
        ? `'${subject.name}'을(를) 방특 과목으로 정했습니다. 선생님이 '방특'에 체크하면 이 과목을 고를 수 있습니다.`
        : `'${subject.name}'을(를) 방특 과목에서 뺐습니다.`);
    });
    const vacLabel = el("label", { className: "consent vacation-pick" }, [vac, el("span", { textContent: "방특" })]);
    const deptPick = el("select", {}, [
      el("option", { value: "", textContent: "학과 고르기" }),
      ...depts.map((d) => el("option", { value: d.id, textContent: d.name })),
    ]);
    deptPick.setAttribute("aria-label", "넣을 학과");
    const move = el("button", { type: "button", className: "ghost-btn", textContent: "학과에 넣기" });
    move.addEventListener("click", async () => {
      if (!deptPick.value) return setState("넣을 학과를 골라주세요", true);
      const link = { subject_id: subject.id, department_id: deptPick.value };
      let { error } = await supabase.from("subject_departments").insert(link);
      const sort_order = subjects.reduce((m, s) => Math.max(m, s.sort_order ?? -1), -1) + 1;
      if (!error) ({ error } = await supabase.from("subjects").update({ sort_order }).eq("id", subject.id));
      if (error) return setState(dbErrorMessage(error), true);
      links.push(link);
      subject.sort_order = sort_order;
      setState(`'${subject.name}'을(를) ${deptPick.selectedOptions[0].textContent} 커리큘럼에 넣었습니다. 공개 사이트에는 '사이트에 반영' 후 반영됩니다.`);
      draw();
    });
    const remove = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
    remove.addEventListener("click", async () => {
      const counts = [
        ["단계", await countRows(supabase, "subject_weeks", "subject_id", subject.id)],
        ["강사 커리큘럼", await countRows(supabase, "instructor_curricula", "subject_id", subject.id)],
        ["강사 담당 과목", await countRows(supabase, "instructor_subjects", "subject_id", subject.id)],
        ["준비물", await countRows(supabase, "course_prep_items", "subject_id", subject.id)],
        ["로드맵 연결", await countRows(supabase, "roadmap_step_subjects", "subject_id", subject.id)],
        ["강사별 프로그램·준비물", await countRows(supabase, "instructor_subject_materials", "subject_id", subject.id)],
      ];
      if (!confirm(cascadeMessage("과목", subject.name, counts))) return;
      // 확인창에 보여 준 개수를 DB가 다시 세어, 그 사이 바뀌었으면 지우지 않는다(과목 관리와 같은 함수).
      try {
        await rpc(supabase, "comsw_delete_subjects", { p_ids: [subject.id], p_seen: counts.reduce((n, [, c]) => n + c, 0) });
      } catch (e) {
        return setState(e.message, true);
      }
      subjects.splice(subjects.indexOf(subject), 1);
      setState(`'${subject.name}' 과목을 삭제했습니다. 공개 사이트에서는 '사이트에 반영' 후 빠집니다.`);
      draw();
    });
    return el("div", { className: "other-subject-row" }, [name, duration, vacLabel, stepsBtn, curriculaBtn, deptPick, move, remove, revert, edit]);
  }

  function draw() {
    const others = subjects
      .filter((s) => !links.some((l) => l.subject_id === s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    list.replaceChildren(
      el("p", { className: "muted", textContent: `기타 과목 ${others.length}개` }),
      ...(others.length ? others.map(row) : [el("p", { className: "muted", textContent: "기타 과목이 없습니다." })]),
    );
  }
  draw();
}
