import { auth } from "./firebase.mjs";
import { signIn, signOutAll, currentRole } from "./session.mjs";
import { roleLabel, canEnter } from "./roles.mjs";
import { loginErrorMessage } from "./messages.mjs";

const $ = (sel) => document.querySelector(sel);
const form = $("#loginForm");
const errorEl = $("#loginError");
const NO_ACCESS = "접근 권한이 없습니다. 교육부 계정만 이용할 수 있습니다.";

function show(view) {
  $("#loginView").hidden = view !== "login";
  $("#statusView").hidden = view !== "status";
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
  $("#statusEmail").textContent = auth.currentUser.email;
  $("#statusRole").textContent = roleLabel(role);
  show("status");
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

$("#logoutBtn").addEventListener("click", async () => {
  await signOutAll();
  show("login");
});

show("loading");
currentRole()
  .then((role) => (auth.currentUser ? enter(role) : show("login")))
  .catch((err) => {
    console.error("세션 확인 실패", err);
    errorEl.textContent = loginErrorMessage(err.code, err.message);
    show("login");
  });
