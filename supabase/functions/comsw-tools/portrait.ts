import { Image } from "npm:imagescript@3.3.0";

export async function validateCurriculumImage(bytes: Uint8Array) {
  const image = await Image.decode(bytes, { maxPixels: 20_000_000 });
  if (image.width !== image.height || image.width < 1000) {
    throw new Error(
      "커리큘럼 이미지는 1000px 이상의 정사각형으로 잘라서 올려주세요",
    );
  }
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
