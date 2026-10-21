import test from "node:test";
import assert from "node:assert/strict";
import { normText, truthy, splitRoadmapNames, prepCategory, splitMulti, deptKeyword } from "../migrate/normalize.mjs";
import { transform } from "../migrate/transform.mjs";
import { SAMPLE_ROWS, r } from "./fixtures.mjs";

const m = transform(SAMPLE_ROWS);
const byKey = (list, key) => list.find(x => x.key === key);
const deptName = key => byKey(m.departments, key).name;
const subjectName = key => byKey(m.subjects, key).name;
const subjectDepts = name => m.subjects.find(s => s.name === name).department_keys.map(deptName).sort();

test("normalize: 제로폭 문자 제거와 체크박스 판정", () => {
  assert.equal(normText("​ 포토샵 "), "포토샵");
  for (const v of [true, "TRUE", "y", "Yes", "1", "checked"]) assert.equal(truthy(v), true, String(v));
  for (const v of [false, "false", "", null, "0"]) assert.equal(truthy(v), false, String(v));
  assert.deepEqual(splitRoadmapNames("포토샵, 일러스트\n포토샵 / 웹1"), ["포토샵", "일러스트", "웹1"]);
  assert.deepEqual(splitMulti("시각편집학과, AI학과;웹학과"), ["시각편집학과", "AI학과", "웹학과"]);
  assert.equal(deptKeyword("CG학과"), "CG");
  assert.equal(prepCategory("AI 툴"), "ai");
  assert.equal(prepCategory("교재"), "textbook");
  assert.equal(prepCategory("준비물"), "supply");
  assert.equal(prepCategory("기타"), null);
});

test("학과: O 첫 등장 순서, Q로 활성, 첫 U, 드라이브 폴더", () => {
  assert.deepEqual(m.departments.map(d => [d.name, d.is_active]), [["시각편집학과", true], ["웹학과", true], ["CG학과", true], ["0", false]]);
  assert.equal(m.departments[0].name_en, "VISUAL EDITING");
  assert.equal(m.departments[0].drive_folder_id, "fid-sigak");
  assert.equal(m.departments[2].drive_folder_id, null);
  assert.deepEqual(m.categories.map(c => [c.name, c.is_active]), [["커리큘럼", true], ["수강후기", false]]);
});

test("과목의 학과 연결은 B에 학과 키워드가 포함되는지로 정한다", () => {
  assert.deepEqual(subjectDepts("포토샵"), ["시각편집학과", "웹학과"]);
  assert.deepEqual(subjectDepts("마야"), ["CG학과"]);
});

test("과목: 전체수업 순서 + 다른 시트에만 있는 과목은 순서 없음", () => {
  const ps = m.subjects.find(s => s.name === "포토샵");
  assert.equal(ps.sort_order, 0);
  assert.equal(ps.duration, "1개월");
  assert.equal(ps.level, "★★");
  for (const n of ["웹1", "일러스트", "컴퓨터 기초", "캐드", "포토샵1"])
    assert.equal(m.subjects.find(s => s.name === n)?.sort_order, null, n);
  assert.equal(m.weeks.length, 3);
  assert.deepEqual(m.weeks.filter(w => subjectName(w.subject_key) === "포토샵").map(w => [w.week_label, w.summary, w.image_url]),
    [["1주차", "요약1", "img1"], ["2주차", "요약2", "img2"]]);
});

test("동명이인 강사는 탭 학과로 구분한다", () => {
  const ic = m.instructor_curricula.find(c => c.summary === "정리w1");
  const inst = byKey(m.instructors, ic.instructor_key);
  assert.deepEqual(inst.department_keys.map(deptName), ["웹학과"]);
  assert.deepEqual(m.warnings, []);
});

test("강사 커리큘럼은 A·B 빈칸을 윗줄에서 이어받는다", () => {
  const a = m.instructor_curricula.find(c => c.summary === "정리w1");
  const b = m.instructor_curricula.find(c => c.summary === "정리w2");
  assert.equal(b.instructor_key, a.instructor_key);
  assert.equal(b.subject_key, a.subject_key);
  assert.equal(b.status, "approved");
});

test("강사페이지에 없는 커리큘럼 강사는 숨김 강사로 만든다", () => {
  assert.equal(m.instructors.find(i => i.name === "조해리").is_listed, false);
  assert.equal(m.instructors.filter(i => i.name === "김민주").length, 2);
});

