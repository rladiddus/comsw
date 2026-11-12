// V3 시험판 화면 틀: 설계 시안(컴수원_V3_최종설계/화면시안)의 메뉴 구성 그대로, 이름은 기존에 쓰던 말에 가깝게.
// 화면은 pages/*.mjs가 운영 DB를 읽어 그린다. 기존 기능은 그대로 저장되고, V3 새 기능(DB 추가 필요)은 화면에서만 시험한다(v3.mjs state).
import { supabase } from "../../admin/js/session.mjs";
import { roleLabel, canManage } from "../../admin/js/roles.mjs";
import { formatPublished } from "../../admin/js/format.mjs";
import { dbErrorMessage } from "../../admin/js/fields.mjs";
import { mountPage, clearApp } from "../../admin/js/mount.mjs";
import { auth } from "../../admin/js/firebase.mjs";
import { SITE_PAGES, previewUrl, openPreview } from "../../admin/js/preview.mjs";
import { configureServices, createServices } from "../../admin/js/services.mjs";
import { usePage, sortable, savedOrder } from "./v3.mjs";
import { keepScroll } from "../../admin/js/keep-scroll.mjs";

const page = (file) => () => import(`./pages/${file}.mjs`);

// [묶음, [[id, 아이콘, 메뉴 이름(시안 이름), 한 줄 설명, 화면]]]
export const GROUPS = [
  // 메뉴 순서(2026-10-30 사용자 지정): 운영 메뉴 → 선생님 → 나머지
  ["운영 메뉴", [
    ["legacy", "⚙", "기본 설정 등", "사이트 화면·메뉴·채용·시스템 설정을 고칩니다.", page("legacy")],
    ["inbox", "☷", "승인 관리", "한 강사·한 과목의 전체 단계와 준비물을 함께 승인합니다. 프로필 승인은 따로입니다.", page("inbox")], // 통합 승인함(2026-11-11 '승인 대기' → '승인 관리', 운영 메뉴 기본 설정 등 아래로)
    ["instructors", "♙", "강사 관리", "재직 상태와 담당 과목에 따라 학과 관리에 들어갈 강사가 정해집니다.", page("instructors")], // 강사·재직 관리
    ["teachers", "✎", "커리큘럼 관리", "강사마다 승인본과 수정 대기 제출을 따로 봅니다.", page("teachers")],
    ["subjects", "▤", "과목 관리", "과목을 만들고, 커리큘럼이 없거나 어디에도 쓰이지 않는 과목을 정리합니다.", page("subjects")],
    ["aggregate", "≡", "학과 관리", "학과마다 과목을 만들고 순서를 정하며, 재직 강사들의 승인 커리큘럼을 모아 과목 커리큘럼을 만듭니다.", page("aggregate")], // 시안: 학과 통합 커리큘럼(과목 하나를 모든 학과가 같이 씀)
    ["seminars", "✦", "특강·세미나", "", page("seminars")],
    ["vacation", "▣", "방학 특강", "", page("vacation")],
    ["roadmap", "◇", "로드맵", "학과 관리의 과목 순서를 보며 과목을 스텝에 넣습니다.", page("roadmap")], // 자동 로드맵
    ["materials", "▧", "수업별 준비물", "", page("materials")], // 준비물·교재·AI 도구
  ]],
  ["선생님", [
    ["profile", "◉", "내 프로필", "", page("profile")],
    ["mine", "✎", "내 커리큘럼", "담당 학과·정규/방특·과목을 고른 뒤 수업 내용을 제출합니다.", page("mine")], // 내 수업·제출
  ]],
  ["사이트 운영", [
    ["release", "↥", "사이트 반영", "연계 작업과 반영 전 검사를 확인하고 마지막에 공개 사이트에 반영합니다.", page("release")], // 연계 작업·게시
  ]],
];

// 선생님은 '선생님' 묶음만(대시보드는 2026-11-11 삭제). 관리자·학과장은 지금처럼 전체(본인 커리큘럼·프로필 포함).
const TEACHER = ["mine", "profile"];
const menusFor = (role) => GROUPS
  .map(([g, items]) => [g, items.filter(([id]) => canManage(role) || (role === "teacher" && TEACHER.includes(id)))])
  .filter(([, items]) => items.length);

