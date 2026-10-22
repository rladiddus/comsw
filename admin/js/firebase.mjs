// 쌤톡(ssamtalk-sbs)과 같은 Firebase 프로젝트 — 공개 웹 설정값이며 비밀키가 아니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js";

export const app = initializeApp({
  apiKey: "AIzaSyAnxAV5UJpBeLOUBvfslpWRjRQlUrQk8gs",
  authDomain: "ssamtalk-sbs.firebaseapp.com",
  projectId: "ssamtalk-sbs",
  storageBucket: "ssamtalk-sbs.firebasestorage.app",
  messagingSenderId: "23608706037",
  appId: "1:23608706037:web:9f34363e13a69abf1b56bc",
});

export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-northeast3");
