import { Image } from "npm:imagescript@3.3.0";
import encodeWebp from "npm:@jsquash/webp@1.5.0/encode.js";

// 공개 이미지는 WebP로 저장한다. 메인 배경 등 일반 이미지는 긴 변 1920px까지 줄인다.
export async function toWebp(bytes: Uint8Array, kind: string) {
  const isWebp = String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (isWebp) return bytes;
  const image = await Image.decode(bytes, { maxPixels: 20_000_000 });
  const max = kind === "image" ? 1920 : 0;
  if (max && Math.max(image.width, image.height) > max) {
    const scale = max / Math.max(image.width, image.height);
    image.resize(
      Math.round(image.width * scale),
      Math.round(image.height * scale),
    );
  }
  return new Uint8Array(
    await encodeWebp({
      data: new Uint8ClampedArray(image.bitmap.buffer),
      width: image.width,
      height: image.height,
      colorSpace: "srgb",
    } as ImageData, { quality: 80 }),
  );
}

export async function preparePortrait(bytes: Uint8Array, final: boolean) {
  const image = await Image.decode(bytes, { maxPixels: 20_000_000 });
  if (image.width * image.height > 20_000_000) {
    throw new Error(
      "본인 사진의 해상도가 너무 큽니다. 2,048px 이하로 줄여주세요",
    );
  }
  if (final) {
    const scale = Math.max(941 / image.width, 1672 / image.height);
    image.resize(
      Math.ceil(image.width * scale),
      Math.ceil(image.height * scale),
    );
    image.crop(
      Math.floor((image.width - 941) / 2),
      Math.floor((image.height - 1672) / 2),
      941,
      1672,
    );
  } else if (Math.max(image.width, image.height) > 1024) {
    const scale = 1024 / Math.max(image.width, image.height);
    image.resize(
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
    );
  }
  return image.encode();
}
