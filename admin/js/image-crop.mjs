// 커리큘럼 이미지: 원본은 그대로 올리고, 사이트 썸네일(학과별 자료 카드, 269×391 세로 직사각형)로 보일 영역만 고른다.
// 고른 영역은 주소 뒤 '#crop=x,y,w,h'(원본 대비 0~1 비율)로 남긴다 → 썸네일은 그 영역, 크게 보기는 원본.
// '#' 뒤는 서버로 가지 않으므로 이미지 주소로는 그대로 쓰인다(예전 정사각형 이미지는 영역 없이 그대로).
export const THUMB_RATIO = 269 / 391; // 가로 / 세로
const MIN_WIDTH = 300; // 고를 수 있는 가장 작은 영역 가로(px)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function initialCrop(width, height) {
  if (!(width > 0 && height > 0)) throw new Error("이미지를 불러오지 못했습니다. 다른 파일로 올려주세요.");
  const w = Math.min(width, height * THUMB_RATIO);
  const h = w / THUMB_RATIO;
  return { width, height, x: (width - w) / 2, y: (height - h) / 2, w, h };
}
const maxWidth = (c) => Math.min(c.width, c.height * THUMB_RATIO);
export function adjustCrop(current, patch) {
  const w = clamp(patch.w ?? current.w, Math.min(MIN_WIDTH, maxWidth(current)), maxWidth(current));
  const h = w / THUMB_RATIO;
  return {
    ...current,
    w,
    h,
    x: clamp(patch.x ?? current.x, 0, current.width - w),
    y: clamp(patch.y ?? current.y, 0, current.height - h),
  };
}
export function panCrop(current, dx, dy, previewWidth) {
  return adjustCrop(current, {
    x: current.x - dx * current.w / previewWidth,
    y: current.y - dy * current.w / previewWidth,
  });
}

