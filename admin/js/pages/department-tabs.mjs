import { subpages } from "../subpages.mjs";

export const render = subpages("학과 관리", [
  ["departments", "학과", () => import("./departments.mjs")],
  ["subjects", "학과별 과목", () => import("./department-subjects.mjs")],
]);
