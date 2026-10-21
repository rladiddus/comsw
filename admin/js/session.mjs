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

export async function currentRole() {
  await auth.authStateReady();
  return auth.currentUser ? syncRole(auth.currentUser) : null;
}

export function signOutAll() {
  try { localStorage.removeItem("comsw_preview_token"); } catch {}
  return signOut(auth);
}
