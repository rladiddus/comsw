import { cropImageToSquare } from "../admin/js/image-crop.mjs";
const button = document.querySelector("#startCrop");
button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1100;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1600, 1100);
    gradient.addColorStop(0, "#f44920");
    gradient.addColorStop(.5, "#ffd59e");
    gradient.addColorStop(1, "#3e619a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1600, 1100);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 90px sans-serif";
    ctx.fillText("1600 × 1100", 150, 400);
    ctx.font = "50px sans-serif";
    ctx.fillText("CURRICULUM IMAGE", 150, 500);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    const file = await cropImageToSquare(
      new File([blob], "wide-example.png", { type: "image/png" }),
    );
    const result = document.querySelector("#result");
    if (!file) {
      result.textContent = "크롭을 취소했습니다";
      return;
    }
    const img = document.querySelector("#croppedImage");
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    const url = URL.createObjectURL(file);
    img.dataset.objectUrl = url;
    img.src = url;
    await img.decode();
    img.hidden = false;
    result.textContent =
      `크롭 완료 · ${img.naturalWidth}×${img.naturalHeight}px · ${file.name}`;
  } catch (e) {
    document.querySelector("#result").textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
