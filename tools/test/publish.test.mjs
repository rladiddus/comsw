import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, seeded, as } from "./pg.mjs";
import { FIXTURE_MENU_NAMES_IN_ORDER } from "./fixtures.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const TEACHER = { sub: "t", role: "authenticated", comsw_role: "teacher" };

async function published() {
  const db = await seeded();
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, "anon");
  return db;
}
const sheet = async (db, source, name) =>
  (await db.query(`select * from comsw_site_rows($1, $2)`, [source, name])).rows;

test("스냅샷이 없으면 공개 함수는 빈 결과", async () => {
  const db = await freshDb();
  await as(db, "anon");
  assert.equal((await sheet(db, "main", "로드맵")).length, 0);
});

test("익명과 선생님은 적용할 수 없다", async () => {
  const db = await seeded();
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_publish()`));
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_publish()`), /적용 권한이 없습니다/);
});

test("익명·관리자는 공개 전 데이터를 직접 뽑거나 소유자용 적용을 쓸 수 없다", async () => {
  const db = await seeded();
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_build_rows()`));
  await as(db, "authenticated", ADMIN);
  await assert.rejects(db.query(`select comsw_publish_as_owner()`));
});

test("관리자가 적용하면 익명이 시트 모양으로 읽는다", async () => {
  const db = await published();
  const menu = await sheet(db, "main", "메인 페이지");
  assert.equal(menu[0].row_number, 2);
  assert.deepEqual(menu.map(r => r.data.values[4]).filter(Boolean), FIXTURE_MENU_NAMES_IN_ORDER);
  assert.deepEqual(menu[0].data.values.slice(0, 8), ["video.mp4", "캡션", "true", "", "전체 수업", "true", "왼쪽", "1"]);
  assert.equal(menu[0].data.values[9], "logo-url");
  const vac = menu.find(r => r.data.values[4] === "방학 특강").data.values;
  assert.deepEqual([vac[8], vac[9]], ["2026년 여름방학특강", "vac-bg"]);
});

test("방학 특강이 유일한 메뉴여도 로고와 같은 행을 쓰지 않는다", async () => {
  const db = await seeded();
  await db.exec(`delete from menus where name <> '방학 특강'`);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, "anon");
  const rows = await sheet(db, "main", "메인 페이지");
  assert.equal(rows[0].data.values[9], "logo-url");
  assert.equal(rows.find(r => r.data.values[4] === "방학 특강").data.values[9], "vac-bg");
});

test("전체수업 행은 주차·학과·카테고리를 같은 행 번호에 나란히 놓는다", async () => {
  const db = await published();
  const rows = (await sheet(db, "main", "컴수원_전체수업")).map(r => r.data.values);
  assert.equal(rows.length, 4); // 주차 3, 학과 4, 카테고리 2 → 4행
  assert.deepEqual(rows[0].slice(1, 12), ["시각편집, 웹", "포토샵", "1주차", "작성1", "요약1", "1개월", "img1", "", "01 기초", "Photoshop", "★★"]);
  assert.deepEqual([rows[0][14], rows[0][15], rows[0][16], rows[0][17], rows[0][20], rows[0][22], rows[0][23]],
    ["시각편집학과", "p-sigak", "true", "시각 설명", "VISUAL EDITING", "커리큘럼", "true"]);
  assert.equal(rows[2][1], "CG");
  assert.deepEqual([rows[3][2], rows[3][14], rows[3][16]], ["", "0", "false"]);
});

test("주차가 없는 전체수업 과목도 과목 요약 행을 남긴다", async () => {
  const db = await seeded();
  await db.exec(`delete from subject_weeks where subject_id = (select id from subjects where name = '마야')`);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, "anon");
  const maya = (await sheet(db, "main", "컴수원_전체수업")).map(r => r.data.values).find(v => v[2] === "마야");
  assert.deepEqual([maya[3], maya[6], maya[10]], ["", "2개월", "Maya"]);
});

test("로드맵·준비물·강사·특강·강사 커리큘럼·채용 배치", async () => {
  const db = await published();
  const road = (await sheet(db, "main", "로드맵")).map(r => r.data.values);
  assert.deepEqual(road.slice(0, 3).map(v => v.slice(0, 3)),
    [["웹학과", "포토샵, 마야", "웹1"], ["웹학과", "원문1", "원문2"], ["웹학과", "요약1", "요약2"]]);
  assert.equal(road[3][0], "사무 자격증");

  const prep = (await sheet(db, "main", "수업별 준비물(AI/교재 등)")).map(r => r.data.values);
  assert.deepEqual(prep[1], ["포토샵", "교재명", "멘토 포토샵 2", "", "", ""]);
  assert.equal(prep[2][1], "AI 툴");

  const inst = (await sheet(db, "main", "강사페이지")).map(r => r.data.values);
  assert.equal(inst.length, 2); // 숨김 강사(조해리) 제외
  assert.deepEqual(inst[0], ["김민주", "시각편집학과", "포토샵, 일러스트", "경력1", "한마디1", "photo1", "", "여자"]);

  const sem = (await sheet(db, "main", "특강 및 세미나")).map(r => r.data.values);
  assert.deepEqual(sem[0], ["poster", "AI 특강", "소주제", "2026년 8월 18일 14:00-16:00", "홍강사", "F강의장", "25", "2"]);

  const web = (await sheet(db, "instructor_curriculum", "웹학과")).map(r => r.data.values);
  assert.deepEqual(web.map(v => [v[0], v[1], v[2], v[4]]), [["김민주", "웹1", "1주차", "정리w1"], ["김민주", "웹1", "2주차", "정리w2"], ["조해리", "웹1", "1주차", "정리j1"]]);
  const vac = (await sheet(db, "instructor_curriculum", "2026년 여름방학특강")).map(r => r.data.values);
  assert.deepEqual(vac[0].slice(6), ["교재", "멘토 포토샵", "2시간 X 10일"]);

  const job = (await sheet(db, "recruitment", "웹학과")).map(r => r.data.values);
  assert.equal(job[0].length, 14);
  assert.equal(job[0][12], "https://job");
});

test("과목 순서 번호가 겹쳐도 과목별 주차가 섞이지 않는다", async () => {
  const db = await seeded();
  await db.exec(`update subjects set sort_order = 0 where sort_order is not null`);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, "anon");
  const names = (await sheet(db, "main", "컴수원_전체수업")).map(r => r.data.values[2]).filter(Boolean);
  const runs = names.filter((n, i) => n !== names[i - 1]);
  assert.equal(runs.length, new Set(names).size);
});

test("선생님의 pending 커리큘럼은 공개되지 않는다", async () => {
  const db = await seeded();
  await db.exec(`update instructor_curricula set status = 'pending' where summary = '정리w2'`);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, "anon");
  assert.equal((await sheet(db, "instructor_curriculum", "웹학과")).length, 2);
});

test("신청자 이름·연락처는 스냅샷 어디에도 없다", async () => {
  const db = await seeded();
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  const text = (await db.query(`select rows::text t from site_snapshots`)).rows[0].t;
  assert.ok(!text.includes("010-1111-2222"));
  assert.ok(!text.includes("김철수"));
});

test("적용은 매번 새 스냅샷을 만들고 공개 함수는 최신을 쓴다", async () => {
  const db = await seeded();
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await db.exec(`update subjects set name = '포토샵 기초' where name = '포토샵'`);
  const id2 = (await db.query(`select comsw_publish() id`)).rows[0].id;
  assert.equal(Number(id2), 2);
  await as(db, "anon");
  const rows = (await sheet(db, "main", "컴수원_전체수업")).map(r => r.data.values);
  assert.equal(rows[0][2], "포토샵 기초");
});
