import { subpages } from "../subpages.mjs";

export const render = subpages("강사", [
  // 승인 대기 탭에서 승인한 프로필이 바로 보이게 열 때마다 새로 그린다.
  ["instructors", "강사", () => import("./instructors.mjs"), { fresh: true }],
  ["pending", "승인 대기", () => import("./instructor-pending.mjs")],
  ["accounts", "계정 연결", () => import("./accounts.mjs")],
]);