const $ = (sel) => document.querySelector(sel);

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

export async function preview(menuName, tablet = false) {
  const url = previewUrl(menuName, tablet);
  if (!url) { alert(`'${menuName}'은(는) 연결된 사이트 페이지가 없어 미리 볼 수 없습니다.`); return; }
  try {
    await openPreview(url, () => auth.currentUser.getIdToken());
  } catch (err) {
    alert(`미리보기를 열지 못했습니다: ${err.message}`);
  }
}

export async function refreshPublished() {
  const { data, error } = await supabase.from("site_snapshots")
    .select("created_at").order("id", { ascending: false }).limit(1).maybeSingle();
  $("#publishInfo").textContent = error ? `마지막 반영 확인 실패: ${dbErrorMessage(error)}` : formatPublished(data);
}

export async function publish() {
  if (!confirm("공개 사이트에 지금 내용을 반영할까요?")) return false;
  const btn = $("#publishBtn");
  btn.disabled = true;
  btn.textContent = "반영 중…";
  const { error } = await supabase.rpc("comsw_publish");
  btn.disabled = false;
  btn.textContent = "사이트에 반영";
  if (error) { toast(dbErrorMessage(error)); return false; }
  toast("사이트에 반영했습니다");
  await refreshPublished();
  return true;
}

// 화면 머리(시안): 홈 / 메뉴, 제목(오른쪽에 화면이 ctx.headBar로 고르기 칸을 둘 수 있음), 설명, 오른쪽 버튼 자리(ctx.headActions).
function pageHead(label, desc) {
  const head = document.createElement("div");
  head.className = "v2-head";
  const titleBox = document.createElement("div");
  const bar = Object.assign(document.createElement("div"), { className: "v3-headbar" });
  const titleRow = Object.assign(document.createElement("div"), { className: "v3-titlerow" });
  titleRow.append(Object.assign(document.createElement("h1"), { textContent: label }), bar);
  titleBox.append(
    Object.assign(document.createElement("div"), { className: "v2-crumb", textContent: `홈 / ${label}` }),
    titleRow,
    ...(desc ? [Object.assign(document.createElement("p"), { className: "v2-desc", textContent: desc })] : []),
  );
  const actions = document.createElement("div");
  actions.className = "v2-actions";
  head.append(titleBox, actions);
  return { head, actions, bar };
}

let session = null;
const foldedGroups = new Set((() => { try { return JSON.parse(localStorage.getItem("v3.navFolded")) ?? []; } catch { return []; } })());
// 메뉴 순서(2026-11-11): 묶음 안에서 끌어서 바꾼다(경계에 주황 점선). 이 브라우저에만 기억(v3.navOrder = { 묶음: [메뉴 id] }).
const navOrder = (() => { try { return JSON.parse(localStorage.getItem("v3.navOrder")) ?? {}; } catch { return {}; } })();
const ordered = (g, items) => savedOrder(items, navOrder[g], ([id]) => id);

// 왼쪽 메뉴: 묶음 이름을 누르면 그 아래 메뉴가 접히고 펼쳐진다(접은 묶음은 이 브라우저에 기억). 메뉴는 묶음 안에서 끌어서 순서를 바꾼다.
function drawNav(groups, id) {
  $("#sideNav").replaceChildren(...groups.flatMap(([g, all]) => {
    const items = ordered(g, all);
    const links = items.map(([mid, icon, mlabel]) => {
      const a = Object.assign(document.createElement("a"), { href: `#/${mid}`, className: mid === id ? "active" : "" });
      a.append(Object.assign(document.createElement("span"), { className: "v2-nav-icon", textContent: icon }), mlabel);
      return a;
    });
    const head = Object.assign(document.createElement("button"), { type: "button", className: "v2-nav-group v3-navtoggle", textContent: g });
    const fold = (on) => {
      head.classList.toggle("folded", on);
      head.setAttribute("aria-expanded", String(!on));
      links.forEach((a) => { a.hidden = on; });
    };
    fold(foldedGroups.has(g));
    head.addEventListener("click", () => {
      if (foldedGroups.has(g)) foldedGroups.delete(g); else foldedGroups.add(g);
      try { localStorage.setItem("v3.navFolded", JSON.stringify([...foldedGroups])); } catch { /* 저장소 막힘 */ }
      fold(foldedGroups.has(g));
    });
    sortable(links.map((a, i) => [a, items[i][0]]), items.map(([mid]) => mid), (ids) => {
      navOrder[g] = ids;
      try { localStorage.setItem("v3.navOrder", JSON.stringify(navOrder)); } catch { /* 저장소 막힘: 이번에만 */ }
      drawNav(groups, id);
    });
    return [head, ...links];
  }), manualLink());
}

