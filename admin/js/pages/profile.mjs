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
    el("h2", { textContent: "내 프로필" }),
    el("p", {
      className: "desc",
      textContent:
        "경력과 한마디를 소개하고, 프로필 제작에 사용할 본인 사진을 올려주세요.",
    }),
  );
  const setState = stateLine(container);
  try {
    const own = await requireInstructor(ctx);
    const draft = (await rows(supabase, "instructor_profile_drafts", (q) =>
      q.eq("instructor_id", own.id)))[0];
    let sourceId = draft?.source_asset_id || null;
    const layout = el("div", { className: "workspace-grid" });
    const form = el("form", { className: "workspace-card profile-form" });
    form.append(el("h3", { textContent: "선생님 소개" }));
    const name = field(form, "이름", "name", "text", draft?.name ?? own.name);
    name.required = true;
    name.maxLength = 80;
    const career = field(
      form,
      "경력",
      "career",
      "textarea",
      draft?.career ?? own.career ?? "",
    );
    career.maxLength = 10000;
    const message = field(
      form,
      "한마디",
      "message",
      "textarea",
      draft?.message ?? own.message ?? "",
    );
    message.maxLength = 2000;
    form.append(
      el("h3", { textContent: "프로필 생성용 본인 사진" }),
      el("p", {
        className: "desc",
        textContent:
          "얼굴이 선명한 사진을 올려주세요. 원본은 비공개로 보관하며 본인과 관리자·학과장만 확인할 수 있습니다.",
      }),
    );
    const photoState = el("p", {
      className: "muted",
      textContent: sourceId
        ? "보관 중인 본인 사진이 있습니다."
        : "아직 올린 사진이 없습니다.",
    });
    form.append(photoState);
    const consent = el("input", {
      type: "checkbox",
      checked: Boolean(draft?.source_consent),
    });
    consent.name = "ai_photo_consent";
    const upload = mountImageUpload(form, {
      kind: "profile-source",
      label: "본인 사진 올리기",
      onUploaded: (asset) => {
        sourceId = asset.id;
        consent.checked = false;
        photoState.textContent = `${
          asset.filename || "본인 사진"
        } · 비공개 보관`;
      },
    });
    form.append(
      el("label", { className: "consent" }, [
        consent,
        el("span", {
          textContent:
            "학과장이 본인 사진을 확인하고 AI 프로필 제작에 사용하는 데 동의합니다.",
        }),
      ]),
    );
    const submit = el("button", {
      type: "submit",
      className: "publish-btn",
      textContent: "프로필 승인 요청",
    });
    form.append(el("div", { className: "form-actions" }, [submit]));
    async function save() {
      if (upload.busy()) {
        throw new Error("사진 업로드가 끝난 후 저장해주세요");
      }
      if (sourceId && !consent.checked) {
        throw new Error("본인 사진 사용 동의를 확인해주세요");
      }
      return rpc(supabase, "comsw_save_my_profile", {
        p_name: name.value.trim(),
        p_career: career.value,
        p_message: message.value,
        p_source_asset_id: sourceId,
        p_source_consent: consent.checked,
      });
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submit.disabled) {
        return;
      }
      submit.disabled = true;
      try {
        await save();
        await render(container, ctx);
        container.prepend(
          el("p", {
            className: "notice",
            textContent: "프로필을 저장했습니다. 학과장 승인 후 적용됩니다.",
          }),
        );
      } catch (e) {
        setState(e.message, true);
      } finally {
        submit.disabled = false;
      }
    });
    const preview = el("section", {
      className: "workspace-card profile-preview",
    }, [el("h3", { textContent: "프로필 사진" })]);
    const url = draft?.photo_url || own.photo_url;
    if (url) {
      preview.append(
        el("img", {
          className: "profile-portrait",
          src: driveThumbnail(url),
          alt: `${own.name} 프로필`,
        }),
      );
    } else {
      preview.append(
        el("div", {
          className: "portrait-placeholder",
          textContent: "사진을 올려 나만의 프로필을 준비하세요",
        }),
      );
    }
    preview.append(
      el("p", {
        className: "desc",
        textContent: draft?.status === "pending"
          ? "프로필 승인 대기 중입니다. 공개 정보는 승인 전까지 유지됩니다."
          : "올려주신 사진으로 학과장이 프로필을 제작합니다. 완성된 사진은 이곳에서 확인할 수 있습니다.",
      }),
    );
    layout.append(form, preview);
    container.append(layout);
  } catch (e) {
    setState(e.message, true);
  }
}
