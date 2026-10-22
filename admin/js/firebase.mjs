// 쌤톡(ssamtalk-sbs)과 같은 Firebase 프로젝트 — 공개 웹 설정값이며 비밀키가 아니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { browserSessionPersistence, initializeAuth } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js";

export const app = initializeApp({
  apiKey: "AIzaSyAnxAV5UJpBeLOUBvfslpWRjRQlUrQk8gs",
  authDomain: "ssamtalk-sbs.firebaseapp.com",
  projectId: "ssamtalk-sbs",
  storageBucket: "ssamtalk-sbs.firebasestorage.app",
  messagingSenderId: "23608706037",
  appId: "1:23608706037:web:9f34363e13a69abf1b56bc",
});

// 로그인은 이 브라우저 세션에만 저장한다 → 브라우저(탭)를 닫으면 로그아웃.
// 예전에 '계속 저장'으로 남은 로그인은 읽지 않으므로 다시 로그인해야 한다.
export const auth = initializeAuth(app, { persistence: browserSessionPersistence });
try {
  // 예전 '계속 저장' 로그인 정보(이 사이트에서는 관리 화면만 씀)를 지운다.
  indexedDB.deleteDatabase("firebaseLocalStorageDb");
} catch {
  // 지원하지 않는 브라우저는 그대로 둔다(읽지 않으므로 로그인되지 않음).
}
export const functions = getFunctions(app, "asia-northeast3");
