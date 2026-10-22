import {
  el,
  field,
  requireInstructor,
  rows,
  rpc,
  stateLine,
} from "../teacher-workspace.mjs";
import { mountImageUpload } from "../image-upload.mjs";
import { driveThumbnail } from "../drive.mjs";

export async function render(container, ctx) {
  const { supabase } = ctx;
  container.replaceChildren(
    el("h2", { textContent: "내 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent:
        "나의 수업을 주차별로 소개해주세요. 제출 후 학과장 승인과 적용을 거쳐 사이트에 반영됩니다.",
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
    const layout = el("div", { className: "workspace-grid" });
    const form = el("form", { className: "workspace-card curriculum-form" });
    form.append(
      el("h3", { textContent: `${own.name} 선생님의 수업` }),
      el("p", {
        className: "desc",
        textContent:
          "기본 4주, 일부 과목은 8주로 작성해주세요. 이미지는 가로·세로 모두 1000px 이상이면 어떤 비율도 괜찮습니다. 첨부 후 정사각형으로 자릅니다. 요약은 학과장이 정리합니다.",
      }),
    );
    function select(label, name) {
      const input = el("select", { name, required: true });
      form.append(
        el("label", { className: "form-field" }, [
          el("span", { textContent: label }),
          input,
        ]),
      );
      return input;
    }
    const dept = select("학과", "department");
    const set = select("커리큘럼 탭", "set_id");
    const subject = select("과목", "subject_id");
    function options(input, list) {
      input.replaceChildren(
        ...list.map((x) => el("option", { value: x.id, textContent: x.name })),
      );
    }
    options(dept, depts);
    const refill = () => {
      options(
        set,
        sets.filter((s) =>
          s.department_id === dept.value || s.department_id == null
        ),
      );
      const ids = links.filter((l) => l.department_id === dept.value).map((l) =>
        l.subject_id
      );
      options(
        subject,
        ids.length ? subjects.filter((s) => ids.includes(s.id)) : subjects,
      );
    };
    refill();
    dept.addEventListener("change", refill);
    const step = field(form, "주차·단계", "step_label", "text", "1주차");
    step.required = true;
    step.maxLength = 80;
    const written = field(form, "개인 수업 커리큘럼", "written", "textarea");
    written.required = true;
    written.maxLength = 12000;
    const media = field(form, "커리큘럼 이미지·영상 주소", "media_url");
    media.type = "url";
    media.placeholder = "https://…";
    const preview = el("img", {
      className: "curriculum-preview",
      alt: "제출할 커리큘럼 이미지",
      hidden: true,
    });
    function showPreview() {
      preview.hidden = !media.value;
      if (media.value) preview.src = driveThumbnail(media.value);
    }
    media.addEventListener("change", showPreview);
    preview.addEventListener("error", () => {
      preview.hidden = true;
    });
    form.append(preview);
    const upload = mountImageUpload(form, {
      kind: "curriculum",
      onUploaded: (asset) => {
        media.value = asset.url;
        showPreview();
      },
    });
    const submit = el("button", {
      type: "submit",
      className: "publish-btn",
      textContent: "승인 요청하기",
    });
    form.append(el("div", { className: "form-actions" }, [submit]));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        if (upload.busy()) {
          throw new Error("이미지 업로드가 끝난 후 제출해주세요");
        }
        if (
          !set.value || !subject.value || !step.value.trim() ||
          !written.value.trim()
        ) throw new Error("학과·과목·주차와 커리큘럼을 입력해주세요");
        await rpc(supabase, "comsw_submit_my_curriculum", {
          p_set_id: set.value,
          p_subject_id: subject.value,
          p_step_label: step.value.trim(),
          p_written: written.value,
          p_summary: "",
          p_media_url: media.value,
        });
        await render(container, ctx);
        container.prepend(
          el("p", {
            className: "notice",
            textContent: "커리큘럼을 제출했습니다. 학과장 승인 대기 중입니다.",
          }),
        );
      } catch (err) {
        setState(err.message, true);
      } finally {
        submit.disabled = false;
      }
    });
    const list = el(
      "section",
      { className: "workspace-card submission-list" },
      [el("h3", { textContent: "제출한 수업" })],
    );
    if (!submitted.length) {
      list.append(
        el("p", {
          className: "desc",
          textContent: "아직 제출한 커리큘럼이 없습니다.",
        }),
      );
    }
    for (const row of submitted) {
      const pending = row.status === "pending";
      const card = el("article", { className: "submission-card" }, [
        el("span", {
          className: `status-pill ${pending ? "pending" : "approved"}`,
          textContent: pending ? "승인 대기" : "승인됨",
        }),
        el("h4", {
          textContent: `${
            subjects.find((s) => s.id === row.subject_id)?.name || "과목"
          } · ${row.step_label}`,
        }),
        el("p", {
          className: "muted",
          textContent: sets.find((s) => s.id === row.set_id)?.name || "",
        }),
        el("p", {
          className: "submission-text",
          textContent: row.written || "",
        }),
      ]);
      const edit = el("button", {
        type: "button",
        className: "ghost-btn",
        textContent: pending ? "이어서 수정" : "수정해서 제출",
      });
      edit.addEventListener("click", () => {
        const selected = sets.find((s) => s.id === row.set_id);
        if (selected?.department_id) dept.value = selected.department_id;
        refill();
        set.value = row.set_id;
        if (![...subject.options].some((o) => o.value === row.subject_id)) {
          options(subject, subjects);
        }
        subject.value = row.subject_id;
        step.value = row.step_label;
        written.value = row.written || "";
        media.value = row.media_url || "";
        showPreview();
        setState(
          pending
            ? "대기 중인 같은 과목·주차를 다시 제출하면 대기본을 갱신합니다."
            : "승인된 내용은 유지되며 수정본을 새로 제출합니다.",
        );
        form.scrollIntoView?.({ behavior: "smooth" });
      });
      card.append(edit);
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
            await render(container, ctx);
          } catch (e) {
            setState(e.message, true);
            del.disabled = false;
          }
        });
        card.append(del);
      }
      list.append(card);
    }
    layout.append(form, list);
    container.append(layout);
  } catch (e) {
    setState(e.message, true);
  }
}
