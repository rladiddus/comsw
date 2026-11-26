// 홈페이지 로드맵(PC·태블릿): 한 단계 이름 합치기, 글이 길면 행이 늘어남(잘리지 않음)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const page of ["roadmap.html", "roadmap_tablet.html"]) {
  const html = readFileSync(new URL(`../../${page}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  test(`${page}: 이름 끝 숫자·범위만 다른 과목은 한 이름으로`, () => {
    const pick = (name) => html.match(new RegExp(`    function ${name}\\([\\s\\S]*?\\n    }\\n`))[0];
    const split = new Function(`${pick("splitSubjectNames")}${pick("splitNumberedSequence")}${pick("mergeNumberedSubjectNames")}return splitSubjectNames;`)();
    assert.deepEqual(split("디지털 드로잉 1~2, 디지털 드로잉 3~4"), ["디지털 드로잉 1~4"]);
    assert.deepEqual(split("디지털 드로잉 5~6, 디지털 드로잉 7~12"), ["디지털 드로잉 5~12"]);
    assert.deepEqual(split("캐드1, 캐드2"), ["캐드 1~2"]);
    assert.deepEqual(split("캐드 1~2"), ["캐드 1~2"], "하나면 적힌 그대로");
    assert.deepEqual(split("CG5"), ["CG5"]);
    assert.deepEqual(split("AI포토샵, AI일러스트"), ["AI포토샵", "AI일러스트"]);
  });
  test(`${page}: 과목명·설명을 높이로 자르지 않고 행 높이를 맞춤`, () => {
    const css = (sel) => html.match(new RegExp(`\\n    ${sel.replace(".", "\\.")} \\{([^}]*)\\}`))[1];
    assert.match(css(".subject-box"), /min-height: 89px/);
    assert.doesNotMatch(css(".subject-name"), /max-height|overflow/);
    assert.match(css(".subject-name"), /flex-shrink: 0/);
    assert.doesNotMatch(css(".subject-summary"), /max-height|overflow/);
    assert.match(html, /fitRowHeights\(\);/);
  });
}
