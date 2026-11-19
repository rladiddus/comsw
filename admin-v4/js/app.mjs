// V4 화면 틀: 역할별 메뉴(관리 7 + 강사 2), 주소 #/메뉴 로 이동. 권한은 DB가 다시 확인하고, 메뉴 숨김은 보기 정리일 뿐이다.
import { roleLabel } from "../../admin/js/roles.mjs";
import { menusFor } from "./menus.mjs";
import { auth } from "../../admin/js/firebase.mjs";
import { configureServices, createServices } from "../../admin/js/services.mjs";
import { supabase } from "../../admin/js/session.mjs";
import { useDb } from "./data.mjs";
import { h, fail } from "./ui.mjs";
import { resetTracking, unsaved } from "./changes.mjs";

const $ = (sel) => document.querySelector(sel);
let session = null;
let shown = 0; // 늦게 끝난 예전 화면이 새 화면을 덮지 않게

let here = "";
function route() {
  if (!session) return;
  // 임시 저장하지 않은 바뀐 설정이 있으면 메뉴를 옮기기 전에 묻는다
  if (here && location.hash !== here && unsaved() && !confirm("임시 저장하지 않은 바뀐 설정이 있습니다. 이동하면 사라집니다. 이동할까요?")) {
    history.replaceState(null, "", here);
    return;
  }
  resetTracking();
  const groups = menusFor(session.role);
  const items = groups.flatMap(([, list]) => list);
  const [id, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  const hit = items.find(([m]) => m === id) ?? items[0];
  if (hit[0] !== id) { history.replaceState(null, "", `#/${hit[0]}`); }
  $("#sideNav").replaceChildren(...groups.flatMap(([g, list]) => [
    h("div", { class: "navlabel" }, g),
    ...list.map(([m, label]) => h("a", { href: `#/${m}`, "aria-current": m === hit[0] ? "page" : null }, label)),
  ]));
  const group = groups.find(([, list]) => list.includes(hit))[0];
  $("#crumb").textContent = `${group} / ${hit[1]}`;
  here = location.hash;
  const main = $("#content");
  const n = ++shown;
  hit[2]()
    .then((mod) => { if (n === shown) return mod.render({ main, session, params: rest.map(decodeURIComponent) }); })
    .catch((err) => { console.error(err); if (n === shown) main.replaceChildren(fail(`화면을 열지 못했습니다: ${err.message}`)); });
}

export function startApp({ role, email, uid, displayName }) {
  session = { role, email, uid, displayName };
  useDb(supabase);
  const cfg = window.COMSW_SUPABASE_CONFIG;
  configureServices(createServices({ ...cfg, getToken: () => auth.currentUser?.getIdToken() }));
  $("#loginWrap").hidden = true;
  $("#appView").hidden = false;
  $("#userName").textContent = displayName || email;
  $("#userRole").textContent = roleLabel(role);
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", (e) => { if (unsaved()) e.preventDefault(); });
  route();
}

export function stopApp() {
  window.removeEventListener("hashchange", route);
  session = null;
  configureServices();
  $("#content").replaceChildren();
  $("#sideNav").replaceChildren();
  $("#appView").hidden = true;
  $("#loginWrap").hidden = false;
}
