import test from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./pg.mjs";

const TABLES = [
  "departments", "site_categories", "subjects", "subject_departments", "subject_weeks",
  "instructors", "instructor_departments", "instructor_subjects", "curriculum_sets",
  "instructor_curricula", "roadmap_tracks", "roadmap_steps", "roadmap_step_subjects",
  "course_prep_items", "seminars", "seminar_applications", "recruitment_posts",
  "main_media", "menus", "loading_items", "site_settings", "site_snapshots",
];

test("콘텐츠 테이블이 모두 만들어진다", async () => {
  const db = await freshDb();
  const { rows } = await db.query(`select table_name from information_schema.tables where table_schema='public'`);
  const names = rows.map(r => r.table_name);
  for (const t of TABLES) assert.ok(names.includes(t), t);
});

test("강사 커리큘럼 상태는 approved/pending만", async () => {
  const db = await freshDb();
  await db.exec(`insert into curriculum_sets(name) values ('x');
                 insert into instructors(name) values ('강사');
                 insert into subjects(name) values ('포토샵');`);
  await assert.rejects(db.query(
    `insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, status)
     select s.id, i.id, j.id, '1주차', 'live' from curriculum_sets s, instructors i, subjects j`), /check/);
});

test("동명이인 강사를 허용한다", async () => {
  const db = await freshDb();
  await db.query(`insert into instructors(name) values ('김민주'), ('김민주')`);
  assert.equal((await db.query(`select count(*)::int c from instructors`)).rows[0].c, 2);
});

test("메뉴 위치는 left/right만", async () => {
  const db = await freshDb();
  await assert.rejects(db.query(`insert into menus(name, side) values ('전체 수업', 'center')`));
});

test("'시트에서 가져오기' 함수는 전환 뒤 없앴다", async () => {
  const db = await freshDb();
  const { rows } = await db.query(`select 1 from pg_proc where proname = 'comsw_import'`);
  assert.equal(rows.length, 0);
});
