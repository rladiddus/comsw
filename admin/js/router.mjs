import { canManage } from "./roles.mjs";

export const NAV = [
  { id: "main", label: "메인 화면", manage: true, ready: true },
  { id: "loading", label: "로딩 화면", manage: true, ready: true },
  { id: "seminars", label: "특강·세미나", manage: true, ready: true },
  { id: "departments", label: "학과", manage: true, ready: true },
  { id: "subjects", label: "과목·단계", manage: true, ready: true },
  { id: "roadmap", label: "로드맵", manage: true, ready: true },
  { id: "prep", label: "수업별 준비물", manage: true, ready: true },
  { id: "instructors", label: "강사", manage: true, ready: true },
  { id: "accounts", label: "계정 연결", manage: true, ready: true },
  { id: "curricula", label: "강사 커리큘럼", manage: true, ready: true },
  { id: "recruitment", label: "채용 공고", manage: true, ready: true },
  { id: "vacation", label: "방학 특강", manage: true, ready: true },
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
