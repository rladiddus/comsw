// 역할별 메뉴(관리 8 + 강사 2). 메뉴 숨김은 보기 정리일 뿐, 권한은 DB가 다시 확인한다.
import { canManage } from "../../admin/js/roles.mjs";

const page = (file) => () => import(`./pages/${file}.mjs`);

// [id, 메뉴 이름, 화면]
export const ADMIN_MENUS = [
  ["instructors", "강사", page("instructors")],
  ["courses", "학과·과목", page("courses")],
  ["roadmap", "로드맵", page("roadmap")],
  ["vacation", "방학 특강", page("vacation")],
  ["prep", "준비물", page("prep")],
  ["seminars", "특강·세미나", page("seminars")],
  ["site", "사이트 편집", page("site")],
  ["usage", "AI 사용량", page("usage")],
];
export const TEACHER_MENUS = [
  ["mine", "내 커리큘럼", page("mine")],
  ["profile", "내 프로필", page("profile")],
];

export const menusFor = (role) => [
  ...(canManage(role) || role === "observer" ? [["관리", ADMIN_MENUS]] : []), // 옵저버: 관리 화면을 보기만
  ...(role === "teacher" || canManage(role) ? [["내 작업", TEACHER_MENUS]] : []),
];
