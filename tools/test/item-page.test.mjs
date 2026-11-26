// 홈페이지 수업별 준비물(PC·태블릿): 공개된 과목만, 기준 과목 이름으로 묶고 합침, 학과 순서/가나다순
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const page of ["item.html", "item_tablet.html"]) {
  const html = readFileSync(new URL(`../../${page}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const pick = (name) => html.match(new RegExp(`    function ${name}\\([\\s\\S]*?\\n    }\\n`))[0];
  const build = new Function("normalizeText", "getRawValues", "window",
    `${pick("prepBaseName")}${pick("prepTruthy")}${pick("prepDeptOrd")}${pick("publicSubjectRanks")}${pick("buildPrepView")}return buildPrepView;`)(
    (v) => String(v ?? "").trim(), (r) => r, {});
  const row = (dept, name, ord, o = "", on = "") => Object.assign(Array(26).fill(""), { 1: dept, 2: name, 14: o, 16: on, 25: ord });
  const lessons = [row("", "", "", "시각편집학과", "true"), row("", "", "", "웹학과", "true"), row("", "", "", "숨김학과", "false"),
    row("시각편집", "AI포토샵", '{"시각편집":2}'), row("시각편집", "AI웹툰1", '{"시각편집":1}'), row("시각편집", "AI웹툰2", '{"시각편집":1}'),
    row("웹", "캐드1", '{"웹":0}'), row("숨김", "비밀", "{}")];
  const it = (subject, category, content) => ({ subject, category, content });
  const items = [it("AI웹툰1", "ai", "Claude"), it("AI웹툰2", "ai", "Claude"), it("AI웹툰2", "ai", "Gemini"), it("AI포토샵", "textbook", "멘토 포토샵"),
    it("웹툰1", "ai", "Claude"), it("AI크리에이터 아트웍", "ai", "Chat GPT"), it("비밀", "textbook", "비밀 교재"), it("캐드", "textbook", "멘토 캐드")];
  test(`${page}: 공개된 과목만, 기준 이름으로 묶고 같은 것은 한 번, 학과 순서/가나다순`, () => {
    const dept = build(items, lessons, "dept");
    assert.deepEqual(dept.map((x) => `${x.subject}|${x.content}`), ["AI웹툰|Claude", "AI웹툰|Gemini", "AI포토샵|멘토 포토샵", "캐드|멘토 캐드"]);
    assert.deepEqual([...new Set(build(items, lessons, "name").map((x) => x.subject))], ["AI웹툰", "AI포토샵", "캐드"].sort((a, b) => a.localeCompare(b, "ko")));
    assert.match(html, /data-sort="dept"[\s\S]*data-sort="name"/, "학과 순서·가나다순 버튼");
  });
}
