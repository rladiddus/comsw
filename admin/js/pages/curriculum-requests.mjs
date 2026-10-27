import { el, rows, rpc, stateLine } from "../teacher-workspace.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { driveThumbnail } from "../drive.mjs";
import { getServices } from "../services.mjs";
import { chooseThumbnail, stripCrop, applyCrop } from "../image-crop.mjs";
import { nextMonthName } from "../month.mjs";

// 커리큘럼 관리 > 신청 과목: 선생님이 승인 요청한 커리큘럼을 학과장·관리자가 다듬어 저장(=승인)하고,
// 그 과목의 학과 커리큘럼 요약과 로드맵 문구를 AI로 새로 만들어 '적용'한다.
// 강사·과목·학과 탭이 같은 신청을 한 묶음으로 보여 준다.
// 여러 달 과정(웹툰1, 웹툰2 …)은 학과장이 '+ 개월 추가'(다음 달 과목 + 빈 1단계 신청)와 '이 개월 빼기'(이 묶음 신청 삭제)로 늘리고 줄인다.
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
        "선생님이 승인 요청한 커리큘럼입니다. '수정'으로 다듬고(AI 요약·직접 수정·이미지 다시 자르기) '저장'하면 그 선생님 커리큘럼으로 승인됩니다. 아래에서 학과 커리큘럼·로드맵 문구를 새로 만들어 '적용'할 수 있습니다.",
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
    // ── 1. 신청 내용: 강사명 / 과목명 / 단계 / 커리큘럼 / 이미지 ──
    let editing = false;
    const rowViews = g.rows.map((r) => {
      const step = el("input", { type: "text", value: r.step_label, readOnly: true });
      const written = el("textarea", { value: r.written ?? "", rows: 4, readOnly: true });
      const summary = el("textarea", { value: r.summary ?? "", rows: 2, readOnly: true, placeholder: "AI 요약 또는 직접 작성" });
      const aiBtn = el("button", { type: "button", className: "ghost-btn ai-btn", textContent: "AI 요약", hidden: true });
      const fillAi = async () => {
        if (!written.value.trim()) throw new Error(`${step.value || r.step_label}: 커리큘럼 원문을 먼저 입력해주세요`);
        summary.value = await ai("week", written.value);
      };
      aiBtn.addEventListener("click", async () => {
        aiBtn.disabled = true;
        try {
          setState("AI 요약 중…");
          await fillAi();
          setState("AI 요약을 넣었습니다. 확인 후 '저장'을 눌러주세요.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          aiBtn.disabled = false;
        }
      });
      let media = r.media_url ?? "";
      const thumb = el("div", { className: "submission-thumb" });
      const paintThumb = () => thumb.replaceChildren(
        media ? applyCrop(el("img", { src: driveThumbnail(media), alt: `${r.step_label} 이미지` }), media) : el("span", { textContent: "이미지 없음" }),
      );
      paintThumb();
      const recrop = el("button", { type: "button", className: "ghost-btn", textContent: "다시 자르기", hidden: true });
      recrop.addEventListener("click", async () => {
        recrop.disabled = true;
        try {
          // 원본은 그대로 두고 썸네일 영역('#crop=…')만 다시 고른다(새로 올리지 않음). 예전 드라이브 링크는 안 됨.
          if (/drive.google.com/.test(media)) throw new Error("이 이미지는 예전 드라이브 링크라 다시 자를 수 없습니다.");
          const fragment = await crop(media);
          if (!fragment) return;
          media = `${stripCrop(media)}${fragment}`;
          paintThumb();
          setState("썸네일 영역을 다시 골랐습니다. '저장'을 눌러야 반영됩니다.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          recrop.disabled = false;
        }
      });
      const line = el("div", { className: "request-row" }, [
        el("span", { className: "request-cell", textContent: nameOf(instructors, g.instructor_id) }),
        el("span", { className: "request-cell", textContent: subject?.name ?? "" }),
        el("div", { className: "request-cell" }, [step]),
        el("div", { className: "request-cell request-text" }, [
          written,
          el("div", { className: "request-summary" }, [summary, aiBtn]),
        ]),
        el("div", { className: "request-cell request-image" }, [thumb, recrop]),
      ]);
      return {
        line,
        setEditing(on) {
          step.readOnly = written.readOnly = summary.readOnly = !on;
          aiBtn.hidden = !on;
          recrop.hidden = !on || !media;
        },
        // 되돌리기: 마지막 저장 값으로
        reset() {
          step.value = r.step_label;
          written.value = r.written ?? "";
          summary.value = r.summary ?? "";
          media = r.media_url ?? "";
          paintThumb();
        },
        values: () => ({ step_label: step.value.trim(), written: written.value, summary: summary.value.trim() || null, media_url: media || null }),
        fillAi,
        summary,
        row: r,
      };
    });
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    const revert = el("button", { type: "button", className: "ghost-btn", textContent: "되돌리기", hidden: true });
    const status = el("span", { className: "status-pill pending", textContent: g.saved ? "승인됨" : "승인 대기" });
    if (g.saved) status.className = "status-pill approved";
    edit.addEventListener("click", async () => {
      if (!editing) {
        editing = true;
        rowViews.forEach((v) => v.setEditing(true));
        revert.hidden = false;
        edit.textContent = "저장";
        edit.className = "publish-btn";
        return;
      }
      // 아래 칸(요약)이 사이트에 보이는 문구다. 비어 있으면 저장(승인)하지 않고 AI생성·직접 작성을 고르게 한다.
      const empty = rowViews.filter((v) => !v.values().summary);
      if (empty.length) return askSummary(empty);
      edit.disabled = true;
      try {
        for (const v of rowViews) {
          const patch = v.values();
          if (!patch.step_label || !patch.written.trim()) throw new Error("단계와 커리큘럼 내용을 확인해주세요");
          const { error } = await supabase.from("instructor_curricula").update(patch).eq("id", v.row.id);
          if (error) throw new Error(dbErrorMessage(error));
          if (!g.saved) await rpc(supabase, "comsw_approve_curriculum", { p_id: v.row.id });
          Object.assign(v.row, patch);
        }
        g.saved = true;
        editing = false;
        rowViews.forEach((v) => v.setEditing(false));
        revert.hidden = true;
        edit.textContent = "수정";
        edit.className = "ghost-btn";
        status.className = "status-pill approved";
        status.textContent = "승인됨";
        setState(`${nameOf(instructors, g.instructor_id)} 선생님의 커리큘럼으로 저장(승인)했습니다. 공개 사이트에는 '적용' 후 반영됩니다.`);
      } catch (e) {
        setState(e.message, true);
      } finally {
        edit.disabled = false;
      }
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
      aiPick.addEventListener("click", async () => {
        close();
        edit.disabled = true;
        try {
          setState("AI 요약 중…");
          for (const v of empty) await v.fillAi();
          setState("AI 요약을 넣었습니다. 확인 후 '저장'을 눌러주세요.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          edit.disabled = false;
        }
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
    revert.addEventListener("click", () => {
      editing = false;
      rowViews.forEach((v) => {
        v.reset();
        v.setEditing(false);
      });
      revert.hidden = true;
      edit.textContent = "수정";
      edit.className = "ghost-btn";
      setState("마지막 저장 상태로 되돌렸습니다");
    });
    const teacherText = () => rowViews.map((v) => {
      const x = v.values();
      return `${x.step_label}: ${x.summary || x.written}`;
    }).join("\n");

    // ── 2. 학과 커리큘럼(과목의 학과별 커리큘럼 요약): 현재 / 신규 ──
    const current = el("textarea", { value: subject?.dept_curriculum ?? "", rows: 4, readOnly: true });
    const fresh = el("textarea", { rows: 4, placeholder: "'학과 커리큘럼 생성'을 누르면 AI가 만든 문구가 들어갑니다. 직접 고칠 수 있습니다." });
    const genDept = el("button", { type: "button", className: "ghost-btn ai-btn", textContent: "학과 커리큘럼 생성" });
    genDept.addEventListener("click", async () => {
      genDept.disabled = true;
      try {
        setState("학과 커리큘럼을 만드는 중…");
        const stepsText = weeks.filter((w) => w.subject_id === g.subject_id)
          .map((w) => `${w.week_label}: ${w.summary || w.written || ""}`).join("\n");
        fresh.value = await ai("department", [
          `[과목] ${subject?.name ?? ""}`,
          `[지금 학과 커리큘럼]\n${current.value}`,
          stepsText && `[지금 단계별 내용]\n${stepsText}`,
          `[${nameOf(instructors, g.instructor_id)} 선생님 신청 커리큘럼]\n${teacherText()}`,
        ].filter(Boolean).join("\n\n"));
        setState("학과 커리큘럼 신규 문구를 만들었습니다. 확인 후 아래 '적용'을 눌러주세요.");
      } catch (e) {
        setState(e.message, true);
      } finally {
        genDept.disabled = false;
      }
    });

    // ── 3. 로드맵: 이 과목이 들어간 단계마다, 이 과목의 줄만 현재 / 신규 ──
    // 한 단계에 과목이 둘이면 문구 줄도 과목 순서대로 하나씩이다. 신청한 과목의 줄만 바꾸고 다른 과목 줄은 그대로 둔다.
    // (과목 묶기는 나중에 로드맵에서 설정)
    const roadmapSteps = steps.filter((st) => stepSubjects.some((x) => x.step_id === st.id && x.subject_id === g.subject_id));
    const roadmapViews = roadmapSteps.map((st) => {
      const members = stepSubjects.filter((x) => x.step_id === st.id)
        .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
      const shared = members.length > 1;
      const at = members.findIndex((x) => x.subject_id === g.subject_id);
      const lines = () => String(st.summary ?? "").split("\n");
      const mine = () => (shared ? lines()[at] ?? "" : st.summary ?? "");
      const now = el("textarea", { value: mine(), rows: shared ? 1 : 2, readOnly: true });
      const next = el("textarea", { rows: shared ? 1 : 2, placeholder: "'로드맵 문구 생성'을 누르면 채워집니다" });
      const gen = el("button", { type: "button", className: "ghost-btn ai-btn", textContent: "로드맵 문구 생성" });
      gen.addEventListener("click", async () => {
        gen.disabled = true;
        try {
          setState("로드맵 문구를 만드는 중…");
          const text = await ai("roadmap", [
            `[과목] ${subject?.name ?? ""}`,
            st.source_text,
            fresh.value.trim() || current.value,
          ].filter(Boolean).join("\n"));
          // 과목이 함께 묶인 단계는 이 과목 몫인 한 줄만 쓴다.
          next.value = shared ? text.split("\n").map((x) => x.trim()).find(Boolean) ?? "" : text;
          setState("로드맵 신규 문구를 만들었습니다. 확인 후 아래 '적용'을 눌러주세요.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          gen.disabled = false;
        }
      });
      const otherLines = shared
        ? members.map((x, i) => (i === at ? null : `${nameOf(subjects, x.subject_id)}: ${lines()[i] ?? ""}`)).filter(Boolean)
        : [];
      return {
        step: st,
        next,
        now,
        // 이 과목 줄만 바꾼 단계 전체 문구.
        merged(text) {
          if (!shared) return text;
          const all = lines();
          while (all.length < members.length) all.push("");
          all[at] = text.replace(/\n+/g, " ");
          return all.join("\n");
        },
        refresh() {
          now.value = mine();
        },
        el: el("div", { className: "compare-block" }, [
          el("div", { className: "box-title" }, [
            el("h4", { textContent: `${nameOf(tracks, st.track_id)} · ${st.position}단계 · ${subject?.name ?? ""}` }),
            gen,
          ]),
          el("div", { className: "compare-row" }, [
            el("label", { className: "form-field" }, [el("span", { textContent: "현재" }), now]),
            el("label", { className: "form-field" }, [el("span", { textContent: "신규" }), next]),
          ]),
          ...(otherLines.length
            ? [el("p", { className: "muted", textContent: `같은 단계의 다른 과목 줄(그대로 유지) — ${otherLines.join(" · ")}` })]
            : []),
        ]),
      };
    });

    // ── 4. 적용: 신규 칸에 넣은 문구를 실제로 반영 ──
    const apply = el("button", { type: "button", className: "publish-btn", textContent: "적용" });
    apply.addEventListener("click", async () => {
      const deptText = fresh.value.trim();
      const roadmapTexts = roadmapViews.filter((v) => v.next.value.trim());
      if (!deptText && !roadmapTexts.length) return setState("신규 칸에 문구를 먼저 만들어주세요", true);
      if (!confirm("신규 문구를 학과 커리큘럼·로드맵에 반영할까요?")) return;
      apply.disabled = true;
      try {
        if (deptText) {
          const { error } = await supabase.from("subjects").update({ dept_curriculum: deptText }).eq("id", g.subject_id);
          if (error) throw new Error(dbErrorMessage(error));
          subject.dept_curriculum = deptText;
          current.value = deptText;
          fresh.value = "";
        }
        for (const v of roadmapTexts) {
          const summary = v.merged(v.next.value.trim());
          const { error } = await supabase.from("roadmap_steps").update({ summary }).eq("id", v.step.id);
          if (error) throw new Error(dbErrorMessage(error));
          v.step.summary = summary;
          v.refresh();
          v.next.value = "";
        }
        // 승인과 적용을 다 마친 묶음은 목록에서 뺀다(승인만 했으면 아래 문구 작업을 위해 남겨 둠).
        if (g.saved) {
          groups.splice(groups.indexOf(g), 1);
          [...pills.children].find((b) => b.dataset.key === key(g))?.remove();
          if (groups.length) show(groups[0]);
          else body.replaceChildren(el("p", { className: "muted", textContent: "새로 들어온 신청이 없습니다." }));
          setState(`${label(g)} — 승인과 적용을 마쳐 목록에서 뺐습니다. 공개 사이트에는 위쪽 '적용' 후 보입니다.`);
        } else {
          setState("반영했습니다. 공개 사이트에는 위쪽 '적용' 후 보입니다.");
        }
      } catch (e) {
        setState(e.message, true);
      } finally {
        apply.disabled = false;
      }
    });

    // ── 개월 늘리기·줄이기 ──
    const addMonth = el("button", { type: "button", className: "ghost-btn", textContent: "+ 개월 추가" });
    addMonth.title = "다음 달 과목(예: 웹툰1 → 웹툰2)에 빈 1단계 신청을 만듭니다. '수정'으로 내용을 넣고 '저장'하면 승인됩니다.";
    addMonth.addEventListener("click", async () => {
      const name = nextMonthName(subject?.name ?? "", subjects.map((s) => s.name));
      if (!confirm(`'${name}' 과목에 ${nameOf(instructors, g.instructor_id)} 선생님의 빈 1단계 신청을 만들까요?`)) return;
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
    const dropMonth = el("button", { type: "button", className: "ghost-btn danger", textContent: "이 개월 빼기" });
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

    return [
      el("section", { className: "workspace-card request-section" }, [
        el("div", { className: "request-title" }, [
          el("h3", { textContent: `신청 내용 · ${nameOf(sets, g.set_id)}` }),
          status,
          revert,
          edit,
          el("span", { className: "request-month-actions" }, [addMonth, dropMonth]),
        ]),
        el("div", { className: "request-row request-head" },
          ["강사명", "과목명", "단계", "커리큘럼", "이미지"].map((t) => el("span", { textContent: t }))),
        ...rowViews.map((v) => v.line),
        ...materialsLine(g),
      ]),
      el("section", { className: "workspace-card request-section" }, [
        el("div", { className: "box-title" }, [el("h3", { textContent: `학과 커리큘럼 · ${subject?.name ?? ""}` }), genDept]),
        el("div", { className: "compare-row" }, [
          el("label", { className: "form-field" }, [el("span", { textContent: "현재" }), current]),
          el("label", { className: "form-field" }, [el("span", { textContent: "신규" }), fresh]),
        ]),
      ]),
      el("section", { className: "workspace-card request-section" }, [
        el("h3", { textContent: "로드맵 문구" }),
        ...(roadmapViews.length
          ? roadmapViews.map((v) => v.el)
          : [el("p", { className: "muted", textContent: "이 과목이 들어간 로드맵 단계가 없습니다." })]),
      ]),
      el("div", { className: "form-actions request-apply" }, [
        apply,
        el("span", { className: "muted", textContent: "신규 칸의 문구를 학과 커리큘럼·로드맵에 반영합니다." }),
      ]),
    ];
  }
  show(groups.find((g) => key(g) === focus) ?? groups[0]);
}
