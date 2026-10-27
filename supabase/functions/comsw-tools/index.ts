import "jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "npm:jose@6.1.0";
import { preparePortrait, toWebp } from "./portrait.ts";
import { createHandler } from "./handler.mjs";
import { createStorage } from "./storage.mjs";

const env = (name: string) => Deno.env.get(name);
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const serviceClient = () =>
  createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, options);

// Firebase(sbs-com-sw) 서비스 계정으로 Storage 쓰기용 접근 토큰을 받는다.
let firebaseCache = { token: "", expires: 0 };
async function firebaseToken() {
  if (firebaseCache.token && Date.now() < firebaseCache.expires) {
    return firebaseCache.token;
  }
  const account = JSON.parse(env("FIREBASE_SERVICE_ACCOUNT") || "{}");
  if (!account.private_key) {
    throw new Error("관리자가 이미지 저장소 연결을 완료해야 합니다");
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/devstorage.read_write",
  })
    .setProtectedHeader({ alg: "RS256", kid: account.private_key_id })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(account.private_key, "RS256"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error("이미지 저장소 연결을 확인해주세요");
  }
  firebaseCache = {
    token: data.access_token,
    expires: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
  };
  return firebaseCache.token;
}
const handler = createHandler({
  env,
  verifyToken: async (token: string) =>
    (await jwtVerify(token, keys, {
      issuer: "https://securetoken.google.com/ssamtalk-sbs",
      audience: "ssamtalk-sbs",
      algorithms: ["RS256"],
    })).payload,
  userClient: (token: string) =>
    createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
      ...options,
      global: { headers: { Authorization: `Bearer ${token}` } },
    }),
  serviceClient,
  storage: createStorage({ env, supabase: serviceClient, firebaseToken }),
  toWebp,
  preparePortrait,
});
Deno.serve(handler);
