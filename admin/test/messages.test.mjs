import test from "node:test";
import assert from "node:assert/strict";
import { loginErrorMessage } from "../js/messages.mjs";

test("쌤톡과 같은 로그인 오류 문구", () => {
  assert.equal(loginErrorMessage("functions/not-found"), "아이디가 없습니다. 쌤톡에서 회원가입해주세요.");
  assert.equal(loginErrorMessage("auth/user-not-found"), "아이디가 없습니다. 쌤톡에서 회원가입해주세요.");
  assert.equal(loginErrorMessage("auth/invalid-email"), "아이디가 없습니다. 쌤톡에서 회원가입해주세요.");
  assert.equal(loginErrorMessage("auth/invalid-credential"), "비밀번호가 맞지 않습니다.");
  assert.equal(loginErrorMessage("auth/wrong-password"), "비밀번호가 맞지 않습니다.");
  assert.equal(loginErrorMessage("functions/unauthenticated"), "비밀번호가 맞지 않습니다.");
  assert.equal(loginErrorMessage("functions/permission-denied"), "관리자의 승인을 기다려주세요.");
  assert.equal(loginErrorMessage("functions/failed-precondition"), "로그인 정보가 완전하지 않습니다. 관리자에게 문의해주세요.");
  assert.equal(loginErrorMessage("auth/too-many-requests"), "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.");
  assert.equal(loginErrorMessage("functions/resource-exhausted"), "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.");
  assert.equal(loginErrorMessage("something/else", "원문"), "원문");
});
