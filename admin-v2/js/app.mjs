// V2 시험판 화면 틀: 메뉴를 업무 묶음으로 나누고, 기존 화면(admin/js/pages)을 그대로 빌려 쓴다.
// 새로 만든 화면은 대시보드·승인 대기(전체)·과목 관리(전체 과목)·사이트 반영뿐이다. 데이터는 운영 DB 그대로.
import { supabase } from "../../admin/js/session.mjs";
import { roleLabel, canManage } from "../../admin/js/roles.mjs";
import { formatPublished } from "../../admin/js/format.mjs";
import { dbErrorMessage } from "../../admin/js/fields.mjs";
import { mountPage, clearApp } from "../../admin/js/mount.mjs";
import { auth } from "../../admin/js/firebase.mjs";
import { SITE_PAGES, previewUrl, openPreview } from "../../admin/js/preview.mjs";
import { configureServices, createServices } from "../../admin/js/services.mjs";
import { subpages } from "../../admin/js/subpages.mjs";

const old = (file) => () => import(`../../admin/js/pages/${file}.mjs`);
const tabs = (title, list) => async () => ({ render: subpages(title, list) });

// [묶음, [[id, 메뉴 이름, 한 줄 설명, 화면, 미리볼 사이트 페이지]]]
export const GROUPS = [
  ["운영", [
    ["dashboard", "대시보드", "오늘 처리할 일과 사이트 반영 상태를 봅니다.", () => import("./pages/dashboard.mjs")],
    ["reviews", "승인 대기", "선생님이 보낸 커리큘럼·방학 특강·프로필을 한곳에서 확인하고 승인합니다.", tabs("승인 대기", [
      ["all", "전체", () => import("./pages/reviews.mjs"), { fresh: true }],
      ["curricula", "커리큘럼", old("curriculum-requests"), { fresh: true }],
      ["vacation", "방학 특강", old("vacation"), { fresh: true }],
      ["profiles", "프로필", old("instructor-pending"), { fresh: true }],
    ])],
  ]],
  ["기준 정보", [
    ["departments", "학과 관리", "학과 이름·소개·이미지와 순서를 관리합니다. 과목 연결은 과목 관리에서 합니다.", old("departments"), "학과별 자료"],
    ["subjects", "과목 관리", "모든 과목을 한곳에서 찾고, 학과 연결·기간·단계를 정리합니다.", tabs("과목 관리", [
      ["all", "전체 과목", () => import("./pages/subjects.mjs"), { fresh: true }],
      ["by-dept", "학과별 과목", old("department-subjects"), { fresh: true }],
      ["manage", "과목 정보", old("subject-manage"), { fresh: true }],
      ["new", "신규 과목", old("new-subjects"), { fresh: true }],
      ["other", "기타 과목", old("other-subjects"), { fresh: true }],
    ]), "전체 수업"],
    ["curricula", "커리큘럼 관리", "학과 커리큘럼(사이트 문구)과 강사별 커리큘럼을 봅니다.", tabs("커리큘럼 관리", [
      ["department", "학과 커리큘럼", old("department-curriculum"), { fresh: true }],
      ["instructor", "강사 커리큘럼", old("curricula"), { fresh: true }],
    ]), "학과 커리큘럼"],
    ["instructors", "강사 관리", "강사 카드와 쌤톡 계정 연결을 관리합니다. 프로필 승인은 승인 대기에서 합니다.", tabs("강사 관리", [
      ["list", "강사", old("instructors"), { fresh: true }],
      ["accounts", "계정 연결", old("accounts")],
    ]), "학과별 자료"],
  ]],
  ["콘텐츠", [
    ["roadmap", "로드맵", "학과별 로드맵 단계와 연결 과목을 관리합니다.", old("roadmap"), "전체 수업"],
    ["prep", "수업별 준비물", "과목별 교재·준비물·AI 도구를 관리합니다.", old("prep"), "수업별 준비물"],
  ]],
  ["프로그램", [
    ["seminars", "특강·세미나", "특강 일정과 신청자 명단을 관리합니다.", old("seminars"), "특강/세미나"],
    ["recruitment", "채용 공고", "학과별 채용 공고를 관리합니다.", old("recruitment"), "학과별 자료"],
  ]],
  ["사이트", [
    ["settings", "기본 설정", "메인 화면·로딩 화면과 AI 설정을 관리합니다.", old("settings"), "메인"],
    ["publishing", "사이트 반영", "반영 전 바뀐 곳을 확인하고, 미리 본 뒤 공개 사이트에 반영합니다.", () => import("./pages/publishing.mjs")],
  ]],
  ["선생님", [
    ["mine", "내 커리큘럼", "", old("mine")],
    ["profile", "내 프로필", "", old("profile")],
  ]],
];

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

// 화면 머리: 묶음 › 메뉴, 제목, 설명, (사이트 페이지가 있으면) 미리보기.
function pageHead(group, label, desc, site) {
  const head = document.createElement("div");
  head.className = "v2-head";
  const btn = (text, tablet) => Object.assign(document.createElement("button"), {
    type: "button", className: "ghost-btn", textContent: text, onclick: () => preview(site, tablet),
  });
  const titleBox = document.createElement("div");
  titleBox.append(
    Object.assign(document.createElement("div"), { className: "v2-crumb", textContent: `${group} › ${label}` }),
    Object.assign(document.createElement("h1"), { textContent: label }),
    ...(desc ? [Object.assign(document.createElement("p"), { className: "v2-desc", textContent: desc })] : []),
  );
  head.append(titleBox);
  if (site) {
    const actions = document.createElement("div");
    actions.className = "v2-actions";
    actions.append(btn(`미리보기 · ${site}`, false), btn("태블릿", true));
    head.append(actions);
  }
  return head;
}

let session = null;

async function route() {
  const groups = menusFor(session.role);
  const all = groups.flatMap(([g, items]) => items.map((it) => [g, ...it]));
  const want = location.hash.replace(/^#\/?/, "").split("/")[0];
  const found = all.find(([, id]) => id === want) ?? all[0];
  if (!found) { $("#content").replaceChildren(); return; }
  const [group, id, label, desc, load, site] = found;
  $("#sideNav").replaceChildren(...groups.flatMap(([g, items]) => [
    Object.assign(document.createElement("div"), { className: "v2-nav-group", textContent: g }),
    ...items.map(([mid, mlabel]) => Object.assign(document.createElement("a"), {
      href: `#/${mid}`, textContent: mlabel, className: mid === id ? "active" : "",
    })),
  ]));
  try {
    await mountPage($("#content"), async () => ({
      render: async (box, ctx) => {
        box.className = "v2-page";
        box.append(pageHead(group, label, desc, canManage(session.role) ? site : null));
        const body = document.createElement("div");
        body.className = "v2-body";
        box.append(body);
        await (await load()).render(body, ctx);
      },
    }), { supabase, ...session, label, id, preview, publish });
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
