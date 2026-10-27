import { supabase } from "./session.mjs";
import { navFor, routeFrom } from "./router.mjs";
import { roleLabel, canManage } from "./roles.mjs";
import { formatPublished } from "./format.mjs";
import { dbErrorMessage } from "./fields.mjs";
import { mountPage, clearApp } from "./mount.mjs";
import { auth } from "./firebase.mjs";
import { SITE_PAGES, previewUrl, openPreview } from "./preview.mjs";
import { configureServices, createServices } from './services.mjs';

const $ = sel => document.querySelector(sel);
const PAGES = {
  settings: () => import("./pages/settings.mjs"),
  seminars: () => import("./pages/seminars.mjs"),
  departments: () => import("./pages/department-tabs.mjs"),
  roadmap: () => import("./pages/roadmap.mjs"),
  prep: () => import("./pages/prep.mjs"),
  instructors: () => import("./pages/instructor-tabs.mjs"),
  curricula: () => import("./pages/curricula.mjs"),
  "curriculum-admin": () => import("./pages/curriculum-admin.mjs"),
  recruitment: () => import("./pages/recruitment.mjs"),
  vacation: () => import("./pages/vacation.mjs"),
  mine: () => import('./pages/mine.mjs'),
  profile: () => import('./pages/profile.mjs'),
};

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// 관리자·학과장이 '사이트에 반영' 전 내용을 공개 사이트 화면으로 본다(꺼진 페이지 포함).
async function preview(menuName, tablet = false) {
  const url = previewUrl(menuName, tablet);
  if (!url) { alert(`'${menuName}'은(는) 연결된 사이트 페이지가 없어 미리 볼 수 없습니다.`); return; }
  try {
    await openPreview(url, () => auth.currentUser.getIdToken());
  } catch (err) {
    alert(`미리보기를 열지 못했습니다: ${err.message}`);
  }
}

// 메뉴 화면 제목 옆에 그 메뉴 내용이 나오는 사이트 페이지 미리보기(PC·태블릿).
function addPagePreview(content, site) {
  const title = content.querySelector("h2");
  if (!title || title.parentElement.classList.contains("page-title-row")) return;
  const button = (text, tablet) => {
    const b = document.createElement("button");
    Object.assign(b, { type: "button", className: "ghost-btn", textContent: text, title: `'${site}' 페이지를 '사이트에 반영' 전 내용으로 봅니다` });
    b.addEventListener("click", () => preview(site, tablet));
    return b;
  };
  const row = document.createElement("div");
  row.className = "page-title-row";
  title.replaceWith(row);
  row.append(title, button(`미리보기 · ${site}`, false), button("태블릿", true));
}

async function refreshPublished() {
  const { data, error } = await supabase.from("site_snapshots")
    .select("created_at").order("id", { ascending: false }).limit(1).maybeSingle();
  $("#publishInfo").textContent = error ? `마지막 반영 확인 실패: ${dbErrorMessage(error)}` : formatPublished(data);
}

async function publish() {
  if (!confirm("공개 사이트에 지금 내용을 반영할까요?")) return;
  const btn = $("#publishBtn");
  btn.disabled = true;
  btn.textContent = "반영 중…";
  const { error } = await supabase.rpc("comsw_publish");
  btn.disabled = false;
  btn.textContent = "사이트에 반영";
  if (error) { toast(dbErrorMessage(error)); return; }
  toast("사이트에 반영했습니다");
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
  try {
    await mountPage($("#content"), load, { supabase, ...session, label: item.label, id, preview });
    // 늦게 끝난 이전 페이지에 붙지 않게, 아직 이 메뉴일 때만.
    if (item.site && canManage(session.role) && routeFrom(location.hash, session.role) === id) addPagePreview($("#content"), item.site);
  } catch (err) { toast(dbErrorMessage(err)); }
}

export function startApp({ role, email, uid, displayName }) {
  session = { role, email, uid, displayName };
  const cfg = window.COMSW_SUPABASE_CONFIG;
  configureServices(createServices({ ...cfg, getToken: () => auth.currentUser?.getIdToken() }));
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
  configureServices();
  // 공용 PC에서 다음 사람이 이전 화면(신청자 연락처 등)을 보지 못하게 비운다.
  clearApp([$("#content"), $("#sideNav")], [$("#userEmail"), $("#userRole"), $("#publishInfo")]);
  $("#appView").hidden = true;
  $("#loginWrap").hidden = false;
}

document.addEventListener("click", e => {
  if (e.target?.id === "publishBtn") publish();
  if (e.target?.id === "previewBtn") preview($("#previewPage").value, $("#previewDevice").value === "tablet");
});
