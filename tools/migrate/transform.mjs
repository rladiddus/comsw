import { normText as T, truthy, deptKeyword, splitMulti, splitRoadmapNames, prepCategory } from "./normalize.mjs";

const PREP_SHEETS = ["수업별 준비물(AI/교재 등)", "수업별 준비몰(AI/교재 등)"];
// 사이트의 신청 수(H열)는 이 시트만 센다. 예전 '특강 신청' 시트 포함 여부는 사용자 확인 대기.
const APPLY_SHEETS = ["특강 신청자 명단"];
const IC_HELPER_TAB = "전체학과별 과목";

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

export function transform(rawRows) {
  const warnings = [];
  const sheet = (source, name) => rawRows
    .filter(x => x.source_id === source && x.sheet_name === name)
    .sort((a, b) => a.row_number - b.row_number);
  const values = (source, name) => sheet(source, name).map(x => x.data?.values || []);
  const tabs = source => [...new Set(rawRows.filter(x => x.source_id === source).map(x => x.sheet_name))];

  // 학과·카테고리 (전체수업 옆 표)
  const curriculum = values("main", "컴수원_전체수업");
  const helperRows = sheet("instructor_curriculum", IC_HELPER_TAB);
  const folderHeaders = (helperRows[0]?.data?.headers || []).map(T);
  const folderRow = helperRows[0]?.data?.values || [];
  const departments = [];
  for (const v of curriculum) {
    const name = T(v[14]);
    if (!name || departments.some(d => d.name === name)) continue;
    const col = folderHeaders.indexOf(name);
    departments.push({
      key: `d:${name}`, name, sort_order: departments.length,
      name_en: T(curriculum.find(x => T(x[14]) === name && T(x[20]))?.[20]),
      description: T(v[17]), image_url: T(v[15]), is_active: truthy(v[16]),
      drive_folder_id: col >= 0 ? T(folderRow[col]) || null : null,
    });
  }
  const deptByName = name => departments.find(d => d.name === T(name));

  const categories = [];
  for (const v of curriculum) {
    const name = T(v[22]);
    if (name && !categories.some(c => c.name === name))
      categories.push({ key: `c:${name}`, name, is_active: truthy(v[23]), sort_order: categories.length });
  }

  // 과목 (전체수업 순서가 우선, 다른 시트에만 있는 이름은 순서 없음)
  const subjects = [];
  const subjectKey = (name, fields) => {
    const n = T(name);
    let s = subjects.find(x => x.name === n);
    if (!s) {
      s = { key: `s:${n}`, name: n, duration: "", dept_curriculum: "", program: "", level: "", sort_order: null, department_keys: [] };
      subjects.push(s);
    }
    if (fields && s.sort_order === null) Object.assign(s, fields);
    return s.key;
  };
  let order = 0;
  const weeks = [];
  for (const v of curriculum) {
    const name = T(v[2]);
    if (!name) continue;
    const known = subjects.find(x => x.name === name && x.sort_order !== null);
    const key = subjectKey(name, known ? null : {
      sort_order: order++, duration: T(v[6]), dept_curriculum: T(v[9]), program: T(v[10]), level: T(v[11]),
      department_keys: departments.filter(d => T(v[1]).includes(deptKeyword(d.name))).map(d => d.key),
    });
    if (T(v[3])) weeks.push({
      subject_key: key, week_label: T(v[3]), written: T(v[4]), summary: T(v[5]), image_url: T(v[7]),
      sort_order: weeks.filter(w => w.subject_key === key).length,
    });
  }

  // 강사 (강사페이지 행마다 한 명 — 동명이인 허용)
  const instructors = [];
  for (const x of sheet("main", "강사페이지")) {
    const v = x.data?.values || [];
    const name = T(v[0]);
    if (!name) continue;
    const department_keys = [];
    for (const d of splitMulti(v[1])) {
      const dept = deptByName(d);
      if (dept) department_keys.push(dept.key);
      else warnings.push(`강사페이지 ${name}: 없는 학과 '${d}'`);
    }
    instructors.push({
      key: `i:${x.row_number}`, name, gender: T(v[7]), career: T(v[3]), message: T(v[4]), photo_url: T(v[5]),
      is_listed: true, sort_order: instructors.length, department_keys,
      subject_keys: splitMulti(v[2]).map(s => subjectKey(s)),
    });
  }

  // 강사별 커리큘럼 탭
  const curriculum_sets = [];
  const instructor_curricula = [];
  for (const tab of tabs("instructor_curriculum").filter(t => t !== IC_HELPER_TAB)) {
    const set = { key: `set:${tab}`, name: tab, department_key: deptByName(tab)?.key ?? null, sort_order: curriculum_sets.length };
    curriculum_sets.push(set);
    forwardFill(values("instructor_curriculum", tab), [0, 1]).forEach(v => {
      if (!T(v[2])) return;
      instructor_curricula.push({
        set_key: set.key, instructor_key: matchInstructor(T(v[0]), set), subject_key: subjectKey(v[1]),
        step_label: T(v[2]), written: T(v[3]), summary: T(v[4]), media_url: T(v[5]),
        supplies: T(v[6]), supplies_detail: T(v[7]), class_time: T(v[8]), status: "approved",
        sort_order: instructor_curricula.filter(c => c.set_key === set.key).length,
      });
    });
  }
  function matchInstructor(name, set) {
    const listed = instructors.filter(i => i.name === name && i.is_listed);
    if (listed.length === 1) return listed[0].key;
    if (listed.length > 1) {
      const hit = listed.find(i => set.department_key && i.department_keys.includes(set.department_key));
      if (hit) return hit.key;
      // 동명이인 누구에게도 맞지 않으면 엉뚱한 사람에게 붙이지 않고 따로 둔다 (관리 화면에서 담당자 지정).
      warnings.push(`강사 커리큘럼 '${set.name}' 탭의 ${name}: 동명이인 중 학과로 구분 불가, 숨김 강사로 분리`);
    }
    const key = `i:hidden:${name}`;
    if (!instructors.some(i => i.key === key)) instructors.push({
      key, name, gender: "", career: "", message: "", photo_url: "", is_listed: false,
      sort_order: instructors.length, department_keys: set.department_key ? [set.department_key] : [], subject_keys: [],
    });
    return key;
  }

  // 로드맵: A가 연속으로 같은 3행 묶음 (1행 과목명, 2행 원문, 3행 요약)
  const roadmap_tracks = [];
  let group = null;
  for (const v of values("main", "로드맵")) {
    const name = T(v[0]);
    if (!name) continue;
    if (!group || group.name !== name) {
      group = { name, rows: [] };
      roadmap_tracks.push(group);
    }
    group.rows.push(v);
  }
  roadmap_tracks.forEach((g, i) => {
    const [names = [], source = [], summary = []] = g.rows;
    g.key = `t:${i}`;
    g.department_key = deptByName(g.name)?.key ?? null;
    g.sort_order = i;
    g.steps = [];
    names.forEach((cell, col) => {
      if (col === 0 || !T(cell)) return;
      g.steps.push({
        position: col, source_text: T(source[col]), summary: T(summary[col]),
        subject_keys: splitRoadmapNames(cell).map(n => subjectKey(n)),
      });
    });
    delete g.rows;
  });

  // 준비물
  const prepSheet = PREP_SHEETS.find(n => sheet("main", n).length) ?? PREP_SHEETS[0];
  const prep = [];
  forwardFill(values("main", prepSheet), [0, 1]).forEach(v => {
    const category = prepCategory(v[1]);
    if (!T(v[0]) || !category || [2, 3, 4, 5].every(c => !T(v[c]))) return;
    prep.push({
      subject_key: subjectKey(v[0]), category, content: T(v[2]), link_url: T(v[3]), image_url: T(v[4]), extra: T(v[5]),
      sort_order: prep.length,
    });
  });

  // 특강과 신청자
  const seminars = [];
  for (const v of values("main", "특강 및 세미나")) {
    const title = T(v[1]);
    if (!title || seminars.some(s => s.title === title)) continue;
    const cap = Number.parseInt(T(v[6]), 10);
    seminars.push({
      key: `sem:${title}`, title, poster_url: T(v[0]), subtitle: T(v[2]), datetime_text: T(v[3]),
      instructor: T(v[4]), place: T(v[5]), capacity: Number.isFinite(cap) ? cap : null, sort_order: seminars.length,
    });
  }
  const applications = [];
  for (const name of APPLY_SHEETS) for (const v of values("main", name)) {
    const [title, person, phone] = [T(v[0]), T(v[1]), T(v[2])];
    if (!title) continue;
    const sem = seminars.find(s => s.title === title);
    if (!sem) { warnings.push(`신청자: 없는 특강 '${title}'`); continue; }
    if (!applications.some(a => a.seminar_key === sem.key && a.name === person && a.phone === phone))
      applications.push({ seminar_key: sem.key, name: person, phone });
  }

  // 채용 (탭 = 학과)
  const recruitment = [];
  for (const tab of tabs("recruitment")) {
    const dept = deptByName(tab);
    if (!dept) { warnings.push(`채용: 없는 학과 탭 '${tab}'`); continue; }
    for (const v of values("recruitment", tab)) {
      const fields = Array.from({ length: 14 }, (_, i) => T(v[i]));
      if (fields.some(Boolean)) recruitment.push({ department_key: dept.key, fields, sort_order: recruitment.length });
    }
  }

  // 메인 페이지·로딩
  const main = values("main", "메인 페이지");
  const media = main.filter(v => T(v[0])).map((v, i) => ({ url: T(v[0]), caption: T(v[1]), is_active: truthy(v[2]), sort_order: i }));
  const menus = main.filter(v => T(v[4])).map(v => {
    const side = ["왼쪽", "left", "l"].includes(T(v[6]).toLowerCase()) ? "left" : "right";
    const n = Number(T(v[7]));
    return { name: T(v[4]), is_active: truthy(v[5]), side, sort_order: T(v[7]) && Number.isFinite(n) ? n : 999 };
  });
  const loading = values("main", "로딩 중").filter(v => T(v[0])).map((v, i) => ({
    image_url: T(v[0]), text: T(v[1]), is_active: truthy(v[2]), font_family: T(v[3]), font_size: T(v[4]), font_weight: T(v[5]), sort_order: i,
  }));
  const vacationRow = main.find(v => T(v[4]).replace(/\s+/g, "") === "방학특강");
  const vacationSet = vacationRow ? curriculum_sets.find(s => s.name === T(vacationRow[8])) : null;
  if (vacationRow && !vacationSet) warnings.push(`메인 페이지 방학 특강: 없는 시트 '${T(vacationRow[8])}'`);
  const settings = {
    roadmap_logo_url: T(main[0]?.[9]),
    vacation_set_key: vacationSet?.key ?? null,
    vacation_background_url: vacationRow ? T(vacationRow[9]) : "",
  };

  return {
    departments, categories, subjects, weeks, instructors, curriculum_sets, instructor_curricula,
    roadmap_tracks, prep, seminars, applications, recruitment, media, menus, loading, settings,
    warnings: [...new Set(warnings)],
  };
}
