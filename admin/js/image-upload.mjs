import { getServices } from "./services.mjs";
import { cropImageToSquare } from "./image-crop.mjs";

export function validateImage(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("PNG·JPG·WEBP 이미지를 선택해주세요");
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("이미지는 10MB 이하로 올려주세요");
  }
}

export function mountImageUpload(
  container,
  {
    kind = "image",
    onUploaded,
    upload,
    crop = cropImageToSquare,
    label = "이미지 올리기",
  } = {},
) {
  const box = document.createElement("div");
  box.className = "upload-zone";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.hidden = true;
  input.setAttribute("aria-label", label);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-btn";
  button.textContent = label;
  const hint = document.createElement("span");
  hint.className = "muted";
  hint.textContent = "또는 여기에 끌어다 놓기 · 최대 10MB";
  const state = document.createElement("p");
  state.className = "save-state";
  state.setAttribute("role", "status");
  let busy = false;
  async function send(files) {
    if (busy || !files?.length) return;
    try {
      if (files.length !== 1) {
        throw new Error("이미지는 한 번에 한 장씩 올려주세요");
      }
      validateImage(files[0]);
      busy = true;
      button.disabled = true;
      box.setAttribute("aria-busy", "true");
      state.textContent = kind === "curriculum"
        ? "정사각형으로 자를 부분을 선택해주세요…"
        : "이미지를 올리는 중…";
      state.classList.remove("err");
      const file = kind === "curriculum" ? await crop(files[0]) : files[0];
      if (!file) {
        state.textContent = "이미지 첨부를 취소했습니다";
        return;
      }
      validateImage(file);
      state.textContent = "이미지를 올리는 중…";
      const fn = upload ?? getServices().upload;
      if (!fn) {
        throw new Error(
          "이미지 업로드 연결을 준비 중입니다. 관리자에게 문의해주세요.",
        );
      }
      const asset = await fn(file, kind);
      await onUploaded?.(asset);
      state.textContent = kind === "profile-source"
        ? "본인 사진을 비공개로 보관했습니다. 프로필을 저장해주세요."
        : "이미지를 올렸습니다";
    } catch (err) {
      state.textContent = err.message;
      state.classList.add("err");
    } finally {
      busy = false;
      button.disabled = false;
      input.value = "";
      box.removeAttribute("aria-busy");
    }
  }
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => send(input.files));
  for (const type of ["dragenter", "dragover"]) {
    box.addEventListener(type, (e) => {
      e.preventDefault();
      box.classList.add("drag-over");
    });
  }
  box.addEventListener("dragleave", () => box.classList.remove("drag-over"));
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    box.classList.remove("drag-over");
    send(e.dataTransfer?.files);
  });
  box.append(button, hint, input, state);
  container.append(box);
  return { box, busy: () => busy };
}
