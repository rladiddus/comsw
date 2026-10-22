import {
  el,
  mountTabs,
  requireInstructor,
  rows,
  rpc,
  stateLine,
} from "../teacher-workspace.mjs";
import { mountImageUpload } from "../image-upload.mjs";
import { driveThumbnail } from "../drive.mjs";

// 이미지: 직접 업로드(정사각형 크롭) 또는 링크. 고른 방식의 값 하나만 제출한다.
function mediaPicker(container, initial = "") {
  let url = initial;
  // 첨부 이미지는 업로드 칸 오른쪽의 고정 크기 칸에 보여 준다(줄 높이가 바뀌지 않게).
  const preview = el("img", { alt: "커리큘럼 이미지", hidden: true });
  const empty = el("span", { textContent: "이미지 없음" });
  preview.addEventListener("error", () => {
    preview.hidden = true;
    empty.hidden = false;
  });
  const show = () => {
    preview.hidden = !url;
    empty.hidden = Boolean(url);
    if (url) preview.src = driveThumbnail(url);
  };
  const link = el("input", {
    type: "url",
    placeholder: "https://… (구글 드라이브·이미지 주소)",
    value: initial,
  });
  link.addEventListener("change", () => {
    url = link.value.trim();
    show();
  });
  const uploadBox = el("div");
  const upload = mountImageUpload(uploadBox, {
    kind: "curriculum",
    label: "이미지 직접 올리기",
    onUploaded: (asset) => {
      url = asset.url;
      link.value = url;
      show();
    },
  });
  const linkBox = el("label", { className: "form-field media-link" }, [
    el("span", { textContent: "이미지 링크" }),
    link,
  ]);
  const modes = el("div", { className: "segmented", role: "group" });
  const choose = (mode) => {
    uploadBox.hidden = mode !== "upload";
    linkBox.hidden = mode !== "link";
    for (const b of modes.children) {
      b.classList.toggle("active", b.dataset.mode === mode);
    }
  };
  for (const [mode, text] of [["upload", "직접 업로드"], ["link", "링크로 업로드"]]) {
    const b = el("button", { type: "button", textContent: text });
    b.dataset.mode = mode;
    b.addEventListener("click", () => choose(mode));
    modes.append(b);
  }
  choose(initial ? "link" : "upload");
  container.append(
    el("div", { className: "media-picker" }, [
      el("span", { className: "field-label", textContent: "커리큘럼 이미지" }),
      el("div", { className: "media-body" }, [
        el("div", { className: "media-controls" }, [modes, uploadBox, linkBox]),
        el("div", { className: "media-thumb" }, [preview, empty]),
      ]),
    ]),
  );
  show();
  return { value: () => url, busy: () => upload.busy() };
}

const nextStep = (label) => {
  const n = Number(String(label).match(/\d+/)?.[0] ?? 0);
  return `${n + 1}단계`;
};

