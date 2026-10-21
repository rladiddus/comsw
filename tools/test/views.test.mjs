import test from "node:test";
import assert from "node:assert/strict";
import { siteViews } from "../migrate/views.mjs";

const TABS = { instructor_curriculum: [], recruitment: [] };
const curriculumRow = (week, side = {}) => {
  const v = Array(24).fill("");
  if (week) [v[1], v[2], v[3], v[5], v[7]] = week;
  if (side.O) { v[14] = side.O; v[16] = "TRUE"; v[20] = side.U ?? ""; }
  return v;
};
const getter = sheets => (source, name) => sheets[`${source}/${name}`] ?? [];

test("배치가 달라도 사이트가 보는 내용이 같으면 같은 view", () => {
  const original = getter({
    "main/컴수원_전체수업": [
      curriculumRow(["웹", "웹1", "1주차", "요약", "img"]),
      curriculumRow(null),
      curriculumRow(null, { O: "웹학과", U: "WEB" }),
    ],
    "main/로드맵": [["웹학과", "웹1", "", ""], ["웹학과", "원문"], ["웹학과", "요약"]],
  });
  const snapshot = getter({
    "main/컴수원_전체수업": [curriculumRow(["웹", "웹1", "1주차", "요약", "img"], { O: "웹학과", U: "WEB" })],
    "main/로드맵": [["웹학과", "웹1"], ["웹학과", "원문"], ["웹학과", "요약"]],
  });
  assert.deepEqual(siteViews(snapshot, TABS), siteViews(original, TABS));
});

test("로드맵은 과목이 있는 칸의 원문·요약만 비교한다", () => {
  const a = getter({ "main/로드맵": [["웹학과", "웹1", ""], ["웹학과", "원문", ""], ["웹학과", "요약", "#ERROR!"]] });
  const b = getter({ "main/로드맵": [["웹학과", "웹1"], ["웹학과", "원문"], ["웹학과", "요약"]] });
  assert.deepEqual(siteViews(a, TABS).roadmap, siteViews(b, TABS).roadmap);
});

test("주차 요약이 하나라도 다르면 view가 다르다", () => {
  const a = getter({ "main/컴수원_전체수업": [curriculumRow(["웹", "웹1", "1주차", "요약", "img"], { O: "웹학과" })] });
  const b = getter({ "main/컴수원_전체수업": [curriculumRow(["웹", "웹1", "1주차", "다른 요약", "img"], { O: "웹학과" })] });
  assert.notDeepEqual(siteViews(a, TABS).deptWeeks, siteViews(b, TABS).deptWeeks);
});

test("메뉴는 이름순으로 비교하고 체크박스 표기 차이는 무시한다", () => {
  const a = getter({ "main/메인 페이지": [["", "", "", "", "B", true, "왼쪽", 2], ["", "", "", "", "A", "TRUE", "", ""]] });
  const b = getter({ "main/메인 페이지": [["", "", "", "", "A", "true", "오른쪽", "999"], ["", "", "", "", "B", "true", "left", "2"]] });
  assert.deepEqual(siteViews(a, TABS).menus, siteViews(b, TABS).menus);
});
