import { supabase } from "./session.mjs";
import { navFor, routeFrom } from "./router.mjs";
import { roleLabel, canManage } from "./roles.mjs";
import { formatPublished } from "./format.mjs";
import { dbErrorMessage } from "./fields.mjs";
import { mountPage, clearApp } from "./mount.mjs";
import { auth } from "./firebase.mjs";
import { SITE_PAGES, previewUrl, openPreview } from "./preview.mjs";

const $ = sel => document.querySelector(sel);
const PAGES = {
  main: () => import("./pages/main-page.mjs"),
  loading: () => import("./pages/loading.mjs"),
  seminars: () => import("./pages/seminars.mjs"),
  departments: () => import("./pages/departments.mjs"),
  subjects: () => import("./pages/subjects.mjs"),
  roadmap: () => import("./pages/roadmap.mjs"),
  prep: () => import("./pages/prep.mjs"),
  recruitment: () => import("./pages/recruitment.mjs"),
};

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// 관리자·학과장이 '적용' 전 내용을 공개 사이트 화면으로 본다(꺼진 페이지 포함).
async function preview(menuName, tablet = false) {
  const url = previewUrl(menuName, tablet);
  if (!url) { alert(`'${menuName}'은(는) 연결된 사이트 페이지가 없어 미리 볼 수 없습니다.`); return; }
  try {
    await openPreview(url, () => auth.currentUser.getIdToken());
  } catch (err) {
    alert(`미리보기를 열지 못했습니다: ${err.message}`);
  }
}

async function refreshPublished() {
  const { data, error } = await supabase.from("site_snapshots")
    .select("created_at").order("id", { ascending: false }).limit(1).maybeSingle();
  $("#publishInfo").textContent = error ? `마지막 적용 확인 실패: ${dbErrorMessage(error)}` : formatPublished(data);
}

async function publish() {
  if (!confirm("공개 사이트에 지금 내용을 반영할까요?")) return;
  const btn = $("#publishBtn");
  btn.disabled = true;
  btn.textContent = "적용 중…";
  const { error } = await supabase.rpc("comsw_publish");
  btn.disabled = false;
  btn.textContent = "적용";
  if (error) { toast(dbErrorMessage(error)); return; }
  toast("적용했습니다");
  await refreshPublished();
}

let session = null;

async function route() {
  const items = navFor(session.role);
  const id = routeFrom(location.hash, session.role);
  const item = items.find(n => n.id === id);
  $("#sideNav").replaceChildren(...items.map(n => {
    const a = document.createElement("a");
    a.href = `#/${n.id}`;
    a.textContent = n.label;
    if (n.id === id) a.classList.add("active");
    if (!n.ready) a.classList.add("not-ready");
    return a;
  }));
  if (!item) { $("#content").replaceChildren(); return; }
  const load = item.ready && PAGES[id] ? PAGES[id] : () => import("./pages/placeholder.mjs");
  await mountPage($("#content"), load, { supabase, role: session.role, label: item.label, id, preview });
}

export function startApp({ role, email }) {
  session = { role, email };
  $("#loginWrap").hidden = true;
  $("#appView").hidden = false;
  $("#userEmail").textContent = email;
  $("#userRole").textContent = roleLabel(role);
  const manager = canManage(role);
  $("#publishBtn").hidden = !manager;
  $("#previewBox").hidden = !manager;
  $("#previewPage").replaceChildren(...SITE_PAGES.map(p => Object.assign(document.createElement("option"), { value: p.name, textContent: p.name })));
  $("#publishInfo").hidden = !manager;
  if (manager) refreshPublished();
  window.addEventListener("hashchange", route);
  route();
}

export function stopApp() {
  window.removeEventListener("hashchange", route);
  session = null;
  // 공용 PC에서 다음 사람이 이전 화면(신청자 연락처 등)을 보지 못하게 비운다.
  clearApp([$("#content"), $("#sideNav")], [$("#userEmail"), $("#userRole"), $("#publishInfo")]);
  $("#appView").hidden = true;
  $("#loginWrap").hidden = false;
}

document.addEventListener("click", e => {
  if (e.target?.id === "publishBtn") publish();
  if (e.target?.id === "previewBtn") preview($("#previewPage").value, $("#previewDevice").value === "tablet");
});
