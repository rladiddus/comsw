import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { freeName } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";
import { dropTarget } from "../card-list.mjs";

// 로드맵: 공개 사이트 로드맵처럼 한 줄 = 로드맵 묶음(보통 학과), 오른쪽으로 단계 상자가 이어진다.
// 왼쪽에서 학과를 고르면 단계 상자의 과목 목록은 '학과 커리큘럼'의 학과 과목(subject_departments)으로 좁혀진다.
// 단계 상자: 과목 여러 개 선택, '원문 보기'(고른 과목의 커리큘럼 모아 보기), 아래 요약(사이트 문구).
// 줄은 보기 상태로 열리고 '수정'을 눌러야 고칠 수 있다. 학과·이름·과목·요약은 '저장' 때 한꺼번에 저장('취소'는 버림),
// 단계 추가·삭제는 수정 중에, 끌어 옮기기(줄은 위아래, 단계는 좌우, 놓을 자리 점선)는 언제나 바로 저장된다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "로드맵" }),
    el("p", {
      className: "desc",
      textContent:
        "'수정'을 누르면 고칠 수 있습니다. 왼쪽에서 학과를 고르면 그 학과 과목('커리큘럼 관리 > 학과 커리큘럼')에서 단계마다 과목을 고릅니다. ⠿를 끌어 줄은 위아래, 단계는 좌우로 옮깁니다. '원문 보기'로 고른 과목의 커리큘럼을 모아 보고, 아래 요약이 사이트 상자 문구입니다.",
    }),
  );
  const setState = stateLine(container);
  const fail = (error) => { setState(dbErrorMessage(error), true); return true; };
  const [depts, subjects, links, tracks, steps, stepSubjects, curricula, instructors] = await Promise.all([
    rows(supabase, "departments", (q) => q.order("sort_order")),
    rows(supabase, "subjects", (q) => q.order("sort_order")),
    rows(supabase, "subject_departments"),
    rows(supabase, "roadmap_tracks", (q) => q.order("sort_order")),
    rows(supabase, "roadmap_steps", (q) => q.order("position")),
    rows(supabase, "roadmap_step_subjects", (q) => q.order("sort_order")),
    rows(supabase, "instructor_curricula", (q) => q.eq("status", "approved").order("sort_order")),
    rows(supabase, "instructors", (q) => q.order("sort_order")),
  ]);
  const board = el("div", { className: "roadmap-board" });
  const addTrack = el("button", { type: "button", className: "publish-btn", textContent: "+ 로드맵 줄 추가" });
  const popup = el("dialog", { className: "roadmap-source" });
  // 바깥(어두운 곳)을 누르면 닫힌다. 안쪽 글 상자를 누를 때는 그대로.
  popup.addEventListener("click", (e) => { if (e.target === popup) close(popup); });
  container.append(board, el("div", { className: "editor-bar" }, [addTrack]), popup);
  // 열린 과목 고르기 목록은 다른 곳을 누르거나 화면이 움직이면 닫는다(목록은 화면 위에 떠 있어서).
  const closeLists = (except) => {
    for (const d of container.querySelectorAll("details.multi[open]")) if (!d.contains(except)) d.open = false;
  };
  const onClick = (e) => {
    if (!container.isConnected) return document.removeEventListener("click", onClick);
    closeLists(e.target);
  };
  const onScroll = (e) => {
    if (!container.isConnected) return document.removeEventListener("scroll", onScroll, true);
    if (!e.target.closest?.(".multi-list")) closeLists(null);
  };
  document.addEventListener("click", onClick);
  document.addEventListener("scroll", onScroll, true);

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? "";
  const ordered = (list) => [...list].sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
  const trackList = () => ordered(tracks);
  const stepsOf = (track) => steps.filter((s) => s.track_id === track.id).sort((a, b) => a.position - b.position);
  const savedSubjects = (step) => ordered(stepSubjects.filter((x) => x.step_id === step.id)).map((x) => x.subject_id);

  // 수정 중인 줄: 줄 id → { name, department_id, steps: 단계 id → { subjects, summary } }
  const drafts = new Map();
  const draftOf = (track) => drafts.get(track.id);
  const stepDraft = (track, step) => {
    const d = draftOf(track);
    if (!d) return { subjects: savedSubjects(step), summary: step.summary ?? "" };
    d.steps[step.id] ??= { subjects: savedSubjects(step), summary: step.summary ?? "" };
    return d.steps[step.id];
  };
  const deptOf = (track) => draftOf(track)?.department_id ?? track.department_id;
  // 학과가 있으면 그 학과 과목만(전체 수업 순서), 없으면 모든 과목.
  const choices = (track) => {
    const dept = deptOf(track);
    if (!dept) return [...subjects].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const ids = new Set(links.filter((l) => l.department_id === dept).map((l) => l.subject_id));
    return ordered(subjects.filter((s) => ids.has(s.id)));
  };

  function open(dialog) {
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function close(dialog) {
    if (dialog.close) dialog.close();
    else dialog.removeAttribute("open");
  }
  // 원문 보기: 고른 과목마다 승인된 강사 커리큘럼(강사·단계 순) 원문을 모은다.
  function showSource(track, step) {
    const ids = stepDraft(track, step).subjects;
    const body = el("div", { className: "roadmap-source-body" }, [
      el("h3", { textContent: `${track.name} · ${step.position}단계 원문` }),
    ]);
    if (step.source_text) body.append(el("h4", { textContent: "로드맵 원문" }), el("p", { textContent: step.source_text }));
    if (!ids.length) body.append(el("p", { className: "muted", textContent: "고른 과목이 없습니다." }));
    for (const id of ids) {
      body.append(el("h4", { textContent: nameOf(subjects, id) }));
      const mine = curricula.filter((c) => c.subject_id === id && (c.written || "").trim());
      if (!mine.length) body.append(el("p", { className: "muted", textContent: "승인된 커리큘럼이 없습니다." }));
      for (const c of mine) {
        body.append(el("div", { className: "roadmap-source-item" }, [
          el("strong", { textContent: `${nameOf(instructors, c.instructor_id)} · ${c.step_label}` }),
          el("p", { textContent: c.written }),
        ]));
      }
    }
    popup.replaceChildren(body);
    open(popup);
  }

  // '저장': 줄 학과·이름, 단계마다 요약과 고른 과목(빠진 것 삭제, 새로 고른 것 추가, 순서 다시 매김).
  async function save(track) {
    const d = draftOf(track);
    const name = d.name.trim();
    if (!name) return setState("로드맵 이름을 입력해주세요", true);
    const patch = { name, department_id: d.department_id || null };
    if (patch.name !== track.name || patch.department_id !== (track.department_id ?? null)) {
      const { error } = await supabase.from("roadmap_tracks").update(patch).eq("id", track.id);
      if (error) return fail(error);
      Object.assign(track, patch);
    }
    for (const step of stepsOf(track)) {
      const sd = d.steps[step.id];
      if (!sd) continue;
      const summary = sd.summary.trim() || null;
      if (summary !== (step.summary ?? null)) {
        const { error } = await supabase.from("roadmap_steps").update({ summary }).eq("id", step.id);
        if (error) return fail(error);
        step.summary = summary;
      }
      const before = savedSubjects(step);
      if (before.join() === sd.subjects.join()) continue;
      for (const id of before.filter((id) => !sd.subjects.includes(id))) {
        const { error } = await supabase.from("roadmap_step_subjects").delete().eq("step_id", step.id).eq("subject_id", id);
        if (error) return fail(error);
        stepSubjects.splice(stepSubjects.findIndex((x) => x.step_id === step.id && x.subject_id === id), 1);
      }
      for (const [sort_order, id] of sd.subjects.entries()) {
        const have = stepSubjects.find((x) => x.step_id === step.id && x.subject_id === id);
        if (have?.sort_order === sort_order) continue;
        const { error } = have
          ? await supabase.from("roadmap_step_subjects").update({ sort_order }).eq("step_id", step.id).eq("subject_id", id)
          : await supabase.from("roadmap_step_subjects").insert({ step_id: step.id, subject_id: id, sort_order });
        if (error) return fail(error);
        if (have) have.sort_order = sort_order;
        else stepSubjects.push({ step_id: step.id, subject_id: id, sort_order });
      }
    }
    drafts.delete(track.id);
    setState(`'${track.name}'을(를) 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
    draw();
  }

  async function setPosition(step, position) {
    const { error } = await supabase.from("roadmap_steps").update({ position }).eq("id", step.id);
    if (error) throw error;
    step.position = position;
  }
  // 단계 끌어 옮기기: 새 순서대로 1, 2, 3…(같은 줄에서 번호가 겹칠 수 없어 먼저 큰 번호로 비켜 둔다).
  async function moveStep(track, from, to) {
    const list = stepsOf(track);
    list.splice(to, 0, ...list.splice(from, 1));
    const spare = list.reduce((m, s) => Math.max(m, s.position), 0) + 1;
    try {
      for (const [i, s] of list.entries()) if (s.position !== i + 1) await setPosition(s, spare + i);
      for (const [i, s] of list.entries()) if (s.position !== i + 1) await setPosition(s, i + 1);
    } catch (error) {
      return fail(error);
    }
    setState("단계 순서를 바꿨습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
    draw();
  }

  async function moveTrack(from, to) {
    const list = trackList();
    list.splice(to, 0, ...list.splice(from, 1));
    for (const [i, t] of list.entries()) {
      if (t.sort_order === i) continue;
      const { error } = await supabase.from("roadmap_tracks").update({ sort_order: i }).eq("id", t.id);
      if (error) return fail(error);
      t.sort_order = i;
    }
    setState("로드맵 순서를 바꿨습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
    draw();
  }

  async function removeStep(track, step) {
    if (!confirm(`${track.name}의 ${step.position}단계를 삭제할까요?`)) return;
    const { error } = await supabase.from("roadmap_steps").delete().eq("id", step.id);
    if (error) return fail(error);
    steps.splice(steps.indexOf(step), 1);
    delete draftOf(track)?.steps[step.id];
    // 뒤 단계를 한 칸씩 당겨 번호가 비지 않게 한다(사이트는 번호를 칸 위치로 쓴다).
    try {
      for (const s of stepsOf(track).filter((s) => s.position > step.position)) await setPosition(s, s.position - 1);
    } catch (e) {
      fail(e);
    }
    draw();
  }

  async function addStep(track) {
    const position = stepsOf(track).reduce((m, s) => Math.max(m, s.position), 0) + 1;
    const step = { id: crypto.randomUUID(), track_id: track.id, position };
    const { error } = await supabase.from("roadmap_steps").insert(step);
    if (error) return fail(error);
    steps.push(step);
    draw();
    // 새 단계는 바로 과목을 고를 수 있게 목록을 열어 둔다.
    const boxes = board.querySelectorAll(`[data-track="${track.id}"] .roadmap-step`);
    const last = boxes[boxes.length - 1]?.querySelector("details.multi");
    if (last) last.open = true;
  }

  // 끌기: 지금 끄는 것이 줄인지 단계인지 기억해서, 줄은 줄끼리·단계는 같은 줄 단계끼리만 놓이게 한다.
  let dragging = null;
  const handle = (title) => el("span", { className: "drag-handle", textContent: "⠿", title });
  function draggable(box, grip, what) {
    grip.addEventListener("pointerdown", () => { box.draggable = true; });
    box.addEventListener("dragstart", (e) => {
      if (dragging) return; // 안쪽 단계를 끄는 중이면 바깥 줄은 그대로
      dragging = what;
      e.dataTransfer?.setData?.("text/plain", "");
      box.classList.add("dragging");
    });
    box.addEventListener("dragend", () => {
      dragging = null;
      box.draggable = false;
      box.classList.remove("dragging");
    });
  }

  const listLabel = (ids) => (ids.length ? ids.map((id) => nameOf(subjects, id)).join(", ") : "과목 고르기");
  function stepBox(track, step, index) {
    const editing = drafts.has(track.id);
    const sd = stepDraft(track, step);
    let picker;
    if (editing) {
      const list = choices(track);
      // 학과 밖 과목이 이미 골라져 있으면 목록 끝에 남겨 둔다(빼려면 체크 해제).
      const extra = sd.subjects.filter((id) => !list.some((s) => s.id === id))
        .map((id) => ({ id, name: `${nameOf(subjects, id)} (학과 밖)` }));
      const label = el("summary", { textContent: listLabel(sd.subjects) });
      const options = [...list, ...extra].map((s) => {
        const box = el("input", { type: "checkbox", checked: sd.subjects.includes(s.id), value: s.id });
        box.addEventListener("change", () => {
          sd.subjects = box.checked ? [...sd.subjects, s.id] : sd.subjects.filter((id) => id !== s.id);
          label.textContent = listLabel(sd.subjects);
        });
        return el("label", { className: "multi-option" }, [box, el("span", { textContent: s.name })]);
      });
      const pop = el("div", { className: "multi-list" },
        options.length ? options : [el("p", { className: "muted", textContent: "이 학과에 과목이 없습니다" })]);
      picker = el("details", { className: "multi" }, [label, pop]);
      // 목록은 화면 위에 띄워서(position: fixed) 줄 상자·가로 스크롤에 잘리지 않게 한다.
      picker.addEventListener("toggle", () => {
        if (!picker.open) return;
        const r = label.getBoundingClientRect();
        Object.assign(pop.style, { position: "fixed", top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${Math.max(r.width, 200)}px` });
      });
    } else {
      picker = el("div", { className: "multi-view", textContent: sd.subjects.length ? listLabel(sd.subjects) : "과목 없음" });
    }
    // 높이는 문구 줄 수만큼(최소 2줄) — 빈 공간 없이 한 화면에 더 많은 줄이 보이게.
    const lineCount = (sd.summary || "").split("\n").length;
    const summary = el("textarea", { value: sd.summary, rows: Math.max(2, lineCount), readOnly: !editing, placeholder: editing ? "요약(사이트 상자 문구)" : "" });
    summary.setAttribute("aria-label", `${step.position}단계 요약`);
    summary.addEventListener("input", () => { sd.summary = summary.value; });
    const source = el("button", { type: "button", className: "ghost-btn", textContent: "원문 보기" });
    source.addEventListener("click", () => showSource(track, step));
    const head = el("div", { className: "roadmap-step-head" }, [el("strong", { textContent: `${step.position}단계` })]);
    const box = el("section", { className: "roadmap-step" }, [head, picker, source, summary]);
    const grip = handle("끌어서 단계 순서 바꾸기");
    head.prepend(grip);
    draggable(box, grip, { kind: "step", track: track.id, index });
    dropTarget(box, index,
      () => (dragging?.kind === "step" && dragging.track === track.id ? dragging.index : -1),
      (from, to) => moveStep(track, from, to), "x");
    if (editing) {
      const del = el("button", { type: "button", className: "icon-btn", textContent: "×", title: "단계 삭제" });
      del.addEventListener("click", () => removeStep(track, step));
      head.append(del);
    }
    return box;
  }

  function trackRow(track, index) {
    const editing = drafts.has(track.id);
    const d = draftOf(track);
    const dept = el("select", { disabled: !editing }, [
      el("option", { value: "", textContent: "학과 없음" }),
      ...depts.map((x) => el("option", { value: x.id, textContent: x.name })),
    ]);
    dept.value = deptOf(track) ?? "";
    dept.setAttribute("aria-label", "학과");
    dept.addEventListener("change", () => {
      d.department_id = dept.value;
      draw(); // 단계 과목 목록을 새 학과로
    });
    const name = el("input", { type: "text", value: d?.name ?? track.name, readOnly: !editing });
    name.setAttribute("aria-label", "로드맵 이름");
    name.addEventListener("input", () => { d.name = name.value; });
    const button = (text, className, onClick) => {
      const b = el("button", { type: "button", className, textContent: text });
      b.addEventListener("click", onClick);
      return b;
    };
    const tools = editing
      ? [
        button("저장", "publish-btn", () => save(track)),
        button("취소", "ghost-btn", () => { drafts.delete(track.id); draw(); }),
        button("삭제", "ghost-btn danger", async () => {
          if (!confirm(cascadeMessage("로드맵", track.name, [["단계", stepsOf(track).length]]))) return;
          const { error } = await supabase.from("roadmap_tracks").delete().eq("id", track.id);
          if (error) return fail(error);
          tracks.splice(tracks.indexOf(track), 1);
          drafts.delete(track.id);
          draw();
        }),
      ]
      : [button("수정", "ghost-btn", () => {
        drafts.set(track.id, { name: track.name, department_id: track.department_id ?? "", steps: {} });
        draw();
      })];
    const list = stepsOf(track);
    const stepsBox = el("div", { className: "roadmap-steps" }, list.map((s, i) => stepBox(track, s, i)));
    if (editing) {
      stepsBox.append(button("+ 과목 추가", "ghost-btn roadmap-add-step", (e) => {
        e.stopPropagation(); // '다른 곳 누르면 닫기'가 새 단계의 열린 목록을 닫지 않게
        addStep(track);
      }));
    }
    const grip = handle("끌어서 로드맵 순서 바꾸기");
    const row = el("div", { className: `roadmap-track${editing ? " editing" : ""}` }, [
      grip,
      el("div", { className: "roadmap-track-head" }, [dept, name, el("div", { className: "roadmap-track-tools" }, tools)]),
      stepsBox,
    ]);
    row.dataset.track = track.id;
    draggable(row, grip, { kind: "track", index });
    dropTarget(row, index, () => (dragging?.kind === "track" ? dragging.index : -1), moveTrack);
    return row;
  }

  function draw() {
    const list = trackList();
    board.replaceChildren(...list.map(trackRow));
    if (!list.length) board.append(el("p", { className: "muted", textContent: "로드맵이 없습니다. 아래에서 추가해주세요." }));
  }
  addTrack.addEventListener("click", async () => {
    const row = {
      id: crypto.randomUUID(),
      name: freeName("새 로드맵", tracks, "name"),
      sort_order: tracks.reduce((m, t) => Math.max(m, t.sort_order ?? -1), -1) + 1,
    };
    const { error } = await supabase.from("roadmap_tracks").insert(row);
    if (error) return fail(error);
    tracks.push(row);
    drafts.set(row.id, { name: row.name, department_id: "", steps: {} }); // 새 줄은 바로 고치게
    draw();
  });
  draw();
}