// 맨 아래 '사용 매뉴얼'(2026-11-11): 새 창으로. 학과장·관리자 = 학과장용, 선생님 = 일반 강사용. 끌어서 옮기지 않는다.
function manualLink() {
  const a = Object.assign(document.createElement("a"), {
    href: canManage(session?.role) ? "../manual/v3-head.html" : "../manual/v3-teacher.html",
    target: "_blank", rel: "noopener", className: "v3-navmanual", title: "새 창으로 열기",
  });
  a.append(Object.assign(document.createElement("span"), { className: "v2-nav-icon", textContent: "?" }), "사용 매뉴얼");
  return a;
}

async function route() {
  const groups = menusFor(session.role);
  const all = groups.flatMap(([g, items]) => ordered(g, items)); // 주소가 없으면 끌어서 바꾼 순서의 첫 메뉴
  const want = location.hash.replace(/^#\/?/, "").split("/")[0];
  const found = all.find(([id]) => id === want) ?? all[0];
  if (!found) { $("#content").replaceChildren(); return; }
  // 없는 메뉴 주소(예: 지운 #/dashboard)면 보여 주는 화면 주소로 바꿔 둔다(Codex ⑥, hashchange 없이)
  if (want && want !== found[0]) history.replaceState(null, "", `#/${found[0]}`);
  const [id, , label, desc, load] = found;
  drawNav(groups, id);
  usePage(id);
  try {
    await mountPage($("#content"), async () => ({
      render: async (box, ctx) => {
        box.className = "v2-page";
        const { head, actions, bar } = pageHead(label, desc);
        const body = document.createElement("div");
        body.className = "v2-body";
        box.append(head, body);
        await (await load()).render(body, { ...ctx, headActions: actions, headBar: bar });
      },
    }), { supabase, ...session, label, id, preview, publish, getToken: () => auth.currentUser.getIdToken() });
  } catch (err) { toast(dbErrorMessage(err)); }
}

export function startApp({ role, email, uid, displayName }) {
  session = { role, email, uid, displayName };
  keepScroll(); // 스크롤은 사용자가 움직일 때만(다시 그려져도 위치 유지)
  const cfg = window.COMSW_SUPABASE_CONFIG;
  configureServices(createServices({ ...cfg, getToken: () => auth.currentUser?.getIdToken() }));
  $("#loginWrap").hidden = true;
  $("#appView").hidden = false;
  $("#userEmail").textContent = email;
  $("#userRole").textContent = roleLabel(role);
  const manager = canManage(role);
  $("#publishBtn").hidden = !manager;
  $("#previewBox").hidden = !manager;
  $("#previewPage").replaceChildren(...SITE_PAGES.map((p) => Object.assign(document.createElement("option"), { value: p.name, textContent: p.name })));
  $("#publishInfo").hidden = !manager;
  if (manager) refreshPublished();
  window.addEventListener("hashchange", route);
  route();
}

export function stopApp() {
  window.removeEventListener("hashchange", route);
  session = null;
  configureServices();
  clearApp([$("#content"), $("#sideNav")], [$("#userEmail"), $("#userRole"), $("#publishInfo")]);
  $("#appView").hidden = true;
  $("#loginWrap").hidden = false;
}

document.addEventListener("click", (e) => {
  if (e.target?.id === "publishBtn") publish();
  if (e.target?.id === "previewBtn") preview($("#previewPage").value, $("#previewDevice").value === "tablet");
});
