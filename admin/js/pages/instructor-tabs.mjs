import { subpages } from "../subpages.mjs";

export const render = subpages("강사", [
  ["instructors", "강사", () => import("./instructors.mjs")],
  ["accounts", "계정 연결", () => import("./accounts.mjs")],
]);
