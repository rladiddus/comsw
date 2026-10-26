import { canManage } from "./roles.mjs";

// site: 이 메뉴 내용이 나오는 공개 사이트 페이지(preview.mjs SITE_PAGES 이름) → 화면 제목 옆 '미리보기'.
export const NAV = [
  { id: "settings", label: "기본 설정", manage: true, ready: true, site: "메인" },
  { id: "instructors", label: "강사 관리", manage: true, ready: true, site: "학과별 자료" },
  { id: "departments", label: "학과 관리", manage: true, ready: true, site: "학과별 자료" },
  { id: "curriculum-admin", label: "커리큘럼 관리", manage: true, ready: true, site: "학과 커리큘럼" },
  { id: "curricula", label: "강사 커리큘럼", manage: true, ready: true, site: "학과별 자료" },
  { id: "roadmap", label: "로드맵", manage: true, ready: true, site: "전체 수업" },
  { id: "prep", label: "수업별 준비물", manage: true, ready: true, site: "수업별 준비물" },
  { id: "seminars", label: "특강·세미나", manage: true, ready: true, site: "특강/세미나" },
  { id: "vacation", label: "방학 특강", manage: true, ready: true, site: "방학 특강" },
  { id: "recruitment", label: "채용 공고", manage: true, ready: true, site: "학과별 자료" },
  { id: "mine", label: "내 커리큘럼", manage: false, ready: true },
  { id: "profile", label: "내 프로필", manage: false, ready: true },
];

export function navFor(role) {
  if (canManage(role)) return NAV;
  if (role === "teacher") return NAV.filter(n => !n.manage);
  return [];
}

export function routeFrom(hash, role) {
  const items = navFor(role);
  const id = String(hash || "").replace(/^#\/?/, "");
  return items.some(n => n.id === id) ? id : items[0]?.id;
}
