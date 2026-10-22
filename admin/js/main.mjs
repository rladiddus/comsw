import { auth } from "./firebase.mjs";
import { signIn, signOutAll, currentRole } from "./session.mjs";
import { canEnter } from "./roles.mjs";
import { loginErrorMessage } from "./messages.mjs";
import { startApp, stopApp } from "./app.mjs";
import { clearActive, sessionExpired, startIdleLogout } from "./idle-logout.mjs";

const $ = (sel) => document.querySelector(sel);
const form = $("#loginForm");
const errorEl = $("#loginError");
const NO_ACCESS = "접근 권한이 없습니다. 교육부 계정만 이용할 수 있습니다.";
const IDLE_OUT = "30분 동안 사용하지 않아 로그아웃했습니다. 다시 로그인해주세요.";
let idle = null;

async function logout(message = "") {
  idle?.stop();
  idle = null;
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
  startApp({ role, email: auth.currentUser.email, uid: auth.currentUser.uid, displayName: auth.currentUser.displayName || '' });
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
// 브라우저를 다시 열었을 때 마지막 사용 후 30분이 지났으면 로그인부터 다시 한다.
auth.authStateReady()
  .then(async () => {
    if (auth.currentUser && sessionExpired()) {
      await logout(IDLE_OUT);
      return;
    }
    const role = await currentRole();
    return auth.currentUser ? enter(role) : show("login");
  })
  .catch((err) => {
    console.error("세션 확인 실패", err);
    errorEl.textContent = loginErrorMessage(err.code, err.message);
    show("login");
  });
