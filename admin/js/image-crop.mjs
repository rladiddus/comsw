const MIN_SIDE = 1000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function initialCrop(width, height) {
  if (
    !Number.isFinite(width) || !Number.isFinite(height) ||
    Math.min(width, height) < MIN_SIDE
  ) {
    throw new Error(
      "이미지의 가로와 세로가 모두 1000px 이상이어야 합니다. 더 큰 원본을 올려주세요.",
    );
  }
  const side = Math.min(width, height);
  return { width, height, x: (width - side) / 2, y: (height - side) / 2, side };
}
export function adjustCrop(current, patch) {
  const side = clamp(
    patch.side ?? current.side,
    MIN_SIDE,
    Math.min(current.width, current.height),
  );
  return {
    ...current,
    side,
    x: clamp(patch.x ?? current.x, 0, current.width - side),
    y: clamp(patch.y ?? current.y, 0, current.height - side),
  };
}
export function panCrop(current, dx, dy, previewSize) {
  return adjustCrop(current, {
    x: current.x - dx * current.side / previewSize,
    y: current.y - dy * current.side / previewSize,
  });
}

export async function cropImageToSquare(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    let crop = initialCrop(image.naturalWidth, image.naturalHeight);
    return await new Promise((resolve, reject) => {
      const previous = document.activeElement;
      const dialog = document.createElement("dialog");
      dialog.className = "crop-dialog";
      const title = document.createElement("h2");
      title.textContent = "커리큘럼 이미지 자르기";
      title.id = "crop-dialog-title";
      dialog.setAttribute("aria-labelledby", title.id);
      const desc = document.createElement("p");
      desc.className = "desc";
      desc.textContent =
        "이미지를 끌어 위치를 맞추고 크기를 조절해주세요. 선택한 부분을 1000×1000px로 저장합니다.";
      const canvas = document.createElement("canvas");
      canvas.className = "crop-canvas";
      canvas.width = 600;
      canvas.height = 600;
      canvas.tabIndex = 0;
      canvas.setAttribute(
        "aria-label",
        "정사각형 크롭 미리보기. 드래그하거나 아래 위치 슬라이더를 사용하세요.",
      );
      const context = canvas.getContext("2d");
      const state = document.createElement("p");
      state.className = "muted";
      state.setAttribute("role", "status");
      function slider(label, min, max, value, change) {
        const wrap = document.createElement("label");
        wrap.className = "crop-control";
        const text = document.createElement("span");
        text.textContent = label;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = "1";
        input.value = String(value);
        input.addEventListener("input", () => change(Number(input.value)));
        wrap.append(text, input);
        return { wrap, input };
      }
      const size = slider(
        "자르기 크기",
        MIN_SIDE,
        Math.min(crop.width, crop.height),
        crop.side,
        (value) => {
          const centerX = crop.x + crop.side / 2,
            centerY = crop.y + crop.side / 2;
          crop = adjustCrop(crop, {
            side: value,
            x: centerX - value / 2,
            y: centerY - value / 2,
          });
          draw();
        },
      );
      const horizontal = slider(
        "가로 위치",
        0,
        crop.width - crop.side,
        crop.x,
        (value) => {
          crop = adjustCrop(crop, { x: value });
          draw();
        },
      );
      const vertical = slider(
        "세로 위치",
        0,
        crop.height - crop.side,
        crop.y,
        (value) => {
          crop = adjustCrop(crop, { y: value });
          draw();
        },
      );
      function draw() {
        context.clearRect(0, 0, 600, 600);
        context.drawImage(
          image,
          crop.x,
          crop.y,
          crop.side,
          crop.side,
          0,
          0,
          600,
          600,
        );
        horizontal.input.max = String(crop.width - crop.side);
        horizontal.input.value = String(crop.x);
        horizontal.input.disabled = crop.width === crop.side;
        vertical.input.max = String(crop.height - crop.side);
        vertical.input.value = String(crop.y);
        vertical.input.disabled = crop.height === crop.side;
        size.input.value = String(crop.side);
        size.input.disabled = Math.min(crop.width, crop.height) === MIN_SIDE;
        state.textContent = `원본 ${crop.width}×${crop.height}px · 선택 영역 ${
          Math.floor(crop.side)
        }×${Math.floor(crop.side)}px · 저장 1000×1000px`;
      }
      let pointer = null;
      canvas.addEventListener("pointerdown", (event) => {
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!pointer || pointer.id !== event.pointerId) return;
        crop = panCrop(
          crop,
          event.clientX - pointer.x,
          event.clientY - pointer.y,
          canvas.getBoundingClientRect().width,
        );
        pointer = { ...pointer, x: event.clientX, y: event.clientY };
        draw();
      });
      const release = () => {
        pointer = null;
      };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
      canvas.addEventListener("lostpointercapture", release);
      canvas.addEventListener("keydown", (event) => {
        const shifts = {
          ArrowLeft: [10, 0],
          ArrowRight: [-10, 0],
          ArrowUp: [0, 10],
          ArrowDown: [0, -10],
        };
        if (shifts[event.key]) {
          event.preventDefault();
          const [dx, dy] = shifts[event.key];
          crop = panCrop(crop, dx, dy, 600);
          draw();
        }
      });
      const actions = document.createElement("div");
      actions.className = "form-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "ghost-btn";
      cancel.textContent = "취소";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "publish-btn";
      save.textContent = "이 부분으로 첨부";
      let done = false;
      function finish(value, error) {
        if (done) return;
        done = true;
        dialog.close();
        dialog.remove();
        previous?.focus?.();
        if (error) reject(error);
        else resolve(value);
      }
      cancel.addEventListener("click", () => finish(null));
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(null);
      });
      save.addEventListener("click", () => {
        save.disabled = true;
        cancel.disabled = true;
        const output = document.createElement("canvas");
        output.width = MIN_SIDE;
        output.height = MIN_SIDE;
        try {
          output.getContext("2d").drawImage(
            image,
            crop.x,
            crop.y,
            crop.side,
            crop.side,
            0,
            0,
            MIN_SIDE,
            MIN_SIDE,
          );
          output.toBlob((blob) => {
            if (!blob) {
              finish(null, new Error("이미지를 저장하지 못했습니다"));
              return;
            }
            finish(
              new File(
                [blob],
                `${file.name.replace(/\.[^.]+$/, "")}-square.png`,
                { type: "image/png" },
              ),
            );
          }, "image/png");
        } catch (error) {
          finish(null, error);
        }
      });
      actions.append(cancel, save);
      dialog.append(
        title,
        desc,
        canvas,
        size.wrap,
        horizontal.wrap,
        vertical.wrap,
        state,
        actions,
      );
      document.body.append(dialog);
      draw();
      dialog.showModal();
      save.focus();
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
