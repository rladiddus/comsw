// 공개 사이트가 각 시트에서 실제로 읽어 쓰는 내용만 뽑는다 (배치·표기 차이는 무시).
import { normText as T, truthy, deptKeyword, splitMulti, splitRoadmapNames, prepCategory } from "./normalize.mjs";

const PREP_SHEETS = ["수업별 준비물(AI/교재 등)", "수업별 준비몰(AI/교재 등)"];

const side = v => (["왼쪽", "left", "l"].includes(T(v).toLowerCase()) ? "left" : "right");
const order = v => (T(v) && Number.isFinite(Number(T(v))) ? Number(T(v)) : 999);
const trimTail = cells => {
  const out = [...cells];
  while (out.length && (Array.isArray(out.at(-1)) ? !out.at(-1).length : !out.at(-1))) out.pop();
  return out;
};
function forwardFill(rows, cols) {
  const last = {};
  return rows.map(v => {
    const out = [...v];
    for (const c of cols) {
      if (T(out[c])) last[c] = out[c];
      else out[c] = last[c] ?? "";
    }
    return out;
  });
}

export function siteViews(get, tabs) {
  const main = get("main", "메인 페이지");
  const media = main.filter(v => T(v[0]) && truthy(v[2])).map(v => [T(v[0]), T(v[1])]);
  const menus = main.filter(v => T(v[4]))
    .map(v => [T(v[4]), truthy(v[5]), side(v[6]), order(v[7])])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const vacationRow = main.find(v => T(v[4]).replace(/\s+/g, "") === "방학특강");

  const loading = get("main", "로딩 중").filter(v => T(v[0]) && truthy(v[2]))
    .map(v => [T(v[0]), T(v[1]), T(v[3]), T(v[4]), T(v[5])]);

  const cur = get("main", "컴수원_전체수업");
  const depts = [];
  for (const v of cur) {
    const name = T(v[14]);
    if (name && truthy(v[16]) && !depts.some(d => d[0] === name)) depts.push([name, T(v[15]), T(v[17])]);
  }
  const deptEnglish = {};
  for (const v of cur) if (T(v[14]) && T(v[20]) && !(T(v[14]) in deptEnglish)) deptEnglish[T(v[14])] = T(v[20]);
  const categories = [...new Set(cur.filter(v => T(v[22]) && truthy(v[23])).map(v => T(v[22])))];
  const deptWeeks = Object.fromEntries(depts.map(([name]) => [name,
    cur.filter(v => T(v[1]).includes(deptKeyword(name)) && T(v[2]) && T(v[3])).map(v => [T(v[2]), T(v[3]), T(v[5]), T(v[7])])]));
  const subjectSummary = {};
  for (const v of cur) if (T(v[2]) && !(T(v[2]) in subjectSummary)) subjectSummary[T(v[2])] = [T(v[6]), T(v[9]), T(v[10]), T(v[11])];

  const roadmap = [];
  let group = null;
  for (const v of get("main", "로드맵")) {
    const name = T(v[0]);
    if (!name) continue;
    if (!group || group.name !== name) roadmap.push(group = { name, rows: [] });
    group.rows.push(v);
  }
  // roadmap.html은 1행에 과목이 있는 칸의 원문·요약만 보여준다.
  const roadmapView = roadmap.map(g => {
    const names = (g.rows[0] || []).slice(1).map(splitRoadmapNames);
    const cells = row => names.map((n, i) => (n.length ? T((row || [])[i + 1]) : ""));
    return [g.name, trimTail(names), trimTail(cells(g.rows[1])), trimTail(cells(g.rows[2]))];
  });

  const prepName = PREP_SHEETS.find(n => get("main", n).length) ?? PREP_SHEETS[0];
  const prep = forwardFill(get("main", prepName), [0, 1])
    .filter(v => T(v[0]) && prepCategory(v[1]) && [2, 3, 4, 5].some(c => T(v[c])))
    .map(v => [T(v[0]), prepCategory(v[1]), T(v[2]), T(v[3]), T(v[4]), T(v[5])]);

  const instructors = get("main", "강사페이지").filter(v => T(v[0]))
    .map(v => [T(v[0]), splitMulti(v[1]).sort(), splitMulti(v[2]), T(v[3]), T(v[4]), T(v[5]), T(v[7])]);

  const curricula = Object.fromEntries(tabs.instructor_curriculum.map(tab => [tab,
    forwardFill(get("instructor_curriculum", tab), [0, 1]).filter(v => T(v[2]))
      .map(v => [T(v[0]), T(v[1]), T(v[2]), T(v[4]), T(v[5]), T(v[7]), T(v[8])])]));

  const recruitment = Object.fromEntries(tabs.recruitment.map(tab => [tab,
    get("recruitment", tab).map(v => Array.from({ length: 14 }, (_, i) => T(v[i]))).filter(f => f.some(Boolean))]));

  const seminarRows = get("main", "특강 및 세미나").filter(v => T(v[1]));
  const seminars = seminarRows.map(v => [T(v[0]), T(v[1]), T(v[2]), T(v[3]), T(v[4]), T(v[5]), T(v[6])]);
  const seminarApplied = Object.fromEntries(seminarRows.map(v => [T(v[1]), Number(T(v[7])) || 0]));

  return {
    media, menus, logo: T(main[0]?.[9]), vacation: vacationRow ? [T(vacationRow[8]), T(vacationRow[9])] : null,
    loading, depts, deptEnglish, categories, deptWeeks, subjectSummary, roadmap: roadmapView, prep, instructors,
    curricula, recruitment, seminars, seminarApplied,
  };
}
