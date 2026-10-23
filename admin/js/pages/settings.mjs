import { subpages } from "../subpages.mjs";

export const render = subpages("기본 설정", [
  ["main", "메인 화면", () => import("./main-page.mjs")],
  ["loading", "로딩 화면", () => import("./loading.mjs")],
]);
