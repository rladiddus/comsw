export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const PROMPTS = {
  week:
    "제시되는 내용을 간결한 설명문으로 정리해줘. ~합니다, ~입니다를 쓰지않고, 공식적인 교육 제안서 말투로 띄어쓰기포함 45자 내외로 작성해줘. 단, 결과에과 같은 출처 표기나 대괄호 기호는 절대 포함하지 마.",
  department:
    "제시된 커리큘럼을 두 문장으로 정리. 각 문장은 01, 02로 시작하고 25글자 내외. ~합니다, ~입니다로 끝나지않고 단어로 마무리. 예를 들어 포토샵 기본 툴 사용법 이렇게. 그리고 01과 02는 줄바꿈",
  roadmap:
    "주어진 문장을 10자 내의 두 문장으로 정리. 두 문장은 서로 줄바꿈으로 표기",
  profile:
    "첨부 사진과 동일한 인물로 보이도록 얼굴 특징과 자연스러운 비율을 유지. 세련되고 전문적인 강사 프로필 사진. 따뜻하고 균형 잡힌 톤, 부드러운 스튜디오 조명. 머리부터 가슴 위까지 들어오는 상반신 구도. 얼굴 정면, 시선 카메라. 몸은 화면 기준 왼쪽으로 약 15도, 인물의 왼쪽 어깨가 카메라에 조금 더 가까운 자연스러운 자세. 원본 의상 색상을 참고하여 현대적이고 단정한 의상. 얼굴과 머리가 잘리지 않도록 충분한 여백. 배경은 완전 투명, 세로형 강사 소개용 PNG. 글자·로고 없음.",
};

export function requireMember(claims) {
  if (
    !claims?.sub || !["admin", "head", "teacher"].includes(claims.comsw_role)
  ) throw new Error("접근 권한이 없습니다");
  return {
    uid: claims.sub,
    role: claims.comsw_role,
    manager: ["admin", "head"].includes(claims.comsw_role),
  };
}
export function checkImage(bytes, declaredType) {
  if (!bytes?.length || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("이미지는 10MB 이하로 올려주세요");
  }
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 &&
    bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const type = png
    ? "image/png"
    : jpeg
    ? "image/jpeg"
    : webp
    ? "image/webp"
    : null;
  if (!type || type !== declaredType) {
    throw new Error("PNG·JPG·WEBP 이미지 파일을 확인해주세요");
  }
  return type;
}
export function safeFilename(name) {
  return String(name || "image.png").replace(/[\x00-\x1f/\\]/g, "_").slice(
    -120,
  );
}
export function summaryReservation(prompt, text, fx) {
  // UTF-8 바이트 수는 토큰 수의 상한. 고정 모델에 실제 단가보다 높은 보수적 단가를 적용한다.
  const bytes = new TextEncoder().encode(`${prompt}\n${text}`).length;
  return Math.max(1, Math.ceil((bytes * 5 + 512 * 30) / 1e6 * fx));
}
export function usageCost(usage, fx, image = false) {
  if (
    !Number.isFinite(usage?.input_tokens) ||
    !Number.isFinite(usage?.output_tokens)
  ) throw new Error("AI 사용량을 확인하지 못했습니다");
  // 현재 일반 요금보다 높은 단가로 합산하여 예산에 여유를 남긴다. 설정/근거는 운영 안내 참조.
  return Math.ceil(
    (usage.input_tokens * (image ? 8 : 5) + usage.output_tokens * 30) / 1e6 *
      fx,
  );
}
export async function digest(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
