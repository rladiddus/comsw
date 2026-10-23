import { subpages } from "../subpages.mjs";

export const render = subpages("커리큘럼 관리", [
  ["requests", "신청 과목", () => import("./curriculum-requests.mjs")],
  ["department", "학과 커리큘럼", () => import("./department-curriculum.mjs")],
]);