export async function render(container, ctx, { tab } = {}) {
  const { supabase } = ctx;
  container.replaceChildren(
    el("h2", { textContent: "내 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent:
        "나의 수업을 단계별로 소개해주세요. 제출 후 학과장 승인과 적용을 거쳐 사이트에 반영됩니다.",
    }),
  );
  const setState = stateLine(container);
  try {
    const own = await requireInstructor(ctx);
    const loadMyMajors = ctx.loadMyMajors ??
      (await import("../ssamtalk-members.mjs")).loadMyMajors;
    const [depts, subjects, links, sets, submitted, mySubjects, myDepts, majors] = await Promise.all([
      rows(supabase, "departments", (q) => q.order("sort_order")),
      rows(supabase, "subjects", (q) => q.order("sort_order")),
      rows(supabase, "subject_departments"),
      rows(supabase, "curriculum_sets", (q) => q.order("sort_order")),
      rows(
        supabase,
        "instructor_curricula",
        (q) => q.eq("instructor_id", own.id).order("sort_order"),
      ),
      rows(supabase, "instructor_subjects", (q) => q.eq("instructor_id", own.id)),
      rows(supabase, "instructor_departments", (q) => q.eq("instructor_id", own.id)),
      loadMyMajors(ctx.uid).catch(() => null),
    ]);
    // 내 학과 = 쌤톡 학과(이름이 같은 컴수원 학과). 못 불러오면 컴수원에 저장된 내 학과.
    const myDeptList = majors
      ? depts.filter((d) => majors.includes(d.name))
      : depts.filter((d) => myDepts.some((x) => x.department_id === d.id));
    const myIds = new Set(mySubjects.map((x) => x.subject_id));
    const goSettings = () => {
      try {
        sessionStorage.setItem("comsw_profile_tab", "classes");
      } catch {
        // 탭 기억이 안 되면 내 프로필 첫 탭이 열린다.
      }
      location.hash = "#/profile";
    };
    const subjectName = (id) =>
      subjects.find((s) => s.id === id)?.name || "과목";
    const submit = (row) =>
      rpc(supabase, "comsw_submit_my_curriculum", {
        p_set_id: row.set_id,
        p_subject_id: row.subject_id,
        p_step_label: row.step_label,
        p_written: row.written,
        p_summary: "",
        p_media_url: row.media_url,
      });
    const done = async (message) => {
      await render(container, ctx, { tab: "list" });
      container.querySelector(".save-state").before(
        el("p", { className: "notice", textContent: message }),
      );
    };

    // ── 등록하기 ──
    const form = el("form", { className: "workspace-card curriculum-form" });
    form.append(
      el("h3", { textContent: `${own.name} 선생님의 수업` }),
      el("p", {
        className: "desc",
        textContent:
          "기본 4단계로 작성해주세요. 이미지는 가로·세로 모두 1000px 이상이면 어떤 비율도 괜찮습니다. 첨부 후 정사각형으로 자릅니다. 요약은 학과장이 정리합니다.",
      }),
    );
    const select = (label, name) => {
      const input = el("select", { name, required: true });
      return [
        input,
        el("label", { className: "form-field" }, [
          el("span", { textContent: label }),
          input,
        ]),
      ];
    };
    const [dept, deptField] = select("내 학과", "department");
    const [set, setField] = select("선택 학과", "set_id");
    form.append(el("div", { className: "form-row" }, [deptField, setField]));
    const settingsLink = el("button", {
      type: "button",
      className: "link-btn",
      textContent: "내 프로필 > 수업 설정에서 학과·과목 바꾸기",
    });
    settingsLink.addEventListener("click", goSettings);
    const subjectHint = el("p", { className: "muted" });
    form.append(el("p", { className: "muted" }, [settingsLink]), subjectHint);
    const options = (input, list) =>
      input.replaceChildren(
        ...list.map((x) => el("option", { value: x.id, textContent: x.name })),
      );
    options(dept, myDeptList);
    // 단계의 과목 = 수업 설정에서 고른 내 과목 중 이 학과 과목.
    const deptSubjects = () => {
      const ids = links.filter((l) => l.department_id === dept.value).map((l) =>
        l.subject_id
      );
      return subjects.filter((s) => ids.includes(s.id) && myIds.has(s.id));
    };
    const stepsBox = el("div", { className: "step-list" });
    const steps = [];
    function addStep(subjectId, label) {
      const box = el("section", { className: "step-row" });
      const [subject, subjectField] = select("과목", "subject_id");
      options(subject, deptSubjects());
      if (subjectId) subject.value = subjectId;
      const stepInput = el("input", {
        name: "step_label",
        type: "text",
        value: label,
        maxLength: 80,
        required: true,
      });
      const remove = el("button", {
        type: "button",
        className: "ghost-btn danger",
        textContent: "단계 삭제",
      });
      const written = el("textarea", {
        name: "written",
        rows: 5,
        maxLength: 12000,
        required: true,
        placeholder: "이 단계에서 배우는 내용과 결과물을 적어주세요.",
      });
      // 한 줄: 과목 | 단계 | 개인 수업 커리큘럼 | 커리큘럼 이미지 | 삭제
      const mediaBox = el("div", { className: "step-media" });
      box.append(
        subjectField,
        el("label", { className: "form-field" }, [
          el("span", { textContent: "단계" }),
          stepInput,
        ]),
        el("label", { className: "form-field" }, [
          el("span", { textContent: "개인 수업 커리큘럼" }),
          written,
        ]),
        mediaBox,
        remove,
      );
      const media = mediaPicker(mediaBox);
      const step = { box, subject, stepInput, written, media };
      remove.addEventListener("click", () => {
        if (steps.length === 1) {
          setState("단계는 하나 이상 있어야 합니다", true);
          return;
        }
        steps.splice(steps.indexOf(step), 1);
        box.remove();
      });
      steps.push(step);
      stepsBox.append(box);
    }
    const refill = () => {
      subjectHint.textContent = !myDeptList.length
        ? "내 학과가 없습니다. 수업 설정에서 학과를 추가해주세요."
        : deptSubjects().length
        ? ""
        : "이 학과에서 고른 과목이 없습니다. 수업 설정에서 수업하는 과목을 체크해주세요.";
      options(
        set,
        sets.filter((s) =>
          s.department_id === dept.value || s.department_id == null
        ),
      );
      for (const s of steps) {
        const keep = s.subject.value;
        options(s.subject, deptSubjects());
        if ([...s.subject.options].some((o) => o.value === keep)) {
          s.subject.value = keep;
        }
      }
    };
    refill();
    dept.addEventListener("change", refill);
    addStep(null, "1단계");
    const add = el("button", {
      type: "button",
      className: "ghost-btn add-step",
      textContent: "+ 단계 추가",
    });
    add.addEventListener("click", () => {
      const last = steps.at(-1);
      addStep(last?.subject.value, nextStep(last?.stepInput.value));
    });
    const send = el("button", {
      type: "submit",
      className: "publish-btn",
      textContent: "승인 요청하기",
    });
    form.append(
      stepsBox,
      add,
      el("div", { className: "form-actions" }, [send]),
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (send.disabled) return;
      send.disabled = true;
      let sent = 0;
      try {
        if (steps.some((s) => s.media.busy())) {
          throw new Error("이미지 업로드가 끝난 후 제출해주세요");
        }
        const list = steps.map((s) => ({
          set_id: set.value,
          subject_id: s.subject.value,
          step_label: s.stepInput.value.trim(),
          written: s.written.value,
          media_url: s.media.value(),
        }));
        if (
          !set.value ||
          list.some((r) => !r.subject_id || !r.step_label || !r.written.trim())
        ) throw new Error("학과·과목·단계와 커리큘럼 내용을 모두 입력해주세요");
        for (const row of list) {
          await submit(row);
          sent++;
        }
        await done(
          `${sent}개 단계를 제출했습니다. 학과장 승인 대기 중입니다.`,
        );
      } catch (err) {
        setState(
          sent ? `${sent}개 단계는 제출했습니다. 나머지: ${err.message}` : err.message,
          true,
        );
      } finally {
        send.disabled = false;
      }
    });

    // ── 조회하기 ──
    const list = el("section", { className: "workspace-card submission-list" }, [
      el("h3", { textContent: "등록한 커리큘럼" }),
    ]);
    if (!submitted.length) {
      list.append(
        el("p", {
          className: "desc",
          textContent: "아직 등록한 커리큘럼이 없습니다. '등록하기'에서 작성해주세요.",
        }),
      );
    }
    // 이미지를 누르면 크게 보여 준다(바깥이나 이미지를 누르면 닫힘).
    const zoom = el("dialog", { className: "image-zoom" });
    zoom.addEventListener("click", () => zoom.close?.());
    const openZoom = (url, alt) => {
      zoom.replaceChildren(el("img", { src: driveThumbnail(url), alt }));
      if (zoom.showModal) zoom.showModal();
      else zoom.setAttribute("open", "");
    };
    list.append(zoom);
    for (const row of submitted) {
      const pending = row.status === "pending";
      const card = el("article", { className: "submission-card" });
      const title = `${subjectName(row.subject_id)} · ${row.step_label}`;
      // 보기: 왼쪽 내용, 오른쪽 이미지(한 화면에 여러 단계가 보이게).
      const view = () => {
        card.className = "submission-card submission-row";
        const edit = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: "수정",
        });
        edit.addEventListener("click", editor);
        const actions = el("div", { className: "card-actions" }, [edit]);
        const info = el("div", { className: "submission-info" }, [
          el("span", {
            className: `status-pill ${pending ? "pending" : "approved"}`,
            textContent: pending ? "승인 대기" : "승인됨",
          }),
          el("h4", { textContent: title }),
          el("p", {
            className: "muted",
            textContent: sets.find((s) => s.id === row.set_id)?.name || "",
          }),
          el("p", { className: "submission-text", textContent: row.written || "" }),
          actions,
        ]);
        const thumb = row.media_url
          ? el("button", {
            type: "button",
            className: "submission-thumb",
            title: "크게 보기",
          }, [el("img", { src: driveThumbnail(row.media_url), alt: `${title} 이미지` })])
          : el("div", { className: "submission-thumb empty", textContent: "이미지 없음" });
        if (row.media_url) {
          thumb.addEventListener("click", () => openZoom(row.media_url, `${title} 이미지`));
        }
        card.replaceChildren(info, thumb);
        if (pending) {
          const del = el("button", {
            type: "button",
            className: "ghost-btn danger",
            textContent: "대기본 삭제",
          });
          del.addEventListener("click", async () => {
            if (!confirm("승인 대기 중인 이 제출물을 삭제할까요?")) return;
            del.disabled = true;
            try {
              const { error } = await supabase.from("instructor_curricula")
                .delete().eq("id", row.id).eq("instructor_id", own.id).eq(
                  "status",
                  "pending",
                );
              if (error) throw new Error(error.message);
              await render(container, ctx, { tab: "list" });
            } catch (e) {
              setState(e.message, true);
              del.disabled = false;
            }
          });
          actions.append(del);
        }
      };
      // 수정: 등록하기와 같은 한 줄 배치. 과목·단계는 바꿀 수 없다(바꾸려면 새로 등록).
      function editor() {
        card.className = "submission-card";
        const fixed = (label, value) =>
          el("label", { className: "form-field" }, [
            el("span", { textContent: label }),
            el("input", { type: "text", value, readOnly: true }),
          ]);
        const written = el("textarea", {
          name: "written",
          maxLength: 12000,
          value: row.written || "",
        });
        const mediaBox = el("div", { className: "step-media" });
        card.replaceChildren(
          el("h4", { textContent: `${title} 수정` }),
          el("p", {
            className: "muted",
            textContent: pending
              ? "저장하면 승인 대기 내용이 바뀝니다."
              : "승인된 내용은 그대로 두고, 수정본을 승인 요청합니다.",
          }),
          el("section", { className: "step-row" }, [
            fixed("과목", subjectName(row.subject_id)),
            fixed("단계", row.step_label),
            el("label", { className: "form-field" }, [
              el("span", { textContent: "개인 수업 커리큘럼" }),
              written,
            ]),
            mediaBox,
            el("span"),
          ]),
        );
        const media = mediaPicker(mediaBox, row.media_url || "");
        const save = el("button", {
          type: "button",
          className: "publish-btn",
          textContent: "저장 및 승인 요청",
        });
        const cancel = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: "취소",
        });
        cancel.addEventListener("click", view);
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            if (media.busy()) throw new Error("이미지 업로드가 끝난 후 저장해주세요");
            if (!written.value.trim()) throw new Error("커리큘럼 내용을 입력해주세요");
            await submit({ ...row, written: written.value, media_url: media.value() });
            await done("수정본을 제출했습니다. 학과장 승인 대기 중입니다.");
          } catch (e) {
            setState(e.message, true);
            save.disabled = false;
          }
        });
        card.append(el("div", { className: "form-actions" }, [save, cancel]));
      }
      view();
      list.append(card);
    }

    // ── 탭 ──
    mountTabs(container, [
      ["write", "등록하기", form],
      ["list", `조회하기 (${submitted.length})`, list],
    ], tab ?? (submitted.length ? "list" : "write"));
    container.append(el("div", { className: "workspace-single" }, [form, list]));
  } catch (e) {
    setState(e.message, true);
  }
}