const round = (n) => Math.round(n * 10000) / 10000;
export function cropFragment(c) {
  return `#crop=${[c.x / c.width, c.y / c.height, c.w / c.width, c.h / c.height].map(round).join(",")}`;
}
export const stripCrop = (url) => String(url ?? "").replace(/#crop=[^#]*$/, "");
export function parseCrop(url) {
  const m = String(url ?? "").match(/#crop=([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/);
  if (!m) return null;
  const [x, y, w, h] = m.slice(1).map(Number);
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}
// 썸네일 칸 안의 img를 고른 영역만 보이게 배치한다(칸은 overflow:hidden, 같은 세로 비율).
export function applyCrop(img, url) {
  const c = parseCrop(url);
  if (!c) return img;
  Object.assign(img.style, {
    position: "absolute",
    maxWidth: "none",
    objectFit: "fill",
    width: `${100 / c.w}%`,
    height: `${100 / c.h}%`,
    left: `${-100 * c.x / c.w}%`,
    top: `${-100 * c.y / c.h}%`,
  });
  img.classList.add("thumb-cropped");
  return img;
}

// 썸네일 영역 고르기 창. source = 새 파일(File) 또는 이미 올린 이미지 주소. 고르면 '#crop=…', 취소하면 null.
export async function chooseThumbnail(source) {
  const isFile = typeof source !== "string";
  const url = isFile ? URL.createObjectURL(source) : stripCrop(source);
  const image = new Image();
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("이미지를 불러오지 못했습니다. 예전 드라이브 링크라면 '새로 올리기'로 다시 올려주세요.");
    }
    let crop = initialCrop(image.naturalWidth, image.naturalHeight);
    const old = parseCrop(source);
    if (!isFile && old) {
      crop = adjustCrop(crop, { w: old.w * crop.width, x: old.x * crop.width, y: old.y * crop.height });
    }
    return await new Promise((resolve) => {
      const previous = document.activeElement;
      const dialog = document.createElement("dialog");
      dialog.className = "crop-dialog";
      const title = document.createElement("h2");
      title.textContent = "썸네일로 보일 부분 고르기";
      title.id = "crop-dialog-title";
      dialog.setAttribute("aria-labelledby", title.id);
      const desc = document.createElement("p");
      desc.className = "desc";
      desc.textContent =
        "사이트 카드에 세로 직사각형으로 보일 부분입니다. 끌어서 위치를 맞추고 크기를 조절해주세요. 원본은 그대로 올라가고, 크게 볼 때는 원본 전체가 보입니다.";
      const PREVIEW_W = 340;
      const PREVIEW_H = Math.round(PREVIEW_W / THUMB_RATIO);
      const canvas = document.createElement("canvas");
      canvas.className = "crop-canvas thumb";
      canvas.width = PREVIEW_W;
      canvas.height = PREVIEW_H;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "썸네일 미리보기. 드래그하거나 아래 슬라이더를 사용하세요.");
      const context = canvas.getContext("2d");
      const state = document.createElement("p");
      state.className = "muted";
      state.setAttribute("role", "status");
      function slider(label, change) {
        const wrap = document.createElement("label");
        wrap.className = "crop-control";
        const text = document.createElement("span");
        text.textContent = label;
        const input = document.createElement("input");
        input.type = "range";
        input.step = "1";
        input.addEventListener("input", () => change(Number(input.value)));
        wrap.append(text, input);
        return { wrap, input };
      }
      // 크기 슬라이더: 오른쪽으로 갈수록 영역이 커진다(덜 확대).
      const size = slider("자르기 크기", (value) => {
        const cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
        const w = value;
        crop = adjustCrop(crop, { w, x: cx - w / 2, y: cy - w / THUMB_RATIO / 2 });
        draw();
      });
      const horizontal = slider("가로 위치", (value) => {
        crop = adjustCrop(crop, { x: value });
        draw();
      });
      const vertical = slider("세로 위치", (value) => {
        crop = adjustCrop(crop, { y: value });
        draw();
      });
      const set = (s, min, max, value) => {
        Object.assign(s.input, { min: String(Math.floor(min)), max: String(Math.floor(max)), value: String(Math.round(value)) });
        s.input.disabled = max - min < 1;
      };
      function draw() {
        context.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
        context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, PREVIEW_W, PREVIEW_H);
        set(size, Math.min(MIN_WIDTH, maxWidth(crop)), maxWidth(crop), crop.w);
        set(horizontal, 0, crop.width - crop.w, crop.x);
        set(vertical, 0, crop.height - crop.h, crop.y);
        state.textContent = `원본 ${crop.width}×${crop.height}px · 썸네일 영역 ${Math.floor(crop.w)}×${Math.floor(crop.h)}px`;
      }
      let pointer = null;
      canvas.addEventListener("pointerdown", (event) => {
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.setPointerCapture?.(event.pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!pointer || pointer.id !== event.pointerId) return;
        crop = panCrop(crop, event.clientX - pointer.x, event.clientY - pointer.y, canvas.getBoundingClientRect().width || PREVIEW_W);
        pointer = { ...pointer, x: event.clientX, y: event.clientY };
        draw();
      });
      const release = () => { pointer = null; };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
      canvas.addEventListener("lostpointercapture", release);
      canvas.addEventListener("keydown", (event) => {
        const shifts = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
        if (!shifts[event.key]) return;
        event.preventDefault();
        crop = panCrop(crop, ...shifts[event.key], PREVIEW_W);
        draw();
      });
      const actions = document.createElement("div");
      actions.className = "form-actions";
      const cancel = Object.assign(document.createElement("button"), { type: "button", className: "ghost-btn", textContent: "취소" });
      const save = Object.assign(document.createElement("button"), { type: "button", className: "publish-btn", textContent: "이 부분으로 첨부" });
      let done = false;
      function finish(value) {
        if (done) return;
        done = true;
        dialog.close();
        dialog.remove();
        previous?.focus?.();
        resolve(value);
      }
      cancel.addEventListener("click", () => finish(null));
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(null);
      });
      save.addEventListener("click", () => finish(cropFragment(crop)));
      actions.append(cancel, save);
      dialog.append(title, desc, canvas, size.wrap, horizontal.wrap, vertical.wrap, state, actions);
      document.body.append(dialog);
      draw();
      dialog.showModal();
      save.focus();
    });
  } finally {
    if (isFile) URL.revokeObjectURL(url);
  }
}
