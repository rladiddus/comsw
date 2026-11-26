export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const PROMPTS = {
  // 강사 단계 문구(2026-11-24 사용자 요청): '교육 제안서 말투'를 빼고 '~교육'·'~제안'으로 끝나지 않게.
  week:
    "제시되는 수업 내용을 간결한 설명문 한 문장으로 정리해줘. ~합니다, ~입니다를 쓰지 말고 띄어쓰기 포함 45자 내외로 작성해줘. 문장 끝을 '교육', '제안', '교육 진행', '교육 제안', '교육 실시', '교육 추진'으로 끝내지 말고, 배우는 내용이나 결과가 드러나는 명사로 마무리해줘(예: '~ 활용법', '~ 실습', '~ 제작', '~ 완성'). 출처 표기나 대괄호 기호는 절대 포함하지 마.",
  // V4 과목 공통 4단계(2026-11-20 사용자 요청): '~교육', '~교육 진행'으로 끝나지 않게.
  common:
    "제시되는 여러 강사의 커리큘럼 내용을 하나의 간결한 설명문으로 정리해줘. ~합니다, ~입니다를 쓰지 말고 띄어쓰기 포함 45자 내외로 작성해줘. 문장 끝을 '교육', '제안', '교육 진행', '교육 제안', '교육 실시', '교육 추진'으로 끝내지 말고, 배우는 내용이나 결과가 드러나는 명사로 마무리해줘(예: '~ 활용법', '~ 실습', '~ 완성'). 출처 표기나 대괄호 기호는 절대 포함하지 마.",
  // 학과 커리큘럼 과정내용(2026-11-20): 공통 4단계를 단계마다 한 줄, 01~04
  department:
    "제시된 과목의 단계별 커리큘럼을 단계마다 한 줄씩 정리해줘. 각 줄은 01, 02, 03, 04처럼 단계 번호로 시작하고 줄바꿈으로 나눠. 각 줄은 띄어쓰기 포함 25자 내외로, ~합니다, ~입니다로 끝내지 말고 배우는 내용이 드러나는 단어로 마무리해줘(예: 01 인터페이스 이해, 레이어 조작, 파일 관리). 제시된 단계 수만큼만 쓰고, 다른 설명이나 대괄호 기호는 쓰지 마.",
  // 홈페이지 챗봇 상담 평가 정리(2026-11-26): 생각하기 켬. 결과를 Claude Code에 붙여 넣어 챗봇 지시문을 고친다.
  feedback:
    "너는 학원 홈페이지 AI 수업 상담 챗봇의 품질을 점검하는 담당자다. 아래는 방문자가 남긴 상담 평가(별점 1~5, 한마디, 그때의 대화)다. 전화번호·이메일은 이미 가려져 있다. 다음 순서로 한국어로 정리해줘. 1) 한눈에 보기: 평가 수, 평균 별점, 별점별 개수. 2) 잘된 점: 높은 별점 대화에서 반복되는 좋은 답변 방식 2~4개. 3) 아쉬운 점: 낮은 별점과 한마디를 근거로 문제를 묶어서 정리하고, 문제마다 근거가 된 대화의 질문과 답 일부를 짧게(한 줄) 인용. 4) 챗봇을 이렇게 고쳐 주세요: 챗봇 지시문을 고치는 사람에게 그대로 전달할 수 있게 '~하게 해줘' 형식의 요청 문장으로 3~7개, 중요한 것부터 번호를 붙여서. 각 요청에는 왜 필요한지 한 줄을 붙여. 5) 더 지켜볼 것: 한두 건뿐이라 판단을 미룰 것. 평가가 적거나 근거가 약하면 그렇다고 솔직히 쓰고 지어내지 마. 사람 이름·연락처 같은 개인정보는 쓰지 마. 표와 마크다운 기호 없이 번호와 줄바꿈으로만 써줘.",
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
// 1백만 토큰 단가(달러). 글: gpt-6-luna 실제 요금(0.1·0.5)의 1.5배. 모델을 바꾸면 같이 고친다.
const TEXT_RATE = { input: 0.15, output: 0.75 };
const IMAGE_RATE = { input: 8, output: 30 };
export function summaryReservation(prompt, text, fx, outTokens = 512) {
  // UTF-8 바이트 수는 토큰 수의 상한.
  const bytes = new TextEncoder().encode(`${prompt}\n${text}`).length;
  return Math.max(1, Math.ceil((bytes * TEXT_RATE.input + outTokens * TEXT_RATE.output) / 1e6 * fx));
}
// 종류별 글 요약 설정: 상담 평가 정리만 길게 읽고, 생각하기를 켜고(medium), 길게 쓴다.
export function summaryOptions(kind) {
  return kind === "feedback"
    ? { maxText: 40000, effort: "medium", outTokens: 8000 }
    : { maxText: 12000, effort: "none", outTokens: 512 };
}
export function usageCost(usage, fx, image = false) {
  if (
    !Number.isFinite(usage?.input_tokens) ||
    !Number.isFinite(usage?.output_tokens)
  ) throw new Error("AI 사용량을 확인하지 못했습니다");
  // 설정/근거는 운영 안내 참조. 한 건은 1원 아래로 적지 않는다.
  const rate = image ? IMAGE_RATE : TEXT_RATE;
  return Math.ceil(
    (usage.input_tokens * rate.input + usage.output_tokens * rate.output) /
      1e6 * fx,
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
