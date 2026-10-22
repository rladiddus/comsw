// 30분 동안 조작이 없으면 로그아웃한다. 1분 전에 '30분 연장 / 로그아웃'을 묻는다(연장 횟수 제한 없음).
// 마지막 사용 시각은 브라우저 저장소에 남겨 탭끼리 공유하고, 브라우저를 다시 열었을 때도 확인한다.
export const IDLE_MS = 30 * 60 * 1000;
export const WARN_MS = 60 * 1000;
const KEY = "comsw_last_active";

export function idleState(last, now) {
  const idle = now - last;
  if (idle >= IDLE_MS) return "logout";
  if (idle >= IDLE_MS - WARN_MS) return "warn";
  return "ok";
}

export function lastActive(storage = localStorage) {
  try {
    return Number(storage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}
export function markActive(storage = localStorage, now = Date.now()) {
  try {
    storage.setItem(KEY, String(now));
  } catch {
    // 저장소를 못 쓰면 이 탭 안에서만 센다.
  }
}
export function clearActive(storage = localStorage) {
  try {
    storage.removeItem(KEY);
  } catch {
    // 무시
  }
}

// 다시 열었을 때: 기록이 있고 30분이 지났으면 만료. 기록이 없으면(처음) 만료로 보지 않는다.
export function sessionExpired(storage = localStorage, now = Date.now()) {
  const last = lastActive(storage);
  return last > 0 && idleState(last, now) === "logout";
}

const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];

export function startIdleLogout({
  onLogout,
  now = () => Date.now(),
  storage = localStorage,
  doc = document,
  tickMs = 1000,
}) {
  let local = now();
  let saved = 0;
  const touch = () => {
    local = now();
    saved = local;
    markActive(storage, local);
  };
  touch();

  const left = doc.createElement("strong");
  const extend = Object.assign(doc.createElement("button"), {
    type: "button",
    className: "publish-btn",
    textContent: "30분 연장",
  });
  const leave = Object.assign(doc.createElement("button"), {
    type: "button",
    className: "ghost-btn",
    textContent: "로그아웃",
  });
  const dialog = doc.createElement("dialog");
  dialog.className = "idle-dialog";
  const text = doc.createElement("p");
  text.append("30분 동안 사용하지 않아 ", left, " 뒤 로그아웃됩니다.");
  const title = Object.assign(doc.createElement("h3"), { textContent: "곧 로그아웃됩니다" });
  const actions = Object.assign(doc.createElement("div"), { className: "form-actions" });
  actions.append(extend, leave);
  dialog.append(title, text, actions);
  // Esc로 닫아도 연장으로 보지 않는다(버튼으로만 결정).
  dialog.addEventListener("cancel", (e) => e.preventDefault());
  doc.body.append(dialog);
  const isOpen = () => dialog.open || dialog.hasAttribute("open");
  const open = () => {
    if (isOpen()) return;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  const close = () => {
    if (dialog.close) dialog.close();
    dialog.removeAttribute("open");
  };

  // 경고가 떠 있을 때는 마우스 움직임으로 연장하지 않는다(버튼으로 고른다).
  const onActivity = () => {
    if (isOpen()) return;
    if (now() - saved > 5000) touch();
    else local = now();
  };
  for (const type of ACTIVITY) doc.addEventListener(type, onActivity, { capture: true, passive: true });

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    for (const type of ACTIVITY) doc.removeEventListener(type, onActivity, { capture: true });
    close();
    dialog.remove();
  }
  const logout = () => {
    stop();
    onLogout();
  };
  function check() {
    // 다른 탭에서 쓰고 있으면 그 시각을 따른다.
    const last = Math.max(local, lastActive(storage));
    const state = idleState(last, now());
    if (state === "logout") return logout();
    if (state === "warn") {
      const sec = Math.max(0, Math.ceil((last + IDLE_MS - now()) / 1000));
      left.textContent = `${sec}초`;
      open();
    } else if (isOpen()) {
      close();
    }
  }
  extend.addEventListener("click", () => {
    touch();
    close();
  });
  leave.addEventListener("click", logout);
  const timer = setInterval(check, tickMs);
  return { stop, check };
}