test("방학 탭은 준비물·시간을 담고 학과가 없다", () => {
  const set = m.curriculum_sets.find(s => s.name === "2026년 여름방학특강");
  assert.equal(set.department_key, null);
  const v = m.instructor_curricula.find(c => c.set_key === set.key);
  assert.deepEqual([v.supplies, v.supplies_detail, v.class_time], ["교재", "멘토 포토샵", "2시간 X 10일"]);
  assert.ok(!m.curriculum_sets.some(s => s.name === "전체학과별 과목"));
});

test("로드맵은 연속 묶음 3행을 이름·원문·요약으로 읽는다", () => {
  const [web, office] = m.roadmap_tracks;
  assert.equal(deptName(web.department_key), "웹학과");
  assert.deepEqual(web.steps.map(s => [s.position, s.source_text, s.summary, s.subject_keys.map(subjectName)]),
    [[1, "원문1", "요약1", ["포토샵", "마야"]], [2, "원문2", "요약2", ["웹1"]]]);
  assert.equal(office.department_key, null);
});

test("준비물은 A·B를 이어받고 알 수 없는 분류는 건너뛴다", () => {
  assert.deepEqual(m.prep.map(p => [subjectName(p.subject_key), p.category, p.content, p.extra]),
    [["포토샵", "textbook", "멘토 포토샵", "28,000원"], ["포토샵", "textbook", "멘토 포토샵 2", ""], ["캐드", "ai", "ChatGPT, Claude", "설명"]]);
});

test("신청자는 '특강 신청자 명단' 시트에서만 가져온다 (사이트의 신청 수와 같게)", () => {
  assert.deepEqual(m.applications.map(a => a.name).sort(), ["김철수", "홍길동"]);
  assert.equal(m.seminars[0].capacity, 25);
});

test("메인: 미디어, 메뉴 위치·순서, 로고와 방학 특강 설정", () => {
  assert.deepEqual(m.media.map(x => [x.url, x.is_active]), [["video.mp4", true]]);
  assert.deepEqual(m.menus.map(x => [x.name, x.side, x.sort_order]),
    [["전체 수업", "left", 1], ["학과별 자료", "right", 999], ["방학 특강", "left", 3]]);
  assert.equal(m.settings.roadmap_logo_url, "logo-url");
  assert.equal(byKey(m.curriculum_sets, m.settings.vacation_set_key).name, "2026년 여름방학특강");
  assert.equal(m.settings.vacation_background_url, "vac-bg");
  assert.deepEqual(m.loading.map(x => [x.image_url, x.is_active, x.font_family]), [["loading-img", false, "Great Vibes"]]);
});

test("채용 공고는 탭 학과에 14칸 그대로", () => {
  assert.equal(m.recruitment.length, 1);
  assert.equal(deptName(m.recruitment[0].department_key), "웹학과");
  assert.equal(m.recruitment[0].fields.length, 14);
  assert.equal(m.recruitment[0].fields[0], "회사");
});

test("특강명이 없는 신청자와 없는 학과명은 경고로 남긴다", () => {
  const w = transform([...SAMPLE_ROWS,
    r("main", "특강 신청자 명단", 9, ["없는 특강", "누구", "010-9999-9999"]),
    r("main", "강사페이지", 9, ["박강사", "없는학과", "포토샵"])]).warnings;
  assert.ok(w.some(x => x.includes("없는 특강")));
  assert.ok(w.some(x => x.includes("없는학과")));
});

test("같은 이름 강사가 여럿인데 탭 학과로 못 고르면 어느 쪽에도 붙이지 않고 숨김 강사로 분리 + 경고", () => {
  const m2 = transform([...SAMPLE_ROWS,
    r("instructor_curriculum", "CG학과", 2, ["김민주", "마야", "1주차", "", "x", ""]),
    r("instructor_curriculum", "CG학과", 3, ["", "", "2주차", "", "y", ""])]);
  const kims = m2.instructors.filter(i => i.name === "김민주");
  assert.equal(kims.length, 3);
  const hidden = kims.find(i => !i.is_listed);
  const rows = m2.instructor_curricula.filter(c => c.summary === "x" || c.summary === "y");
  assert.deepEqual(rows.map(c => c.instructor_key), [hidden.key, hidden.key]);
  assert.equal(m2.warnings.filter(x => x.includes("김민주")).length, 1);
});
