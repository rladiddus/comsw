import {
  el,
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
  const preview = el("img", {
    className: "curriculum-preview",
    alt: "커리큘럼 이미지",
    hidden: true,
  });
  preview.addEventListener("error", () => {
    preview.hidden = true;
  });
  const show = () => {
    preview.hidden = !url;
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
      modes,
      uploadBox,
      linkBox,
      preview,
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
    const [depts, subjects, links, sets, submitted] = await Promise.all([
      rows(supabase, "departments", (q) => q.order("sort_order")),
      rows(supabase, "subjects", (q) => q.order("sort_order")),
      rows(supabase, "subject_departments"),
      rows(supabase, "curriculum_sets", (q) => q.order("sort_order")),
      rows(
        supabase,
        "instructor_curricula",
        (q) => q.eq("instructor_id", own.id).order("sort_order"),
      ),
    ]);
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
    const [dept, deptField] = select("학과", "department");
    const [set, setField] = select("커리큘럼 탭", "set_id");
    form.append(el("div", { className: "form-row" }, [deptField, setField]));
    const options = (input, list) =>
      input.replaceChildren(
        ...list.map((x) => el("option", { value: x.id, textContent: x.name })),
      );
    options(dept, depts);
    const deptSubjects = () => {
      const ids = links.filter((l) => l.department_id === dept.value).map((l) =>
        l.subject_id
      );
      return ids.length ? subjects.filter((s) => ids.includes(s.id)) : subjects;
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
      box.append(
        el("div", { className: "step-head" }, [
          subjectField,
          el("label", { className: "form-field" }, [
            el("span", { textContent: "단계" }),
            stepInput,
          ]),
          remove,
        ]),
        el("label", { className: "form-field" }, [
          el("span", { textContent: "개인 수업 커리큘럼" }),
          written,
        ]),
      );
      const media = mediaPicker(box);
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
    for (const row of submitted) {
      const pending = row.status === "pending";
      const card = el("article", { className: "submission-card" });
      const view = () => {
        const edit = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: pending ? "수정" : "수정해서 제출",
        });
        edit.addEventListener("click", editor);
        card.replaceChildren(
          el("span", {
            className: `status-pill ${pending ? "pending" : "approved"}`,
            textContent: pending ? "승인 대기" : "승인됨",
          }),
          el("h4", { textContent: `${subjectName(row.subject_id)} · ${row.step_label}` }),
          el("p", {
            className: "muted",
            textContent: sets.find((s) => s.id === row.set_id)?.name || "",
          }),
          el("p", { className: "submission-text", textContent: row.written || "" }),
          ...(row.media_url
            ? [el("img", {
              className: "curriculum-preview",
              src: driveThumbnail(row.media_url),
              alt: `${row.step_label} 이미지`,
            })]
            : []),
          edit,
        );
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
          card.append(del);
        }
      };
      function editor() {
        const written = el("textarea", {
          rows: 6,
          maxLength: 12000,
          value: row.written || "",
        });
        card.replaceChildren(
          el("h4", { textContent: `${subjectName(row.subject_id)} · ${row.step_label} 수정` }),
          el("p", {
            className: "muted",
            textContent: pending
              ? "저장하면 승인 대기 내용이 바뀝니다."
              : "승인된 내용은 그대로 두고, 수정본을 승인 요청합니다.",
          }),
          el("label", { className: "form-field" }, [
            el("span", { textContent: "개인 수업 커리큘럼" }),
            written,
          ]),
        );
        const media = mediaPicker(card, row.media_url || "");
        const save = el("button", {
          type: "button",
          className: "publish-btn",
          textContent: "수정 승인 요청",
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
    const tabs = el("div", { className: "tab-bar", role: "tablist" });
    const panels = { write: form, list };
    const open = (name) => {
      for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
      for (const b of tabs.children) {
        b.classList.toggle("active", b.dataset.tab === name);
        b.setAttribute("aria-selected", String(b.dataset.tab === name));
      }
    };
    for (const [name, text] of [["write", "등록하기"], ["list", `조회하기 (${submitted.length})`]]) {
      const b = el("button", { type: "button", role: "tab", textContent: text });
      b.dataset.tab = name;
      b.addEventListener("click", () => open(name));
      tabs.append(b);
    }
    container.append(tabs, el("div", { className: "workspace-single" }, [form, list]));
    open(tab ?? (submitted.length ? "list" : "write"));
  } catch (e) {
    setState(e.message, true);
  }
}
