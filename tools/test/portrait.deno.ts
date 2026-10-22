import { Image } from "npm:imagescript@3.3.0";
import decodeWebp from "npm:@jsquash/webp@1.5.0/decode.js";
import {
  preparePortrait,
  toWebp,
  validateCurriculumImage,
} from "../../supabase/functions/comsw-tools/portrait.ts";

Deno.test("프로필 PNG는 941×1672이며 투명도를 유지한다", async () => {
  const image = new Image(1024, 1536);
  image.fill(0x00000000);
  const result = await Image.decode(
    await preparePortrait(await image.encode(), true),
  );
  if (result.width !== 941 || result.height !== 1672) {
    throw new Error(`잘못된 크기 ${result.width}x${result.height}`);
  }
  if ((result.getPixelAt(1, 1) & 255) !== 0) throw new Error("투명도가 사라짐");
});
Deno.test("AI 입력 사진은 긴 변 1024 이하로 줄인다", async () => {
  const result = await Image.decode(
    await preparePortrait(await new Image(1200, 1800).encode(), false),
  );
  if (Math.max(result.width, result.height) > 1024) {
    throw new Error("원본 크기 제한 실패");
  }
});

Deno.test("커리큘럼 서버 업로드는 1000px 이상 정사각형만 허용", async () => {
  await validateCurriculumImage(await new Image(1000, 1000).encode());
  for (const [w, h] of [[999, 999], [1200, 1000]]) {
    let rejected = false;
    try {
      await validateCurriculumImage(await new Image(w, h).encode());
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`${w}x${h} 이미지를 거절하지 않음`);
  }
});

Deno.test("공개 이미지는 WebP로 바꾸고 프로필 투명도·일반 이미지 1920 제한을 지킨다", async () => {
  const portrait = new Image(941, 1672);
  portrait.fill(0x00000000);
  const png = await portrait.encode();
  const webp = await toWebp(png, "profile-generated");
  const back = await decodeWebp(webp.slice().buffer);
  if (back.width !== 941 || back.height !== 1672 || back.data[3] !== 0) {
    throw new Error("프로필 WebP 크기·투명도 오류");
  }
  const wide = await decodeWebp(
    (await toWebp(await new Image(3000, 1500).encode(), "image")).slice().buffer,
  );
  if (wide.width !== 1920 || wide.height !== 960) {
    throw new Error(`일반 이미지 크기 ${wide.width}x${wide.height}`);
  }
  if (await toWebp(webp, "image") !== webp) {
    throw new Error("이미 WebP인 파일은 그대로 둔다");
  }
});
