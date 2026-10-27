import { getServices } from "./services.mjs";
import { chooseThumbnail } from "./image-crop.mjs";

export function validateImage(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("PNG·JPG·WEBP 이미지를 선택해주세요");
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("이미지는 10MB 이하로 올려주세요");
  }
}

// 올리기 전에 브라우저에서 긴 변을 줄이고 WebP로 바꾼다. 서버 함수는 CPU 약 2초 제한이라
// 휴대폰 사진(1200만 화소)을 서버에서 바꾸면 중간에 끊겨 '요청에 실패했습니다'가 났다(서버는 WebP면 그대로 저장).
// 썸네일 영역('#crop=')은 비율이라 줄여도 그대로 맞는다. 브라우저가 못 하면 원본을 보낸다.
const MAX_SIDE = { image: 1920, curriculum: 2560 };
export async function shrinkImage(file, kind) {
  const max = MAX_SIDE[kind];
  if (!max || typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/webp") return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((done) => canvas.toBlob?.(done, "image/webp", 0.85) ?? done(null));
  // WebP로 못 바꾸는 브라우저면(예전 Safari) 줄인 것만이라도 JPG로.
  const out = blob?.type === "image/webp" ? blob
    : await new Promise((done) => canvas.toBlob?.(done, "image/jpeg", 0.9) ?? done(null));
  if (!out || (scale === 1 && out.size >= file.size)) return file;
  const ext = out.type === "image/webp" ? "webp" : "jpg";
  return new File([out], String(file.name || "image").replace(/\.[^.]*$/, "") + "." + ext, { type: out.type });
}

export function mountImageUpload(
  container,
  {
    kind = "image",
    onUploaded,
    upload,
    crop = chooseThumbnail, // 커리큘럼: 썸네일 영역('#crop=…')을 고르고 원본을 올린다
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
        ? "썸네일로 보일 부분을 골라주세요…"
        : "이미지를 올리는 중…";
      state.classList.remove("err");
      const file = files[0];
      const fragment = kind === "curriculum" ? await crop(file) : "";
      if (fragment === null) {
        state.textContent = "이미지 첨부를 취소했습니다";
        return;
      }
      state.textContent = "이미지를 올리는 중…";
      const fn = upload ?? getServices().upload;
      if (!fn) {
        throw new Error(
          "이미지 업로드 연결을 준비 중입니다. 관리자에게 문의해주세요.",
        );
      }
      const asset = await fn(await shrinkImage(file, kind), kind);
      await onUploaded?.(fragment ? { ...asset, url: `${asset.url}${fragment}` } : asset);
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
