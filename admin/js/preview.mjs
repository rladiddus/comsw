// 공개 사이트 페이지 미리보기. 메뉴 이름은 사이트 하단 메뉴(footer-menu.js)의 연결과 같다.
export const SITE_PAGES = [
  { name: "메인", file: "index" },
  { name: "전체 수업", file: "roadmap" },
  { name: "학과별 자료", file: "Curriculum_full" },
  { name: "학과 커리큘럼", file: "Curriculum_onepage" },
  { name: "특강/세미나", file: "seminar" },
  { name: "수업별 준비물", file: "item" },
  { name: "방학 특강", file: "vacation" },
];

const key = s => String(s ?? "").replace(/\s+/g, "");

export function previewUrl(name, tablet) {
  const page = SITE_PAGES.find(p => key(p.name) === key(name));
  return page ? `../${page.file}${tablet ? "_tablet" : ""}.html?preview=1` : null;
}

// 토큰(관리자 로그인, 1시간 유효)을 같은 사이트 저장소에 남기면 공개 페이지가 '사이트에 반영' 전 내용을 읽는다.
// 기다리는 동안 팝업 차단에 걸리지 않게 탭부터 연다.
export async function openPreview(url, getToken, win = window) {
  const tab = win.open("", "_blank");
  try {
    win.localStorage.setItem("comsw_preview_token", await getToken());
  } catch (err) {
    tab?.close?.();
    throw err;
  }
  if (tab) tab.location.href = url;
  else win.location.href = url;
}
