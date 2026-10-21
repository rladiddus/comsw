import { supabase } from "./session.mjs";
import { navFor, routeFrom } from "./router.mjs";
import { roleLabel, canManage } from "./roles.mjs";
import { formatPublished } from "./format.mjs";
import { dbErrorMessage } from "./fields.mjs";

const $ = sel => document.querySelector(sel);
const PAGES = {
  main: () => import("./pages/main-page.mjs"),
  loading: () => import("./pages/loading.mjs"),
  seminars: () => import("./pages/seminars.mjs"),
};

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
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
  const content = $("#content");
  content.replaceChildren();
  if (!item) return;
  const load = item.ready && PAGES[id] ? PAGES[id] : () => import("./pages/placeholder.mjs");
  const mod = await load();
  await mod.render(content, { supabase, role: session.role, label: item.label, id });
}

export function startApp({ role, email }) {
  session = { role, email };
  $("#loginWrap").hidden = true;
  $("#appView").hidden = false;
  $("#userEmail").textContent = email;
  $("#userRole").textContent = roleLabel(role);
  const manager = canManage(role);
  $("#publishBtn").hidden = !manager;
  $("#publishInfo").hidden = !manager;
  if (manager) refreshPublished();
  window.addEventListener("hashchange", route);
  route();
}

export function stopApp() {
  window.removeEventListener("hashchange", route);
  session = null;
  $("#appView").hidden = true;
  $("#loginWrap").hidden = false;
}

document.addEventListener("click", e => {
  if (e.target?.id === "publishBtn") publish();
});
