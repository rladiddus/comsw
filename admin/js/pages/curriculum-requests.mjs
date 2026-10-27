import { el, rows, rpc, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { driveThumbnail } from "../drive.mjs";
import { getServices } from "../services.mjs";
import { chooseThumbnail, stripCrop, applyCrop } from "../image-crop.mjs";
import { nextMonthName } from "../month.mjs";

// 커리큘럼 관리 > 신청 과목: 선생님이 승인 요청한 커리큘럼을 학과장·관리자가 다듬어 승인한다.
// 흐름 = ① 다듬기(처음부터 고칠 수 있음) → ② 학과·로드맵 문구(선택, 접힘) → ③ 맨 아래 [승인하기] 한 번.
// [승인하기]는 단계 저장 + 승인(comsw_approve_curriculum) 뒤, 새 문구 칸에 쓴 학과 커리큘럼·로드맵 문구도 반영하고 목록에서 뺀다.
// 강사·과목·학과 탭이 같은 신청을 한 묶음으로 보여 준다. 여러 달 과정은 [⋯ 과정 구성]에서 다음 달 추가·이 달 신청 삭제.
export async function render(container, { supabase, crop = chooseThumbnail, focus = null }) {
  const reload = (key) => {
    container.replaceChildren();
    return render(container, { supabase, crop, focus: key });
  };
  container.append(
    el("h2", { textContent: "신청 과목" }),
    el("p", {
      className: "desc",
      textContent:
        "선생님이 승인 요청한 커리큘럼입니다. 바로 고친 뒤 맨 아래 '승인하기'를 누르면 승인되고 목록에서 빠집니다. 공개 사이트에는 위쪽 '사이트에 반영' 후 보입니다.",
    }),
  );
  const setState = stateLine(container);
  const [pending, instructors, subjects, sets, weeks, tracks, steps, stepSubjects, materials] = await Promise.all([
    // 방특 제출은 '방학 특강'에서 그룹에 담으므로 여기서는 뺀다.
    rows(supabase, "instructor_curricula", (q) => q.eq("status", "pending").eq("vacation", false).order("sort_order")),
    rows(supabase, "instructors"),
    rows(supabase, "subjects"),
    rows(supabase, "curriculum_sets"),
    rows(supabase, "subject_weeks", (q) => q.order("sort_order")),
    rows(supabase, "roadmap_tracks"),
    rows(supabase, "roadmap_steps"),
    rows(supabase, "roadmap_step_subjects"),
    rows(supabase, "instructor_subject_materials"),
  ]);
  const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? "";
  const ai = async (kind, text) => {
    const fn = getServices().summarize;
    if (!fn) throw new Error("AI 연결을 준비 중입니다");
    return (await fn(kind, text)).text;
  };

  // 선생님이 이 과목에 적은 프로그램·준비물(저장 = 승인 때 과목 값에 새 항목만 합쳐짐).
  const materialsLine = (g) => {
    const m = materials.find((x) => x.instructor_id === g.instructor_id && x.subject_id === g.subject_id);
    if (!m || !(m.tools || m.supplies)) return [];
    return [el("p", { className: "muted request-materials", textContent:
      `선생님이 적은 프로그램: ${m.tools || "없음"} · 준비물: ${m.supplies || "없음"} (승인하면 학과 커리큘럼에 없는 항목만 더해집니다)` })];
  };

  // 강사·과목·학과 탭이 같은 신청을 한 묶음으로.
  const groups = [];
  for (const r of pending) {
    let g = groups.find((x) => x.instructor_id === r.instructor_id && x.subject_id === r.subject_id && x.set_id === r.set_id);
    if (!g) {
      g = { instructor_id: r.instructor_id, subject_id: r.subject_id, set_id: r.set_id, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  if (!groups.length) {
    container.append(el("p", { className: "muted", textContent: "새로 들어온 신청이 없습니다." }));
    return;
  }
  const pills = el("div", { className: "subject-tabs", role: "tablist" });
  const body = el("div", { className: "request-body" });
  container.append(pills, body);
  const label = (g) => `${nameOf(instructors, g.instructor_id)} · ${nameOf(subjects, g.subject_id)} (${g.rows.length}단계)`;
  const show = (g) => {
    for (const b of pills.children) b.classList.toggle("active", b.dataset.key === key(g));
    setState("");
    body.replaceChildren(...view(g));
  };
  const key = (g) => `${g.instructor_id}:${g.subject_id}:${g.set_id}`;
  for (const g of groups) {
    const b = el("button", { type: "button", role: "tab", textContent: label(g) });
    b.dataset.key = key(g);
    b.addEventListener("click", () => show(g));
    pills.append(b);
  }

  function view(g) {
    const subject = subjects.find((s) => s.id === g.subject_id);
    const teacher = nameOf(instructors, g.instructor_id);
    // ── ① 다듬기: 단계 / 선생님 원문 / 사이트에 보이는 문구 / 이미지 (처음부터 고칠 수 있음) ──
    const rowViews = g.rows.map((r) => {
      const step = el("input", { type: "text", value: r.step_label });
      step.setAttribute("aria-label", "단계");
      const written = el("textarea", { value: r.written ?? "", rows: 4 });
      written.setAttribute("aria-label", "선생님 원문");
      const summary = el("textarea", { value: r.summary ?? "", rows: 3, placeholder: "비어 있으면 아래 '빈 문구 AI로 채우기' 또는 직접 작성" });
      summary.setAttribute("aria-label", "사이트에 보이는 문구");
      const fillAi = async () => {
        if (!written.value.trim()) throw new Error(`${step.value || r.step_label}: 선생님 원문을 먼저 입력해주세요`);
        summary.value = await ai("week", written.value);
      };
      let media = r.media_url ?? "";
      const thumb = el("div", { className: "submission-thumb" });
      const paintThumb = () => thumb.replaceChildren(
        media ? applyCrop(el("img", { src: driveThumbnail(media), alt: `${r.step_label} 이미지` }), media) : el("span", { textContent: "이미지 없음" }),
      );
      paintThumb();
      // 원본은 그대로 두고 썸네일 영역('#crop=…')만 다시 고른다. 예전 드라이브 링크는 다시 자를 수 없어 링크를 숨긴다.
      const recrop = el("button", { type: "button", className: "link-btn", textContent: "썸네일 조정" });
      const canCrop = () => Boolean(media) && !/drive.google.com/.test(media);
      recrop.hidden = !canCrop();
      recrop.addEventListener("click", async () => {
        recrop.disabled = true;
        try {
          const fragment = await crop(media);
          if (!fragment) return;
          media = `${stripCrop(media)}${fragment}`;
          paintThumb();
          markDirty();
          setState("썸네일 영역을 다시 골랐습니다. '승인하기'를 눌러야 반영됩니다.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          recrop.disabled = false;
        }
      });
      return {
        line: el("div", { className: "request-row" }, [
          el("div", { className: "request-cell" }, [step]),
          el("div", { className: "request-cell" }, [written]),
          el("div", { className: "request-cell" }, [summary]),
          el("div", { className: "request-cell request-image" }, [thumb, recrop]),
        ]),
        reset() {
          step.value = r.step_label;
          written.value = r.written ?? "";
          summary.value = r.summary ?? "";
          media = r.media_url ?? "";
          recrop.hidden = !canCrop();
          paintThumb();
        },
        values: () => ({ step_label: step.value.trim(), written: written.value, summary: summary.value.trim() || null, media_url: media || null }),
        fillAi,
        summary,
        row: r,
      };
    });
    const status = el("span", { className: "status-pill pending", textContent: "승인 대기" });
    const fillEmpty = el("button", { type: "button", className: "ghost-btn ai-btn", textContent: "빈 문구 AI로 채우기" });
    fillEmpty.title = "사이트에 보이는 문구가 빈 단계만 선생님 원문으로 채웁니다. 한 칸만 다시 만들려면 그 칸을 비우고 누르세요.";
    async function fillEmptySummaries(list) {
      fillEmpty.disabled = approve.disabled = true;
      try {
        setState("AI 요약 중…");
        for (const v of list) await v.fillAi();
        markDirty();
        setState("빈 문구를 AI로 채웠습니다. 확인 후 '승인하기'를 눌러주세요.");
      } catch (e) {
        setState(e.message, true);
      } finally {
        fillEmpty.disabled = approve.disabled = false;
      }
    }
    fillEmpty.addEventListener("click", () => {
      const empty = rowViews.filter((v) => !v.values().summary);
      if (!empty.length) return setState("빈 문구가 없습니다. 다시 만들려면 그 칸을 비우고 눌러주세요.");
      fillEmptySummaries(empty);
    });
    const teacherText = () => rowViews.map((v) => {
      const x = v.values();
      return `${x.step_label}: ${x.summary || x.written}`;
    }).join("\n");

    // ── ② 학과·로드맵 문구(선택): 현재 / 새 문구. 새 문구 칸에 쓴 것만 승인할 때 반영 ──
    const current = el("textarea", { value: subject?.dept_curriculum ?? "", rows: 4, readOnly: true });
    const fresh = el("textarea", { rows: 4, placeholder: "비워 두면 지금 문구 그대로" });
    // 한 단계에 과목이 둘이면 문구 줄도 과목 순서대로 하나씩이다. 신청한 과목의 줄만 바꾸고 다른 과목 줄은 그대로 둔다.
    const roadmapSteps = steps.filter((st) => stepSubjects.some((x) => x.step_id === st.id && x.subject_id === g.subject_id));
    const roadmapViews = roadmapSteps.map((st) => {
      const members = stepSubjects.filter((x) => x.step_id === st.id)
        .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
      const shared = members.length > 1;
      const at = members.findIndex((x) => x.subject_id === g.subject_id);
      const lines = () => String(st.summary ?? "").split("\n");
      const mine = () => (shared ? lines()[at] ?? "" : st.summary ?? "");
      const now = el("textarea", { value: mine(), rows: shared ? 1 : 2, readOnly: true });
      const next = el("textarea", { rows: shared ? 1 : 2, placeholder: "비워 두면 지금 문구 그대로" });
      const otherLines = shared
        ? members.map((x, i) => (i === at ? null : `${nameOf(subjects, x.subject_id)}: ${lines()[i] ?? ""}`)).filter(Boolean)
        : [];
      return {
        step: st,
        next,
        async generate() {
          const text = await ai("roadmap", [
            `[과목] ${subject?.name ?? ""}`,
            st.source_text,
            fresh.value.trim() || current.value,
          ].filter(Boolean).join("\n"));
          // 과목이 함께 묶인 단계는 이 과목 몫인 한 줄만 쓴다.
          next.value = shared ? text.split("\n").map((x) => x.trim()).find(Boolean) ?? "" : text;
        },
        // 이 과목 줄만 바꾼 단계 전체 문구.
        merged(text) {
          if (!shared) return text;
          const all = lines();
          while (all.length < members.length) all.push("");
          all[at] = text.replace(/\n+/g, " ");
          return all.join("\n");
        },
        el: el("div", { className: "compare-block" }, [
          el("h4", { textContent: `로드맵 · ${nameOf(tracks, st.track_id)} · ${st.position}단계` }),
          el("div", { className: "compare-row" }, [
            el("label", { className: "form-field" }, [el("span", { textContent: "현재" }), now]),
            el("label", { className: "form-field" }, [el("span", { textContent: "새 문구" }), next]),
          ]),
          ...(otherLines.length
            ? [el("p", { className: "muted", textContent: `같은 단계의 다른 과목 줄(그대로 유지) — ${otherLines.join(" · ")}` })]
            : []),
        ]),
      };
    });
    // 빈 새 문구 칸만 AI로: 학과 문구를 먼저 만들고, 그 문구로 로드맵 문구를 만든다.
    const genTexts = el("button", { type: "button", className: "ghost-btn ai-btn", textContent: "새 문구 AI로 만들기" });
    genTexts.title = "비어 있는 새 문구 칸만 만듭니다. 한 칸만 다시 만들려면 그 칸을 비우고 누르세요.";
    genTexts.addEventListener("click", async () => {
      const todo = roadmapViews.filter((v) => !v.next.value.trim());
      if (fresh.value.trim() && !todo.length) return setState("새 문구가 모두 있습니다. 다시 만들려면 그 칸을 비우고 눌러주세요.");
      genTexts.disabled = approve.disabled = true;
      try {
        if (!fresh.value.trim()) {
          setState("학과 커리큘럼 문구를 만드는 중…");
          const stepsText = weeks.filter((w) => w.subject_id === g.subject_id)
            .map((w) => `${w.week_label}: ${w.summary || w.written || ""}`).join("\n");
          fresh.value = await ai("department", [
            `[과목] ${subject?.name ?? ""}`,
            `[지금 학과 커리큘럼]\n${current.value}`,
            stepsText && `[지금 단계별 내용]\n${stepsText}`,
            `[${teacher} 선생님 신청 커리큘럼]\n${teacherText()}`,
          ].filter(Boolean).join("\n\n"));
        }
        for (const v of todo) {
          setState("로드맵 문구를 만드는 중…");
          await v.generate();
        }
        markDirty();
        setState("새 문구를 만들었습니다. 확인 후 '승인하기'를 누르면 함께 반영됩니다.");
      } catch (e) {
        setState(e.message, true);
      } finally {
        genTexts.disabled = approve.disabled = false;
      }
    });
    const texts = el("details", { className: "workspace-card request-section request-texts" }, [
      el("summary", { textContent: "② 학과·로드맵 문구도 바꾸기 (선택)" }),
      el("p", { className: "muted", textContent: "새 문구 칸에 쓴 것만 '승인하기' 때 함께 반영합니다. 비워 두면 지금 문구 그대로입니다." }),
      el("div", { className: "box-title" }, [genTexts]),
      el("div", { className: "compare-block" }, [
        el("h4", { textContent: `학과 커리큘럼 · ${subject?.name ?? ""}` }),
        el("div", { className: "compare-row" }, [
          el("label", { className: "form-field" }, [el("span", { textContent: "현재" }), current]),
          el("label", { className: "form-field" }, [el("span", { textContent: "새 문구" }), fresh]),
        ]),
      ]),
      ...(roadmapViews.length
        ? roadmapViews.map((v) => v.el)
        : [el("p", { className: "muted", textContent: "이 과목이 들어간 로드맵 단계가 없습니다." })]),
    ]);

    // ── 고친 것 취소: 고친 것이 있을 때만 보인다 ──
    const cancel = el("button", { type: "button", className: "ghost-btn", textContent: "고친 것 취소", hidden: true });
    function markDirty() {
      cancel.hidden = false;
    }
    cancel.addEventListener("click", () => {
      rowViews.forEach((v) => v.reset());
      fresh.value = "";
      roadmapViews.forEach((v) => (v.next.value = ""));
      cancel.hidden = true;
      setState("선생님이 낸 내용으로 되돌렸습니다");
    });

    // ── ③ 승인하기: 단계 저장 + 승인 → 새 문구 반영 → 목록에서 빼기 ──
    const approve = el("button", { type: "button", className: "publish-btn", textContent: "승인하기" });
    approve.addEventListener("click", async () => {
      // 사이트에 보이는 문구가 비어 있으면 승인하지 않고 AI생성·직접 작성을 고르게 한다.
      const empty = rowViews.filter((v) => !v.values().summary);
      if (empty.length) return askSummary(empty);
      approve.disabled = true;
      try {
        if (!g.saved) {
          for (const v of rowViews) {
            const patch = v.values();
            if (!patch.step_label || !patch.written.trim()) throw new Error(`${patch.step_label || v.row.step_label}: 단계와 선생님 원문을 확인해주세요`);
            const { error } = await supabase.from("instructor_curricula").update(patch).eq("id", v.row.id);
            if (error) throw new Error(dbErrorMessage(error));
            await rpc(supabase, "comsw_approve_curriculum", { p_id: v.row.id });
            Object.assign(v.row, patch);
          }
          g.saved = true;
          status.className = "status-pill approved";
          status.textContent = "승인됨";
        }
      } catch (e) {
        approve.disabled = false;
        return setState(e.message, true);
      }
      // 승인은 끝났다. 문구 반영이 실패하면 그렇게 알리고 다시 누르면 문구만 반영한다.
      const done = [];
      try {
        const deptText = fresh.value.trim();
        if (deptText) {
          const { error } = await supabase.from("subjects").update({ dept_curriculum: deptText }).eq("id", g.subject_id);
          if (error) throw new Error(dbErrorMessage(error));
          subject.dept_curriculum = current.value = deptText;
          fresh.value = "";
          done.push("학과 커리큘럼");
        }
        for (const v of roadmapViews.filter((x) => x.next.value.trim())) {
          const summary = v.merged(v.next.value.trim());
          const { error } = await supabase.from("roadmap_steps").update({ summary }).eq("id", v.step.id);
          if (error) throw new Error(dbErrorMessage(error));
          v.step.summary = summary;
          v.next.value = "";
          if (!done.includes("로드맵")) done.push("로드맵");
        }
      } catch (e) {
        approve.disabled = false;
        approve.textContent = "문구 다시 반영";
        texts.open = true;
        return setState(`승인은 됐습니다. 학과·로드맵 문구는 반영하지 못했습니다: ${e.message} — '문구 다시 반영'을 눌러주세요.`, true);
      }
      groups.splice(groups.indexOf(g), 1);
      [...pills.children].find((b) => b.dataset.key === key(g))?.remove();
      if (groups.length) show(groups[0]);
      else body.replaceChildren(el("p", { className: "muted", textContent: "새로 들어온 신청이 없습니다." }));
      setState(`${label(g)} 승인했습니다${done.length ? `(${done.join("·")} 문구 함께 반영)` : ""}. 공개 사이트에는 위쪽 '사이트에 반영' 후 보입니다.`);
    });
    function askSummary(empty) {
      const names = empty.map((v) => v.values().step_label || v.row.step_label).join(", ");
      const aiPick = el("button", { type: "button", className: "publish-btn", textContent: "AI생성" });
      const typePick = el("button", { type: "button", className: "ghost-btn", textContent: "직접 작성" });
      const dialog = el("dialog", { className: "idle-dialog summary-dialog" }, [
        el("h3", { textContent: "문구가 비어 있습니다" }),
        el("p", { textContent: `${names} 문구가 비어 있습니다. AI생성 또는 직접 작성을 진행해주세요. (이 문구가 공개 사이트에 보입니다)` }),
        el("div", { className: "form-actions" }, [aiPick, typePick]),
      ]);
      const close = () => {
        dialog.close?.();
        dialog.remove();
      };
      dialog.addEventListener("close", () => dialog.remove());
      aiPick.addEventListener("click", () => {
        close();
        fillEmptySummaries(empty);
      });
      typePick.addEventListener("click", () => {
        close();
        empty[0].summary.scrollIntoView?.({ block: "center" });
        empty[0].summary.focus();
      });
      document.body.append(dialog);
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    // ── ⋯ 과정 구성: 다음 달 과목 추가 · 이 달 신청 삭제 ──
    const addMonth = el("button", { type: "button", className: "ghost-btn", textContent: "다음 달 과목 추가" });
    addMonth.title = "다음 달 과목(예: 웹툰1 → 웹툰2)에 빈 1단계 신청을 만듭니다.";
    addMonth.addEventListener("click", async () => {
      const name = nextMonthName(subject?.name ?? "", subjects.map((s) => s.name));
      if (!confirm(`'${name}' 과목에 ${teacher} 선생님의 빈 1단계 신청을 만들까요?`)) return;
      addMonth.disabled = true;
      try {
        // 과목 만들기와 빈 1단계 신청을 DB 함수 한 번으로(한쪽만 남지 않게)
        const id = await rpc(supabase, "comsw_add_month_request", {
          p_from: g.subject_id, p_name: name, p_set_id: g.set_id, p_instructor_id: g.instructor_id,
        });
        await reload(`${g.instructor_id}:${id}:${g.set_id}`);
      } catch (e) {
        setState(e.message, true);
        addMonth.disabled = false;
      }
    });
    const dropMonth = el("button", { type: "button", className: "ghost-btn danger", textContent: "이 달 신청 삭제" });
    dropMonth.addEventListener("click", async () => {
      if (!confirm(`${label(g)} 신청을 모두 지울까요? 선생님이 낸 이 과목 신청이 삭제됩니다(이미 승인된 커리큘럼은 그대로).`)) return;
      dropMonth.disabled = true;
      try {
        // 이 묶음의 승인 대기 줄을 한 번에 지운다(일부만 지워지지 않게, DB가 같은 묶음인지 확인)
        await rpc(supabase, "comsw_drop_requests", { p_ids: g.rows.map((r) => r.id) });
        await reload(null);
      } catch (e) {
        setState(e.message, true);
        dropMonth.disabled = false;
      }
    });
    const menu = el("details", { className: "request-menu" }, [
      el("summary", { textContent: "⋯ 과정 구성" }),
      el("div", { className: "request-menu-items" }, [addMonth, dropMonth]),
    ]);

    const review = el("section", { className: "workspace-card request-section" }, [
      el("h4", { className: "request-step-title", textContent: "① 다듬기" }),
      el("div", { className: "request-row request-head" },
        ["단계", "선생님 원문", "사이트에 보이는 문구", "이미지"].map((t) => el("span", { textContent: t }))),
      ...rowViews.map((v) => v.line),
      el("div", { className: "box-title request-fill" }, [fillEmpty]),
      ...materialsLine(g),
    ]);
    review.addEventListener("input", markDirty);
    texts.addEventListener("input", markDirty);
    return [
      el("div", { className: "request-title" }, [
        el("h3", { textContent: `${subject?.name ?? ""} · ${teacher} 선생님 · ${nameOf(sets, g.set_id)}` }),
        status,
        menu,
      ]),
      review,
      texts,
      el("div", { className: "form-actions request-apply" }, [
        cancel,
        el("span", { className: "muted", textContent: "③ 승인하면 목록에서 빠집니다." }),
        approve,
      ]),
    ];
  }
  show(groups.find((g) => key(g) === focus) ?? groups[0]);
}
