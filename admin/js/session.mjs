import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
import { auth, functions } from "./firebase.mjs";

const cfg = window.COMSW_SUPABASE_CONFIG;

export const supabase = createClient(cfg.url, cfg.anonKey, {
  accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
});

// 승인·등급 변경이 옛 토큰에 남지 않도록 클레임을 다시 계산하고 토큰을 강제 갱신한다.
// 직원이 아니면 토큰에 Supabase 인증 클레임이 없으므로 Supabase를 부르지 않는다.
async function syncRole(user) {
  const { data: refreshed } = await httpsCallable(functions, "refreshMyComswClaims")();
  if (!refreshed?.role) return null;
  await user.getIdToken(true);
  const { data, error } = await supabase.rpc("comsw_whoami");
  if (error) throw error;
  return data?.role ?? null;
}

export async function signIn(idOrEmail, password) {
  let email = idOrEmail.trim();
  if (!email.includes("@")) {
    const result = await httpsCallable(functions, "loginWithUsername")({ username: email, password });
    email = result.data.email;
  }
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return { uid: user.uid, role: await syncRole(user) };
}

// 새로고침(이미 로그인됨): 지금 토큰의 역할(comsw_role, DB도 이 값으로 권한을 판단)로 바로 들어가고,
// 권한 다시 계산(쌤톡 서버, 잠들어 있으면 몇 초)은 뒤에서 한다. 등급이 바뀌었으면 토큰을 새로 받아 화면을 다시 연다.
// 토큰에 역할이 없으면(처음·직원 아님) 예전처럼 끝까지 기다려 확인한다.
export async function currentRole() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  const role = (await user.getIdTokenResult()).claims.comsw_role || null;
  if (!role) return syncRole(user);
  recheckRole(user, role);
  return role;
}

async function recheckRole(user, role) {
  try {
    const { data } = await httpsCallable(functions, "refreshMyComswClaims")();
    if ((data?.role ?? null) === role) return;
    // 새 토큰의 역할이 실제로 바뀌었을 때만 다시 연다(같으면 다시 열어도 또 같아서 되풀이하지 않음).
    const fresh = (await user.getIdTokenResult(true)).claims.comsw_role || null;
    if (fresh !== role) location.reload();
  } catch (err) {
    console.warn("권한 다시 확인 실패(다음 새로고침 때 다시 확인)", err);
  }
}

export function signOutAll() {
  try { localStorage.removeItem("comsw_preview_token"); } catch {}
  return signOut(auth);
}
