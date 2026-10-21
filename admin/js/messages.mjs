// 쌤톡 public/app-firebase.js 로그인 오류 매핑과 같은 문구 (가입 안내만 쌤톡으로).
const NO_ID = "아이디가 없습니다. 쌤톡에서 회원가입해주세요.";
const BAD_PW = "비밀번호가 맞지 않습니다.";
const TOO_MANY = "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.";

const MESSAGES = {
  "auth/user-not-found": NO_ID,
  "auth/invalid-email": NO_ID,
  "functions/not-found": NO_ID,
  "auth/wrong-password": BAD_PW,
  "auth/invalid-credential": BAD_PW,
  "functions/unauthenticated": BAD_PW,
  "functions/permission-denied": "관리자의 승인을 기다려주세요.",
  "functions/failed-precondition": "로그인 정보가 완전하지 않습니다. 관리자에게 문의해주세요.",
  "auth/too-many-requests": TOO_MANY,
  "functions/resource-exhausted": TOO_MANY,
};

export function loginErrorMessage(code, fallback = "로그인하지 못했습니다. 잠시 후 다시 시도해주세요.") {
  return MESSAGES[code] ?? fallback;
}
