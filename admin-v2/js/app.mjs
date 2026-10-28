// V2 시험판 화면 틀: 시안(컴수원_V2_관리화면_인터랙티브_시안.html)의 메뉴 구성 그대로, 이름만 기존 메뉴에 가까운 말로.
// 화면은 pages/*.mjs가 시안 모양(숫자 카드·목록·상세)으로 운영 DB를 읽어 그리고, 고치기는 기존 화면을 그 안에서 연다. DB는 바꾸지 않는다.
import { supabase } from "../../admin/js/session.mjs";
import { roleLabel, canManage } from "../../admin/js/roles.mjs";
import { formatPublished } from "../../admin/js/format.mjs";
import { dbErrorMessage } from "../../admin/js/fields.mjs";
import { mountPage, clearApp } from "../../admin/js/mount.mjs";
import { auth } from "../../admin/js/firebase.mjs";
import { SITE_PAGES, previewUrl, openPreview } from "../../admin/js/preview.mjs";
import { configureServices, createServices } from "../../admin/js/services.mjs";

const page = (file) => () => import(`./pages/${file}.mjs`);

// [묶음, [[id, 아이콘, 메뉴 이름(시안 이름), 한 줄 설명, 화면]]]
export const GROUPS = [
  ["운영", [
    ["dashboard", "▦", "대시보드", "오늘 처리할 일과 사이트 반영 상태를 한눈에 봅니다.", page("dashboard")], // 운영 대시보드
    ["reviews", "☷", "승인 대기", "커리큘럼·방학 특강·강사 프로필 승인 요청을 같은 기준으로 검토합니다.", page("reviews")], // 통합 승인함
  ]],
  ["기준 정보", [
    ["departments", "◈", "학과 관리", "학과 정보만 관리하고 과목 배치는 과목 관리에서 합니다.", page("departments")],
    ["subjects", "▤", "과목 관리", "과목을 등록·수정하고 학과에 배치하는 곳입니다.", page("subjects")], // 과목 카탈로그
    ["curricula", "≡", "커리큘럼 관리", "학과 커리큘럼·강사 커리큘럼·사이트 문구를 과목별로 봅니다.", page("curricula")], // 커리큘럼 스튜디오
    ["instructors", "♙", "강사 관리", "강사 정보와 쌤톡 계정 연결을 한곳에서 관리합니다.", page("instructors")], // 강사·계정
  ]],
  ["콘텐츠", [
    ["roadmaps", "◇", "로드맵", "과목을 연결해 학과별 학습 경로를 구성합니다.", page("roadmaps")], // 로드맵 빌더
    ["materials", "▧", "수업별 준비물", "교재·준비물·AI 도구를 과목에 연결합니다.", page("materials")], // 교재·준비물
  ]],
  ["운영 프로그램", [
    ["vacations", "▣", "방학 특강", "방학 특강 그룹(기수)별 강좌와 신청을 관리합니다.", page("vacations")],
    ["seminars", "▦", "특강·세미나", "특강 일정, 정원, 신청자 명단을 관리합니다.", page("seminars")],
    ["recruitment", "▤", "채용 공고", "학과별 채용 공고와 마감일을 관리합니다.", page("recruitment")],
  ]],
  ["사이트 운영", [
    ["site-editor", "▥", "기본 설정", "공개 사이트 페이지별 표시 내용을 보고 고칩니다.", page("site-editor")], // 사이트 편집
    ["publishing", "↥", "사이트 반영", "바뀐 곳을 확인하고 미리 본 뒤 공개 사이트에 반영합니다.", page("publishing")], // 게시 센터
  ]],
  ["설정", [
    ["system", "⚙", "시스템 설정", "AI 사용량·설정, 올린 파일, 작업 기록을 봅니다.", page("system")],
  ]],
  ["선생님", [
    ["mine", "✎", "내 커리큘럼", "담당 과목을 고르고 커리큘럼을 작성해 승인 요청합니다.", page("classes")], // 내 수업·커리큘럼
    ["profile", "◉", "내 프로필", "경력과 소개를 작성하고 검토 상태를 확인합니다.", page("profile")],
  ]],
];

// 선생님은 대시보드와 '선생님' 묶음만. 관리자·학과장은 지금처럼 전체(본인 커리큘럼·프로필 포함).
const TEACHER = ["dashboard", "mine", "profile"];
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

// 화면 머리(시안): 홈 / 메뉴, 제목, 설명, 오른쪽 버튼 자리(화면이 ctx.headActions에 채운다).
function pageHead(label, desc) {
  const head = document.createElement("div");
  head.className = "v2-head";
  const titleBox = document.createElement("div");
  titleBox.append(
    Object.assign(document.createElement("div"), { className: "v2-crumb", textContent: `홈 / ${label}` }),
    Object.assign(document.createElement("h1"), { textContent: label }),
    ...(desc ? [Object.assign(document.createElement("p"), { className: "v2-desc", textContent: desc })] : []),
  );
  const actions = document.createElement("div");
  actions.className = "v2-actions";
  head.append(titleBox, actions);
  return { head, actions };
}

let session = null;

async function route() {
  const groups = menusFor(session.role);
  const all = groups.flatMap(([, items]) => items);
  const want = location.hash.replace(/^#\/?/, "").split("/")[0];
  const found = all.find(([id]) => id === want) ?? all[0];
  if (!found) { $("#content").replaceChildren(); return; }
  const [id, , label, desc, load] = found;
  $("#sideNav").replaceChildren(...groups.flatMap(([g, items]) => [
    Object.assign(document.createElement("div"), { className: "v2-nav-group", textContent: g }),
    ...items.map(([mid, icon, mlabel]) => {
      const a = Object.assign(document.createElement("a"), { href: `#/${mid}`, className: mid === id ? "active" : "" });
      a.append(Object.assign(document.createElement("span"), { className: "v2-nav-icon", textContent: icon }), mlabel);
      return a;
    }),
  ]));
  try {
    await mountPage($("#content"), async () => ({
      render: async (box, ctx) => {
        box.className = "v2-page";
        const { head, actions } = pageHead(label, desc);
        const body = document.createElement("div");
        body.className = "v2-body";
        box.append(head, body);
        await (await load()).render(body, { ...ctx, headActions: actions });
      },
    }), { supabase, ...session, label, id, preview, publish, getToken: () => auth.currentUser.getIdToken() });
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
