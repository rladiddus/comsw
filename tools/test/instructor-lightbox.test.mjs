// 강사별 커리큘럼 크게 보기(PC·태블릿): 이전·다음은 누른 과목의 단계만(같은 강사의 다른 과목과 섞이지 않게)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const page of ["Curriculum_full.html", "Curriculum_full_tablet.html"]) {
  test(`${page}: 누른 과목의 단계만 넘김`, () => {
    const html = readFileSync(new URL(`../../${page}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
    const fn = html.match(/  function _showInstructorWeekLightbox\([\s\S]*?\n  }\n/)[0];
    const window = {};
    let opened = null;
    new Function("window", "openLightbox", `${fn}_showInstructorWeekLightbox(arguments[2], "포트폴리오", "2단계");`)(window, (i) => { opened = i; },
      ["포토샵", "포트폴리오", "일러스트"].flatMap((s) => [1, 2, 3, 4].map((n) => ({ subjectName: s, week: { title: `${n}단계` } }))));
    assert.deepEqual(window.flatWeeksForLightbox.map((x) => x.subjectName + x.week.title), ["포트폴리오1단계", "포트폴리오2단계", "포트폴리오3단계", "포트폴리오4단계"]);
    assert.equal(opened, 1);
  });
}
