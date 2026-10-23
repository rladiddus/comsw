// 신규 과목: 첫 승인 때 전체수업 맨 뒤로. 마지막 학과에서 빼면 기타 과목(순서 없음)으로.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: [d1] } = await db.query(`select id from departments order by sort_order limit 1`);
  const { rows: [d2] } = await db.query(`select id from departments order by sort_order offset 1 limit 1`);
  const { rows: [s] } = await db.query(`insert into subjects(name) values ('새 과목') returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, d1.id]);
  return { db, subjectId: s.id, d1: d1.id, d2: d2.id };
}
const orderOf = async (db, id) => {
  await as(db, null);
  return (await db.query(`select sort_order from subjects where id = $1`, [id])).rows[0].sort_order;
};

test("신규 과목은 첫 커리큘럼 승인 때 전체수업 맨 뒤에 들어가고, 이미 순서가 있으면 그대로", async () => {
  const { db, subjectId } = await setup();
  const { rows: [{ max }] } = await db.query(`select max(sort_order) from subjects`);
  const { rows: [c] } = await db.query(`
    insert into instructor_curricula (set_id, instructor_id, subject_id, step_label, status)
    select (select id from curriculum_sets limit 1), (select id from instructors limit 1), $1, '1단계', 'pending' returning id`, [subjectId]);
  assert.equal(await orderOf(db, subjectId), null);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [c.id]);
  assert.equal(await orderOf(db, subjectId), max + 1);
});

test("학과 하나에서 빼면 그대로, 마지막 학과에서까지 빼면 기타 과목(순서 없음)", async () => {
  const { db, subjectId, d1, d2 } = await setup();
  await db.query(`update subjects set sort_order = 99 where id = $1`, [subjectId]);
  await db.query(`insert into subject_departments values ($1, $2)`, [subjectId, d2]);
  await as(db, "authenticated", ADMIN);
  await db.query(`delete from subject_departments where subject_id = $1 and department_id = $2`, [subjectId, d1]);
  assert.equal(await orderOf(db, subjectId), 99);
  await as(db, "authenticated", ADMIN);
  await db.query(`delete from subject_departments where subject_id = $1 and department_id = $2`, [subjectId, d2]);
  assert.equal(await orderOf(db, subjectId), null);
});
