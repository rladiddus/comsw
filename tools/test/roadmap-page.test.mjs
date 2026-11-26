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
  test(`${page}: 학과 이름을 누르면 나오는 표는 학과 커리큘럼 페이지와 같은 과목(학과 구성 기준, 로드맵 단계 이름으로 찾지 않음)`, async () => {
    const pick = (name) => html.match(new RegExp(`    (?:async )?function ${name}\\([\\s\\S]*?\\n    }\\n`))[0];
    const raw = (dept, name, ord, o = "", u = "") => { const v = Array(26).fill(""); Object.assign(v, { 1: dept, 2: name, 6: "1개월", 14: o, 20: u, 25: ord }); return { values: v }; };
    const rows = [raw("", "", "", "웹학과", "WEB"), raw("웹, 시각편집", "AI포토샵", '{"웹":2}'), raw("웹", "UIUX2", '{"웹":4}'), raw("웹", "UIUX1", '{"웹":3}'), raw("시각편집", "시각편집 디자인", '{"시각편집":1}'), raw("웹", "UIUX1", '{"웹":3}')];
    const load = new Function("fetchSupabaseRowsForSheet", "CURRICULUM_SHEET_NAME", "normalizeText", "getRawValues",
      `${pick("deptOrdOf")}${pick("loadCurriculumSimpleByDeptFromSupabase")}return loadCurriculumSimpleByDeptFromSupabase;`)(
      async () => rows, "컴수원_전체수업", (v) => String(v ?? "").trim(), (r) => r.values);
    const r = await load("웹학과");
    assert.equal(r.engName, "WEB");
    assert.deepEqual(r.subjects.map((s) => s.name), ["AI포토샵", "UIUX1", "UIUX2"], "학과 구성 순서, 한 번씩");
    assert.ok(!html.includes("splitRoadmapSubjects"), "로드맵 단계 이름으로 찾던 옛 방식 없음");
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
