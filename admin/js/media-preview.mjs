import { driveThumbnail } from "./drive.mjs";

// 공개 사이트 index.html의 detectMediaTypeForIndex와 같은 규칙으로 이미지·영상을 구분한다.
export function mediaKind(url) {
  const raw = String(url || "").toLowerCase();
  if (!raw.trim()) return "empty";
  if (raw.includes("youtube.com") || raw.includes("youtu.be")) return "youtube";
  if (raw.includes("vimeo.com")) return "vimeo";
  if (/\.(mp4|webm|mov|ogg)(\?|#|$)/.test(raw)) return "video";
  if (raw.includes("pexels.com") && raw.includes("/download/video/")) return "video";
  if (raw.includes("pixabay.com") && raw.includes("/videos/")) return "video";
  if (raw.includes("coverr.co")) return "video";
  if (raw.includes("drive.google.com")) return "drive";
  return "image";
}

const youtubeId = (url) =>
  String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/)?.[1];
const vimeoId = (url) => String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
const driveId = (url) =>
  String(url).match(/\/file\/d\/([^/?#]+)/)?.[1] ||
  String(url).match(/[?&]id=([^&#]+)/)?.[1];

// 미리보기 요소 하나. 영상은 소리 없이 반복 재생한다.
export function mediaPreview(url) {
  const kind = mediaKind(url);
  const make = (tag, props) => Object.assign(document.createElement(tag), props);
  const frame = (src) =>
    make("iframe", { src, allow: "autoplay; encrypted-media", title: "미리보기" });
  if (kind === "empty") return make("span", { className: "muted", textContent: "주소를 넣으면 미리보기가 나옵니다" });
  if (kind === "youtube" && youtubeId(url)) {
    return frame(`https://www.youtube.com/embed/${youtubeId(url)}?autoplay=1&mute=1&loop=1&playlist=${youtubeId(url)}`);
  }
  if (kind === "vimeo" && vimeoId(url)) {
    return frame(`https://player.vimeo.com/video/${vimeoId(url)}?autoplay=1&muted=1&loop=1`);
  }
  if (kind === "drive" && driveId(url)) {
    return frame(`https://drive.google.com/file/d/${driveId(url)}/preview`);
  }
  if (kind === "video") {
    return make("video", { src: url, muted: true, loop: true, autoplay: true, playsInline: true, controls: true });
  }
  const img = make("img", { src: driveThumbnail(url), alt: "미리보기" });
  img.addEventListener("error", () => img.replaceWith(make("span", { className: "muted", textContent: "이미지를 불러오지 못했습니다" })));
  return img;
}
