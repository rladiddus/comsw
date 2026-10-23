import { subpages } from "../subpages.mjs";

// 과목·단계 메뉴가 하던 일은 학과 커리큘럼(이름·기간·단계·순서)·신규 과목 추가·기타 과목으로 옮겼다.
// 탭끼리 과목이 오가므로(신규 → 승인 후 학과 커리큘럼, 학과에서 빼면 기타 과목) 과목 탭은 열 때마다 새로 그린다.
export const render = subpages("커리큘럼 관리", [
  ["requests", "신청 과목", () => import("./curriculum-requests.mjs")],
  ["department", "학과 커리큘럼", () => import("./department-curriculum.mjs"), { fresh: true }],
  ["new-subjects", "신규 과목 추가", () => import("./new-subjects.mjs"), { fresh: true }],
  ["other-subjects", "기타 과목", () => import("./other-subjects.mjs"), { fresh: true }],
]);
