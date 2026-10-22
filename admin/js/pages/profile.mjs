import {
  el,
  field,
  mountTabs,
  requireInstructor,
  rows,
  rpc,
  stateLine,
} from "../teacher-workspace.mjs";
import { mountImageUpload } from "../image-upload.mjs";
import { mountClassSettings } from "../class-settings.mjs";

const members = () => import("../ssamtalk-members.mjs");

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
    const layout = el("div", { className: "workspace-single" });
    const form = el("form", { className: "workspace-card profile-form" });
    form.append(el("h3", { textContent: "선생님 소개" }));
    // 이름은 강사 정보(쌤톡 이름)를 그대로 쓴다. 바꿔야 하면 관리자가 '강사'에서 고친다.
    const name = field(form, "이름", "name", "text", own.name);
    name.readOnly = true;
    form.append(el("p", {
      className: "muted",
      textContent: "이름은 바꿀 수 없습니다. 고쳐야 하면 관리자에게 요청해주세요.",
    }));
    const career = field(
      form,
      "경력",
      "career",
      "textarea",
      draft?.career ?? own.career ?? "",
    );
    career.maxLength = 10000;
    career.rows = 7;
    career.placeholder = [
      "예시)",
      "現 SBS아카데미 수원지점 시각편집학과 전임강사",
      "前 ○○디자인 스튜디오 그래픽 디자이너",
      "2025 ○○기업 브랜드 리뉴얼 프로젝트 디자인",
      "2024 ○○문화재단 독립출판 북디자인",
      "저서 『○○ 실무 가이드』",
    ].join("\n");
    const message = field(
      form,
      "한마디",
      "message",
      "textarea",
      draft?.message ?? own.message ?? "",
    );
    message.maxLength = 2000;
    message.placeholder =
      "예시) 혼자서는 막막했던 그때를 기억하며, 기초부터 실무까지 차근차근 함께 완성하겠습니다!";
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
    if (draft?.status === "pending") {
      form.prepend(el("p", {
        className: "notice",
        textContent: "프로필 승인 대기 중입니다. 공개 정보는 승인 전까지 유지됩니다.",
      }));
    }
    layout.append(form);
    const classes = el("div", { className: "workspace-single" });
    await mountClassSettings(classes, {
      supabase,
      uid: ctx.uid,
      own,
      loadMyMajors: ctx.loadMyMajors ?? (await members()).loadMyMajors,
      saveMyMajors: ctx.saveMyMajors ?? (await members()).saveMyMajors,
    });
    // 내 커리큘럼의 '수업 설정에서 바꾸기'로 오면 수업 설정 탭을 연다.
    let initial = "intro";
    try {
      if (sessionStorage.getItem("comsw_profile_tab") === "classes") initial = "classes";
      sessionStorage.removeItem("comsw_profile_tab");
    } catch {
      // 저장소를 못 쓰면 내 소개부터.
    }
    mountTabs(container, [["intro", "내 소개", layout], ["classes", "수업 설정", classes]], initial);
    container.append(layout, classes);
  } catch (e) {
    setState(e.message, true);
  }
}
