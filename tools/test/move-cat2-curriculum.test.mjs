// CAT 2급 커리큘럼 주인 바로잡기(20261126060000): 숨김 김민주 → 남현우, 건축·기계 자격증 탭으로, 빈 기록은 보관 뒤 삭제.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, runMigration } from "./pg.mjs";

const FILE = "20261126060000_move_cat2_curriculum.sql";
const GHOST = "862978ef-f32f-4fb4-a4b8-a56254cad3a7";

async function setup({ twoNam = false, namHasCat = false } = {}) {
  const db = await freshDb(FILE);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const office = await one(`insert into departments(name) values ('사무 자격증') returning id`);
  const build = await one(`insert into departments(name) values ('건축·기계 자격증') returning id`);
  const sOffice = await one(`insert into curriculum_sets(name, department_id) values ('사무 자격증', $1) returning id`, [office]);
  const sBuild = await one(`insert into curriculum_sets(name, department_id) values ('건축·기계 자격증', $1) returning id`, [build]);
  const cat = await one(`insert into subjects(name) values ('CAT 2급') returning id`);
  await db.query(`insert into instructors(id, name, is_listed) values ($1, '김민주', false)`, [GHOST]);
  await db.query(`insert into instructor_departments(instructor_id, department_id) values ($1, $2)`, [GHOST, office]);
  const real = await one(`insert into instructors(name) values ('김민주') returning id`);
  const nam = await one(`insert into instructors(name) values ('남현우') returning id`);
  if (twoNam) await db.query(`insert into instructors(name) values ('남현우')`);
  for (const n of [1, 2, 3, 4]) await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, media_url, status, sort_order)
    values ($1, $2, $3, $4, $5, $6, 'approved', $7)`, [sOffice, GHOST, cat, `${n}단계`, `원문${n}`, `https://x/${n}.png`, n]);
  if (namHasCat) await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, status) values ($1, $2, $3, '1단계', 'approved')`, [sBuild, nam, cat]);
  await db.query(`insert into site_snapshots(published_by, rows) values ('t', comsw_build_rows())`);
  return { db, nam, real, cat, sBuild, sOffice };
}

test("숨김 김민주의 CAT 2급 4단계를 남현우 선생님·건축·기계 자격증 탭으로 옮기고 담당 과목에 넣음, 빈 숨김 기록은 보관 뒤 삭제, 다른 김민주는 그대로", async () => {
  const { db, nam, real, cat, sBuild } = await setup();
  const ids = (await db.query(`select id from instructor_curricula order by step_label`)).rows.map((r) => r.id);
  await runMigration(db, FILE);
  const rows = (await db.query(`select id, instructor_id, set_id, written, status from instructor_curricula order by step_label`)).rows;
  assert.deepEqual(rows.map((r) => r.id), ids, "같은 줄 그대로(공통 기록과 이어진 번호 유지)");
  assert.ok(rows.every((r) => r.instructor_id === nam && r.set_id === sBuild && r.status === "approved"));
  assert.equal(rows[0].written, "원문1");
  assert.equal((await db.query(`select count(*)::int n from instructor_subjects where instructor_id = $1 and subject_id = $2`, [nam, cat])).rows[0].n, 1);
  assert.equal((await db.query(`select count(*)::int n from instructors where id = $1`, [GHOST])).rows[0].n, 0, "빈 숨김 기록 삭제");
  assert.equal((await db.query(`select count(*)::int n from instructors where id = $1`, [real])).rows[0].n, 1, "다른 김민주는 그대로");
  const backup = (await db.query(`select reason from comsw_private.instructor_curricula_backup`)).rows.map((r) => r.reason);
  assert.equal(backup.length, 5, "옮기기 전 4줄 + 강사 기록 1줄 보관");
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, 2, "깨끗했으면 바로 공개");
  await runMigration(db, FILE); // 다시 실행해도 바꾸지 않음
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, 2);
});

test("남현우 선생님이 둘이거나 이미 같은 탭에 CAT 2급이 있으면 아무것도 바꾸지 않음", async () => {
  for (const opt of [{ twoNam: true }, { namHasCat: true }]) {
    const { db } = await setup(opt);
    await assert.rejects(runMigration(db, FILE), /바꾼 것 없음/);
    assert.equal((await db.query(`select count(*)::int n from instructor_curricula where instructor_id = $1`, [GHOST])).rows[0].n, 4, JSON.stringify(opt));
  }
});
