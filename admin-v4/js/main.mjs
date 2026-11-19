// V4 시작점: 로그인·세션 복구·30분 유휴 로그아웃은 기존 관리 화면과 같은 모듈(admin/js)을 그대로 쓴다.
// 쌤톡 Firebase 로그인 → 역할 클레임 갱신 → Firebase 토큰으로 Supabase. 새 로그인 방식은 만들지 않는다.
import { auth } from "../../admin/js/firebase.mjs";
import { signIn, signOutAll, currentRole } from "../../admin/js/session.mjs";
import { canEnter } from "../../admin/js/roles.mjs";
import { loginErrorMessage } from "../../admin/js/messages.mjs";
import { clearActive, sessionExpired, startIdleLogout } from "../../admin/js/idle-logout.mjs";
import { startApp, stopApp } from "./app.mjs";
import { stashAll } from "./changes.mjs";

const $ = (sel) => document.querySelector(sel);
const form = $("#loginForm");
const errorEl = $("#loginError");
const NO_ACCESS = "접근 권한이 없습니다. 교육부 계정만 이용할 수 있습니다.";
const IDLE_OUT = "30분 동안 사용하지 않아 로그아웃했습니다. 다시 로그인해주세요.";
let idle = null;

async function logout(message = "") {
  idle?.stop();
  idle = null;
  await stashAll(); // 저장 안 한 변경은 로그아웃 전에 임시 저장(다시 로그인하면 이어서)
  clearActive();
  await signOutAll();
  stopApp();
  errorEl.textContent = message;
  show("login");
}

function show(view) {
  $("#loginView").hidden = view !== "login";
  $("#loadingView").hidden = view !== "loading";
}

function lockForm(locked) {
  form.querySelectorAll("input, button").forEach((el) => { el.disabled = locked; });
  form.querySelector("button").textContent = locked ? "로그인 중..." : "로그인";
}

async function enter(role) {
  if (!canEnter(role)) {
    await signOutAll();
    errorEl.textContent = NO_ACCESS;
    show("login");
    return;
  }
  const u = auth.currentUser;
  startApp({ role, email: u.email, uid: u.uid, displayName: u.displayName || "" });
  idle?.stop();
  idle = startIdleLogout({ onLogout: () => logout(IDLE_OUT) });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  errorEl.textContent = "";
  lockForm(true);
  try {
    const { role } = await signIn(String(fd.get("id") || ""), String(fd.get("password") || ""));
    form.reset();
    await enter(role);
  } catch (err) {
    console.error("로그인 실패", err);
    errorEl.textContent = loginErrorMessage(err.code, err.message);
  } finally {
    lockForm(false);
  }
});

$("#logoutBtn").addEventListener("click", () => logout());

show("loading");
auth.authStateReady()
  .then(async () => {
    if (auth.currentUser && sessionExpired()) return logout(IDLE_OUT);
    const role = await currentRole();
    return auth.currentUser ? enter(role) : show("login");
  })
  .catch((err) => {
    console.error("세션 확인 실패", err);
    errorEl.textContent = loginErrorMessage(err.code, err.message);
    show("login");
  });
