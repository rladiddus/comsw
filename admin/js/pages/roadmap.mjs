import { el, rows, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { freeName } from "../order.mjs";
import { cascadeMessage } from "../format.mjs";

// 로드맵: 공개 사이트 로드맵처럼 한 줄 = 로드맵 묶음(보통 학과), 오른쪽으로 단계 상자가 이어진다.
// 왼쪽에서 학과를 고르면 단계 상자의 과목 목록은 '학과 커리큘럼'의 학과 과목(subject_departments)으로 좁혀진다.
// 단계 상자: 과목 여러 개 선택, '원문 보기'(고른 과목의 커리큘럼 모아 보기), 아래 요약(사이트 문구).
// 순서: 단계는 ◀ ▶(좌우), 묶음은 ▲ ▼(위아래). 바꾼 내용은 '적용' 후 사이트에 나온다.
export async function render(container, { supabase }) {
  container.append(
    el("h2", { textContent: "로드맵" }),
    el("p", {
      className: "desc",
      textContent:
        "왼쪽에서 학과를 고르면 그 학과 과목('커리큘럼 관리 > 학과 커리큘럼')에서 단계마다 과목을 고릅니다. '원문 보기'로 고른 과목의 커리큘럼을 모아 보고, 아래 요약이 사이트 상자 문구입니다.",
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
  // 열린 과목 고르기 목록은 다른 곳을 누르면 닫는다.
  container.addEventListener("click", (e) => {
    for (const d of container.querySelectorAll("details.multi[open]")) if (!d.contains(e.target)) d.open = false;
  });

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? "";
  const ordered = (list) => [...list].sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
  const trackList = () => ordered(tracks);
  const stepsOf = (track) => steps.filter((s) => s.track_id === track.id).sort((a, b) => a.position - b.position);
  const chosen = (step) => ordered(stepSubjects.filter((x) => x.step_id === step.id)).map((x) => x.subject_id);
  // 학과가 있으면 그 학과 과목만(전체 수업 순서), 없으면 모든 과목.
  const choices = (track) => {
    if (!track.department_id) return [...subjects].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const ids = new Set(links.filter((l) => l.department_id === track.department_id).map((l) => l.subject_id));
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
    const ids = chosen(step);
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

  async function toggle(step, subjectId, on) {
    if (on) {
      const sort_order = stepSubjects.filter((x) => x.step_id === step.id).reduce((m, x) => Math.max(m, x.sort_order ?? -1), -1) + 1;
      const row = { step_id: step.id, subject_id: subjectId, sort_order };
      const { error } = await supabase.from("roadmap_step_subjects").insert(row);
      if (error) return fail(error);
      stepSubjects.push(row);
    } else {
      const { error } = await supabase.from("roadmap_step_subjects").delete().eq("step_id", step.id).eq("subject_id", subjectId);
      if (error) return fail(error);
      stepSubjects.splice(stepSubjects.findIndex((x) => x.step_id === step.id && x.subject_id === subjectId), 1);
    }
    setState("저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
  }

  async function setPosition(step, position) {
    const { error } = await supabase.from("roadmap_steps").update({ position }).eq("id", step.id);
    if (error) throw error;
    step.position = position;
  }
  // 단계 자리 바꾸기(같은 줄에서 단계 번호는 겹칠 수 없어 잠깐 빈 번호를 거친다).
  async function swap(a, b) {
    const [pa, pb] = [a.position, b.position];
    const spare = Math.max(...steps.filter((s) => s.track_id === a.track_id).map((s) => s.position)) + 1;
    try {
      await setPosition(a, spare);
      await setPosition(b, pa);
      await setPosition(a, pb);
    } catch (error) {
      return fail(error);
    }
    setState("단계 순서를 바꿨습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
    draw();
  }

  async function removeStep(track, step) {
    if (!confirm(`${track.name}의 ${step.position}단계를 삭제할까요?`)) return;
    const { error } = await supabase.from("roadmap_steps").delete().eq("id", step.id);
    if (error) return fail(error);
    steps.splice(steps.indexOf(step), 1);
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

  async function moveTrack(track, delta) {
    const list = trackList();
    const from = list.indexOf(track);
    const to = from + delta;
    if (to < 0 || to >= list.length) return;
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

  async function updateTrack(track, patch) {
    const { error } = await supabase.from("roadmap_tracks").update(patch).eq("id", track.id);
    if (error) return fail(error);
    Object.assign(track, patch);
    setState("저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
  }

  function stepBox(track, step, index, all) {
    const ids = chosen(step);
    const list = choices(track);
    // 학과 밖 과목이 이미 골라져 있으면 목록 끝에 남겨 둔다(빼려면 체크 해제).
    const extra = ids.filter((id) => !list.some((s) => s.id === id)).map((id) => ({ id, name: `${nameOf(subjects, id)} (학과 밖)` }));
    const label = el("summary", { textContent: ids.length ? ids.map((id) => nameOf(subjects, id)).join(", ") : "과목 고르기" });
    const options = [...list, ...extra].map((s) => {
      const box = el("input", { type: "checkbox", checked: ids.includes(s.id), value: s.id });
      box.addEventListener("change", async () => {
        if (await toggle(step, s.id, box.checked)) {
          box.checked = !box.checked;
          return;
        }
        const now = chosen(step);
        label.textContent = now.length ? now.map((id) => nameOf(subjects, id)).join(", ") : "과목 고르기";
      });
      return el("label", { className: "multi-option" }, [box, el("span", { textContent: s.name })]);
    });
    const multi = el("details", { className: "multi" }, [
      label,
      el("div", { className: "multi-list" }, options.length ? options : [el("p", { className: "muted", textContent: "이 학과에 과목이 없습니다" })]),
    ]);
    const summary = el("textarea", { value: step.summary ?? "", rows: 4, placeholder: "요약(사이트 상자 문구)" });
    summary.setAttribute("aria-label", `${step.position}단계 요약`);
    summary.addEventListener("change", async () => {
      const value = summary.value.trim() || null;
      const { error } = await supabase.from("roadmap_steps").update({ summary: value }).eq("id", step.id);
      if (error) return fail(error);
      step.summary = value;
      setState("요약을 저장했습니다. 공개 사이트에는 '적용' 후 반영됩니다.");
    });
    const tool = (text, title, onClick, disabled = false) => {
      const b = el("button", { type: "button", className: "icon-btn", textContent: text, title, disabled });
      b.addEventListener("click", onClick);
      return b;
    };
    const source = el("button", { type: "button", className: "ghost-btn", textContent: "원문 보기" });
    source.addEventListener("click", () => showSource(track, step));
    return el("section", { className: "roadmap-step" }, [
      el("div", { className: "roadmap-step-head" }, [
        el("strong", { textContent: `${step.position}단계` }),
        tool("◀", "왼쪽으로", () => swap(step, all[index - 1]), index === 0),
        tool("▶", "오른쪽으로", () => swap(step, all[index + 1]), index === all.length - 1),
        tool("×", "단계 삭제", () => removeStep(track, step)),
      ]),
      multi,
      source,
      summary,
    ]);
  }

  function trackRow(track, index, all) {
    const dept = el("select", {}, [
      el("option", { value: "", textContent: "학과 없음" }),
      ...depts.map((d) => el("option", { value: d.id, textContent: d.name })),
    ]);
    dept.value = track.department_id ?? "";
    dept.setAttribute("aria-label", "학과");
    dept.addEventListener("change", async () => {
      await updateTrack(track, { department_id: dept.value || null });
      draw();
    });
    const name = el("input", { type: "text", value: track.name });
    name.setAttribute("aria-label", "로드맵 이름");
    name.addEventListener("change", () => {
      const value = name.value.trim();
      if (!value) {
        name.value = track.name;
        return setState("로드맵 이름을 입력해주세요", true);
      }
      updateTrack(track, { name: value });
    });
    const tool = (text, title, onClick, disabled = false) => {
      const b = el("button", { type: "button", className: "icon-btn", textContent: text, title, disabled });
      b.addEventListener("click", onClick);
      return b;
    };
    const remove = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
    remove.addEventListener("click", async () => {
      const n = stepsOf(track).length;
      if (!confirm(cascadeMessage("로드맵", track.name, [["단계", n]]))) return;
      const { error } = await supabase.from("roadmap_tracks").delete().eq("id", track.id);
      if (error) return fail(error);
      tracks.splice(tracks.indexOf(track), 1);
      draw();
    });
    const add = el("button", { type: "button", className: "ghost-btn roadmap-add-step", textContent: "+ 과목 추가" });
    add.addEventListener("click", (e) => {
      e.stopPropagation(); // 아래 '다른 곳 누르면 닫기'가 새 단계의 열린 목록을 닫지 않게
      addStep(track);
    });
    const list = stepsOf(track);
    const row = el("div", { className: "roadmap-track" }, [
      el("div", { className: "roadmap-track-head" }, [
        dept,
        name,
        el("div", { className: "roadmap-track-tools" }, [
          tool("▲", "위로", () => moveTrack(track, -1), index === 0),
          tool("▼", "아래로", () => moveTrack(track, 1), index === all.length - 1),
          remove,
        ]),
      ]),
      el("div", { className: "roadmap-steps" }, [...list.map((s, i) => stepBox(track, s, i, list)), add]),
    ]);
    row.dataset.track = track.id;
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
    draw();
  });
  draw();
}
